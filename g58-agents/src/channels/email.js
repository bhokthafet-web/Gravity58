import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { config, smtpEnabled } from "../config.js";

let transporter;

function transport() {
  if (!smtpEnabled()) throw new Error("Email is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM)");
  transporter ||= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return transporter;
}

const secret = () => config.unsubscribeSecret
  || crypto.createHash("sha256").update(`unsubscribe:${config.databaseUrl}`).digest("hex");

export const unsubscribeToken = (email) =>
  crypto.createHmac("sha256", secret()).update(String(email).toLowerCase()).digest("hex").slice(0, 32);

export function verifyUnsubscribe(email, token) {
  const expected = Buffer.from(unsubscribeToken(email));
  const given = Buffer.from(String(token || ""));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export const unsubscribeUrl = (email) =>
  `${config.publicBaseUrl}/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`;

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);

/** Plain text and simple HTML versions of the email, with a G58 footer and unsubscribe link. */
export function composeEmail(body, to) {
  const link = unsubscribeUrl(to);
  const footer = `Gravity58 · https://g58.in\nDon't want emails from us? Unsubscribe: ${link}`;
  const text = `${body.trim()}\n\n--\n${footer}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827;max-width:600px">
${escapeHtml(body.trim()).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>")}
<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0 8px">
<p style="font-size:12px;color:#6b7280">Gravity58 · <a href="https://g58.in">g58.in</a><br>
Don't want emails from us? <a href="${escapeHtml(link)}">Unsubscribe</a></p></div>`;
  return { text, html, link };
}

export async function sendEmail({ to, subject, body }) {
  const { text, html, link } = composeEmail(body, to);
  const info = await transport().sendMail({
    from: config.smtp.from,
    to,
    replyTo: config.smtp.replyTo || undefined,
    subject,
    text,
    html,
    headers: { "List-Unsubscribe": `<${link}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  return info.messageId;
}
