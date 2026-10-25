import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { config } from "./config.js";
import { query } from "./db.js";

export const client = new Anthropic();

// USD per million tokens for the configured model (Claude Opus 5.5).
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

export const SHARED_SYSTEM = `You work for Gravity58 (G58, https://g58.in), a small Indian software company that sells simple
business tools to local shops, restaurants and service businesses: G58 Digital Menu (QR menu and table orders),
G58 Refills (online store and repeat orders), G58 POS (free billing app) and one-page business websites.
Be honest and specific. Never invent facts about a business, never promise features G58 does not have,
never pressure people, and always respect a request to stop being contacted.`;

export async function recordCost(agent, usage) {
  if (!usage) return;
  const usd = ((usage.input_tokens || 0) * PRICE.input
    + (usage.output_tokens || 0) * PRICE.output
    + (usage.cache_read_input_tokens || 0) * PRICE.cacheRead
    + (usage.cache_creation_input_tokens || 0) * PRICE.cacheWrite) / 1_000_000;
  const paise = Math.round(usd * config.usdToInr * 100);
  if (paise <= 0) return;
  await query(
    `INSERT INTO agents.ledger(kind, category, amount_paise, note) VALUES('cost', 'claude_api', $1, $2)`,
    [paise, agent],
  );
}

/**
 * One structured call to Claude. Returns the parsed object matching `schema`,
 * or throws if Claude refused or the output did not parse.
 */
export async function think({ agent, system, prompt, schema, effort = "medium", maxTokens = 16000 }) {
  const response = await client.beta.messages.parse({
    model: config.model,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: SHARED_SYSTEM },
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: prompt }],
    output_config: { effort, format: betaZodOutputFormat(schema) },
  });
  await recordCost(agent, response.usage);

  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined (${response.stop_details?.category ?? "unknown"})`);
  }
  if (response.stop_reason === "max_tokens") throw new Error("Claude output was cut off at max_tokens");
  if (!response.parsed_output) throw new Error("Claude output did not match the expected schema");
  return response.parsed_output;
}
