import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

export const query = (text, values = []) => pool.query(text, values);

export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function migrate() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sql");
  const files = (await fs.readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    await query(await fs.readFile(path.join(dir, file), "utf8"));
  }
}

export async function getSettings() {
  const result = await query(`SELECT key, value FROM agents.settings`);
  return Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
}

export async function setSetting(key, value) {
  await query(
    `INSERT INTO agents.settings(key, value, updated_at) VALUES($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
    [key, JSON.stringify(value)],
  );
}

export async function log(agent, message, data = null, level = "info") {
  await query(
    `INSERT INTO agents.agent_log(agent, level, message, data) VALUES($1, $2, $3, $4)`,
    [agent, level, message, data ? JSON.stringify(data) : null],
  );
}
