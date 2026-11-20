# G58 Agents

Three AI agents that find local businesses, talk to them on WhatsApp, build website previews and keep the books for Gravity58. They run as one Docker service next to G58 Core on the VPS and use the same PostgreSQL database, in a separate `agents` schema.

| Agent | What it does |
|---|---|
| **Marketing** (`src/agents/marketing.js`) | Finds businesses with mobile numbers on OpenStreetMap, scores them with Claude, sends the approved WhatsApp intro template and follow-ups, and answers replies |
| **Builder** (`src/agents/builder.js`) | Makes a free one-page website preview for interested leads (served at `/agents/sites/<slug>`) and drafts Instagram, X and Facebook posts for you to publish |
| **Coordinator** (`src/agents/coordinator.js`) | Runs every 5 minutes and hands out work. Writes a daily plan and status report with Claude, sends sign-up links for subscriptions, queues Razorpay payment links **for your approval**, and records revenue and costs (Claude, WhatsApp) for the P&L |

## Email outreach (manual, the default)

Automatic outreach is **off** (`auto_outreach` setting). Nothing is found, drafted or sent until you ask, and every email is sent by a person clicking **Send**.

1. In the dashboard's **Email** tab, enter an area ("Kukatpally, Hyderabad") and business types, then click **Find emails**. The agent (`src/agents/email.js`) looks the area up on OpenStreetMap and collects businesses that list an email or a website. For websites it reads the home and contact pages and keeps only addresses on the business's own domain or a personal provider (Gmail, Yahoo, Outlook, Rediffmail…), so it never emails a web designer or partner by mistake.
2. Click **Draft emails for new businesses**. Drafts come from fixed templates (Digital Menu for food places, a website offer for businesses without one, Refills for other shops), or are written by Claude when `ANTHROPIC_API_KEY` is set.
3. Review each draft, edit the address, subject or text, then click **Send**. Emails go through Brevo SMTP from `MAIL_FROM`; replies go to `MAIL_REPLY_TO`. A footer with a one-click unsubscribe link is added automatically, unsubscribed addresses are never emailed again, and a daily limit (50 by default) protects your sender reputation.

OpenStreetMap coverage in India is thin: a city-wide search of Hyderabad cafes, restaurants and bakeries found 59 businesses with an email or website, giving 14 usable addresses. More business types and more areas give more.

## Talking to the coordinator

Write to the coordinator in plain words, in the **Talk to the coordinator** box on the dashboard or from your own WhatsApp number (`OWNER_WHATSAPP`). Both are one conversation. Examples:

- "Focus on salons and bakeries in Kukatpally, max 15 messages a day"
- "Don't offer POS any more; tell restaurants the first month of Digital Menu is free"
- "How many replies did we get this week? What did we spend?"
- "What does Snap Mandi want? Tell them we'll call tomorrow at 11"
- "Approve the website payment for Snap Mandi"
- "Pause everything"

The coordinator changes settings, saves standing instructions that the sales agent follows with every business, starts jobs, updates leads, messages a lead for you, records revenue or costs, and approves or rejects payment links. It only approves or rejects a payment when your own message says "approve" or "reject". It never acts on what a business writes.

Every morning, at the first check after 8 AM IST, it sends you a **daily report** on WhatsApp. You also get an alert when a payment link is waiting or a business needs a person. If you haven't written to the number in the last 24 hours, Meta only allows a template, so you get a one-line summary. Reply to it, and the full report and conversation continue as normal messages.

Dashboard: `https://server.g58.in/agents/`. Sign in at `https://server.g58.in/console/` first; only `admin` and `super_admin` accounts can use it.

## Safety rails

- Agents start **paused**. Nothing is sent until you press **Start agents**.
- WhatsApp outreach is capped per day (30 by default), only goes out 10:00–19:00 IST, and only uses Meta-approved templates. Free-form replies are sent only inside the 24-hour window after the customer writes.
- Replies like `STOP` or "not interested" add the number to a permanent do-not-contact list.
- If Meta flags or downgrades the WhatsApp number, all agents pause automatically.
- Money is never moved automatically. Payment links wait in **Approvals** until you approve them.
- Generated websites are stripped of scripts and served with a CSP that blocks JavaScript.

## Before you start: accounts you need

1. **Claude API key**: create one at console.anthropic.com and add credit. Expect roughly ₹1–3 per lead qualified and replied to. Actual spend shows on the Money tab.
2. **WhatsApp Cloud API**: create a Meta Business account and an app with the WhatsApp product, then add a phone number that is **not** already used in the WhatsApp app. Get business verification done to raise sending limits. Set `OWNER_WHATSAPP` to your personal number, which must be different from the business number. Create these templates in WhatsApp Manager:
   - `g58_intro` (category **Marketing**): `Hi {{1}}, this is Gravity58 from Hyderabad. {{2}} Would you like to try it free for a month? Reply STOP to opt out.`
   - `g58_followup` (category **Marketing**): `Hi {{1}}, just following up on our message about Gravity58. Happy to answer any questions. Reply STOP to opt out.`
   - `g58_owner_report` (category **Utility**): `G58 daily report: {{1}} Reply to this message to talk to your coordinator.`
   - Set the webhook to `https://server.g58.in/agents/webhooks/whatsapp`, using your `WA_VERIFY_TOKEN`, and subscribe to `messages`, `phone_number_quality_update` and `account_update`.
3. **Razorpay** (only for one-off payments such as websites): add API keys and a webhook to `https://server.g58.in/agents/webhooks/razorpay` for the event `payment_link.paid`.

> **Important:** Meta's WhatsApp Business policy expects people to have agreed to receive business messages. Cold messages to businesses found online are risky: if many people block or report you, Meta lowers your number's quality and can ban it. Keep the daily limit low (start at 10–20), make the pitch genuinely useful, and watch the Activity tab. Under India's DPDP Act, honour every opt-out immediately. The agents do this automatically.

## Deploy on the VPS

```bash
# on the VPS, after copying this folder to /opt/g58-agents
cd /opt/g58-agents
cp .env.example .env && chmod 600 .env
# set DATABASE_URL using POSTGRES_PASSWORD from /opt/g58-core-staging/.env, then fill in the API keys
sudo docker compose up -d --build
curl -s http://127.0.0.1:8090/health
# route /agents/* through the G58 edge (Caddyfile in g58-core already has the rule)
cd /opt/g58-core-staging && sudo docker compose --profile edge restart edge
```

## Local checks

```bash
npm install
npm test
```

## Notes

- Leads come from OpenStreetMap. In Hyderabad, three categories (cafe, bakery, restaurant) gave about 70 businesses with mobile numbers, so coverage is thin. Google Places can be added later for many more leads.
- Subscriptions (Digital Menu, Refills) sign up and pay on g58.in itself. Mark those leads **won** in the dashboard and add the revenue on the Money tab, or connect G58 Core subscription records later.
- Social posts are drafts. Posting automatically to Instagram or X would need the Meta Graph API or the paid X API.
