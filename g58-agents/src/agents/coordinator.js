// Agent 3 — Coordinator. Decides what the other two agents work on, keeps the
// books, and turns closed deals into payment requests that a human approves.
import { z } from "zod";
import { query, getSettings, setSetting, log } from "../db.js";
import { think } from "../llm.js";
import { enqueue } from "../tasks.js";
import { createPaymentLink } from "../channels/razorpay.js";
import { sendText, insideServiceWindow } from "../channels/whatsapp.js";
import { today, localHour, inSendWindow } from "../time.js";
import { notifyOwner } from "../channels/owner.js";

const AGENT = "coordinator";

export async function metrics() {
  const [stages, money, week, pending] = await Promise.all([
    query(`SELECT stage, count(*)::int AS n FROM agents.leads GROUP BY stage`),
    query(`SELECT kind, category, sum(amount_paise)::bigint AS paise FROM agents.ledger
           WHERE created_at > now() - interval '30 days' GROUP BY kind, category`),
    query(`SELECT
             count(*) FILTER (WHERE direction='out' AND template IS NOT NULL)::int AS outreach,
             count(*) FILTER (WHERE direction='in')::int AS replies
           FROM agents.messages WHERE created_at > now() - interval '7 days'`),
    query(`SELECT count(*)::int AS n FROM agents.approvals WHERE status='pending'`),
  ]);
  const ledger = money.rows.map((row) => ({ ...row, rupees: Number(row.paise) / 100 }));
  const total = (kind) => ledger.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.rupees, 0);
  return {
    stages: Object.fromEntries(stages.rows.map((row) => [row.stage, row.n])),
    last7Days: week.rows[0],
    last30Days: { revenue: total("revenue"), costs: total("cost"), profit: total("revenue") - total("cost"), byCategory: ledger },
    pendingApprovals: pending.rows[0].n,
  };
}

const PlanSchema = z.object({
  focus_categories: z.array(z.string()).describe("2-5 categories from the allowed list to scout today"),
  summary: z.string().describe("3-5 sentence plain-English status report for the owner"),
  recommendations: z.array(z.string()).describe("Up to 5 concrete actions for the owner"),
});

/** Once a day: review the numbers and choose where the marketing agent should look. */
export async function dailyPlan({ report = false } = {}) {
  const settings = await getSettings();
  const numbers = await metrics();
  const plan = await think({
    agent: AGENT,
    effort: "medium",
    system: `You manage a small AI sales team for G58 in ${settings.city}. Allowed categories: ${JSON.stringify(settings.categories)}.
Products: ${JSON.stringify(settings.products)}. Be frank about what is and is not working, and about costs.`,
    prompt: `Today is ${today()}. Funnel and money (INR):\n${JSON.stringify(numbers, null, 2)}\n\nMake today's plan.`,
    schema: PlanSchema,
  });
  plan.focus_categories = plan.focus_categories.filter((category) => settings.categories.includes(category));
  if (!plan.focus_categories.length) plan.focus_categories = settings.categories.slice(0, 3);
  await setSetting("today_plan", { date: today(), ...plan });
  await log(AGENT, `Daily plan: ${plan.summary}`, plan);
  if (report) await ownerReport(numbers, plan);
}

const inr = (rupees) => `${rupees < 0 ? "-" : ""}₹${Math.abs(Math.round(rupees)).toLocaleString("en-IN")}`;

