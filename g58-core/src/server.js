import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import { config } from "./config.js";
import { closeDatabase, query, ready, transaction } from "./db.js";
import { isAdmin, isPublicKind, isStaff, visibilityForKind } from "./access.js";
import { hashPassword, publicUser, randomToken, tokenHash, verifyPassword } from "./security.js";
import { sendPasswordReset } from "./mailer.js";
import handleAction from "./actions.js";
import { createCompatibilityStore } from "./compat-store.js";
import { isAllowedOrigin } from "./origin.js";

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: config.maxMediaBytes + 1024 * 1024 });
const stateChanging = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const listeners = new Set();

await app.register(cookie);
await app.register(cors, {
  credentials: true,
  origin(origin, callback) {
    if (isAllowedOrigin(origin, config.allowedOrigins)) return callback(null, true);
    callback(new Error("Origin is not allowed"), false);
  },
});
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(rateLimit, { max: 600, timeWindow: "1 minute" });
await app.register(multipart, {
  limits: { files: 1, fileSize: config.maxMediaBytes, fields: 12 },
});
await app.register(fastifyStatic, {
  root: path.join(import.meta.dirname, "../public"),
  prefix: "/console/",
  decorateReply: false,
});

app.decorateRequest("user", null);
app.decorateRequest("sessionHash", "");

app.addHook("onRequest", async (request, reply) => {
  const origin = request.headers.origin;
  if (stateChanging.has(request.method) && !isAllowedOrigin(origin, config.allowedOrigins)) {
    return reply.code(403).send({ error: "Origin is not allowed" });
  }

  const token = request.cookies[config.cookieName];
  if (!token) return;
  const hash = tokenHash(token);
  const result = await query(
    `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='active'`,
    [hash],
  );
  if (result.rows[0]) {
    request.user = result.rows[0];
    request.sessionHash = hash;
  } else {
    reply.clearCookie(config.cookieName, cookieOptions());
  }
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  if (error instanceof z.ZodError) return reply.code(400).send({ error: "Invalid request", details: error.issues });
  if (error.code === "23505") return reply.code(409).send({ error: "That record already exists" });
  if (error.statusCode) return reply.code(error.statusCode).send({ error: error.message });
  return reply.code(500).send({ error: "The G58 server could not complete this request" });
});

app.get("/", async (_request, reply) => reply.redirect("/console/"));
app.get("/health", healthHandler);
app.get("/api/v1/health", healthHandler);

app.post("/api/v1/auth/register", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (request, reply) => {
  const input = z.object({
    email: z.string().email().transform((value) => value.trim().toLowerCase()),
    password: z.string().min(8).max(128),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(30).optional().default(""),
  }).parse(request.body);
  const existing = await query(`SELECT id FROM users WHERE email=$1 AND deleted_at IS NULL`, [input.email]);
  if (existing.rows[0]) {
    return reply.code(409).send({ error: "An account with this email already exists. Sign in or use Forgot password." });
  }
  const passwordHash = await hashPassword(input.password);
  const result = await query(
    `INSERT INTO users(email,password_hash,name,phone) VALUES($1,$2,$3,$4) RETURNING *`,
    [input.email, passwordHash, input.name, input.phone],
  );
  const user = result.rows[0];
  await query(
    `INSERT INTO records(id,kind,owner_id,visibility,payload)
     VALUES($1,'profiles',$2,'private',$3)`,
    [`profile-${user.id}`, user.id, JSON.stringify({ userId: user.id, email: user.email, name: user.name, phone: user.phone, accountType: "customer", state: "", district: "", blocked: false })],
  );
  await startSession(request, reply, user);
  await audit(request, "auth.register", "user", user.id);
  reply.code(201).send({ user: publicUser(user) });
});

