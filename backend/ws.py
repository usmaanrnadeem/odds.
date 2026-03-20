"""
WebSocket connection manager.
All connected clients get every broadcast — no rooms for v1.
"""
import json
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._active.append(ws)
        logger.info("WS connect — %d active", len(self._active))

    def disconnect(self, ws: WebSocket) -> None:
        self._active.discard if hasattr(self._active, "discard") else None
        try:
            self._active.remove(ws)
        except ValueError:
            pass
        logger.info("WS disconnect — %d active", len(self._active))

    async def broadcast(self, payload: dict) -> None:
        """Send JSON payload to all connected clients. Dead connections are pruned."""
        dead: list[WebSocket] = []
        text = json.dumps(payload)
        for ws in list(self._active):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
