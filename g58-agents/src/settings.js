import { z } from "zod";

export const STAGES = ["new", "qualified", "skipped", "contacted", "replied", "interested", "negotiating", "won", "lost", "do_not_contact"];

/** Settings the owner may change, from the dashboard form or by asking the coordinator. */
export const SettingsInput = z.object({
  paused: z.boolean(),
  auto_outreach: z.boolean(),
  email_daily_limit: z.number().int().min(0).max(500),
  city: z.string().min(2).max(80),
  categories: z.array(z.string().regex(/^[a-z_]+$/)).min(1).max(20),
  daily_outreach_limit: z.number().int().min(0).max(250),
  send_window: z.object({ start: z.number().int().min(0).max(23), end: z.number().int().min(1).max(24) }),
  followup_days: z.array(z.number().int().min(1).max(60)).max(4),
  max_qualify_per_tick: z.number().int().min(1).max(50),
  max_sites_per_day: z.number().int().min(0).max(50),
  products: z.array(z.object({
    code: z.string(), name: z.string(), price_inr: z.number().min(0), period: z.enum(["once", "month"]), url: z.string(), pitch: z.string(),
  })),
}).partial();

/** Standing instructions from the owner, shown to the marketing agent on every lead it handles. */
export const guidanceText = (settings) => (settings.owner_guidance?.length
  ? `\nStanding instructions from the G58 owner (follow them):\n${settings.owner_guidance.map((g) => `- ${g}`).join("\n")}`
  : "");
