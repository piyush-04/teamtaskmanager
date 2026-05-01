import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const authSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(6),
});

const signupSchema = authSchema.extend({
  name: z.string().trim().min(2).max(80),
});

function issueToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

router.post("/signup", async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [body.name, body.email, passwordHash],
    );

    res.status(201).json({ user: rows[0], token: issueToken(rows[0].id) });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = authSchema.parse(req.body);
    const { rows } = await query("SELECT * FROM users WHERE email = $1", [
      body.email,
    ]);
    const user = rows[0];
    const valid = user
      ? await bcrypt.compare(body.password, user.password_hash)
      : false;

    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at,
      },
      token: issueToken(user.id),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
