// Manual email outreach. The marketing agent finds business emails in an area and
// drafts a message for each; a person reviews every draft and clicks Send.
import { z } from "zod";
import { query, getSettings, log } from "../db.js";
import { config } from "../config.js";
import { think } from "../llm.js";
import { guidanceText } from "../settings.js";
import { geocodeArea, searchAreaForEmails, expandCategories, visitList } from "../channels/osm.js";
import { findEmailOnWebsite } from "../channels/websites.js";
import { sendEmail } from "../channels/email.js";

const AGENT = "marketing";

const FOOD = new Set(["restaurant", "cafe", "fast_food", "bakery", "ice_cream", "food_court", "bar", "pub", "confectionery", "sweets"]);

/** Runs `work` over items with a small number in flight at once. */
async function inBatches(items, size, work) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(work));
}

export async function findEmails({ area, categories } = {}) {
  const settings = await getSettings();
  const targetArea = (area || settings.city || "").trim();
  const targetCategories = expandCategories(categories?.length ? categories : settings.categories);
  const { bbox, label } = await geocodeArea(targetArea);
  await log(AGENT, `Searching ${label} for ${targetCategories.join(", ")}`);

  const { found, failed } = await searchAreaForEmails(bbox, targetCategories, targetArea);
  await log(AGENT, `Found ${found.length} businesses with an email or website on the map. Reading their websites…`);
  const known = new Set((await query(
    `SELECT source_ref FROM agents.leads WHERE source_ref = ANY($1)`, [found.map((b) => b.sourceRef)],
  )).rows.map((row) => row.source_ref));
  const fresh = found.filter((business) => !known.has(business.sourceRef));

  // OpenStreetMap rarely lists emails; most come from the business's own website.
  await inBatches(fresh.filter((b) => !b.email && b.website), 8, async (business) => {
    business.email = await findEmailOnWebsite(business.website);
    business.emailSource = business.email ? "website" : null;
  });

  const addedIds = [];
  for (const business of fresh.filter((b) => b.email)) {
    const result = await query(
      `INSERT INTO agents.leads(source, source_ref, name, category, phone, email, email_source, website, address, city, lat, lon, stage)
       SELECT 'osm', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
              CASE WHEN EXISTS (SELECT 1 FROM agents.email_opt_outs WHERE email=lower($5)) THEN 'do_not_contact' ELSE 'new' END
       WHERE NOT EXISTS (SELECT 1 FROM agents.leads WHERE lower(email)=lower($5))
       ON CONFLICT DO NOTHING RETURNING id`,
      [business.sourceRef, business.name, business.category, business.phone, business.email, business.emailSource || "osm",
        business.website, business.address, business.city, business.lat, business.lon],
    );
    if (result.rows[0]) addedIds.push(result.rows[0].id);
  }
  await log(AGENT, addedIds.length
    ? `${targetArea}: checked ${found.length} businesses, found ${addedIds.length} new email addresses`
    : `${targetArea}: no new email addresses (${found.length} businesses on the map list an email or website). Shops like medicals and kirana rarely have email; try "Make call/visit list" instead.`,
  { failed });
  if (failed.length) await log(AGENT, `Some business types could not be searched: ${failed.join(" | ")}`, null, "warn");
  // Draft straight away so the emails are waiting for review; sending stays manual.
  if (addedIds.length) await draftEmails({ leadIds: addedIds });
  return { checked: found.length, added: addedIds.length };
}

const productFor = (lead, products) => {
  const code = lead.product_fit || (FOOD.has(lead.category) ? "digital_menu" : lead.website ? "refills" : "website");
  return products.find((p) => p.code === code) ?? products[0];
};

