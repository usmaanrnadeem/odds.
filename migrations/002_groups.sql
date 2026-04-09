-- ============================================================
--  Migration 002 — Groups / Universes
--  Run in Supabase SQL editor.
--  Wipes all existing data and adds group support.
-- ============================================================

-- ── Wipe all data ────────────────────────────────────────────
-- CASCADE handles all FK-dependent tables automatically.
TRUNCATE trades, positions, market_prices, trophies, markets, invite_tokens, users
  RESTART IDENTITY CASCADE;

-- ── Groups ───────────────────────────────────────────────────
-- Each "universe" is a group. Creator becomes group admin.
CREATE TABLE IF NOT EXISTS groups (
    group_id      SERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_by    INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One group per user (UNIQUE on user_id enforces this).
CREATE TABLE IF NOT EXISTS group_memberships (
    group_id  INTEGER NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(userid)   ON DELETE CASCADE,
    role      TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id),
    UNIQUE (user_id)   -- one group per user
);

-- ── Scope markets to a group ─────────────────────────────────
ALTER TABLE markets ADD COLUMN IF NOT EXISTS
    group_id INTEGER REFERENCES groups(group_id) ON DELETE CASCADE;

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_markets_group     ON markets(group_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user  ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_group ON group_memberships(group_id);
