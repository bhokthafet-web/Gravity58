CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS agents;

CREATE TABLE IF NOT EXISTS agents.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO agents.settings(key, value) VALUES
  ('paused', 'true'),
  ('city', '"Hyderabad"'),
  ('categories', '["restaurant","cafe","fast_food","bakery","supermarket","convenience","clothes","beauty","hairdresser","pharmacy"]'),
  ('daily_outreach_limit', '30'),
  ('send_window', '{"start":10,"end":19}'),
  ('followup_days', '[3,7]'),
  ('max_qualify_per_tick', '10'),
  ('max_sites_per_day', '5'),
  ('products', '[
    {"code":"digital_menu","name":"G58 Digital Menu","price_inr":699,"period":"month","url":"https://g58.in/digital-menu/","pitch":"QR menu and live table orders for restaurants and cafes. First month free."},
    {"code":"refills","name":"G58 Refills","price_inr":699,"period":"month","url":"https://g58.in/pricing/","pitch":"Take any store online with repeat and refill orders. First month free."},
    {"code":"pos","name":"G58 POS","price_inr":0,"period":"month","url":"https://g58.in/pos/","pitch":"Free UPI billing POS with a Premium upgrade."},
    {"code":"website","name":"Business website","price_inr":2999,"period":"once","url":"","pitch":"One-page website with WhatsApp, map and Google listing links."}
  ]')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS agents.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'osm',
  source_ref text UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  phone text,
  email text,
  website text,
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  lat double precision,
  lon double precision,
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN
    ('new','qualified','skipped','contacted','replied','interested','negotiating','won','lost','do_not_contact')),
  score int,
  product_fit text,
  pitch text,
  notes text NOT NULL DEFAULT '',
  followups_sent int NOT NULL DEFAULT 0,
  last_contacted_at timestamptz,
  last_inbound_at timestamptz,
  next_followup_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_stage_idx ON agents.leads(stage, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_idx ON agents.leads(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_followup_idx ON agents.leads(next_followup_at) WHERE next_followup_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS agents.opt_outs (
  phone text PRIMARY KEY,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES agents.leads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  channel text NOT NULL DEFAULT 'whatsapp',
  body text NOT NULL DEFAULT '',
  template text,
  external_id text UNIQUE,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_lead_idx ON agents.messages(lead_id, created_at);

CREATE TABLE IF NOT EXISTS agents.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES agents.leads(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  html text NOT NULL,
  status text NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','live','archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES agents.leads(id) ON DELETE SET NULL,
  platform text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','discarded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents.tasks (
  id bigserial PRIMARY KEY,
  agent text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  dedupe_key text UNIQUE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  attempts int NOT NULL DEFAULT 0,
  run_after timestamptz NOT NULL DEFAULT now(),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS tasks_queue_idx ON agents.tasks(status, run_after);

CREATE TABLE IF NOT EXISTS agents.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  lead_id uuid REFERENCES agents.leads(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','failed')),
  decided_by text,
  decided_at timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approvals_status_idx ON agents.approvals(status, created_at);

CREATE TABLE IF NOT EXISTS agents.ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('revenue','cost')),
  category text NOT NULL,
  amount_paise bigint NOT NULL,
  lead_id uuid REFERENCES agents.leads(id) ON DELETE SET NULL,
  ref text UNIQUE,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_created_idx ON agents.ledger(created_at);

CREATE TABLE IF NOT EXISTS agents.agent_log (
  id bigserial PRIMARY KEY,
  agent text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_log_created_idx ON agents.agent_log(created_at DESC);
