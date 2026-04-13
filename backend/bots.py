"""
Background noise bot.
Single unbiased bot that makes tiny random trades on quiet markets only.
Backs off when humans are active. Never pushes price to extremes.
"""
import asyncio
import logging
import random
from datetime import datetime, timezone, timedelta
from typing import Optional

import asyncpg

from .db import get_pool
from .lmsr import cost_buy, current_price
from . import market_cache

logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────

BOT_MIN_INTERVAL  = 5 * 60    # minimum seconds between cycles (5 min)
BOT_MAX_INTERVAL  = 15 * 60   # maximum seconds between cycles (15 min)
BOT_MIN_QTY       = 1
BOT_MAX_QTY       = 3         # small trades only
HUMAN_QUIET_MINS  = 30        # skip market if a human traded within this window
PRICE_SKIP_BAND   = 0.08      # skip if yes_prob is within this of 50% (already balanced)

# ── State ────────────────────────────────────────────────────────────────────

_task: Optional[asyncio.Task] = None


# ── Internal helpers ─────────────────────────────────────────────────────────

async def _last_human_trade(pool: asyncpg.Pool, market_id: int) -> Optional[datetime]:
    """Return timestamp of most recent non-bot trade on this market, or None."""
    row = await pool.fetchrow(
        "SELECT MAX(timestamp) AS ts FROM trades WHERE marketid = $1 AND is_bot = FALSE",
        market_id,
    )
    return row["ts"] if row else None


async def _do_bot_cycle(pool: asyncpg.Pool) -> None:
    """One tick: pick one quiet market, make one small random trade."""
    rows = await pool.fetch("SELECT marketid FROM markets WHERE status = 'open'")
    if not rows:
        return

    # Shuffle so we don't always hit the same market first
    market_ids = [r["marketid"] for r in rows]
    random.shuffle(market_ids)

    now = datetime.now(timezone.utc)
    quiet_cutoff = now - timedelta(minutes=HUMAN_QUIET_MINS)

    for mid in market_ids:
        # Skip if a human traded recently — market is alive, bot not needed
        last_trade = await _last_human_trade(pool, mid)
        if last_trade and last_trade.replace(tzinfo=timezone.utc) > quiet_cutoff:
            continue

        lock = market_cache.get_lock(mid)
        async with lock:
            state = await market_cache.get_state(pool, mid)
            if not state or state["status"] != "open":
                continue

            b     = state["b"]
            yes_q = state["yes_qty"]
            no_q  = state["no_qty"]

            yes_prob = current_price(b, yes_q, no_q)

            # Skip if price is already near 50/50 — no nudge needed
            if abs(yes_prob - 0.5) < PRICE_SKIP_BAND:
                continue

            # Pure random side — no bias
            side = random.random() < 0.5
            qty  = random.randint(BOT_MIN_QTY, BOT_MAX_QTY)

            trade_cost = cost_buy(b, yes_q, no_q, qty, side)

            yes_delta = qty if side else 0
            no_delta  = 0 if side else qty
            new_yes   = yes_q + yes_delta
            new_no    = no_q  + no_delta
            new_prob  = current_price(b, new_yes, new_no)

            if side:
                await pool.execute(
                    """
                    WITH mkt AS (
                        UPDATE markets SET outstandingyes = outstandingyes + $1
                        WHERE marketid = $2
                    )
                    INSERT INTO trades (marketid, userid, side, quantity, cost, is_bot, bot_name)
                    VALUES ($2, NULL, TRUE, $1, $3, TRUE, 'noise')
                    """,
                    qty, mid, trade_cost,
                )
            else:
                await pool.execute(
                    """
                    WITH mkt AS (
                        UPDATE markets SET outstandingno = outstandingno + $1
                        WHERE marketid = $2
                    )
                    INSERT INTO trades (marketid, userid, side, quantity, cost, is_bot, bot_name)
                    VALUES ($2, NULL, FALSE, $1, $3, TRUE, 'noise')
                    """,
                    qty, mid, trade_cost,
                )

            market_cache.apply_delta(mid, yes_delta, no_delta)

        asyncio.create_task(pool.execute(
            "INSERT INTO market_prices (marketid, yes_prob, no_prob) VALUES ($1, $2, $3)",
            mid, new_prob, 1.0 - new_prob,
        ))

        logger.debug(
            "Noise bot: %s×%d on market %d (prob %.3f → %.3f)",
            "YES" if side else "NO", qty, mid, yes_prob, new_prob,
        )

        # Only trade one market per cycle
        return


async def _bot_loop() -> None:
    """Infinite loop — random sleep between cycles."""
    logger.info("Noise bot started (interval=%d–%ds)", BOT_MIN_INTERVAL, BOT_MAX_INTERVAL)
    while True:
        try:
            pool = get_pool()
            await _do_bot_cycle(pool)
        except Exception:
            logger.exception("Bot cycle error (will retry next tick)")
        interval = random.randint(BOT_MIN_INTERVAL, BOT_MAX_INTERVAL)
        await asyncio.sleep(interval)


# ── Public API ───────────────────────────────────────────────────────────────

async def start_bots() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_bot_loop())
        logger.info("Noise bot task created")


async def stop_bots() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
        logger.info("Noise bot task stopped")
