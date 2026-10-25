// Messages between the coordinator and the G58 owner's own WhatsApp number.
import { config, whatsappEnabled } from "../config.js";
import { query, getSettings, setSetting, log } from "../db.js";
import { send } from "./whatsapp.js";

export const isOwner = (phone) => Boolean(config.ownerPhone) && phone === config.ownerPhone;

export async function saveChat(channel, role, text) {
  await query(`INSERT INTO agents.owner_chat(channel, role, text) VALUES($1, $2, $3)`, [channel, role, text]);
}

export async function markOwnerInbound() {
  await setSetting("owner_last_inbound", new Date().toISOString());
}

async function ownerWindowOpen() {
  const last = (await getSettings()).owner_last_inbound;
  return Boolean(last) && Date.now() - new Date(last).getTime() < 23 * 3600 * 1000;
}

// Template parameters may not contain newlines, tabs or long runs of spaces.
export const templateSafe = (text) => String(text).replace(/\s+/g, " ").trim().slice(0, 900);

/**
 * Sends the owner a message. Inside WhatsApp's 24-hour window the full text goes out;
 * otherwise Meta only allows the approved report template, so `shortLine` is sent and
 * the owner can reply to open the window. Everything is also kept in the chat history.
 */
export async function notifyOwner(text, shortLine = text, channel = "report") {
  await saveChat(channel, "coordinator", text);
  if (!config.ownerPhone || !whatsappEnabled()) return;
  try {
    if (await ownerWindowOpen()) {
      await send(config.ownerPhone, { type: "text", text: { body: text.slice(0, 4000) } });
    } else {
      await send(config.ownerPhone, {
        type: "template",
        template: {
          name: config.whatsapp.ownerReportTemplate,
          language: { code: config.whatsapp.templateLanguage },
          components: [{ type: "body", parameters: [{ type: "text", text: templateSafe(shortLine) }] }],
        },
      });
    }
  } catch (error) {
    await log("coordinator", `Could not message the owner on WhatsApp: ${error.message}`, null, "warn");
  }
}

/** Replies to a message the owner just sent, so the 24-hour window is open. */
export async function replyToOwner(text) {
  if (!config.ownerPhone || !whatsappEnabled()) return;
  await send(config.ownerPhone, { type: "text", text: { body: text.slice(0, 4000) } });
}
