import { query, log } from "./db.js";

const MAX_ATTEMPTS = 3;

/** Queues work for an agent. A repeated dedupeKey is ignored, so callers can enqueue idempotently. */
export async function enqueue(agent, kind, payload = {}, { dedupeKey = null, delaySeconds = 0 } = {}) {
  const result = await query(
    `INSERT INTO agents.tasks(agent, kind, payload, dedupe_key, run_after)
     VALUES($1, $2, $3, $4, now() + make_interval(secs => $5))
     ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
    [agent, kind, JSON.stringify(payload), dedupeKey, delaySeconds],
  );
  return result.rows[0]?.id ?? null;
}

async function claim() {
  const result = await query(
    `UPDATE agents.tasks SET status='running', attempts=attempts+1
     WHERE id = (SELECT id FROM agents.tasks WHERE status='queued' AND run_after<=now()
                 ORDER BY run_after, id FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING *`,
  );
  return result.rows[0] ?? null;
}

/**
 * Runs queued tasks one at a time. `handlers` maps "agent.kind" to an async function(payload, task).
 * Failed tasks are retried with backoff, then marked failed and logged for the dashboard.
 */
export function startWorker(handlers, { idleMs = 5000 } = {}) {
  let stopped = false;

  const loop = async () => {
    while (!stopped) {
      let task = null;
      try {
        task = await claim();
        if (!task) {
          await new Promise((resolve) => setTimeout(resolve, idleMs));
          continue;
        }
        const handler = handlers[`${task.agent}.${task.kind}`];
        if (!handler) throw new Error(`No handler for ${task.agent}.${task.kind}`);
        await handler(task.payload, task);
        await query(`UPDATE agents.tasks SET status='done', finished_at=now(), error=NULL WHERE id=$1`, [task.id]);
      } catch (error) {
        if (!task) {
          console.error("Worker error", error);
          await new Promise((resolve) => setTimeout(resolve, idleMs));
          continue;
        }
        const retry = task.attempts < MAX_ATTEMPTS;
        await query(
          `UPDATE agents.tasks SET status=$2, error=$3, run_after=now() + make_interval(mins => $4),
             finished_at=CASE WHEN $2='failed' THEN now() END
           WHERE id=$1`,
          [task.id, retry ? "queued" : "failed", String(error.message || error).slice(0, 2000), 5 * task.attempts],
        );
        await log(task.agent, `${task.kind} ${retry ? "will retry" : "failed"}: ${error.message}`, { taskId: task.id }, retry ? "warn" : "error");
      }
    }
  };

  loop();
  return () => { stopped = true; };
}

export async function recoverStuckTasks() {
  await query(`UPDATE agents.tasks SET status='queued' WHERE status='running'`);
}
