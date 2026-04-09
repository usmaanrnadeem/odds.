"""
Async database connection pool (asyncpg).
Call init_pool() once at app startup via FastAPI lifespan.
"""
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        min_size=5,
        max_size=10,
        ssl="require",
        # Recycle idle connections before they go stale on Supabase's side
        max_inactive_connection_lifetime=300.0,
        # Disable prepared statement cache.
        # Supabase uses PgBouncer in transaction mode by default (port 6543).
        # PgBouncer drops prepared statements between transactions, so asyncpg's
        # default extended-query protocol causes a silent double-RTT:
        #   1. Parse  →  ParseComplete  (1st network round trip)
        #   2. Bind + Execute  →  result  (2nd network round trip)
        # With statement_cache_size=0 asyncpg falls back to simple-query
        # protocol which packs everything into 1 round trip.
        # Safe on direct connections (port 5432) too — just slightly more
        # bytes per query, irrelevant for this workload.
        statement_cache_size=0,
    )


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialised — call init_pool() first")
    return _pool