app.post("/api/v1/auth/guest", { config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (request, reply) => {
  if (request.user) return { user: publicUser(request.user) };
  const result = await query(`INSERT INTO users(name,is_guest) VALUES('Guest customer',true) RETURNING *`);
  await startSession(request, reply, result.rows[0], 2);
  reply.code(201).send({ user: publicUser(result.rows[0]) });
});

app.post("/api/v1/auth/login", { config: { rateLimit: { max: 12, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(1).max(128) }).parse(request.body);
  const result = await query(`SELECT * FROM users WHERE email=$1 AND deleted_at IS NULL`, [input.email.trim().toLowerCase()]);
  const user = result.rows[0];
  if (!user?.password_hash || !(await verifyPassword(user.password_hash, input.password))) return reply.code(401).send({ error: "Incorrect email or password" });
  if (user.status !== "active") return reply.code(403).send({ error: "This account is not active" });
  await startSession(request, reply, user);
  await audit(request, "auth.login", "user", user.id);
  return { user: publicUser(user) };
});

app.post("/api/v1/auth/logout", async (request, reply) => {
  if (request.sessionHash) await query(`DELETE FROM sessions WHERE token_hash=$1`, [request.sessionHash]);
  reply.clearCookie(config.cookieName, cookieOptions());
  return { ok: true };
});

app.get("/api/v1/auth/me", async (request, reply) => {
  if (!request.user) return reply.code(401).send({ error: "Not signed in" });
  return { user: publicUser(request.user) };
});

app.post("/api/v1/auth/forgot-password", async (request) => {
  const { email } = z.object({ email: z.string().email() }).parse(request.body);
  const result = await query(`SELECT * FROM users WHERE email=$1 AND status='active' AND is_guest=false`, [email.trim().toLowerCase()]);
  const user = result.rows[0];
  if (user) {
    const token = randomToken(36);
    await query(`DELETE FROM password_reset_tokens WHERE user_id=$1 OR expires_at<now()`, [user.id]);
    await query(
      `INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')`,
      [tokenHash(token), user.id],
    );
    const resetUrl = `${config.publicSiteUrl}/reset-password/?token=${encodeURIComponent(token)}`;
    try {
      const delivery = await sendPasswordReset({ email: user.email, name: user.name, resetUrl });
      request.log.info({ messageId: delivery.messageId || "accepted" }, "Password reset email accepted by SMTP");
    } catch (error) {
      request.log.error(error, "Password reset email failed");
    }
  }
  return { ok: true, message: "If the account exists, a password-reset email will arrive shortly." };
});

app.post("/api/v1/auth/reset-password", async (request, reply) => {
  const input = z.object({ token: z.string().min(20), password: z.string().min(8).max(128) }).parse(request.body);
  const reset = await query(
    `SELECT * FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()`,
    [tokenHash(input.token)],
  );
  if (!reset.rows[0]) return reply.code(400).send({ error: "This password-reset link is invalid or has expired" });
  const passwordHash = await hashPassword(input.password);
  await transaction(async (client) => {
    await client.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [passwordHash, reset.rows[0].user_id]);
    await client.query(`UPDATE password_reset_tokens SET used_at=now() WHERE token_hash=$1`, [tokenHash(input.token)]);
    await client.query(`DELETE FROM sessions WHERE user_id=$1`, [reset.rows[0].user_id]);
  });
  return { ok: true };
});

app.get("/api/v1/records/:kind", async (request, reply) => {
  const kind = safeKind(request.params.kind);
  const filters = request.query?.filters ? parseFilters(request.query.filters) : {};
  const limit = Math.min(Math.max(Number(request.query?.limit) || 1000, 1), 1000);
  const values = [kind];
  let access = `visibility='public'`;
  if (isStaff(request.user)) access = "true";
  else if (request.user) {
    values.push(request.user.id);
    access = `(visibility='public' OR owner_id=$2 OR $2=ANY(participant_ids))`;
  }
  values.push(JSON.stringify(filters), limit);
  const filterIndex = values.length - 1;
  const limitIndex = values.length;
  const result = await query(
    `SELECT * FROM records WHERE kind=$1 AND deleted_at IS NULL AND (${access})
     AND payload @> $${filterIndex}::jsonb ORDER BY created_at DESC LIMIT $${limitIndex}`,
    values,
  );
  return { rows: result.rows.map(recordResponse), total: result.rowCount };
});