/** A ready-to-send email written from fixed templates (used when Claude is not configured). */
export function templateDraft(lead, products) {
  const product = productFor(lead, products);
  const where = lead.city ? ` in ${lead.city}` : "";
  const lines = {
    digital_menu: [
      `Subject: A free QR menu for ${lead.name}`,
      `Hello ${lead.name} team,`,
      `I'm writing from Gravity58, a Hyderabad software company that helps restaurants and cafes${where} go digital.`,
      `With G58 Digital Menu, your customers scan a QR code on the table, see your full menu with photos, and order straight from their phone. You update prices and items yourself in seconds, so there's no reprinting menus.`,
      `The first month is free, and after that it's ₹699 a month. You can see it here: ${product.url || "https://g58.in"}`,
    ],
    refills: [
      `Subject: Take ${lead.name} online with repeat orders`,
      `Hello ${lead.name} team,`,
      `I'm writing from Gravity58, a Hyderabad software company that helps local shops${where} sell online.`,
      `G58 Refills gives you your own online store where regular customers can reorder in a couple of taps, and you get every order on your phone.`,
      `The first month is free, and after that it's ₹699 a month. You can see it here: ${product.url || "https://g58.in"}`,
    ],
    website: [
      `Subject: A website for ${lead.name}`,
      `Hello ${lead.name} team,`,
      `I'm writing from Gravity58, a Hyderabad software company. I noticed ${lead.name} doesn't have a website yet.`,
      `We build simple one-page websites for local businesses, with your address, map, photos, and WhatsApp and call buttons, so customers who search for you can find and contact you. It's a one-time ₹${product.price_inr}.`,
      `If you'd like, we can make a free preview first so you can see it before deciding.`,
    ],
  }[product.code] ?? [
    `Subject: Simple tools for ${lead.name}`,
    `Hello ${lead.name} team,`,
    `I'm writing from Gravity58, a Hyderabad software company that makes simple tools for local businesses: ${product.name}. ${product.pitch}`,
    `You can see it here: ${product.url || "https://g58.in"}`,
  ];
  const [subjectLine, ...paragraphs] = lines;
  return {
    subject: subjectLine.replace(/^Subject: /, ""),
    body: `${paragraphs.join("\n\n")}\n\nWould you be open to a quick 10-minute call or demo this week? Just reply to this email.\n\nThanks,\nGravity58 team`,
  };
}

const DraftSchema = z.object({
  drafts: z.array(z.object({
    lead_id: z.string(),
    subject: z.string().describe("Short, specific subject line, no clickbait, no emojis"),
    body: z.string().describe("Plain-text email body, 80-150 words, greeting to the business by name, ending with a simple question and 'Thanks,\\nGravity58 team'. No unsubscribe line (added automatically)."),
  })),
});

