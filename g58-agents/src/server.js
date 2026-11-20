import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import { config, smtpEnabled } from "./config.js";
import { query, migrate, getSettings, setSetting, log, pool } from "./db.js";
import { enqueue, startWorker, recoverStuckTasks } from "./tasks.js";
import { parseWebhook, verifySignature } from "./channels/whatsapp.js";
import { verifyWebhook as verifyRazorpay } from "./channels/razorpay.js";
import { isOptOut } from "./phone.js";
import { SettingsInput, STAGES } from "./settings.js";
import * as marketing from "./agents/marketing.js";
import * as builder from "./agents/builder.js";
import * as coordinator from "./agents/coordinator.js";
import * as ownerChat from "./agents/owner-chat.js";
import * as email from "./agents/email.js";
import { verifyUnsubscribe } from "./channels/email.js";
import { isOwner, markOwnerInbound, replyToOwner } from "./channels/owner.js";

const app = Fastify({ logger: { level: "info" }, trustProxy: true, bodyLimit: 1_048_576 });

// Keep the raw body: both webhooks are authenticated by an HMAC over the exact bytes.
app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
  request.rawBody = body;
  try {
    done(null, body ? JSON.parse(body) : {});
  } catch (error) {
    error.statusCode = 400;
    done(error);
  }
});

await app.register(cookie);
await app.register(fastifyStatic, {
  root: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public"),
  prefix: "/",
});

// ---------- Auth: reuse the G58 Core admin session ----------

async function requireAdmin(request, reply) {
  const token = request.cookies[config.sessionCookie];
  if (!token) return reply.code(401).send({ error: "Sign in to G58 first" });
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const result = await query(
    `SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='active'`,
    [hash],
  );
  const user = result.rows[0];
  if (!user || !["admin", "super_admin"].includes(user.role)) return reply.code(403).send({ error: "Admins only" });
  if (request.method !== "GET") {
    const origin = request.headers.origin;
    if (origin && new URL(config.publicBaseUrl).origin !== origin) return reply.code(403).send({ error: "Bad origin" });
  }
  request.user = user;
}

// ---------- Public ----------

app.get("/health", async () => {
  await query("SELECT 1");
  return { ok: true };
});

