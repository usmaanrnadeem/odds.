"""
WebSocket connection manager — group-scoped, authenticated.

Each client must supply a valid JWT (group_id required) when connecting.
Broadcasts are scoped to a group or a specific user — no cross-group leakage.
"""
import json
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # group_id -> {ws}
        self._groups: dict[int, set[WebSocket]] = {}
        # user_id -> {ws}  (handles multi-tab)
        self._users: dict[int, set[WebSocket]] = {}
        # ws -> (group_id, user_id)  — O(1) disconnect lookup
        self._meta: dict[WebSocket, tuple[int, int]] = {}

    async def connect(self, ws: WebSocket, group_id: int, user_id: int) -> None:
        await ws.accept()
        self._meta[ws] = (group_id, user_id)
        self._groups.setdefault(group_id, set()).add(ws)
        self._users.setdefault(user_id, set()).add(ws)
        logger.info("WS connect group=%s user=%s — %d total", group_id, user_id, len(self._meta))

    def disconnect(self, ws: WebSocket) -> None:
        meta = self._meta.pop(ws, None)
        if not meta:
            return
        group_id, user_id = meta
        group_set = self._groups.get(group_id)
        if group_set:
            group_set.discard(ws)
            if not group_set:
                del self._groups[group_id]
        user_set = self._users.get(user_id)
        if user_set:
            user_set.discard(ws)
            if not user_set:
                del self._users[user_id]
        logger.info("WS disconnect group=%s user=%s — %d total", group_id, user_id, len(self._meta))

    async def broadcast_to_group(self, group_id: int, payload: dict) -> None:
        """Send to all authenticated connections in a group."""
        text = json.dumps(payload)
        dead: list[WebSocket] = []
        for ws in list(self._groups.get(group_id, set())):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        """Send to all connections for a specific user (multi-tab safe)."""
        text = json.dumps(payload)
        dead: list[WebSocket] = []
        for ws in list(self._users.get(user_id, set())):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
