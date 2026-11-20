-- Saved call/visit lists (businesses of a type in an area, mostly without email).
CREATE TABLE IF NOT EXISTS agents.visit_lists (
  id bigserial PRIMARY KEY,
  area text NOT NULL,
  types text[] NOT NULL,
  rows jsonb NOT NULL,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
