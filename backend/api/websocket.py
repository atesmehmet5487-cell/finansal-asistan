import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from cache.redis_client import get_redis
import structlog

log = structlog.get_logger()
router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
        log.info("ws_connected", total=len(self.active))

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
        log.info("ws_disconnected", total=len(self.active))

    async def broadcast(self, message: dict):
        dead = set()
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active.discard(ws)


manager = ConnectionManager()


async def _redis_listener():
    r = get_redis()
    pubsub = r.pubsub()
    await pubsub.psubscribe("pub:price:*", "pub:analysis_update", "pub:breaking_news")

    async for message in pubsub.listen():
        if message["type"] not in ("message", "pmessage"):
            continue
        try:
            channel = message.get("channel", "")
            data = json.loads(message.get("data", "{}"))
            if "price" in channel:
                await manager.broadcast({"type": "PRICE_UPDATE", **data})
            elif "analysis_update" in channel:
                await manager.broadcast({"type": "ANALYSIS_UPDATE", **data})
            elif "breaking_news" in channel:
                await manager.broadcast({"type": "BREAKING_NEWS", **data})
        except Exception as e:
            log.error("ws_broadcast_failed", error=str(e))


@router.on_event("startup")
async def start_redis_listener():
    asyncio.create_task(_redis_listener())


@router.websocket("/ws/live")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
