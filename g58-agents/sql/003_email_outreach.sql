-- Manual email outreach: the agent finds emails and drafts; a person reviews and clicks Send.
ALTER TABLE agents.leads ADD COLUMN IF NOT EXISTS email_source text;
-- Only leads from the email search are kept unique by address; older leads (e.g. branches of
-- one chain sharing an email) are left as they are. findEmails also skips any known address.
CREATE UNIQUE INDEX IF NOT EXISTS leads_email_idx ON agents.leads(lower(email)) WHERE email IS NOT NULL AND email_source IS NOT NULL;

CREATE TABLE IF NOT EXISTS agents.email_opt_outs (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents.email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES agents.leads(id) ON DELETE CASCADE,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  drafted_by text NOT NULL DEFAULT 'template',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','discarded','failed')),
  error text,
  sent_by text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_drafts_status_idx ON agents.email_drafts(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS email_drafts_open_idx ON agents.email_drafts(lead_id) WHERE status = 'draft';

INSERT INTO agents.settings(key, value) VALUES
  ('auto_outreach', 'false'),
  ('email_daily_limit', '50')
ON CONFLICT (key) DO NOTHING;