/** Writes a draft for every lead that has an email and no open or sent draft yet. */
export async function draftEmails({ leadIds } = {}) {
  const settings = await getSettings();
  const leads = (await query(
    // One draft per address, even when several leads (branches of a chain) share an email.
    `SELECT * FROM (
       SELECT DISTINCT ON (lower(l.email)) l.* FROM agents.leads l
       WHERE l.email IS NOT NULL AND l.stage NOT IN ('do_not_contact','lost','won')
         AND ($1::uuid[] IS NULL OR l.id = ANY($1))
         AND NOT EXISTS (SELECT 1 FROM agents.email_drafts d
                         WHERE lower(d.to_email)=lower(l.email) AND d.status IN ('draft','sent'))
         AND NOT EXISTS (SELECT 1 FROM agents.email_opt_outs o WHERE o.email=lower(l.email))
       ORDER BY lower(l.email), l.created_at
     ) unique_emails ORDER BY created_at LIMIT 50`,
    [leadIds?.length ? leadIds : null],
  )).rows;
  if (!leads.length) return { drafted: 0 };

  let drafts = [];
  let draftedBy = "template";
  if (config.claudeEnabled) {
    try {
      for (let i = 0; i < leads.length; i += 10) {
        const batch = leads.slice(i, i + 10);
        const result = await think({
          agent: AGENT,
          effort: "low",
          system: `You write short, honest first-contact emails from Gravity58 (Hyderabad) to local business owners.
Pick the one product that fits each business best. Products:\n${JSON.stringify(settings.products)}${guidanceText(settings)}`,
          prompt: `Write one email per business. Return every lead_id exactly once.\n${JSON.stringify(batch.map((l) => ({
            lead_id: l.id, name: l.name, category: l.category, area: l.city, address: l.address, has_website: Boolean(l.website),
          })))}`,
          schema: DraftSchema,
        });
        drafts.push(...result.drafts.filter((d) => batch.some((l) => l.id === d.lead_id)));
      }
      draftedBy = "claude";
    } catch (error) {
      await log(AGENT, `Claude drafting failed, using templates: ${error.message}`, null, "warn");
      drafts = [];
    }
  }
  const byLead = new Map(drafts.map((d) => [d.lead_id, d]));

  let drafted = 0;
  for (const lead of leads) {
    const draft = byLead.get(lead.id) ?? templateDraft(lead, settings.products);
    const result = await query(
      `INSERT INTO agents.email_drafts(lead_id, to_email, subject, body, drafted_by) VALUES($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [lead.id, lead.email, draft.subject.slice(0, 200), draft.body.slice(0, 5000), byLead.has(lead.id) ? draftedBy : "template"],
    );
    drafted += result.rowCount;
  }
  await log(AGENT, `Drafted ${drafted} emails (${draftedBy === "claude" ? "written by Claude" : "from templates"}) — review and send them in the Email tab`);
  return { drafted };
}

async function sentToday() {
  return (await query(
    `SELECT count(*)::int AS n FROM agents.email_drafts
     WHERE status='sent' AND sent_at >= date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1`,
    [config.timezone],
  )).rows[0].n;
}

/** Sends one reviewed draft. Called only when a person clicks Send. */
export async function sendDraft(id, edits, sentBy) {
  const draft = (await query(`SELECT * FROM agents.email_drafts WHERE id=$1`, [id])).rows[0];
  if (!draft || draft.status !== "draft") throw Object.assign(new Error("This draft was already sent or discarded"), { statusCode: 409 });
  const to = (edits.to ?? draft.to_email).trim().toLowerCase();
  const subject = edits.subject ?? draft.subject;
  const body = edits.body ?? draft.body;

  const optedOut = await query(`SELECT 1 FROM agents.email_opt_outs WHERE email=$1`, [to]);
  if (optedOut.rowCount) throw Object.assign(new Error(`${to} unsubscribed; not sent`), { statusCode: 409 });
  const limit = (await getSettings()).email_daily_limit ?? 50;
  if (await sentToday() >= limit) {
    throw Object.assign(new Error(`Daily email limit of ${limit} reached. Change it in Settings, or send more tomorrow.`), { statusCode: 429 });
  }

  // Claim the draft first so a double click can't send it twice.
  const claimed = await query(
    `UPDATE agents.email_drafts SET status='sent', to_email=$2, subject=$3, body=$4, sent_by=$5, sent_at=now(), updated_at=now()
     WHERE id=$1 AND status='draft' RETURNING id`,
    [id, to, subject, body, sentBy],
  );
  if (!claimed.rowCount) throw Object.assign(new Error("This draft was already sent"), { statusCode: 409 });

  try {
    const messageId = await sendEmail({ to, subject, body });
    await query(
      `INSERT INTO agents.messages(lead_id, direction, channel, body, external_id, status) VALUES($1, 'out', 'email', $2, $3, 'sent')`,
      [draft.lead_id, `${subject}\n\n${body}`, messageId],
    );
    await query(
      `UPDATE agents.leads SET stage=CASE WHEN stage IN ('new','qualified') THEN 'contacted' ELSE stage END,
         last_contacted_at=now(), updated_at=now() WHERE id=$1`,
      [draft.lead_id],
    );
    await log(AGENT, `${sentBy} sent an email to ${to}`);
  } catch (error) {
    // Put it back as a draft (with the error shown) so it can be fixed and sent again.
    await query(`UPDATE agents.email_drafts SET status='draft', sent_at=NULL, sent_by=NULL, error=$2 WHERE id=$1`, [id, error.message.slice(0, 500)]);
    throw error;
  }
}

export async function unsubscribe(email) {
  const clean = email.trim().toLowerCase();
  await query(`INSERT INTO agents.email_opt_outs(email) VALUES($1) ON CONFLICT DO NOTHING`, [clean]);
  await query(`UPDATE agents.leads SET stage='do_not_contact', updated_at=now() WHERE lower(email)=$1`, [clean]);
  await query(`UPDATE agents.email_drafts SET status='discarded', updated_at=now() WHERE lower(to_email)=$1 AND status='draft'`, [clean]);
  await log(AGENT, `${clean} unsubscribed from emails`);
}

/** Every named business of these types in the area, for calling or visiting in person. Saved for the dashboard. */
export async function makeVisitList({ area, categories, requestedBy = "" }) {
  const types = expandCategories(categories);
  const { bbox, label } = await geocodeArea(area);
  await log(AGENT, `Making a call/visit list for ${label.split(",").slice(0, 2).join(",")} (${types.join(", ")})…`);
  const rows = await visitList(bbox, types);
  await query(`INSERT INTO agents.visit_lists(area, types, rows, created_by) VALUES($1, $2, $3, $4)`,
    [area, types, JSON.stringify(rows), requestedBy]);
  await log(AGENT, `Call/visit list for ${area}: ${rows.length} businesses — open the "Call/visit list" tab`);
}