app.get("/api/v1/records/:kind/:id", async (request, reply) => {
  const kind = safeKind(request.params.kind);
  const result = await query(`SELECT * FROM records WHERE kind=$1 AND id=$2 AND deleted_at IS NULL`, [kind, request.params.id]);
  const record = result.rows[0];
  if (!record || !mayRead(record, request.user)) return reply.code(404).send({ error: "Record not found" });
  return { row: recordResponse(record) };
});

app.post("/api/v1/records/:kind", async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) return;
  const kind = safeKind(request.params.kind);
  const input = z.object({ id: z.string().max(96).optional(), data: z.record(z.string(), z.unknown()), participantIds: z.array(z.string().uuid()).max(20).optional() }).parse(request.body);
  const id = input.id ? safeId(input.id) : `${kind}-${crypto.randomUUID()}`;
  const visibility = visibilityForKind(kind);
  const result = await query(
    `INSERT INTO records(id,kind,owner_id,participant_ids,visibility,payload) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, kind, user.id, input.participantIds || [], visibility, JSON.stringify(input.data)],
  );
  await audit(request, "record.create", kind, id);
  publish(kind, "create", result.rows[0]);
  reply.code(201).send({ row: recordResponse(result.rows[0]) });
});

app.patch("/api/v1/records/:kind/:id", async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) return;
  const kind = safeKind(request.params.kind);
  const input = z.object({ data: z.record(z.string(), z.unknown()), participantIds: z.array(z.string().uuid()).max(20).optional() }).parse(request.body);
  const existing = await query(`SELECT * FROM records WHERE kind=$1 AND id=$2 AND deleted_at IS NULL`, [kind, request.params.id]);
  if (!existing.rows[0] || (!isAdmin(user) && existing.rows[0].owner_id !== user.id && !(existing.rows[0].participant_ids || []).includes(user.id))) return reply.code(404).send({ error: "Record not found" });
  const result = await query(
    `UPDATE records SET payload=payload || $1::jsonb, participant_ids=COALESCE($2,participant_ids) WHERE id=$3 RETURNING *`,
    [JSON.stringify(input.data), input.participantIds || null, request.params.id],
  );
  await audit(request, "record.update", kind, request.params.id);
  publish(kind, "update", result.rows[0]);
  return { row: recordResponse(result.rows[0]) };
});

app.delete("/api/v1/records/:kind/:id", async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) return;
  const kind = safeKind(request.params.kind);
  const existing = await query(`SELECT * FROM records WHERE kind=$1 AND id=$2 AND deleted_at IS NULL`, [kind, request.params.id]);
  if (!existing.rows[0] || (!isAdmin(user) && existing.rows[0].owner_id !== user.id && !(existing.rows[0].participant_ids || []).includes(user.id))) return reply.code(404).send({ error: "Record not found" });
  await query(`UPDATE records SET deleted_at=now() WHERE id=$1`, [request.params.id]);
  await audit(request, "record.delete", kind, request.params.id);
  publish(kind, "delete", existing.rows[0]);
  return { ok: true };
});

app.post("/api/v1/media", async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) return;
  const part = await request.file();
  if (!part) return reply.code(400).send({ error: "Choose a file" });
  const purpose = String(part.fields?.purpose?.value || request.query?.purpose || "media").slice(0, 64);
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"]);
  if (!allowed.has(part.mimetype)) return reply.code(400).send({ error: "Unsupported media type" });
  const buffer = await part.toBuffer();
  const maximum = purpose === "menu" ? config.maxMenuImageBytes : config.maxMediaBytes;
  if (buffer.length > maximum) return reply.code(413).send({ error: `File must be ${Math.round(maximum / 1024)} KB or smaller` });
  const extension = extensionFor(part.mimetype);
  const storageName = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const destination = path.join(config.mediaRoot, storageName);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, buffer, { flag: "wx" });
  const saved = await query(
    `INSERT INTO media_files(owner_id,purpose,original_name,storage_name,mime_type,byte_size,is_public)
     VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [user.id, purpose, part.filename.slice(0, 255), storageName, part.mimetype, buffer.length, purpose !== "payment-receipt"],
  );
  await audit(request, "media.create", "media", saved.rows[0].id);
  reply.code(201).send({ file: mediaResponse(saved.rows[0]) });
});

