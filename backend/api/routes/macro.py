from fastapi import APIRouter
from cache.redis_client import cache_get, cache_set, TTL
from collectors.tcmb_collector import fetch_macro_data, fetch_exchange_rates, fetch_inflation, CATEGORY_TR

router = APIRouter()


@router.get("/macro")
async def get_macro_data():
    cached = await cache_get("cache:macro:all")
    if cached:
        return {"data": cached, "source": "cache"}

    data = await fetch_macro_data()
    if data:
        await cache_set("cache:macro:all", data, TTL["macro"])
    return {"data": data, "source": "live"}


@router.get("/macro/rates")
async def get_exchange_rates():
    cached = await cache_get("cache:macro:rates")
    if cached:
        return cached

    data = await fetch_exchange_rates()
    if data:
        await cache_set("cache:macro:rates", data, 300)
    return data


@router.get("/macro/inflation")
async def get_inflation():
    cached = await cache_get("cache:macro:inflation")
    if cached:
        return cached

    data = await fetch_inflation()
    if data:
        await cache_set("cache:macro:inflation", data, TTL["macro"])
    return data


@router.get("/macro/summary")
async def get_macro_summary():
    """Dashboard için özet makro göstergeler."""
    data = await cache_get("cache:macro:all") or {}

    def _val(key: str):
        entry = data.get(key, {})
        return entry.get("value")

    return {
        "policy_rate":    {"value": _val("POLICY_RATE"),    "name": "Politika Faizi", "unit": "%"},
        "cpi_yearly":     {"value": _val("CPI_YEARLY"),     "name": "TÜFE (Yıllık)",  "unit": "%"},
        "cpi_monthly":    {"value": _val("CPI_MONTHLY"),    "name": "TÜFE (Aylık)",   "unit": "%"},
        "usd":            {"value": _val("USD_BUYING"),     "name": "USD/TRY",         "unit": "₺"},
        "eur":            {"value": _val("EUR_BUYING"),     "name": "EUR/TRY",         "unit": "₺"},
        "gross_reserves": {"value": _val("GROSS_RESERVES"), "name": "Brüt Rezerv",    "unit": "Mn $"},
        "exports":        {"value": _val("EXPORTS"),        "name": "İhracat",         "unit": "Mn $"},
        "imports":        {"value": _val("IMPORTS"),        "name": "İthalat",         "unit": "Mn $"},
    }