/** The morning WhatsApp report to the owner. */
export async function ownerReport(numbers, plan) {
  const s = numbers.stages;
  const m = numbers.last30Days;
  const issues = (await query(
    `SELECT message FROM agents.agent_log WHERE level IN ('warn','error') AND created_at > now() - interval '24 hours'
     ORDER BY id DESC LIMIT 5`,
  )).rows.map((row) => `• ${row.message}`);
  const text = [
    `G58 daily report — ${today()}`,
    plan.summary,
    [
      `Last 7 days: ${numbers.last7Days.outreach} messaged, ${numbers.last7Days.replies} replies.`,
      `Pipeline: ${s.qualified ?? 0} ready, ${s.contacted ?? 0} contacted, ${(s.interested ?? 0) + (s.negotiating ?? 0)} interested, ${s.won ?? 0} won.`,
      `30 days: revenue ${inr(m.revenue)}, costs ${inr(m.costs)}, profit ${inr(m.profit)}.`,
    ].join("\n"),
    numbers.pendingApprovals ? `${numbers.pendingApprovals} payment link(s) need your approval.` : "",
    plan.recommendations.length ? `Suggestions:\n${plan.recommendations.map((r) => `• ${r}`).join("\n")}` : "",
    issues.length ? `Needs attention:\n${issues.join("\n")}` : "",
    "Reply here to give me instructions.",
  ].filter(Boolean).join("\n\n");
  const short = `${numbers.last7Days.outreach} messaged and ${numbers.last7Days.replies} replies this week, ${(s.interested ?? 0) + (s.negotiating ?? 0)} interested, ${s.won ?? 0} won, 30-day profit ${inr(m.profit)}${numbers.pendingApprovals ? `, ${numbers.pendingApprovals} approval(s) waiting` : ""}.`;
  await notifyOwner(text, short);
}

/**
 * Runs every TICK_SECONDS. Cheap and deterministic: it only looks at the pipeline
 * and queues work; the agents do the thinking inside their tasks.
 */
export async function tick() {
  const settings = await getSettings();
  // Manual mode (the default): nothing is found, drafted or sent unless a person asks.
  if (settings.paused || !settings.auto_outreach) return;
  const day = today();
  const bucket = `${day}T${localHour()}:${Math.floor(new Date().getMinutes() / 15)}`;

  if (settings.today_plan?.date !== day && localHour() >= 8) {
    await enqueue(AGENT, "dailyPlan", { report: true }, { dedupeKey: `plan:${day}` });
    await enqueue("builder", "posts", {}, { dedupeKey: `posts:${day}` });
  }

  const counts = (await metrics()).stages;
  const pool = (counts.qualified ?? 0) + (counts.new ?? 0);
  if (pool < (settings.daily_outreach_limit ?? 30) * 2) {
    await enqueue("marketing", "scout", {}, { dedupeKey: `scout:${day}:${settings.city}` });
  }
  if (counts.new) await enqueue("marketing", "qualify", {}, { dedupeKey: `qualify:${bucket}` });

  if (inSendWindow(settings.send_window)) {
    await enqueue("marketing", "outreach", {}, { dedupeKey: `outreach:${bucket}` });
    await enqueue("marketing", "followups", {}, { dedupeKey: `followups:${day}T${localHour()}` });
  }

  const sitesToday = await query(
    `SELECT count(*)::int AS n FROM agents.sites WHERE created_at > now() - interval '24 hours'`,
  );
  const room = (settings.max_sites_per_day ?? 5) - sitesToday.rows[0].n;
  if (room > 0) {
    const needSites = await query(
      `SELECT id FROM agents.leads l WHERE stage IN ('interested','negotiating')
         AND NOT EXISTS (SELECT 1 FROM agents.sites s WHERE s.lead_id=l.id) LIMIT $1`,
      [room],
    );
    for (const row of needSites.rows) await enqueue("builder", "site", { leadId: row.id }, { dedupeKey: `site:${row.id}` });
  }
}

