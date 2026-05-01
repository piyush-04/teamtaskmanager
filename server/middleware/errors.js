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

  if (
    error.message?.includes("PostgreSQL connection URL is required") ||
    error.code === "ENOTFOUND" ||
    error.code === "ECONNREFUSED" ||
    error.code === "ETIMEDOUT" ||
    error.code === "28P01" ||
    error.code === "3D000"
  ) {
    return res.status(503).json({
      message:
        "Database is not connected. Check the PostgreSQL environment variable in Railway.",
    });
  }

  return res.status(500).json({ message: "Something went wrong" });
}
