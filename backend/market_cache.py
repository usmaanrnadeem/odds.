"""
In-memory market state cache with per-market asyncio.Lock.

Why this exists:
  Each buy/sell previously needed a SELECT ... FOR UPDATE on the markets table
  (one full DB round trip just to read b, outstandingyes, outstandingno and lock the row).
  By caching this state in Python and using an asyncio.Lock per market we can:
    - Skip that round trip entirely on cache hits
    - Still serialize concurrent trades on the same market (preventing stale reads)
    - Use delta UPDATEs in the DB so the DB stays authoritative

Usage:
    lock = get_lock(market_id)
    async with lock:
        state = await get_state(pool, market_id)   # DB fetch only on first access
        # ... compute cost, run single CTE ...
        apply_delta(market_id, yes_delta, no_delta) # keep cache current
"""
import asyncio
from typing import Optional

import asyncpg

# {market_id: {b, yes_qty, no_qty, status}}
_cache: dict[int, dict] = {}

# One Lock per market_id — created lazily
_locks: dict[int, asyncio.Lock] = {}


def get_lock(market_id: int) -> asyncio.Lock:
    """Return the asyncio.Lock for this market, creating it if necessary.

    Safe to call without holding any lock: asyncio is single-threaded so the
    dict mutation is atomic w.r.t. other coroutines.
    """
    if market_id not in _locks:
        _locks[market_id] = asyncio.Lock()
    return _locks[market_id]


async def get_state(pool: asyncpg.Pool, market_id: int) -> Optional[dict]:
    """Return cached state dict, or fetch from DB once on a cold cache.

    Must be called while holding get_lock(market_id) so that the check +
    populate sequence is atomic.
    """
    if market_id not in _cache:
        row = await pool.fetchrow(
            "SELECT b, outstandingyes, outstandingno, status, group_id FROM markets WHERE marketid = $1",
            market_id,
        )
        if not row:
            return None
        _cache[market_id] = {
            "b":        float(row["b"]),
            "yes_qty":  float(row["outstandingyes"]),
            "no_qty":   float(row["outstandingno"]),
            "status":   row["status"],
            "group_id": row["group_id"],
        }
    return _cache[market_id]


def apply_delta(market_id: int, yes_delta: float, no_delta: float) -> None:
    """Update cached quantities by delta after a confirmed trade.

    No-op if the market is not currently cached (safe to call unconditionally).
    """
    if market_id in _cache:
        _cache[market_id]["yes_qty"] += yes_delta
        _cache[market_id]["no_qty"]  += no_delta


def invalidate(market_id: int) -> None:
    """Remove a market from the cache (e.g., after settlement)."""
    _cache.pop(market_id, None)
