from fastapi import APIRouter
from cache.redis_client import cache_get, cache_set
from config import get_settings
from collectors.calendar_collector import fetch_calendar_events

router = APIRouter()
settings = get_settings()


@router.get("/calendar/events")
async def get_calendar_events(days: int = 7):
    cache_key = f"cache:calendar:events:{days}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    url = settings.google_calendar_ical_url
    if not url:
        return {"events": [], "configured": False}

    events = await fetch_calendar_events(url, days_ahead=days)
    result = {"events": events, "configured": True}

    if events:
        await cache_set(cache_key, result, 1800)  # 30 dakika cache

    return result
