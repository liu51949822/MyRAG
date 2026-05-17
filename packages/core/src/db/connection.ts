import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AppConfig } from "../config/config.js";
import * as schema from "./schema.js";

let pool: pg.Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

export async function getDb(config?: AppConfig): Promise<NodePgDatabase<typeof schema>> {
  if (db) return db;

  if (!config) {
    const { loadConfig } = await import("../config/config.js");
    config = loadConfig();
  }

  pool = new pg.Pool({ connectionString: config.databaseUrl });
  db = drizzle(pool, { schema });

  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
  } finally {
    client.release();
  }

  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
