// Agent 2 — Builder. Makes free website previews for interested businesses and
// drafts social media posts for G58 and for its customers.
import crypto from "node:crypto";
import { z } from "zod";
import { query, log } from "../db.js";
import { think } from "../llm.js";
import { config } from "../config.js";
import { sendText, insideServiceWindow } from "../channels/whatsapp.js";

const AGENT = "builder";

export const slugify = (name) => String(name).toLowerCase().normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "business";

/** Removes anything executable. Sites are also served with a CSP that blocks scripts. */
export function sanitizeHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*>/gi, "")
    .replace(/<(iframe|object|embed|form)[\s\S]*?(<\/\1\s*>|$)/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

const SiteSchema = z.object({
  html: z.string().describe("A complete single-file HTML5 page with inline CSS and no JavaScript"),
});

export async function site({ leadId }) {
  const lead = (await query(`SELECT * FROM agents.leads WHERE id=$1`, [leadId])).rows[0];
  if (!lead) return;
  const existing = await query(`SELECT slug FROM agents.sites WHERE lead_id=$1 LIMIT 1`, [leadId]);
  if (existing.rowCount) return;

  const mapLink = lead.lat ? `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lon}` : "";
  const result = await think({
    agent: AGENT,
    effort: "medium",
    maxTokens: 32000,
    system: `You are a web designer building a one-page mobile-first website for a small Indian business.
Use only inline CSS, system fonts, no external scripts, no JavaScript, no forms. Use only the facts given;
where you need content you do not know (menu items, prices, hours, photos), add a short clearly marked
placeholder such as "Opening hours — to be confirmed". Include a prominent WhatsApp button
(https://wa.me/<phone>) and a call button. Add a small footer: "Website preview by Gravity58 · g58.in".`,
    prompt: `Business facts:\n${JSON.stringify({
      name: lead.name, category: lead.category, address: lead.address, city: lead.city, phone: lead.phone, map: mapLink,
    })}`,
    schema: SiteSchema,
  });

  const slug = `${slugify(lead.name)}-${crypto.randomBytes(3).toString("hex")}`;
  await query(`INSERT INTO agents.sites(lead_id, slug, html) VALUES($1, $2, $3)`, [leadId, slug, sanitizeHtml(result.html)]);
  const url = `${config.publicBaseUrl}/sites/${slug}`;
  await log(AGENT, `Built website preview for ${lead.name}`, { leadId, url });

  if (insideServiceWindow(lead)) {
    await sendText(lead, `Here is a free preview of a website for ${lead.name}: ${url}\nTell us what to change, or send your menu/price list and photos and we will add them.`);
  }
  await posts({ leadId });
}

const PostsSchema = z.object({
  posts: z.array(z.object({
    platform: z.enum(["instagram", "x", "facebook"]),
    body: z.string().describe("Ready-to-post caption including hashtags; X posts under 270 characters"),
  })),
});

/** Drafts posts for the dashboard. With a leadId, posts promote that business; otherwise they promote G58. */
export async function posts({ leadId } = {}) {
  const lead = leadId ? (await query(`SELECT name, category, city FROM agents.leads WHERE id=$1`, [leadId])).rows[0] : null;
  const result = await think({
    agent: AGENT,
    effort: "low",
    system: "You write short, honest social media posts for Indian small businesses. No fake reviews, no invented offers.",
    prompt: lead
      ? `Write 1 Instagram and 1 X post announcing that ${lead.name} (${lead.category}, ${lead.city}) is now online with a new website.`
      : "Write 2 Instagram and 2 X posts promoting Gravity58 tools for local shops and restaurants (Digital Menu, Refills, free POS, websites). First month free on paid plans.",
    schema: PostsSchema,
  });
  for (const post of result.posts) {
    await query(`INSERT INTO agents.posts(lead_id, platform, body) VALUES($1, $2, $3)`, [leadId ?? null, post.platform, post.body]);
  }
  await log(AGENT, `Drafted ${result.posts.length} social posts${lead ? ` for ${lead.name}` : ""}`);
}