app.get("/api/v1/media/:id", async (request, reply) => {
  const result = await query(
    `SELECT m.*, r.owner_id AS record_owner_id, r.participant_ids AS record_participant_ids
       FROM media_files m
       LEFT JOIN records r ON r.id=m.record_id AND r.deleted_at IS NULL
      WHERE m.id=$1 AND m.deleted_at IS NULL`,
    [request.params.id],
  );
  const file = result.rows[0];
  const linkedParticipant = file?.record_owner_id === request.user?.id || (file?.record_participant_ids || []).includes(request.user?.id);
  if (!file || (!file.is_public && !isStaff(request.user) && file.owner_id !== request.user?.id && !linkedParticipant)) return reply.code(404).send({ error: "File not found" });
  const filename = path.join(config.mediaRoot, file.storage_name);
  const data = await fs.readFile(filename).catch(() => null);
  if (!data) return reply.code(404).send({ error: "File not found" });
  reply.type(file.mime_type).header("Cache-Control", file.is_public ? "public, max-age=86400" : "private, no-store").send(data);
});

app.delete("/api/v1/media/:id", async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) return;
  const result = await query(`SELECT * FROM media_files WHERE id=$1 AND deleted_at IS NULL`, [request.params.id]);
  const file = result.rows[0];
  if (!file || (!isAdmin(user) && file.owner_id !== user.id)) return reply.code(404).send({ error: "File not found" });
  await fs.rm(path.join(config.mediaRoot, file.storage_name), { force: true });
  await query(`UPDATE media_files SET deleted_at=now() WHERE id=$1`, [file.id]);
  await audit(request, "media.delete", "media", file.id);
  return { ok: true };
});

app.post("/api/v1/actions", { config: { rateLimit: { max: 180, timeWindow: "1 minute" } } }, async (request, reply) => {
  const user = requireUser(request, reply);
  if (!user) return;
  const call = createCompatibilityStore({ actor: user, onMutation: publish });
  let sent = false;
  const response = {
    json(payload, status = 200) {
      sent = true;
      reply.code(status).send(payload);
      return payload;
    },
  };
  await handleAction({
    req: {
      method: "POST",
      bodyJson: request.body || {},
      bodyText: JSON.stringify(request.body || {}),
      call,
      headers: {
        "x-g58-user-id": user.id,
        "x-g58-user-email": user.email || "",
      },
    },
    res: response,
    error: (message) => request.log.error(message),
  });
  if (!sent && !reply.sent) return reply.code(500).send({ ok: false, error: "The secure action returned no response" });
});

