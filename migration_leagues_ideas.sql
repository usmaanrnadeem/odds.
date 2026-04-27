-- Migration: leagues + market ideas
-- Run this on Supabase SQL editor

-- Leagues: time-bounded competitions within a group
CREATE TABLE IF NOT EXISTS leagues (
    league_id        SERIAL PRIMARY KEY,
    group_id         INT NOT NULL REFERENCES groups(group_id),
    name             TEXT NOT NULL,
    starts_at        TIMESTAMPTZ NOT NULL,
    ends_at          TIMESTAMPTZ NOT NULL,
    status           TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'ended'
    starting_points  FLOAT NOT NULL DEFAULT 1000.0,
    schedule_frequency TEXT DEFAULT NULL,              -- 'weekly' | 'biweekly' | 'custom'
    schedule_day     INT DEFAULT NULL,                 -- 0=Mon ... 6=Sun
    schedule_time    TEXT DEFAULT NULL,                -- 'HH:MM' (display only)
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       INT REFERENCES users(userid)
);

-- Tag markets to a league
ALTER TABLE markets ADD COLUMN IF NOT EXISTS league_id INT REFERENCES leagues(league_id);

-- Market ideas submitted by group members
CREATE TABLE IF NOT EXISTS market_ideas (
    idea_id      SERIAL PRIMARY KEY,
    group_id     INT NOT NULL REFERENCES groups(group_id),
    submitted_by INT NOT NULL REFERENCES users(userid),
    title        TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    admin_note   TEXT,
    market_id    INT REFERENCES markets(marketid), -- set when approved
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at  TIMESTAMPTZ,
    reviewed_by  INT REFERENCES users(userid)
);

-- Index for fast pending-ideas lookup per group
CREATE INDEX IF NOT EXISTS idx_ideas_group_status ON market_ideas(group_id, status);
CREATE INDEX IF NOT EXISTS idx_leagues_group ON leagues(group_id);
CREATE INDEX IF NOT EXISTS idx_markets_league ON markets(league_id);
