import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRIVATE_URL;

let pool;
export const dbEnv = {
  hasConnectionUrl: Boolean(connectionString),
  source:
    (process.env.DATABASE_URL && "DATABASE_URL") ||
    (process.env.DATABASE_PRIVATE_URL && "DATABASE_PRIVATE_URL") ||
    (process.env.POSTGRES_URL && "POSTGRES_URL") ||
    (process.env.POSTGRES_PRIVATE_URL && "POSTGRES_PRIVATE_URL") ||
    null,
};

function getPool() {
  if (!connectionString) {
    throw new Error(
      "A PostgreSQL connection URL is required. Set DATABASE_URL or DATABASE_PRIVATE_URL.",
    );
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl:
        process.env.PGSSLMODE === "require" ||
        connectionString.includes("sslmode=require")
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }

  return pool;
}

export async function query(text, params = []) {
  const result = await getPool().query(text, params);
  return result;
}

export async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
      description TEXT NOT NULL DEFAULT '',
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('Admin', 'Member')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL CHECK (char_length(trim(title)) >= 2),
      description TEXT NOT NULL DEFAULT '',
      due_date DATE NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
      status TEXT NOT NULL DEFAULT 'To Do' CHECK (status IN ('To Do', 'In Progress', 'Done')),
      assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigned_to);
  `);
}
