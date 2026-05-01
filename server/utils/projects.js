import { query } from "../db.js";

export async function getMembership(projectId, userId) {
  const { rows } = await query(
    "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, userId],
  );
  return rows[0] || null;
}

export async function requireProjectMember(projectId, userId, res) {
  const membership = await getMembership(projectId, userId);
  if (!membership) {
    res.status(403).json({ message: "You do not have access to this project" });
    return null;
  }
  return membership;
}

export async function requireProjectAdmin(projectId, userId, res) {
  const membership = await requireProjectMember(projectId, userId, res);
  if (!membership) return null;
  if (membership.role !== "Admin") {
    res.status(403).json({ message: "Admin access required" });
    return null;
  }
  return membership;
}
