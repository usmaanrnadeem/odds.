"""
Web Push notification helper.
Uses pywebpush + VAPID to send pushes to subscribed devices.
Runs in a thread executor so it doesn't block the async event loop.
"""
import asyncio
import json
import logging
import os
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)

VAPID_PUBLIC_KEY  = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS      = {"sub": "mailto:noreply@odds.app"}


def _send_one_sync(endpoint: str, p256dh: str, auth: str, payload: dict) -> bool:
    """Blocking push send — called via run_in_executor."""
    try:
        from pywebpush import webpush, WebPushException
        webpush(
            subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )
        return True
    except Exception as exc:
        # 410 Gone = subscription expired/revoked
        if hasattr(exc, "response") and exc.response is not None:
            if exc.response.status_code == 410:
                return False  # caller should delete this sub
        logger.warning("Push send failed: %s", exc)
        return True  # keep subscription, transient error


async def send_push_to_user(pool: asyncpg.Pool, user_id: int, title: str, body: str, url: str = "/") -> None:
    """Send a push notification to all subscribed devices for a user."""
    if not VAPID_PRIVATE_KEY:
        return  # not configured

    rows = await pool.fetch(
        "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
        user_id,
    )
    if not rows:
        return

    payload = {"title": title, "body": body, "url": url}
    loop = asyncio.get_event_loop()
    stale_ids = []

    for row in rows:
        ok = await loop.run_in_executor(
            None, _send_one_sync, row["endpoint"], row["p256dh"], row["auth"], payload
        )
        if not ok:
            stale_ids.append(row["id"])

    if stale_ids:
        await pool.execute(
            "DELETE FROM push_subscriptions WHERE id = ANY($1::int[])", stale_ids
        )