const unsubscribePage = (message) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gravity58</title><body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#111827">
<h1 style="font-size:22px">Gravity58</h1><p>${message}</p></body>`;

async function handleUnsubscribe(request, reply) {
  const { e: address = "", t: token = "" } = request.query;
  if (!address || !verifyUnsubscribe(address, token)) {
    return reply.code(400).type("text/html").send(unsubscribePage("This unsubscribe link is not valid. Reply to our email with \"unsubscribe\" and we will remove you."));
  }
  await email.unsubscribe(address);
  return reply.type("text/html").send(unsubscribePage("You're unsubscribed. Gravity58 won't email you again."));
}
app.get("/unsubscribe", handleUnsubscribe);
// One-click unsubscribe from the mail app (List-Unsubscribe-Post).
app.post("/unsubscribe", handleUnsubscribe);

app.get("/sites/:slug", async (request, reply) => {
  const site = (await query(`SELECT html FROM agents.sites WHERE slug=$1 AND status<>'archived'`, [request.params.slug])).rows[0];
  if (!site) return reply.code(404).type("text/plain").send("Not found");
  return reply
    .header("Content-Security-Policy", "default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https:; font-src https: data:")
    .header("X-Robots-Tag", "noindex")
    .type("text/html; charset=utf-8")
    .send(site.html);
});

// ---------- WhatsApp webhook ----------

app.get("/webhooks/whatsapp", async (request, reply) => {
  const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = request.query;
  if (mode === "subscribe" && config.whatsapp.verifyToken && token === config.whatsapp.verifyToken) {
    return reply.type("text/plain").send(challenge);
  }
  return reply.code(403).send();
});

app.post("/webhooks/whatsapp", async (request, reply) => {
  if (!verifySignature(request.rawBody ?? "", request.headers["x-hub-signature-256"])) return reply.code(401).send();
  const { inbound, statuses, alerts } = parseWebhook(request.body);

  for (const message of inbound) {
    if (isOwner(message.from)) {
      // The owner talking to the coordinator, not a sales conversation.
      await markOwnerInbound();
      // The task row only guards against Meta re-delivering the webhook. The chat runs right away,
      // not behind slow jobs in the queue; the worker picks it up only if this process dies first.
      const taskId = await enqueue("coordinator", "ownerChat", { text: message.text }, { dedupeKey: `owner:${message.id}`, delaySeconds: 1800 });
      if (taskId) setImmediate(() => handleOwnerMessage(taskId, message.text));
      continue;
    }
    let lead = (await query(`SELECT * FROM agents.leads WHERE phone=$1`, [message.from])).rows[0];
    if (!lead) {
      lead = (await query(
        `INSERT INTO agents.leads(source, name, phone, stage) VALUES('inbound', $1, $2, 'replied') RETURNING *`,
        [message.name || message.from, message.from],
      )).rows[0];
    }
    const stored = await query(
      `INSERT INTO agents.messages(lead_id, direction, body, external_id, status) VALUES($1, 'in', $2, $3, 'received')
       ON CONFLICT (external_id) DO NOTHING`,
      [lead.id, message.text, message.id],
    );
    if (!stored.rowCount) continue; // Meta retried a webhook we already handled.
    await query(`UPDATE agents.leads SET last_inbound_at=now(), updated_at=now() WHERE id=$1`, [lead.id]);

    if (isOptOut(message.text)) {
      await query(`INSERT INTO agents.opt_outs(phone, reason) VALUES($1, $2) ON CONFLICT DO NOTHING`, [lead.phone, message.text.slice(0, 200)]);
      await query(`UPDATE agents.leads SET stage='do_not_contact', next_followup_at=NULL WHERE id=$1`, [lead.id]);
      await log("marketing", `${lead.name} opted out`, { leadId: lead.id });
      continue;
    }
    // Small delay so several quick messages from the same person get one reply.
    await enqueue("marketing", "reply", { leadId: lead.id }, { dedupeKey: `reply:${message.id}`, delaySeconds: 20 });
  }

  for (const status of statuses) {
    await query(`UPDATE agents.messages SET status=$2 WHERE external_id=$1`, [status.id, status.status]);
    if (status.error) await log("marketing", `WhatsApp delivery failed: ${status.error}`, status, "warn");
  }

  for (const alert of alerts) {
    // Meta lowered our number's quality or limits: stop sending until a human looks.
    const event = String(alert.value?.event ?? "");
    if (/FLAGGED|DOWNGRADE|RESTRICT|BAN|DISABLED/i.test(event)) {
      await setSetting("paused", true);
      await log("coordinator", `Paused all agents: WhatsApp reported ${event}`, alert.value, "error");
    }
  }
  return { ok: true };
});

async function answerOwner({ text }) {
  try {
    await replyToOwner(await ownerChat.chat(text, "whatsapp", "owner (WhatsApp)"));
  } catch (error) {
    // Never retry: tools may already have acted. Tell the owner instead.
    await log("coordinator", `Owner chat failed: ${error.message}`, null, "error");
    await replyToOwner(`Sorry, something went wrong: ${error.message}`).catch(() => {});
  }
}

async function handleOwnerMessage(taskId, text) {
  const claimed = await query(`UPDATE agents.tasks SET status='running' WHERE id=$1 AND status='queued' RETURNING id`, [taskId]);
  if (!claimed.rowCount) return;
  await answerOwner({ text });
  await query(`UPDATE agents.tasks SET status='done', finished_at=now() WHERE id=$1`, [taskId]);
}

// ---------- Razorpay webhook ----------

app.post("/webhooks/razorpay", async (request, reply) => {
  if (!verifyRazorpay(request.rawBody ?? "", request.headers["x-razorpay-signature"])) return reply.code(401).send();
  const body = request.body;
  if (body.event === "payment_link.paid") {
    const link = body.payload?.payment_link?.entity;
    const payment = body.payload?.payment?.entity;
    await coordinator.recordPayment({
      paymentLinkId: link?.id,
      referenceId: link?.reference_id,
      amountPaise: Number(payment?.amount ?? link?.amount_paid ?? 0),
      paymentId: payment?.id ?? link?.id,
    });
  }
  return { ok: true };
});

// ---------- Dashboard API (admins only) ----------

app.register(async (api) => {
  api.addHook("preHandler", requireAdmin);

  api.get("/me", async (request) => request.user);

  api.get("/chat", async () => (await query(
    `SELECT channel, role, text, created_at FROM (SELECT * FROM agents.owner_chat ORDER BY id DESC LIMIT 100) recent ORDER BY id`,
  )).rows);

  api.post("/chat", async (request) => {
    const { message } = z.object({ message: z.string().trim().min(1).max(2000) }).parse(request.body);
    return { reply: await ownerChat.chat(message, "dashboard", request.user.email) };
  });

  api.get("/overview", async () => {
    const [numbers, settings] = await Promise.all([coordinator.metrics(), getSettings()]);
    return { ...numbers, paused: settings.paused, plan: settings.today_plan ?? null };
  });

  api.get("/leads", async (request) => {
    const stage = request.query.stage || null;
    const result = await query(
      `SELECT id, name, category, phone, website, address, stage, score, product_fit, pitch, followups_sent,
              last_contacted_at, last_inbound_at, next_followup_at, created_at
       FROM agents.leads WHERE ($1::text IS NULL OR stage=$1) ORDER BY updated_at DESC LIMIT 200`,
      [stage],
    );
    return result.rows;
  });

  api.get("/leads/:id", async (request) => {
    const [lead, messages, sites] = await Promise.all([
      query(`SELECT * FROM agents.leads WHERE id=$1`, [request.params.id]),
      query(`SELECT direction, body, template, status, created_at FROM agents.messages WHERE lead_id=$1 ORDER BY created_at`, [request.params.id]),
      query(`SELECT slug, status, created_at FROM agents.sites WHERE lead_id=$1 ORDER BY created_at DESC`, [request.params.id]),
    ]);
    return { lead: lead.rows[0] ?? null, messages: messages.rows, sites: sites.rows };
  });

  api.patch("/leads/:id", async (request) => {
    const input = z.object({
      stage: z.enum(STAGES).optional(),
      notes: z.string().max(5000).optional(),
    }).parse(request.body);
    const lead = (await query(
      `UPDATE agents.leads SET stage=COALESCE($2, stage), notes=COALESCE($3, notes), updated_at=now() WHERE id=$1 RETURNING *`,
      [request.params.id, input.stage ?? null, input.notes ?? null],
    )).rows[0];
    if (input.stage === "do_not_contact" && lead?.phone) {
      await query(`INSERT INTO agents.opt_outs(phone, reason) VALUES($1, 'marked by admin') ON CONFLICT DO NOTHING`, [lead.phone]);
    }
    return lead;
  });

  api.get("/settings", async () => getSettings());


  api.put("/settings", async (request) => {
    const input = SettingsInput.parse(request.body);
    for (const [key, value] of Object.entries(input)) await setSetting(key, value);
    await log("coordinator", `Settings changed by ${request.user.email}: ${Object.keys(input).join(", ")}`);
    return getSettings();
  });

  api.get("/approvals", async () => (await query(
    `SELECT a.*, l.name AS lead_name FROM agents.approvals a LEFT JOIN agents.leads l ON l.id=a.lead_id
     ORDER BY (a.status='pending') DESC, a.created_at DESC LIMIT 100`,
  )).rows);

  api.post("/approvals/:id/approve", async (request) => coordinator.executeApproval(request.params.id, request.user.email));

  api.post("/approvals/:id/reject", async (request) => {
    await query(`UPDATE agents.approvals SET status='rejected', decided_by=$2, decided_at=now() WHERE id=$1 AND status='pending'`,
      [request.params.id, request.user.email]);
    return { ok: true };
  });

  // ---------- Email outreach (manual send) ----------

  api.get("/email/status", async () => {
    const settings = await getSettings();
    const counts = (await query(
      `SELECT
         (SELECT count(*) FROM agents.leads WHERE email IS NOT NULL)::int AS leads_with_email,
         (SELECT count(*) FROM agents.email_drafts WHERE status='draft')::int AS drafts,
         (SELECT count(*) FROM agents.email_drafts WHERE status='sent' AND sent_at >= date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1)::int AS sent_today,
         (SELECT count(*) FROM agents.email_drafts WHERE status='sent')::int AS sent_total,
         (SELECT count(*) FROM agents.email_opt_outs)::int AS unsubscribed,
         (SELECT count(*) FROM agents.tasks WHERE agent='marketing' AND kind IN ('findEmails','draftEmails','visitList') AND status IN ('queued','running'))::int AS jobs_running`,
      [config.timezone],
    )).rows[0];
    const activity = (await query(
      `SELECT level, message, created_at FROM agents.agent_log WHERE agent='marketing' ORDER BY id DESC LIMIT 1`,
    )).rows[0] ?? null;
    return { ...counts, activity, daily_limit: settings.email_daily_limit ?? 50, smtp: smtpEnabled(), claude: config.claudeEnabled,
      from: config.smtp.from, reply_to: config.smtp.replyTo, city: settings.city, categories: settings.categories };
  });

  const AreaSearch = z.object({
    area: z.string().trim().min(2).max(120),
    categories: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  });

  api.post("/email/visit-list", async (request) => {
    const input = AreaSearch.parse(request.body);
    return { id: await enqueue("marketing", "visitList", { ...input, requestedBy: request.user.email }, {}) };
  });

  api.get("/email/visit-lists", async () => (await query(
    `SELECT id, area, types, jsonb_array_length(rows) AS count, created_at FROM agents.visit_lists ORDER BY id DESC LIMIT 20`,
  )).rows);

  api.get("/email/visit-lists/:id", async (request) => (await query(
    `SELECT id, area, types, rows, created_at FROM agents.visit_lists WHERE id=$1`, [request.params.id],
  )).rows[0] ?? null);

  api.post("/email/find", async (request) => {
    const input = AreaSearch.parse(request.body);
    const id = await enqueue("marketing", "findEmails", input, {});
    await log("marketing", `${request.user.email} asked to find emails in ${input.area}`);
    return { id };
  });

  api.post("/email/draft", async (request) => {
    const input = z.object({ leadIds: z.array(z.string().uuid()).max(200).optional() }).parse(request.body ?? {});
    return { id: await enqueue("marketing", "draftEmails", input, {}) };
  });

  api.get("/email/drafts", async (request) => {
    const status = ["draft", "sent", "discarded"].includes(request.query.status) ? request.query.status : "draft";
    return (await query(
      `SELECT d.id, d.to_email, d.subject, d.body, d.drafted_by, d.status, d.error, d.sent_by, d.sent_at, d.created_at,
              l.name AS lead_name, l.category, l.city, l.website, l.email_source, l.stage
       FROM agents.email_drafts d JOIN agents.leads l ON l.id=d.lead_id
       WHERE d.status=$1 ORDER BY COALESCE(d.sent_at, d.created_at) DESC LIMIT 200`,
      [status],
    )).rows;
  });

  const DraftEdit = z.object({
    to: z.string().trim().email().max(200).optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(5000).optional(),
  });

  api.patch("/email/drafts/:id", async (request) => {
    const input = DraftEdit.parse(request.body);
    await query(
      `UPDATE agents.email_drafts SET to_email=COALESCE($2,to_email), subject=COALESCE($3,subject), body=COALESCE($4,body), updated_at=now()
       WHERE id=$1 AND status='draft'`,
      [request.params.id, input.to ?? null, input.subject ?? null, input.body ?? null],
    );
    return { ok: true };
  });

  api.post("/email/drafts/:id/send", async (request) => {
    await email.sendDraft(request.params.id, DraftEdit.parse(request.body ?? {}), request.user.email);
    return { ok: true };
  });

  api.post("/email/drafts/:id/discard", async (request) => {
    await query(`UPDATE agents.email_drafts SET status='discarded', updated_at=now() WHERE id=$1 AND status='draft'`, [request.params.id]);
    return { ok: true };
  });

  api.get("/posts", async () => (await query(
    `SELECT p.*, l.name AS lead_name FROM agents.posts p LEFT JOIN agents.leads l ON l.id=p.lead_id
     WHERE p.status='draft' ORDER BY p.created_at DESC LIMIT 100`,
  )).rows);

  api.patch("/posts/:id", async (request) => {
    const { status } = z.object({ status: z.enum(["posted", "discarded"]) }).parse(request.body);
    await query(`UPDATE agents.posts SET status=$2 WHERE id=$1`, [request.params.id, status]);
    return { ok: true };
  });

  api.get("/ledger", async () => (await query(
    `SELECT kind, category, amount_paise, note, created_at FROM agents.ledger ORDER BY created_at DESC LIMIT 200`,
  )).rows);

  api.post("/ledger", async (request) => {
    const input = z.object({
      kind: z.enum(["revenue", "cost"]),
      category: z.string().min(1).max(60),
      amount_inr: z.number().positive().max(10_000_000),
      note: z.string().max(500).default(""),
    }).parse(request.body);
    await query(`INSERT INTO agents.ledger(kind, category, amount_paise, note) VALUES($1, $2, $3, $4)`,
      [input.kind, input.category, Math.round(input.amount_inr * 100), `${input.note} (by ${request.user.email})`]);
    return { ok: true };
  });

  api.get("/log", async () => (await query(
    `SELECT agent, level, message, created_at FROM agents.agent_log ORDER BY id DESC LIMIT 150`,
  )).rows);

  api.get("/tasks", async () => (await query(
    `SELECT id, agent, kind, status, attempts, error, run_after, finished_at FROM agents.tasks ORDER BY id DESC LIMIT 100`,
  )).rows);

  const MANUAL = new Set(["marketing.draftEmails", "marketing.scout", "marketing.qualify", "marketing.outreach", "marketing.followups", "builder.posts", "coordinator.dailyPlan"]);
  api.post("/run/:agent/:kind", async (request, reply) => {
    const name = `${request.params.agent}.${request.params.kind}`;
    if (!MANUAL.has(name)) return reply.code(400).send({ error: "Unknown job" });
    const id = await enqueue(request.params.agent, request.params.kind, {}, {});
    await log("coordinator", `${request.user.email} started ${name}`);
    return { id };
  });
}, { prefix: "/api" });

app.setErrorHandler((error, request, reply) => {
  if (error instanceof z.ZodError) return reply.code(400).send({ error: "Invalid input", issues: error.issues });
  request.log.error(error);
  return reply.code(error.statusCode && error.statusCode < 500 ? error.statusCode : 500).send({ error: error.message });
});

// ---------- Start ----------

await migrate();
await recoverStuckTasks();

const stopWorker = startWorker({
  "marketing.scout": marketing.scout,
  "marketing.qualify": marketing.qualify,
  "marketing.outreach": marketing.outreach,
  "marketing.followups": marketing.followups,
  "marketing.reply": marketing.reply,
  "builder.site": builder.site,
  "builder.posts": builder.posts,
  "coordinator.dailyPlan": coordinator.dailyPlan,
  "coordinator.deal": coordinator.deal,
  "marketing.findEmails": email.findEmails,
  "marketing.draftEmails": email.draftEmails,
  "marketing.visitList": email.makeVisitList,
  "coordinator.ownerChat": answerOwner,
});

const runTick = () => coordinator.tick().catch((error) => log("coordinator", `Tick failed: ${error.message}`, null, "error"));
const ticker = setInterval(runTick, config.tickSeconds * 1000);
runTick();

await app.listen({ host: "0.0.0.0", port: config.port });

const shutdown = async () => {
  clearInterval(ticker);
  stopWorker();
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