app.get("/api/v1/events", async (request, reply) => {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": request.headers.origin && config.allowedOrigins.has(request.headers.origin) ? request.headers.origin : config.publicSiteUrl,
    "Access-Control-Allow-Credentials": "true",
  });
  const listener = { response: reply.raw, user: request.user, kinds: new Set(String(request.query?.kinds || "").split(",").filter(Boolean)) };
  listeners.add(listener);
  reply.raw.write(`event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  const heartbeat = setInterval(() => reply.raw.write(": heartbeat\n\n"), 25_000);
  request.raw.on("close", () => { clearInterval(heartbeat); listeners.delete(listener); });
});

app.get("/api/v1/admin/stats", async (request, reply) => {
  const user = requireAdmin(request, reply);
  if (!user) return;
  const result = await query(`
    SELECT
      (SELECT count(*) FROM users WHERE deleted_at IS NULL AND is_guest=false) AS users,
      (SELECT count(*) FROM users WHERE deleted_at IS NULL AND is_guest=true) AS guests,
      (SELECT count(*) FROM records WHERE deleted_at IS NULL) AS records,
      (SELECT count(DISTINCT kind) FROM records WHERE deleted_at IS NULL) AS kinds,
      (SELECT count(*) FROM media_files WHERE deleted_at IS NULL) AS files,
      (SELECT COALESCE(sum(byte_size),0) FROM media_files WHERE deleted_at IS NULL) AS media_bytes,
      (SELECT count(*) FROM sessions WHERE expires_at>now()) AS active_sessions
  `);
  return { stats: result.rows[0] };
});

app.get("/api/v1/admin/users", async (request, reply) => {
  const user = requireAdmin(request, reply);
  if (!user) return;
  const result = await query(`SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1000`);
  return { users: result.rows.map(publicUser) };
});

app.patch("/api/v1/admin/users/:id", async (request, reply) => {
  const user = requireAdmin(request, reply);
  if (!user) return;
  const input = z.object({ status: z.enum(["active", "blocked"]).optional(), role: z.enum(["user", "support", "admin"]).optional() }).parse(request.body);
  const result = await query(`UPDATE users SET status=COALESCE($1,status),role=COALESCE($2,role) WHERE id=$3 AND role<>'super_admin' RETURNING *`, [input.status || null, input.role || null, request.params.id]);
  if (!result.rows[0]) return reply.code(404).send({ error: "User not found" });
  await audit(request, "admin.user.update", "user", request.params.id, input);
  return { user: publicUser(result.rows[0]) };
});

app.get("/api/v1/admin/kinds", async (request, reply) => {
  const user = requireAdmin(request, reply);
  if (!user) return;
  const result = await query(`SELECT kind,count(*)::int AS count,max(updated_at) AS updated_at FROM records WHERE deleted_at IS NULL GROUP BY kind ORDER BY kind`);
  return { kinds: result.rows };
});

app.get("/api/v1/admin/audit", async (request, reply) => {
  const user = requireAdmin(request, reply);
  if (!user) return;
  const result = await query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500`);
  return { events: result.rows };
});

async function healthHandler(_request, reply) {
  try {
    await query("SELECT 1");
    return { status: "ok", service: "g58-core", time: new Date().toISOString() };
  } catch {
    return reply.code(503).send({ status: "down", service: "g58-core" });
  }
}

function cookieOptions(days = config.sessionDays) {
  return {
    path: "/",
    domain: config.cookieDomain || undefined,
    httpOnly: true,
    secure: config.env === "production",
    sameSite: "lax",
    maxAge: days * 86400,
  };
}

async function startSession(request, reply, user, days = config.sessionDays) {
  const token = randomToken(40);
  await query(
    `INSERT INTO sessions(token_hash,user_id,ip,user_agent,expires_at) VALUES($1,$2,$3,$4,now()+($5||' days')::interval)`,
    [tokenHash(token), user.id, request.ip, String(request.headers["user-agent"] || "").slice(0, 1000), days],
  );
  reply.setCookie(config.cookieName, token, cookieOptions(days));
}

function requireUser(request, reply) {
  if (!request.user) { reply.code(401).send({ error: "Sign in required" }); return null; }
  return request.user;
}

function requireAdmin(request, reply) {
  if (!isAdmin(request.user)) { reply.code(403).send({ error: "Administrator access required" }); return null; }
  return request.user;
}

