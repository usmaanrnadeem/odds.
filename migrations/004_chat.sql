-- Migration 004 — Chat messages
-- Run in Supabase SQL editor.
CREATE TABLE IF NOT EXISTS messages (
    id         BIGSERIAL PRIMARY KEY,
    market_id  INTEGER REFERENCES markets(marketid) ON DELETE CASCADE,
    group_id   INTEGER REFERENCES groups(group_id)  ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
    content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 280),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_market_idx ON messages (market_id, created_at ASC);
CREATE INDEX IF NOT EXISTS messages_group_idx  ON messages (group_id,  created_at ASC);