/** A lead said they want to buy. Subscriptions sign up on g58.in; one-off work needs a payment link. */
export async function deal({ leadId, productCode }) {
  const settings = await getSettings();
  const lead = (await query(`SELECT * FROM agents.leads WHERE id=$1`, [leadId])).rows[0];
  const product = settings.products.find((item) => item.code === productCode)
    ?? settings.products.find((item) => item.code === lead?.product_fit);
  if (!lead || !product) {
    await log(AGENT, `Deal for lead ${leadId} needs a human: unknown product "${productCode}"`, { leadId }, "warn");
    return;
  }

  if (product.period === "month") {
    if (insideServiceWindow(lead) && product.url) {
      await sendText(lead, `Great! You can start ${product.name} here: ${product.url}\nThe first month is free. Reply here if you need help setting it up.`);
    }
    await log(AGENT, `Sent ${product.name} sign-up link to ${lead.name}`, { leadId });
    return;
  }

  await query(
    `INSERT INTO agents.approvals(kind, lead_id, payload, reason)
     VALUES('payment_link', $1, $2, $3)`,
    [leadId, JSON.stringify({ amount_inr: product.price_inr, product_code: product.code, description: `${product.name} for ${lead.name}` }),
      `${lead.name} is ready to buy ${product.name}`],
  );
  await log(AGENT, `Payment link for ${lead.name} (₹${product.price_inr}) is waiting for your approval`, { leadId }, "warn");
  await notifyOwner(
    `${lead.name} wants to buy ${product.name} (₹${product.price_inr}). Reply "approve ${lead.name}" to create and send the payment link, or "reject".`,
    `${lead.name} wants to buy ${product.name} for ₹${product.price_inr}. A payment link is waiting for your approval.`,
  );
}

/** Called from the dashboard when a human approves a payment request. */
export async function executeApproval(approvalId, decidedBy) {
  const approval = (await query(
    `UPDATE agents.approvals SET status='approved', decided_by=$2, decided_at=now()
     WHERE id=$1 AND status='pending' RETURNING *`,
    [approvalId, decidedBy],
  )).rows[0];
  if (!approval) throw new Error("Approval not found or already decided");
  const lead = (await query(`SELECT * FROM agents.leads WHERE id=$1`, [approval.lead_id])).rows[0];

  try {
    const link = await createPaymentLink({
      amountPaise: Math.round(Number(approval.payload.amount_inr) * 100),
      description: approval.payload.description,
      customer: { name: lead.name, phone: lead.phone },
      referenceId: `g58a_${approval.id.replace(/-/g, "").slice(0, 30)}`,
    });
    await query(`UPDATE agents.approvals SET result=$2 WHERE id=$1`, [approval.id, JSON.stringify(link)]);
    let delivered = false;
    if (insideServiceWindow(lead)) {
      await sendText(lead, `Here is the secure payment link for ${approval.payload.description} (₹${approval.payload.amount_inr}): ${link.url}`);
      delivered = true;
    }
    await log(AGENT, `Payment link created for ${lead.name}${delivered ? " and sent" : " — send it manually, the WhatsApp window is closed"}`, { link });
    return { ...link, delivered };
  } catch (error) {
    await query(`UPDATE agents.approvals SET status='failed', result=$2 WHERE id=$1`, [approval.id, JSON.stringify({ error: error.message })]);
    throw error;
  }
}

export async function recordPayment({ paymentLinkId, referenceId, amountPaise, paymentId }) {
  const approval = (await query(`SELECT * FROM agents.approvals WHERE result->>'id'=$1`, [paymentLinkId])).rows[0];
  await query(
    `INSERT INTO agents.ledger(kind, category, amount_paise, lead_id, ref, note)
     VALUES('revenue', $1, $2, $3, $4, $5) ON CONFLICT (ref) DO NOTHING`,
    [approval?.payload?.product_code ?? "payment", amountPaise, approval?.lead_id ?? null, `razorpay:${paymentId}`, referenceId ?? ""],
  );
  if (approval?.lead_id) {
    await query(`UPDATE agents.leads SET stage='won', updated_at=now() WHERE id=$1`, [approval.lead_id]);
  }
  await log(AGENT, `Payment received: ₹${amountPaise / 100}`, { paymentId, leadId: approval?.lead_id });
}