function safeKind(value) {
  const kind = String(value || "");
  if (!/^[a-z0-9_-]{1,96}$/i.test(kind)) throw Object.assign(new Error("Invalid record type"), { statusCode: 400 });
  return kind;
}

function safeId(value) {
  const id = String(value || "");
  if (!/^[a-z0-9._:-]{1,96}$/i.test(id)) throw Object.assign(new Error("Invalid record ID"), { statusCode: 400 });
  return id;
}

function parseFilters(value) {
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw Object.assign(new Error("Invalid filters"), { statusCode: 400 });
  }
}

function mayRead(record, user) {
  return record.visibility === "public" || isStaff(user) || record.owner_id === user?.id || (record.participant_ids || []).includes(user?.id);
}

function recordResponse(row) {
  return { ...row.payload, id: row.id, $id: row.id, $createdAt: row.created_at, $updatedAt: row.updated_at, _kind: row.kind };
}

function mediaResponse(row) {
  return { id: row.id, fileId: row.id, mediaUrl: `${config.publicApiUrl}/api/v1/media/${row.id}`, mediaType: row.mime_type, mediaName: row.original_name, size: Number(row.byte_size) };
}

function extensionFor(mime) {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm" })[mime] || "bin";
}

function publish(kind, action, record) {
  const event = JSON.stringify({ kind, action, row: recordResponse(record), at: new Date().toISOString() });
  for (const listener of listeners) {
    if (listener.kinds.size && !listener.kinds.has(kind)) continue;
    if (!mayRead(record, listener.user)) continue;
    listener.response.write(`event: record\ndata: ${event}\n\n`);
  }
}

async function audit(request, action, resourceType, resourceId, metadata = {}) {
  await query(
    `INSERT INTO audit_logs(actor_id,action,resource_type,resource_id,metadata,ip) VALUES($1,$2,$3,$4,$5,$6)`,
    [request.user?.id || null, action, resourceType, resourceId || null, JSON.stringify(metadata), request.ip],
  );
}

async function bootstrapAdmin() {
  if (!config.bootstrapAdmin.email || !config.bootstrapAdmin.password) return;
  const existing = await query(`SELECT id FROM users WHERE email=$1`, [config.bootstrapAdmin.email.toLowerCase()]);
  if (existing.rows[0]) {
    await query(`UPDATE users SET role='super_admin',status='active' WHERE id=$1`, [existing.rows[0].id]);
    return;
  }
  const passwordHash = await hashPassword(config.bootstrapAdmin.password);
  await query(
    `INSERT INTO users(email,password_hash,name,role,email_verified_at) VALUES($1,$2,'G58 Administrator','super_admin',now())`,
    [config.bootstrapAdmin.email.toLowerCase(), passwordHash],
  );
}

async function maintenance() {
  const files = await query(`SELECT id,storage_name FROM media_files WHERE deleted_at IS NULL AND delete_after IS NOT NULL AND delete_after<now()`);
  for (const file of files.rows) {
    await fs.rm(path.join(config.mediaRoot, file.storage_name), { force: true });
    await query(`UPDATE media_files SET deleted_at=now() WHERE id=$1`, [file.id]);
  }
  await query(`UPDATE records SET deleted_at=now() WHERE deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at<now()`);
  await query(`DELETE FROM sessions WHERE expires_at<now()`);
  await query(`DELETE FROM password_reset_tokens WHERE expires_at<now() OR used_at IS NOT NULL`);
  await query(`DELETE FROM users WHERE is_guest=true AND created_at<now()-interval '7 days'`);
}

await fs.mkdir(config.mediaRoot, { recursive: true });
await ready();
await bootstrapAdmin();
await maintenance();
const maintenanceTimer = setInterval(() => maintenance().catch((error) => app.log.error(error)), 60 * 60 * 1000);
maintenanceTimer.unref();

const shutdown = async () => {
  clearInterval(maintenanceTimer);
  await app.close();
  await closeDatabase();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ host: "0.0.0.0", port: config.port });
