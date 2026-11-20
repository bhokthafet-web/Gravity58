import { normalizeIndianPhone } from "./phone.js";

const env = process.env;

const required = (name) => {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
};

const int = (name, fallback) => {
  const value = Number.parseInt(env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
};

export const config = {
  port: int("PORT", 8090),
  databaseUrl: required("DATABASE_URL"),
  publicBaseUrl: (env.PUBLIC_BASE_URL || "https://server.g58.in/agents").replace(/\/$/, ""),
  sessionCookie: env.SESSION_COOKIE || "g58_session",

  model: env.CLAUDE_MODEL || "claude-opus-5-5",
  // Rupees charged per USD when converting Claude usage into ledger costs.
  usdToInr: Number(env.USD_TO_INR || 84),

  // The owner's own WhatsApp number. Messages from it go to the coordinator, not the sales agent.
  ownerPhone: normalizeIndianPhone(env.OWNER_WHATSAPP),

  // Coordinator tick: how often the manager agent re-plans and hands out work.
  tickSeconds: int("TICK_SECONDS", 300),
  timezone: env.TZ_NAME || "Asia/Kolkata",

  whatsapp: {
    token: env.WA_TOKEN || "",
    phoneNumberId: env.WA_PHONE_NUMBER_ID || "",
    appSecret: env.WA_APP_SECRET || "",
    verifyToken: env.WA_VERIFY_TOKEN || "",
    graphVersion: env.WA_GRAPH_VERSION || "v23.0",
    graphBase: (env.WA_GRAPH_BASE || "https://graph.facebook.com").replace(/\/$/, ""),
    introTemplate: env.WA_TEMPLATE_INTRO || "g58_intro",
    followupTemplate: env.WA_TEMPLATE_FOLLOWUP || "g58_followup",
    ownerReportTemplate: env.WA_TEMPLATE_OWNER_REPORT || "g58_owner_report",
    templateLanguage: env.WA_TEMPLATE_LANG || "en",
    // Rupees per business-initiated marketing conversation, for the P&L.
    costPerConversationInr: Number(env.WA_COST_PER_CONVERSATION_INR || 0.8),
  },

  // Outgoing email (same Brevo SMTP relay G58 Core uses). Replies go to MAIL_REPLY_TO.
  smtp: {
    host: env.SMTP_HOST || "",
    port: int("SMTP_PORT", 587),
    secure: env.SMTP_SECURE === "true",
    user: env.SMTP_USER || "",
    pass: env.SMTP_PASS || "",
    from: env.MAIL_FROM || env.SMTP_FROM || "",
    replyTo: env.MAIL_REPLY_TO || "",
  },
  // Signs unsubscribe links; falls back to a value derived from the database URL.
  unsubscribeSecret: env.UNSUBSCRIBE_SECRET || "",
  claudeEnabled: Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN),

  razorpay: {
    keyId: env.RAZORPAY_KEY_ID || "",
    keySecret: env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || "",
  },

  // Comma-separated; mirrors are tried in order because the public servers are often overloaded.
  overpassUrls: (env.OVERPASS_URL || "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter")
    .split(",").map((url) => url.trim()).filter(Boolean),
};

export const smtpEnabled = () => Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from);
export const whatsappEnabled = () => Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId);
export const razorpayEnabled = () => Boolean(config.razorpay.keyId && config.razorpay.keySecret);
