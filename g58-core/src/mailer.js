import nodemailer from "nodemailer";
import { config } from "./config.js";

let transporter;

function transport() {
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    throw new Error("SMTP is not configured");
  }
  transporter ||= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return transporter;
}

export async function sendPasswordReset({ email, name, resetUrl }) {
  return transport().sendMail({
    from: config.smtp.from,
    to: email,
    subject: "Reset your Gravity58 password",
    text: `Hello ${name || "there"},\n\nOpen this secure link to reset your Gravity58 password:\n${resetUrl}\n\nThe link expires in 30 minutes. If you did not request it, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827"><h1 style="color:#ff6b00">Reset your Gravity58 password</h1><p>Hello ${escapeHtml(name || "there")},</p><p>Use the button below within 30 minutes.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#ff6b00;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">Reset password</a></p><p>If you did not request this, you can ignore the email.</p></div>`,
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}
