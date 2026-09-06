import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { isAdmin } from "./access.js";
import { query } from "./db.js";

const rowsRoot = "/tablesdb/gravity58/tables/g58_records/rows";
const filesRoot = "/storage/buckets/ad-media/files";

const httpError = (message, code = 400) => Object.assign(new Error(message), { code });
const rawRow = (row) => ({
  $id: row.id,
  $createdAt: row.created_at,
  $updatedAt: row.updated_at,
  $permissions: (row.participant_ids || []).flatMap((id) => [`read(\"user:${id}\")`, `update(\"user:${id}\")`, `delete(\"user:${id}\")`]),
  kind: row.kind,
  payload: JSON.stringify(row.payload || {}),
});

function bodyOf(options) {
  if (!options?.body) return {};
  if (typeof options.body === "object") return options.body;
  try { return JSON.parse(options.body); }
  catch { return {}; }
}

function queryValues(url) {
  return url.searchParams.getAll("queries[]").map((item) => {
    try { return JSON.parse(item); }
    catch { return null; }
  }).filter(Boolean);
}

function participantIds(permissions = [], actorId = null) {
  const values = permissions.flatMap((permission) => [...String(permission).matchAll(/user:([0-9a-f-]{36})/ig)].map((match) => match[1]));
  if (actorId) values.push(actorId);
  return [...new Set(values)];
}

async function getRecord(id) {
  const result = await query(`SELECT * FROM records WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!result.rows[0]) throw httpError("Record not found", 404);
  return result.rows[0];
}

async function attachPrivateMedia(record) {
  for (const key of ["paymentReceiptFileId", "proofMediaFileId", "extensionProofMediaFileId", "cancellationProofFileId", "identityFileId"]) {
    const fileId = record.payload?.[key];
    if (/^[0-9a-f-]{36}$/i.test(String(fileId || ""))) {
      await query(`UPDATE media_files SET record_id=$1 WHERE id=$2 AND deleted_at IS NULL`, [record.id, fileId]);
    }
  }
}

export function createCompatibilityStore({ actor = null, onMutation = null } = {}) {
  return async function call(resource, options = {}) {
    const url = new URL(resource, "http://g58.internal");
    const method = String(options.method || "GET").toUpperCase();
    const pathname = url.pathname;

    if (pathname === rowsRoot && method === "GET") {
      const queries = queryValues(url);
      const equalKind = queries.find((entry) => entry.method === "equal" && entry.attribute === "kind");
      const limit = Math.min(Math.max(Number(queries.find((entry) => entry.method === "limit")?.values?.[0]) || 100, 1), 10_000);
      const offset = Math.max(Number(queries.find((entry) => entry.method === "offset")?.values?.[0]) || 0, 0);
      const values = [];
      let where = "deleted_at IS NULL";
      if (equalKind?.values?.[0]) { values.push(String(equalKind.values[0])); where += ` AND kind=$${values.length}`; }
      values.push(limit, offset);
      const result = await query(`SELECT * FROM records WHERE ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
      return { rows: result.rows.map(rawRow), total: result.rowCount };
    }

    if (pathname === rowsRoot && method === "POST") {
      if (!actor) throw httpError("A secure customer session is required", 401);
      const body = bodyOf(options);
      const id = String(body.rowId || "");
      const kind = String(body.data?.kind || "");
      if (!/^[a-z0-9._:-]{1,96}$/i.test(id) || !/^[a-z0-9_-]{1,96}$/i.test(kind)) throw httpError("Invalid record details");
      let payload = {};
      try { payload = JSON.parse(body.data?.payload || "{}"); } catch {}
      const participants = participantIds(body.permissions, actor.id);
      try {
        const result = await query(
          `INSERT INTO records(id,kind,owner_id,participant_ids,visibility,payload) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
          [id, kind, actor.id, participants, body.permissions?.some((entry) => String(entry).includes('read(\"any\")')) ? "public" : "shared", JSON.stringify(payload)],
        );
        await attachPrivateMedia(result.rows[0]);
        onMutation?.(kind, "create", result.rows[0]);
        return rawRow(result.rows[0]);
      } catch (error) {
        if (error.code === "23505") throw httpError("Record already exists", 409);
        throw error;
      }
    }

    if (pathname.startsWith(`${rowsRoot}/`)) {
      const id = decodeURIComponent(pathname.slice(rowsRoot.length + 1));
      const record = await getRecord(id);
      if (method === "GET") return rawRow(record);
      if (!actor) throw httpError("Sign in required", 401);
      if (method === "PATCH") {
        const body = bodyOf(options);
        let payload = record.payload || {};
        if (body.data?.payload !== undefined) {
          try { payload = JSON.parse(body.data.payload || "{}"); }
          catch { throw httpError("Invalid record payload"); }
        }
        if (!isAdmin(actor) && record.owner_id !== actor.id && !(record.participant_ids || []).includes(actor.id)) throw httpError("Access denied", 403);
        const result = await query(`UPDATE records SET payload=$1 WHERE id=$2 RETURNING *`, [JSON.stringify(payload), id]);
        await attachPrivateMedia(result.rows[0]);
        onMutation?.(record.kind, "update", result.rows[0]);
        return rawRow(result.rows[0]);
      }
      if (method === "DELETE") {
        if (!isAdmin(actor) && record.owner_id !== actor.id && !(record.participant_ids || []).includes(actor.id)) throw httpError("Access denied", 403);
        await query(`UPDATE records SET deleted_at=now() WHERE id=$1`, [id]);
        onMutation?.(record.kind, "delete", record);
        return {};
      }
    }

    if (pathname.startsWith(`${filesRoot}/`)) {
      const suffix = pathname.slice(filesRoot.length + 1);
      const id = decodeURIComponent(suffix.split("/")[0]);
      const result = await query(`SELECT * FROM media_files WHERE id=$1 AND deleted_at IS NULL`, [id]);
      const file = result.rows[0];
      if (!file) throw httpError("File not found", 404);
      if (!actor) throw httpError("Sign in required", 401);
      if (method === "GET") {
        return {
          $id: file.id,
          name: file.original_name,
          mimeType: file.mime_type,
          sizeOriginal: Number(file.byte_size),
          $permissions: [`read(\"user:${file.owner_id}\")`],
        };
      }
      if (method === "DELETE") {
        if (!isAdmin(actor) && file.owner_id !== actor.id) {
          const linked = file.record_id ? await getRecord(file.record_id).catch(() => null) : null;
          if (!linked || !(linked.participant_ids || []).includes(actor.id)) throw httpError("Access denied", 403);
        }
        await fs.rm(path.join(config.mediaRoot, file.storage_name), { force: true });
        await query(`UPDATE media_files SET deleted_at=now() WHERE id=$1`, [id]);
        return {};
      }
    }

    if (pathname.startsWith("/users/") && method === "GET") {
      if (!actor) throw httpError("Sign in required", 401);
      const id = decodeURIComponent(pathname.slice("/users/".length));
      const result = await query(`SELECT id,email,name,phone,status,role FROM users WHERE id=$1 AND deleted_at IS NULL`, [id]);
      if (!result.rows[0]) throw httpError("User not found", 404);
      return { ...result.rows[0], $id: result.rows[0].id };
    }

    if (/^\/teams\/[^/]+\/memberships$/.test(pathname) && method === "GET") {
      return { memberships: isAdmin(actor) ? [{ userId: actor.id }] : [] };
    }

    throw httpError(`Unsupported internal operation: ${method} ${pathname}`, 501);
  };
}
