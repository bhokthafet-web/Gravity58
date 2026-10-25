import crypto from "node:crypto";
import { config, razorpayEnabled } from "../config.js";

/** Creates a Razorpay payment link. Amount is in paise. */
export async function createPaymentLink({ amountPaise, description, customer, referenceId }) {
  if (!razorpayEnabled()) throw new Error("Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      description: description.slice(0, 2048),
      reference_id: referenceId,
      customer: { name: customer.name, contact: customer.phone ? `+${customer.phone}` : undefined },
      notify: { sms: false, email: false },
      reminder_enable: true,
      expire_by: Math.floor(Date.now() / 1000) + 14 * 24 * 3600,
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Razorpay ${response.status}: ${json?.error?.description || "unknown error"}`);
  return { id: json.id, url: json.short_url };
}

export function verifyWebhook(rawBody, signature) {
  if (!config.razorpay.webhookSecret || !signature) return false;
  const expected = crypto.createHmac("sha256", config.razorpay.webhookSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
