import { Router } from "express";
import { z } from "zod";
import { query, transaction } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectAdmin, requireProjectMember } from "../utils/projects.js";

const router = Router();

const projectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(""),
});

const memberSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
});

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, pm.role,
        COUNT(t.id)::int AS task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'Done')::int AS done_count
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE pm.user_id = $1
       GROUP BY p.id, pm.role
       ORDER BY p.created_at DESC`,
      [req.user.id],
    );
    res.json({ projects: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = projectSchema.parse(req.body);
    const project = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO projects (name, description, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [body.name, body.description, req.user.id],
      );
      await client.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, 'Admin')`,
        [rows[0].id, req.user.id],
      );
      return rows[0];
    });

    res.status(201).json({ project: { ...project, role: "Admin" } });
  } catch (error) {
    next(error);
  }
});

router.get("/:projectId", async (req, res, next) => {
  try {
    const membership = await requireProjectMember(
      req.params.projectId,
      req.user.id,
      res,
    );
    if (!membership) return;

    const [{ rows: projectRows }, { rows: memberRows }] = await Promise.all([
      query("SELECT * FROM projects WHERE id = $1", [req.params.projectId]),
      query(
        `SELECT u.id, u.name, u.email, pm.role
         FROM project_members pm
         JOIN users u ON u.id = pm.user_id
         WHERE pm.project_id = $1
         ORDER BY pm.role, u.name`,
        [req.params.projectId],
      ),
    ]);

    res.json({
      project: { ...projectRows[0], role: membership.role },
      members: memberRows,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:projectId/members", async (req, res, next) => {
  try {
    if (!(await requireProjectAdmin(req.params.projectId, req.user.id, res))) {
      return;
    }

    const body = memberSchema.parse(req.body);
    const { rows: userRows } = await query(
      "SELECT id FROM users WHERE email = $1",
      [body.email],
    );

    if (!userRows[0]) {
      return res.status(404).json({ message: "No user found with that email" });
    }

    await query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'Member')
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [req.params.projectId, userRows[0].id],
    );

    res.status(201).json({ message: "Member added" });
  } catch (error) {
    next(error);
  }
});

router.delete("/:projectId/members/:userId", async (req, res, next) => {
  try {
    if (!(await requireProjectAdmin(req.params.projectId, req.user.id, res))) {
      return;
    }

    if (req.params.userId === req.user.id) {
      return res.status(400).json({ message: "Admins cannot remove themselves" });
    }

    await query(
      "DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 AND role <> 'Admin'",
      [req.params.projectId, req.params.userId],
    );

    await query(
      "UPDATE tasks SET assigned_to = NULL WHERE project_id = $1 AND assigned_to = $2",
      [req.params.projectId, req.params.userId],
    );

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
