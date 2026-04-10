-- Migration 005 — Group join tokens
-- Run in Supabase SQL editor.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS join_token TEXT UNIQUE;
UPDATE groups SET join_token = substr(md5(random()::text || group_id::text), 1, 24) WHERE join_token IS NULL;
