-- ============================================================
--  Prediction Market — Full Schema
--  Run once against Supabase. Safe to re-run (IF NOT EXISTS).
-- ============================================================

-- ── USERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    userID       SERIAL PRIMARY KEY,
    username     TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    points       NUMERIC(12, 2) NOT NULL DEFAULT 1000.00,
    is_admin     BOOLEAN NOT NULL DEFAULT FALSE,
    token_key    TEXT NOT NULL DEFAULT 'rocket'
                     CHECK (token_key IN ('wizard','rocket','fox','knight','shark','bull','ghost','dragon')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INVITE TOKENS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_tokens (
    id          SERIAL PRIMARY KEY,
    token       TEXT NOT NULL UNIQUE,
    created_by  INTEGER NOT NULL REFERENCES users(userID),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    used_by     INTEGER REFERENCES users(userID)
);

-- ── MARKETS ────────────────────────────────────────────────
--  status: 'pending' | 'open' | 'settled'
CREATE TABLE IF NOT EXISTS markets (
    marketID        SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    description     TEXT,
    b               NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
    outstandingYes  NUMERIC(12, 4) NOT NULL DEFAULT 0,
    outstandingNo   NUMERIC(12, 4) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'open', 'settled')),
    settled_side    BOOLEAN,          -- TRUE = YES won, FALSE = NO won, NULL = not settled
    created_by      INTEGER NOT NULL REFERENCES users(userID),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at      TIMESTAMPTZ
);

-- ── POSITIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS positions (
    positionID  SERIAL PRIMARY KEY,
    userID      INTEGER NOT NULL REFERENCES users(userID),
    marketID    INTEGER NOT NULL REFERENCES markets(marketID),
    yesPos      NUMERIC(12, 4) NOT NULL DEFAULT 0,
    noPos       NUMERIC(12, 4) NOT NULL DEFAULT 0,
    UNIQUE (userID, marketID)
);

-- ── TRADES ─────────────────────────────────────────────────
--  is_bot: bot trades are stored but never shown in activity feed
CREATE TABLE IF NOT EXISTS trades (
    tradeID     SERIAL PRIMARY KEY,
    marketID    INTEGER NOT NULL REFERENCES markets(marketID),
    userID      INTEGER REFERENCES users(userID),   -- NULL for bots
    side        BOOLEAN NOT NULL,                    -- TRUE=YES, FALSE=NO
    quantity    NUMERIC(12, 4) NOT NULL,
    cost        NUMERIC(12, 4) NOT NULL,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_bot      BOOLEAN NOT NULL DEFAULT FALSE,
    bot_name    TEXT                                 -- e.g. 'noise_bot_1', NULL for humans
);

-- ── MARKET PRICES ──────────────────────────────────────────
--  One row per trade — drives sparklines + trophy card arc
CREATE TABLE IF NOT EXISTS market_prices (
    id          SERIAL PRIMARY KEY,
    marketID    INTEGER NOT NULL REFERENCES markets(marketID),
    yes_prob    NUMERIC(8, 6) NOT NULL,
    no_prob     NUMERIC(8, 6) NOT NULL,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TROPHIES ───────────────────────────────────────────────
--  Awarded at settlement. Top 3 earners per market get a card.
--  rarity: 'legendary' | 'rare' | 'common'
CREATE TABLE IF NOT EXISTS trophies (
    id          SERIAL PRIMARY KEY,
    userID      INTEGER NOT NULL REFERENCES users(userID),
    marketID    INTEGER NOT NULL REFERENCES markets(marketID),
    rank        INTEGER NOT NULL CHECK (rank IN (1, 2, 3)),
    profit      NUMERIC(12, 4) NOT NULL,
    title       TEXT NOT NULL,   -- 'The Oracle', 'The Contrarian', etc.
    rarity      TEXT NOT NULL DEFAULT 'common'
                    CHECK (rarity IN ('legendary', 'rare', 'common')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (userID, marketID)
);

-- ── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trades_market     ON trades(marketID);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp  ON trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_prices_market     ON market_prices(marketID);
CREATE INDEX IF NOT EXISTS idx_prices_timestamp  ON market_prices(marketID, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_positions_user    ON positions(userID);
CREATE INDEX IF NOT EXISTS idx_positions_market  ON positions(marketID);
CREATE INDEX IF NOT EXISTS idx_trophies_user     ON trophies(userID);
