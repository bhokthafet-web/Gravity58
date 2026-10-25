// Agent 1 — Marketing. Finds local businesses, decides who is worth contacting,
// sends the first WhatsApp message and follow-ups, and holds the conversation.
import { z } from "zod";
import { query, getSettings, log } from "../db.js";
import { think } from "../llm.js";
import { enqueue } from "../tasks.js";
import { searchBusinesses } from "../channels/osm.js";
import { sendTemplate, sendText, insideServiceWindow } from "../channels/whatsapp.js";
import { config } from "../config.js";
import { inSendWindow } from "../time.js";
import { guidanceText } from "../settings.js";
import { notifyOwner } from "../channels/owner.js";

const AGENT = "marketing";

export async function scout({ city, categories } = {}) {
  const settings = await getSettings();
  const targetCity = city || settings.city;
  const targetCategories = categories?.length ? categories : (settings.today_plan?.focus_categories ?? settings.categories);
  const { leads: found, failed } = await searchBusinesses(targetCity, targetCategories);
  let added = 0;
  for (const lead of found) {
    const result = await query(
      `INSERT INTO agents.leads(source, source_ref, name, category, phone, email, website, address, city, lat, lon, stage)
       SELECT 'osm', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              CASE WHEN EXISTS (SELECT 1 FROM agents.opt_outs WHERE phone=$4) THEN 'do_not_contact' ELSE 'new' END
       ON CONFLICT DO NOTHING`,
      [lead.sourceRef, lead.name, lead.category, lead.phone, lead.email, lead.website, lead.address, lead.city, lead.lat, lead.lon],
    );
    added += result.rowCount;
  }
  await log(AGENT, `Scouted ${targetCity}: ${found.length} businesses with mobile numbers, ${added} new`, { categories: targetCategories, failed });
  if (failed.length) await log(AGENT, `Some categories could not be searched: ${failed.join(" | ")}`, null, "warn");
}

const QualifySchema = z.object({
  leads: z.array(z.object({
    id: z.string(),
    score: z.number().int().describe("0-100: how likely this business is to benefit from and pay for a G58 product"),
    product_code: z.string().describe("Code of the single best-fitting product"),
    pitch: z.string().describe("One friendly sentence (max 160 chars) tailored to this business, no emojis, no prices"),
    contact: z.boolean().describe("false if the business is a chain, government office, or a poor fit"),
  })),
});

export async function qualify() {
  const settings = await getSettings();
  const batch = await query(
    `SELECT id, name, category, address, city, website FROM agents.leads WHERE stage='new' ORDER BY created_at LIMIT $1`,
    [settings.max_qualify_per_tick ?? 10],
  );
  if (!batch.rowCount) return;

  const result = await think({
    agent: AGENT,
    effort: "low",
    system: `You qualify local businesses as sales leads. Products available:\n${JSON.stringify(settings.products)}${guidanceText(settings)}`,
    prompt: `Score each lead and write a one-line personalised pitch. Businesses without a website are good
website leads. Restaurants and cafes fit Digital Menu; shops fit Refills or POS. Return every id exactly once.\n\n${JSON.stringify(batch.rows)}`,
    schema: QualifySchema,
  });

  for (const item of result.leads) {
    if (!batch.rows.some((row) => row.id === item.id)) continue;
    await query(
      `UPDATE agents.leads SET stage=$2, score=$3, product_fit=$4, pitch=$5, updated_at=now() WHERE id=$1 AND stage='new'`,
      [item.id, item.contact ? "qualified" : "skipped", item.score, item.product_code, item.pitch.slice(0, 200)],
    );
  }
  await log(AGENT, `Qualified ${result.leads.length} leads`);
}

async function sentToday() {
  const result = await query(
    `SELECT count(*)::int AS n FROM agents.messages
     WHERE direction='out' AND template IS NOT NULL AND created_at >= date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1`,
    [config.timezone],
  );
  return result.rows[0].n;
}

/** Sends first-contact templates to the best qualified leads, within the daily cap and send window. */
export async function outreach() {
  const settings = await getSettings();
  if (settings.paused || !inSendWindow(settings.send_window)) return;
  const remaining = (settings.daily_outreach_limit ?? 30) - await sentToday();
  if (remaining <= 0) return;

  const leads = await query(
    `SELECT * FROM agents.leads l WHERE stage='qualified'
       AND NOT EXISTS (SELECT 1 FROM agents.opt_outs o WHERE o.phone=l.phone)
     ORDER BY score DESC NULLS LAST, created_at LIMIT $1`,
    [Math.min(remaining, 10)],
  );
  const firstGap = settings.followup_days?.[0] ?? 3;
  for (const lead of leads.rows) {
    // Template text approved in WhatsApp Manager, e.g.:
    // "Hi {{1}}, this is Gravity58 from Hyderabad. {{2}} Would you like a free 1-month trial? Reply STOP to opt out."
    await sendTemplate(lead, config.whatsapp.introTemplate, [lead.name, lead.pitch],
      `[intro] Hi ${lead.name}, this is Gravity58. ${lead.pitch}`);
    await query(
      `UPDATE agents.leads SET stage='contacted', next_followup_at=now() + make_interval(days => $2) WHERE id=$1`,
      [lead.id, firstGap],
    );
  }
  if (leads.rowCount) await log(AGENT, `Sent ${leads.rowCount} intro messages`);
}

