-- Migration 003 — Market close time
-- Run in Supabase SQL editor.
ALTER TABLE markets ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ;
