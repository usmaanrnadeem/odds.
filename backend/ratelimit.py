"""Simple in-memory fixed-window rate limiter.

Asyncio is single-threaded so no locking is needed.
"""
import time
from collections import defaultdict

# key -> (count, window_start_timestamp)
_windows: dict[str, tuple[int, float]] = defaultdict(lambda: (0, 0.0))


def check(key: str, limit: int, window_seconds: int) -> bool:
    """Return True if the request is allowed, False if rate limited."""
    count, window_start = _windows[key]
    now = time.time()
    if now - window_start >= window_seconds:
        _windows[key] = (1, now)
        return True
    if count >= limit:
        return False
    _windows[key] = (count + 1, window_start)
    return True
