from fastapi import APIRouter, HTTPException
from cache.redis_client import cache_get, cache_set, TTL

router = APIRouter()

KNOWN_SYMBOLS = {
    "ASELS": "Aselsan Elektronik",
    "THYAO": "Türk Hava Yolları",
    "GARAN": "Garanti BBVA",
    "AKBNK": "Akbank",
    "ISCTR": "İş Bankası C",
    "EREGL": "Ereğli Demir Çelik",
    "KCHOL": "Koç Holding",
    "SAHOL": "Sabancı Holding",
    "SISE": "Şişecam",
    "TUPRS": "Tüpraş",
    "BIMAS": "BİM Mağazalar",
    "MGROS": "Migros",
    "TCELL": "Turkcell",
    "ARCLK": "Arçelik",
    "TOASO": "Tofaş",
    "FROTO": "Ford Otosan",
    "DOHOL": "Doğan Holding",
    "TTKOM": "Türk Telekom",
    "PGSUS": "Pegasus",
    "VESTL": "Vestel",
    "BIST100": "BIST 100 Endeksi",
    "BIST30": "BIST 30 Endeksi",
    "ALTIN": "Altın",
    "GUMUS": "Gümüş",
    "PETROL": "Ham Petrol (Brent)",
    "DOLAR": "ABD Doları",
    "EURO": "Euro",
    "BTC": "Bitcoin",
    "ETH": "Ethereum",
}


@router.get("/search")
async def search(q: str):
    if not q or len(q) < 2:
        return {"results": []}

    cache_key = f"cache:search:{q.lower()}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    q_upper = q.upper()
    q_lower = q.lower()

    matches = []
    for symbol, name in KNOWN_SYMBOLS.items():
        if q_upper in symbol or q_lower in name.lower():
            price_data = await cache_get(f"cache:price:{symbol}")
            consolidated = await cache_get(f"cache:asset:{symbol}:consolidated")
            matches.append({
                "symbol": symbol,
                "name": name,
                "price": price_data.get("price") if price_data else None,
                "change_pct": price_data.get("change_pct") if price_data else None,
                "composite_score": consolidated.get("composite_score") if consolidated else None,
                "overall_sentiment": consolidated.get("overall_sentiment") if consolidated else None,
            })

    result = {"results": matches[:10], "query": q}
    await cache_set(cache_key, result, TTL["search"])
    return result
