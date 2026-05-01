import { ZodError } from "zod";

export function notFound(req, res) {
  res.status(404).json({ message: "Route not found" });
}

export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.flatten().fieldErrors,
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({ message: "That record already exists" });
  }

  console.error(error);
  return res.status(500).json({ message: "Something went wrong" });
}