export async function followups() {
  const settings = await getSettings();
  if (settings.paused || !inSendWindow(settings.send_window)) return;
  const gaps = settings.followup_days ?? [3, 7];
  let remaining = (settings.daily_outreach_limit ?? 30) - await sentToday();

  const due = await query(
    `SELECT * FROM agents.leads l WHERE stage='contacted' AND next_followup_at <= now()
       AND NOT EXISTS (SELECT 1 FROM agents.opt_outs o WHERE o.phone=l.phone)
     ORDER BY next_followup_at LIMIT 20`,
  );
  for (const lead of due.rows) {
    const sent = lead.followups_sent;
    if (sent >= gaps.length) {
      // No reply after the last follow-up: stop contacting them.
      await query(`UPDATE agents.leads SET stage='lost', next_followup_at=NULL, notes=notes || $2 WHERE id=$1`,
        [lead.id, "\nNo reply to follow-ups."]);
      continue;
    }
    if (remaining <= 0) break;
    await sendTemplate(lead, config.whatsapp.followupTemplate, [lead.name], `[follow-up] Hi ${lead.name}, just checking in…`);
    remaining -= 1;
    // Wait until the next follow-up day, or 4 more days before giving up after the last one.
    const next = sent + 1 < gaps.length ? gaps[sent + 1] - gaps[sent] : 4;
    await query(
      `UPDATE agents.leads SET followups_sent=followups_sent+1, next_followup_at=now() + make_interval(days => $2) WHERE id=$1`,
      [lead.id, next],
    );
  }
}

const ReplySchema = z.object({
  reply: z.string().describe("WhatsApp reply to send, under 600 characters, plain text, same language the customer used"),
  intent: z.enum(["question", "interested", "wants_website", "ready_to_buy", "not_interested", "other"]),
  product_code: z.string().describe("Product the customer is discussing, or empty"),
  needs_human: z.boolean().describe("true if a person from G58 must step in (complaint, custom pricing, anything you cannot answer)"),
  summary: z.string().describe("One-line note for the sales log"),
});

const STAGE_FOR_INTENT = {
  interested: "interested",
  wants_website: "interested",
  ready_to_buy: "negotiating",
  not_interested: "lost",
};

/** Answers an inbound WhatsApp message from a lead. */
export async function reply({ leadId }) {
  const lead = (await query(`SELECT * FROM agents.leads WHERE id=$1`, [leadId])).rows[0];
  if (!lead || lead.stage === "do_not_contact" || !insideServiceWindow(lead)) return;
  const settings = await getSettings();
  const history = await query(
    `SELECT direction, body, created_at FROM agents.messages WHERE lead_id=$1 ORDER BY created_at DESC LIMIT 20`,
    [leadId],
  );
  const site = (await query(`SELECT slug FROM agents.sites WHERE lead_id=$1 ORDER BY created_at DESC LIMIT 1`, [leadId])).rows[0];

  const result = await think({
    agent: AGENT,
    system: `You are the G58 sales assistant chatting on WhatsApp with a local business owner. Answer questions
about G58 products using only these facts:\n${JSON.stringify(settings.products)}\nKeep replies short and warm.
If they ask for a website, say we will make a free preview first. Never quote a price that is not listed above.${guidanceText(settings)}`,
    prompt: `Business: ${JSON.stringify({ name: lead.name, category: lead.category, address: lead.address, stage: lead.stage, product_fit: lead.product_fit })}
${site ? `Their website preview: ${config.publicBaseUrl}/sites/${site.slug}\n` : ""}
Conversation (oldest first):
${history.rows.reverse().map((m) => `${m.direction === "in" ? "Customer" : "G58"}: ${m.body}`).join("\n")}

Write the next reply.`,
    schema: ReplySchema,
  });

  const stage = STAGE_FOR_INTENT[result.intent] ?? (lead.stage === "contacted" ? "replied" : lead.stage);
  await query(
    `UPDATE agents.leads SET stage=$2, next_followup_at=NULL, notes=notes || $3, product_fit=COALESCE(NULLIF($4,''), product_fit), updated_at=now()
     WHERE id=$1`,
    [leadId, stage, `\n${new Date().toISOString().slice(0, 10)}: ${result.summary}`, result.product_code],
  );
  await sendText(lead, result.reply);

  if (result.needs_human) {
    await log(AGENT, `Needs a human: ${lead.name} — ${result.summary}`, { leadId }, "warn");
    await notifyOwner(`${lead.name} needs you: ${result.summary}\nTheir number: +${lead.phone}`,
      `${lead.name} needs a person from G58: ${result.summary}`);
  }
  if (result.intent === "wants_website" && !site) {
    await enqueue("builder", "site", { leadId }, { dedupeKey: `site:${leadId}` });
  }
  if (result.intent === "ready_to_buy") {
    await enqueue("coordinator", "deal", { leadId, productCode: result.product_code }, { dedupeKey: `deal:${leadId}:${result.product_code}` });
  }
}
