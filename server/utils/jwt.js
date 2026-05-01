const fallbackSecret = "team-task-manager-demo-secret-change-me";

export function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    console.warn("JWT_SECRET is missing. Using demo fallback secret.");
  }

  return process.env.JWT_SECRET || fallbackSecret;
}
