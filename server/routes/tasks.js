import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectAdmin, requireProjectMember } from "../utils/projects.js";

const router = Router({ mergeParams: true });

const taskSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().default(""),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  priority: z.enum(["Low", "Medium", "High"]),
  assigned_to: z.string().uuid().nullable().optional(),
});

const statusSchema = z.object({
  status: z.enum(["To Do", "In Progress", "Done"]),
});

async function assigneeIsProjectMember(projectId, assigneeId) {
  if (!assigneeId) return true;
  const { rows } = await query(
    "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, assigneeId],
  );
  return Boolean(rows[0]);
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const membership = await requireProjectMember(
      req.params.projectId,
      req.user.id,
      res,
    );
    if (!membership) return;

    const params =
      membership.role === "Admin"
        ? [req.params.projectId]
        : [req.params.projectId, req.user.id];
    const filter =
      membership.role === "Admin"
        ? ""
        : "AND t.assigned_to = $2";

    const { rows } = await query(
      `SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.project_id = $1 ${filter}
       ORDER BY
        CASE t.status WHEN 'To Do' THEN 1 WHEN 'In Progress' THEN 2 ELSE 3 END,
        t.due_date ASC`,
      params,
    );
    res.json({ tasks: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!(await requireProjectAdmin(req.params.projectId, req.user.id, res))) {
      return;
    }

    const body = taskSchema.parse(req.body);
    if (!(await assigneeIsProjectMember(req.params.projectId, body.assigned_to))) {
      return res.status(400).json({ message: "Assignee must be a project member" });
    }

    const { rows } = await query(
      `INSERT INTO tasks
        (project_id, title, description, due_date, priority, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.params.projectId,
        body.title,
        body.description,
        body.due_date,
        body.priority,
        body.assigned_to || null,
        req.user.id,
      ],
    );

    res.status(201).json({ task: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/:taskId/status", async (req, res, next) => {
  try {
    const membership = await requireProjectMember(
      req.params.projectId,
      req.user.id,
      res,
    );
    if (!membership) return;

    const body = statusSchema.parse(req.body);
    const params =
      membership.role === "Admin"
        ? [body.status, req.params.projectId, req.params.taskId]
        : [body.status, req.params.projectId, req.params.taskId, req.user.id];
    const filter =
      membership.role === "Admin" ? "" : "AND assigned_to = $4";

    const { rows } = await query(
      `UPDATE tasks
       SET status = $1, updated_at = now()
       WHERE project_id = $2 AND id = $3 ${filter}
       RETURNING *`,
      params,
    );

    if (!rows[0]) {
      return res.status(403).json({
        message: "Members can update only their assigned tasks",
      });
    }

    res.json({ task: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put("/:taskId", async (req, res, next) => {
  try {
    if (!(await requireProjectAdmin(req.params.projectId, req.user.id, res))) {
      return;
    }

    const body = taskSchema.merge(statusSchema).parse(req.body);
    if (!(await assigneeIsProjectMember(req.params.projectId, body.assigned_to))) {
      return res.status(400).json({ message: "Assignee must be a project member" });
    }

    const { rows } = await query(
      `UPDATE tasks
       SET title = $1, description = $2, due_date = $3, priority = $4,
           assigned_to = $5, status = $6, updated_at = now()
       WHERE project_id = $7 AND id = $8
       RETURNING *`,
      [
        body.title,
        body.description,
        body.due_date,
        body.priority,
        body.assigned_to || null,
        body.status,
        req.params.projectId,
        req.params.taskId,
      ],
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({ task: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete("/:taskId", async (req, res, next) => {
  try {
    if (!(await requireProjectAdmin(req.params.projectId, req.user.id, res))) {
      return;
    }

    await query("DELETE FROM tasks WHERE project_id = $1 AND id = $2", [
      req.params.projectId,
      req.params.taskId,
    ]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
