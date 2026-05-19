import re
import asyncio
from fastapi import APIRouter, HTTPException
from cache.redis_client import cache_get, cache_set, TTL
from db.database import AsyncSessionLocal
from db.models import Asset, ConsolidatedAnalysis, TechnicalAnalysis, SentimentAnalysis
from sqlalchemy import select, desc

router = APIRouter()

DISCLAIMER = "Bu analiz bilgilendirme amaçlıdır. Yatırım tavsiyesi değildir."

_BIST_RE = re.compile(r'^[A-Z]{3,6}$')


@router.get("/assets/{symbol}")
async def get_asset(symbol: str):
    symbol = symbol.upper()

    price = await cache_get(f"cache:price:{symbol}")
    technical = await cache_get(f"cache:asset:{symbol}:technical")
    sentiment = await cache_get(f"cache:asset:{symbol}:sentiment")
    consolidated = await cache_get(f"cache:asset:{symbol}:consolidated")

    # On-demand fiyat çekimi: cache'de yoksa yfinance'tan al
    if not price and not consolidated and _BIST_RE.match(symbol):
        try:
            from collectors.price_collector import _fetch_price_sync, BIST_SYMBOLS, COMMODITY_SYMBOLS
            all_syms = {**BIST_SYMBOLS, **COMMODITY_SYMBOLS}
            yf_sym = all_syms.get(symbol, f"{symbol}.IS")
            price = await asyncio.to_thread(_fetch_price_sync, symbol, yf_sym)
            if price:
                await cache_set(f"cache:price:{symbol}", price, TTL.get("price", 300))
        except Exception:
            pass

    if not price and not consolidated:
        raise HTTPException(status_code=404, detail=f"{symbol} bulunamadı")

    return {
        "symbol": symbol,
        "price": price,
        "technical": technical,
        "sentiment": sentiment,
        "consolidated": consolidated,
        "disclaimer": DISCLAIMER,
    }


@router.get("/assets/{symbol}/technical")
async def get_technical(symbol: str):
    symbol = symbol.upper()
    data = await cache_get(f"cache:asset:{symbol}:technical")
    if not data:
        raise HTTPException(status_code=404, detail="Teknik analiz henüz hazır değil")
    return data


@router.get("/assets/{symbol}/news")
async def get_asset_news(symbol: str, limit: int = 20):
    symbol = symbol.upper()
    news_feed = await cache_get("cache:news:feed:latest")
    if not news_feed:
        return {"symbol": symbol, "news": []}

    filtered = [
        n for n in news_feed
        if symbol in n.get("affected_assets", [])
    ]
    return {"symbol": symbol, "news": filtered[:limit]}


@router.get("/assets/{symbol}/sentiment")
async def get_sentiment(symbol: str):
    symbol = symbol.upper()
    data = await cache_get(f"cache:asset:{symbol}:sentiment")
    if not data:
        return {"symbol": symbol, "data": None, "message": "Yorum verisi henüz toplanmadı"}
    return data


@router.get("/assets/{symbol}/history")
async def get_history(symbol: str, days: int = 30):
    symbol = symbol.upper()
    async with AsyncSessionLocal() as db:
        asset = (await db.execute(select(Asset).where(Asset.symbol == symbol))).scalar_one_or_none()
        if not asset:
            return {"symbol": symbol, "history": []}

        records = (await db.execute(
            select(ConsolidatedAnalysis)
            .where(ConsolidatedAnalysis.asset_id == asset.id)
            .order_by(desc(ConsolidatedAnalysis.generated_at))
            .limit(days * 3)
        )).scalars().all()

    history = [
        {
            "date": r.generated_at.isoformat(),
            "composite_score": float(r.composite_score) if r.composite_score else None,
            "overall_sentiment": r.overall_sentiment,
        }
        for r in records
    ]
    return {"symbol": symbol, "history": history}


@router.get("/prices/all")
async def get_all_prices():
    """Tüm sembol fiyatlarını tek seferde döner — frontend batch çağrısı için."""
    from collectors.price_collector import BIST_SYMBOLS, COMMODITY_SYMBOLS
    import asyncio as _asyncio

    all_syms = {**BIST_SYMBOLS, **COMMODITY_SYMBOLS}
    prices: dict = {}

    # Tüm cache anahtarlarını paralel oku
    cache_results = await _asyncio.gather(
        *[cache_get(f"cache:price:{sym}") for sym in all_syms],
        return_exceptions=True
    )
    for sym, val in zip(all_syms.keys(), cache_results):
        if isinstance(val, dict):
            prices[sym] = val

    # Cache tamamen boşsa (ilk başlatma) scheduler'ı tetikle ama beklemeden dön
    if not prices:
        _asyncio.create_task(_trigger_price_fetch(all_syms))

    return {"prices": prices, "count": len(prices)}


async def _trigger_price_fetch(all_syms: dict):
    """Arka planda fiyat pipeline'ını çalıştırır, endpoint'i bloklamaz."""
    import asyncio as _asyncio
    try:
        from collectors.price_collector import _fetch_price_sync
        # En önemli 10 sembolü önce çek
        priority = ["BIST100", "DOLAR", "EURO", "ALTIN", "ASELS", "THYAO", "GARAN", "AKBNK", "BTC", "ISCTR"]
        async def _one(sym: str):
            yf_sym = all_syms.get(sym)
            if not yf_sym:
                return
            result = await _asyncio.to_thread(_fetch_price_sync, sym, yf_sym)
            if result and result.get("price"):
                await cache_set(f"cache:price:{sym}", result, TTL["price"])
        await _asyncio.gather(*[_one(s) for s in priority if s in all_syms])
    except Exception:
        pass


@router.get("/trending")
async def get_trending():
    from api.routes.search import KNOWN_SYMBOLS
    trending = []
    for symbol in list(KNOWN_SYMBOLS.keys())[:15]:
        price = await cache_get(f"cache:price:{symbol}")
        consolidated = await cache_get(f"cache:asset:{symbol}:consolidated")
        if price or consolidated:
            trending.append({
                "symbol": symbol,
                "name": KNOWN_SYMBOLS[symbol],
                "price": price.get("price") if price else None,
                "change_pct": price.get("change_pct") if price else None,
                "composite_score": consolidated.get("composite_score") if consolidated else None,
                "overall_sentiment": consolidated.get("overall_sentiment") if consolidated else None,
            })

    trending.sort(key=lambda x: abs(x.get("change_pct") or 0), reverse=True)
    return {"trending": trending}
