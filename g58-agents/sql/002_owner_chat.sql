-- One running conversation between the owner and the coordinator, shared by the
-- dashboard chat box and the owner's WhatsApp.
CREATE TABLE IF NOT EXISTS agents.owner_chat (
  id bigserial PRIMARY KEY,
  channel text NOT NULL CHECK (channel IN ('dashboard','whatsapp','report')),
  role text NOT NULL CHECK (role IN ('owner','coordinator')),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_chat_created_idx ON agents.owner_chat(created_at DESC);

INSERT INTO agents.settings(key, value) VALUES ('owner_guidance', '[]') ON CONFLICT (key) DO NOTHING;
