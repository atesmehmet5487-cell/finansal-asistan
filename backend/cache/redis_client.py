import json
from typing import Any
import redis.asyncio as aioredis
from config import get_settings
import structlog

log = structlog.get_logger()
settings = get_settings()

_redis: aioredis.Redis | None = None
_memory_cache: dict = {}


def get_redis() -> aioredis.Redis | None:
    global _redis
    if _redis is None:
        url = settings.redis_url
        if not url or url == "redis://redis:6379" or "redis:6379" in url:
            return None
        try:
            _redis = aioredis.from_url(
                url,
                encoding="utf-8",
                decode_responses=True,
            )
        except Exception as e:
            log.error("redis_init_failed", error=str(e))
            return None
    return _redis


async def cache_get(key: str) -> Any | None:
    r = get_redis()
    if r is None:
        val = _memory_cache.get(key)
        return json.loads(val) if val else None
    try:
        value = await r.get(key)
        if value:
            return json.loads(value)
    except Exception:
        val = _memory_cache.get(key)
        return json.loads(val) if val else None
    return None


async def cache_set(key: str, value: Any, ttl_seconds: int) -> None:
    serialized = json.dumps(value, default=str)
    _memory_cache[key] = serialized
    r = get_redis()
    if r is None:
        return
    try:
        await r.setex(key, ttl_seconds, serialized)
    except Exception:
        pass


async def cache_delete(key: str) -> None:
    _memory_cache.pop(key, None)
    r = get_redis()
    if r is None:
        return
    try:
        await r.delete(key)
    except Exception:
        pass


async def pubsub_publish(channel: str, data: dict) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await r.publish(channel, json.dumps(data, default=str))
    except Exception:
        pass


async def stream_publish(stream: str, data: dict) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await r.xadd(stream, {k: json.dumps(v, default=str) for k, v in data.items()})
    except Exception:
        pass


async def stream_read(stream: str, count: int = 10, block_ms: int = 0) -> list[dict]:
    r = get_redis()
    if r is None:
        return []
    try:
        results = await r.xread({stream: "$"}, count=count, block=block_ms)
        if not results:
            return []
        messages = []
        for _, entries in results:
            for entry_id, fields in entries:
                messages.append({k: json.loads(v) for k, v in fields.items()})
        return messages
    except Exception:
        return []


TTL = {
    "technical": 300,
    "news": 900,
    "sentiment": 1800,
    "consolidated": 600,
    "search": 3600,
    "price": 300,
    "macro": 1800,
}
