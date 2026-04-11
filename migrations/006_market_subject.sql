-- Migration 006 — Market subject (optional player association)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS subject_user_id INTEGER REFERENCES users(userid) ON DELETE SET NULL;
