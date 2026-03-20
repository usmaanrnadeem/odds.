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
    async with pool.acquire() as conn:
        # Fetch all open markets
        markets = await conn.fetch(
            "SELECT marketid, b, outstandingyes, outstandingno FROM markets WHERE status = 'open'"
        )
        if not markets:
            return

        for bot in BOTS:
            # Skip this bot stochastically
            if random.random() > bot["weight"]:
                continue
            if random.random() > BOT_TRADE_CHANCE:
                continue

            market = random.choice(markets)
            mid   = market["marketid"]
            b     = float(market["b"])
            yes_q = float(market["outstandingyes"])
            no_q  = float(market["outstandingno"])

            side = _pick_side(bot)
            qty  = random.randint(BOT_MIN_QTY, BOT_MAX_QTY)
            trade_cost = cost_buy(b, yes_q, no_q, qty, side)

            # Compute new outstanding quantities
            new_yes = yes_q + (qty if side else 0)
            new_no  = no_q  + (qty if not side else 0)
            new_prob = current_price(b, new_yes, new_no)

            async with conn.transaction():
                await conn.execute(
                    """
                    UPDATE markets
                       SET outstandingyes = $1,
                           outstandingno  = $2
                     WHERE marketid = $3
                    """,
                    new_yes, new_no, mid,
                )
                await conn.execute(
                    """
                    INSERT INTO trades (marketid, userid, side, quantity, cost, is_bot, bot_name)
                    VALUES ($1, NULL, $2, $3, $4, TRUE, $5)
                    """,
                    mid, side, qty, trade_cost, bot["name"],
                )
                await conn.execute(
                    """
                    INSERT INTO market_prices (marketid, yes_prob, no_prob)
                    VALUES ($1, $2, $3)
                    """,
                    mid, new_prob, 1.0 - new_prob,
                )

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
