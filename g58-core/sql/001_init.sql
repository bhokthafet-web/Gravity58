CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE,
  password_hash text,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'support', 'admin', 'super_admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'deleted')),
  email_verified_at timestamptz,
  is_guest boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS reset_user_idx ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS records (
  id varchar(96) PRIMARY KEY,
  kind varchar(96) NOT NULL,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  participant_ids uuid[] NOT NULL DEFAULT '{}',
  visibility varchar(16) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'shared')),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS records_kind_created_idx ON records(kind, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS records_owner_idx ON records(owner_id, kind) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS records_participants_idx ON records USING gin(participant_ids);
CREATE INDEX IF NOT EXISTS records_payload_idx ON records USING gin(payload jsonb_path_ops);
CREATE INDEX IF NOT EXISTS records_expiry_idx ON records(expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  record_id varchar(96) REFERENCES records(id) ON DELETE SET NULL,
  purpose varchar(64) NOT NULL DEFAULT 'media',
  original_name text NOT NULL,
  storage_name text UNIQUE NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  delete_after timestamptz,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS media_owner_idx ON media_files(owner_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS media_expiry_idx ON media_files(delete_after) WHERE delete_after IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_logs(actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_touch_updated_at ON users;
CREATE TRIGGER users_touch_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS records_touch_updated_at ON records;
CREATE TRIGGER records_touch_updated_at BEFORE UPDATE ON records
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
