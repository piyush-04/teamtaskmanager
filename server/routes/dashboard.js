import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectMember } from "../utils/projects.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    if (!(await requireProjectMember(req.params.projectId, req.user.id, res))) {
      return;
    }

    const [
      { rows: totals },
      { rows: byStatus },
      { rows: perUser },
      { rows: overdue },
    ] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total_tasks
         FROM tasks WHERE project_id = $1`,
        [req.params.projectId],
      ),
      query(
        `SELECT status, COUNT(*)::int AS count
         FROM tasks WHERE project_id = $1
         GROUP BY status`,
        [req.params.projectId],
      ),
      query(
        `SELECT COALESCE(u.name, 'Unassigned') AS name, COUNT(t.id)::int AS count
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assigned_to
         WHERE t.project_id = $1
         GROUP BY u.name
         ORDER BY count DESC, name ASC`,
        [req.params.projectId],
      ),
      query(
        `SELECT COUNT(*)::int AS count
         FROM tasks
         WHERE project_id = $1 AND due_date < CURRENT_DATE AND status <> 'Done'`,
        [req.params.projectId],
      ),
    ]);

    res.json({
      totalTasks: totals[0].total_tasks,
      byStatus,
      perUser,
      overdueTasks: overdue[0].count,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
