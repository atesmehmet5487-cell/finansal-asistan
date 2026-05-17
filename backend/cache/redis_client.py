import json
from typing import Any
import redis.asyncio as aioredis
from config import get_settings

settings = get_settings()

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            ssl_cert_reqs=None,
        )
    return _redis


async def cache_get(key: str) -> Any | None:
    r = get_redis()
    value = await r.get(key)
    if value:
        return json.loads(value)
    return None


async def cache_set(key: str, value: Any, ttl_seconds: int) -> None:
    r = get_redis()
    await r.setex(key, ttl_seconds, json.dumps(value, default=str))


async def cache_delete(key: str) -> None:
    r = get_redis()
    await r.delete(key)


async def stream_publish(stream: str, data: dict) -> None:
    r = get_redis()
    await r.xadd(stream, {k: json.dumps(v, default=str) for k, v in data.items()})


async def stream_read(stream: str, count: int = 10, block_ms: int = 0) -> list[dict]:
    r = get_redis()
    results = await r.xread({stream: "$"}, count=count, block=block_ms)
    if not results:
        return []
    messages = []
    for _, entries in results:
        for entry_id, fields in entries:
            messages.append({k: json.loads(v) for k, v in fields.items()})
    return messages


async def pubsub_publish(channel: str, data: dict) -> None:
    r = get_redis()
    await r.publish(channel, json.dumps(data, default=str))


TTL = {
    "technical": 300,       # 5 dk
    "news": 900,            # 15 dk
    "sentiment": 1800,      # 30 dk
    "consolidated": 600,    # 10 dk
    "search": 3600,         # 1 saat
    "price": 300,           # 5 dk
    "macro": 1800,          # 30 dk
}
