"""
Background bot traders.
Bots make random trades to keep markets alive and create price movement.
start_bots() / stop_bots() are called from the FastAPI lifespan.
"""
import asyncio
import logging
import random
from typing import Optional

import asyncpg

from .db import get_pool
from .lmsr import cost_buy, current_price
from . import market_cache

logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────

BOT_INTERVAL_SECS = 45       # seconds between bot trade cycles
BOT_TRADE_CHANCE  = 0.6      # probability a bot actually trades each cycle
BOT_MIN_QTY       = 1
BOT_MAX_QTY       = 5

BOTS = [
    {"name": "alice_noise",   "bias": None,  "weight": 0.5},   # random noise
    {"name": "bob_yes",       "bias": True,  "weight": 0.75},   # slightly bullish
    {"name": "carol_no",      "bias": False, "weight": 0.75},   # slightly bearish
    {"name": "dave_opinion",  "bias": None,  "weight": 0.4},    # random, less active
]

# ── State ────────────────────────────────────────────────────────────────────

_task: Optional[asyncio.Task] = None


# ── Internal helpers ─────────────────────────────────────────────────────────

def _pick_side(bot: dict) -> bool:
    """Return True=YES or False=NO based on bot bias."""
    if bot["bias"] is None:
        return random.random() < 0.5
    # biased bots still flip occasionally so they don't just move price to extremes
    flip_chance = 0.25
    if random.random() < flip_chance:
        return not bot["bias"]
    return bot["bias"]


async def _do_bot_cycle(pool: asyncpg.Pool) -> None:
    """One tick: try to make one trade per bot on one random open market."""
    # Fetch just IDs — market state comes from cache
    rows = await pool.fetch("SELECT marketid FROM markets WHERE status = 'open'")
    if not rows:
        return
    market_ids = [r["marketid"] for r in rows]

    for bot in BOTS:
        if random.random() > bot["weight"]:
            continue
        if random.random() > BOT_TRADE_CHANCE:
            continue

        mid  = random.choice(market_ids)
        lock = market_cache.get_lock(mid)

        async with lock:
            state = await market_cache.get_state(pool, mid)
            if not state or state["status"] != "open":
                continue

            b     = state["b"]
            yes_q = state["yes_qty"]
            no_q  = state["no_qty"]

            side       = _pick_side(bot)
            qty        = random.randint(BOT_MIN_QTY, BOT_MAX_QTY)
            trade_cost = cost_buy(b, yes_q, no_q, qty, side)

            yes_delta = qty if side else 0
            no_delta  = 0 if side else qty
            new_yes   = yes_q + yes_delta
            new_no    = no_q  + no_delta
            new_prob  = current_price(b, new_yes, new_no)

            # Single CTE: market delta-update + trade insert (1 round trip)
            if side:
                await pool.execute(
                    """
                    WITH mkt AS (
                        UPDATE markets SET outstandingyes = outstandingyes + $1
                        WHERE marketid = $2
                    )
                    INSERT INTO trades (marketid, userid, side, quantity, cost, is_bot, bot_name)
                    VALUES ($2, NULL, TRUE, $1, $3, TRUE, $4)
                    """,
                    qty, mid, trade_cost, bot["name"],
                )
            else:
                await pool.execute(
                    """
                    WITH mkt AS (
                        UPDATE markets SET outstandingno = outstandingno + $1
                        WHERE marketid = $2
                    )
                    INSERT INTO trades (marketid, userid, side, quantity, cost, is_bot, bot_name)
                    VALUES ($2, NULL, FALSE, $1, $3, TRUE, $4)
                    """,
                    qty, mid, trade_cost, bot["name"],
                )

            market_cache.apply_delta(mid, yes_delta, no_delta)

        # Price snapshot outside lock — fire-and-forget
        asyncio.create_task(pool.execute(
            "INSERT INTO market_prices (marketid, yes_prob, no_prob) VALUES ($1, $2, $3)",
            mid, new_prob, 1.0 - new_prob,
        ))

        logger.debug(
            "Bot %s traded %s×%d on market %d (cost=%.2f, new_prob=%.3f)",
            bot["name"], "YES" if side else "NO", qty, mid, trade_cost, new_prob,
        )


async def _bot_loop() -> None:
    """Infinite loop — sleeps between cycles, handles errors gracefully."""
    logger.info("Bot loop started (interval=%ds)", BOT_INTERVAL_SECS)
    while True:
        try:
            pool = get_pool()
            await _do_bot_cycle(pool)
        except Exception:
            logger.exception("Bot cycle error (will retry next tick)")
        await asyncio.sleep(BOT_INTERVAL_SECS)


# ── Public API ───────────────────────────────────────────────────────────────

async def start_bots() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_bot_loop())
        logger.info("Bot task created")


async def stop_bots() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
        logger.info("Bot task stopped")
