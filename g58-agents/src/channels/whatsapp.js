import crypto from "node:crypto";
import { config, whatsappEnabled } from "../config.js";
import { query } from "../db.js";

const api = (path) => `${config.whatsapp.graphBase}/${config.whatsapp.graphVersion}/${path}`;

export async function send(to, body) {
  if (!whatsappEnabled()) throw new Error("WhatsApp is not configured (WA_TOKEN / WA_PHONE_NUMBER_ID)");
  const response = await fetch(api(`${config.whatsapp.phoneNumberId}/messages`), {
    method: "POST",
    headers: { Authorization: `Bearer ${config.whatsapp.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...body }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`WhatsApp API ${response.status}: ${json?.error?.message || "unknown error"}`);
  return json.messages?.[0]?.id ?? null;
}

async function remember(lead, { body, template, externalId }) {
  await query(
    `INSERT INTO agents.messages(lead_id, direction, body, template, external_id) VALUES($1, 'out', $2, $3, $4)`,
    [lead.id, body, template, externalId],
  );
  await query(`UPDATE agents.leads SET last_contacted_at=now(), updated_at=now() WHERE id=$1`, [lead.id]);
}

/** Free-form text. Only allowed inside the 24-hour window after the lead last wrote to us. */
export async function sendText(lead, text) {
  const externalId = await send(lead.phone, { type: "text", text: { body: text, preview_url: true } });
  await remember(lead, { body: text, template: null, externalId });
}

/**
 * Business-initiated message using a Meta-approved template. Each body parameter
 * fills {{1}}, {{2}}, ... in the template text approved in WhatsApp Manager.
 */
export async function sendTemplate(lead, name, params, renderedPreview) {
  const externalId = await send(lead.phone, {
    type: "template",
    template: {
      name,
      language: { code: config.whatsapp.templateLanguage },
      components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: String(text).slice(0, 900) })) }],
    },
  });
  await remember(lead, { body: renderedPreview, template: name, externalId });
  await query(
    `INSERT INTO agents.ledger(kind, category, amount_paise, lead_id, note) VALUES('cost', 'whatsapp', $1, $2, $3)`,
    [Math.round(config.whatsapp.costPerConversationInr * 100), lead.id, name],
  );
}

export const insideServiceWindow = (lead) =>
  Boolean(lead.last_inbound_at) && Date.now() - new Date(lead.last_inbound_at).getTime() < 23 * 3600 * 1000;

export function verifySignature(rawBody, header) {
  if (!config.whatsapp.appSecret || !header) return false;
  const expected = `sha256=${crypto.createHmac("sha256", config.whatsapp.appSecret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Flattens a webhook payload into inbound messages, delivery statuses and quality alerts. */
export function parseWebhook(payload) {
  const inbound = [];
  const statuses = [];
  const alerts = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      if (change.field === "phone_number_quality_update" || change.field === "account_update") {
        alerts.push({ field: change.field, value });
      }
      for (const message of value.messages ?? []) {
        const text = message.text?.body
          ?? message.button?.text
          ?? message.interactive?.button_reply?.title
          ?? message.interactive?.list_reply?.title
          ?? `[${message.type} message]`;
        inbound.push({ from: message.from, id: message.id, text, name: value.contacts?.[0]?.profile?.name ?? "" });
      }
      for (const status of value.statuses ?? []) {
        statuses.push({ id: status.id, status: status.status, error: status.errors?.[0]?.title ?? null });
      }
    }
  }
  return { inbound, statuses, alerts };
}
