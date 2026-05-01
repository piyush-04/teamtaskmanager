import jwt from "jsonwebtoken";
import { query } from "../db.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [payload.userId],
    );

    if (!rows[0]) {
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ message: "Invalid authentication token" });
  }
}
