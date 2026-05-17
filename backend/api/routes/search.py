from fastapi import APIRouter, HTTPException
from cache.redis_client import cache_get, cache_set, TTL

router = APIRouter()

KNOWN_SYMBOLS = {
    # Büyük Cap / BIST 30
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
    "PGSUS": "Pegasus Hava Yolları",
    "VESTL": "Vestel Elektronik",
    # Bankacılık
    "YKBNK": "Yapı ve Kredi Bankası",
    "VAKBN": "Vakıfbank",
    "HALKB": "Halkbank",
    "DENIZ": "Denizbank",
    "QNBFB": "QNB Finansbank",
    # Enerji & Sanayi
    "PETKM": "Petkim Petrokimya",
    "AKSEN": "Akenerji Elektrik",
    "ODAS": "Odaş Elektrik",
    "ENKAI": "Enka İnşaat",
    "TKFEN": "Tekfen Holding",
    "AEFES": "Anadolu Efes",
    "GUBRF": "Gübre Fabrikaları",
    "BRSAN": "Borusan Mannesmann",
    "ISDMR": "İskenderun Demir Çelik",
    # GYO & Finans
    "EKGYO": "Emlak Konut GYO",
    "TRGYO": "Torunlar GYO",
    "ZRGYO": "Ziraat GYO",
    "GLYHO": "Global Yatırım Holding",
    "ALARK": "Alarko Holding",
    # Tüketim & Perakende
    "SOKM": "Şok Marketler",
    "MAVI": "Mavi Giyim",
    "ADESE": "Adese AVM",
    "ULKER": "Ülker Bisküvi",
    "CCOLA": "Coca-Cola İçecek",
    # Turizm & Ulaştırma
    "TAVHL": "TAV Havalimanları",
    "OTKAR": "Otokar",
    # Madencilik
    "KOZAL": "Koza Altın",
    "KOZAA": "Koza Anadolu Maden",
    # Teknoloji & Diğer
    "LOGO": "Logo Yazılım",
    "NETAS": "Netaş Telekomunikasyon",
    "MPARK": "MLP Sağlık Hizmetleri",
    "SASA": "Sasa Polyester",
    "CIMSA": "Çimsa Çimento",
    "KORDS": "Kordsa Teknik Tekstil",
    "BERA": "Bera Holding",
    "IHAAS": "İhlas Holding A",
    # Endeksler
    "BIST100": "BIST 100 Endeksi",
    "BIST30": "BIST 30 Endeksi",
    # Emtia & Döviz
    "ALTIN": "Altın (XAU/USD)",
    "GUMUS": "Gümüş (XAG/USD)",
    "PETROL": "Ham Petrol (Brent)",
    "DOLAR": "ABD Doları (USD/TRY)",
    "EURO": "Euro (EUR/TRY)",
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
