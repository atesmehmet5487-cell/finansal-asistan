import httpx
import feedparser
from datetime import datetime, timezone
from typing import Optional
import hashlib
import structlog
from config import get_settings

log = structlog.get_logger()
settings = get_settings()

RSS_FEEDS = [
    {"name": "KAP", "url": "https://www.kap.org.tr/tr/rss/Duyuru", "importance": "CRITICAL"},
    {"name": "Investing.com TR", "url": "https://tr.investing.com/rss/news.rss", "importance": "HIGH"},
    {"name": "Finansgundem", "url": "https://www.finansgundem.com/rss/son-haberler", "importance": "MEDIUM"},
    {"name": "Reuters TR", "url": "https://tr.reuters.com/rssFeed/topNews", "importance": "HIGH"},
    {"name": "BorsaGündem", "url": "https://www.borsagundem.com.tr/rss", "importance": "HIGH"},
    {"name": "Mynet Son Dakika", "url": "https://www.mynet.com/haber/rss/sondakika", "importance": "MEDIUM"},
]


def _url_hash(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()


async def fetch_newsapi(query: str = "borsa BIST hisse", language: str = "tr") -> list[dict]:
    if not settings.news_api_key:
        return []

    url = "https://newsapi.org/v2/everything"
    params = {
        "q": query,
        "language": language,
        "sortBy": "publishedAt",
        "pageSize": 50,
        "apiKey": settings.news_api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        articles = []
        for a in data.get("articles", []):
            articles.append({
                "id": _url_hash(a.get("url", "")),
                "title": a.get("title", ""),
                "source": a.get("source", {}).get("name", "NewsAPI"),
                "url": a.get("url", ""),
                "published_at": a.get("publishedAt", ""),
                "content": a.get("description", "") or a.get("content", ""),
                "importance_hint": "MEDIUM",
            })
        return articles
    except Exception as e:
        log.error("newsapi_fetch_failed", error=str(e))
        return []


async def fetch_rss_feed(feed: dict) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(feed["url"])
            resp.raise_for_status()
            text = resp.text

        parsed = feedparser.parse(text)
        articles = []
        for entry in parsed.entries[:20]:
            url = entry.get("link", "")
            articles.append({
                "id": _url_hash(url),
                "title": entry.get("title", ""),
                "source": feed["name"],
                "url": url,
                "published_at": entry.get("published", ""),
                "content": entry.get("summary", ""),
                "importance_hint": feed["importance"],
            })
        return articles
    except Exception as e:
        log.error("rss_fetch_failed", feed=feed["name"], error=str(e))
        return []


async def fetch_all_news() -> list[dict]:
    all_articles = []
    seen_ids = set()

    newsapi = await fetch_newsapi("borsa BIST Türkiye hisse emtia altın")
    for a in newsapi:
        if a["id"] not in seen_ids:
            seen_ids.add(a["id"])
            all_articles.append(a)

    newsapi_en = await fetch_newsapi("Turkey stock market BIST economy", language="en")
    for a in newsapi_en:
        if a["id"] not in seen_ids:
            seen_ids.add(a["id"])
            all_articles.append(a)

    for feed in RSS_FEEDS:
        articles = await fetch_rss_feed(feed)
        for a in articles:
            if a["id"] not in seen_ids:
                seen_ids.add(a["id"])
                all_articles.append(a)

    log.info("news_collected", count=len(all_articles))
    return all_articles
