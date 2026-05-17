from fastapi import APIRouter
from cache.redis_client import cache_get

router = APIRouter()


@router.get("/news/feed")
async def get_news_feed(category: str = "all", limit: int = 50):
    news_feed = await cache_get("cache:news:feed:latest") or []

    if category == "bist":
        filtered = [n for n in news_feed if any(
            sym in n.get("affected_assets", [])
            for sym in ["BIST100", "BIST30", "ASELS", "THYAO", "GARAN", "AKBNK"]
        )]
    elif category == "emtia":
        filtered = [n for n in news_feed if any(
            sym in n.get("affected_assets", [])
            for sym in ["ALTIN", "GUMUS", "PETROL", "BTC", "ETH"]
        )]
    elif category == "makro":
        filtered = [n for n in news_feed if any(
            kw in " ".join(n.get("categories", []))
            for kw in ["faiz", "enflasyon", "tcmb", "merkez bankası", "ekonomi"]
        )]
    elif category == "critical":
        filtered = [n for n in news_feed if n.get("importance") == "CRITICAL"]
    else:
        filtered = news_feed

    importance_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    filtered.sort(key=lambda x: importance_order.get(x.get("importance", "LOW"), 3))

    return {
        "category": category,
        "count": len(filtered),
        "news": filtered[:limit],
    }
