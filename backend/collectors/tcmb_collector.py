"""
TCMB EVDS (Elektronik Veri Dağıtım Sistemi) Collector
Merkez Bankası'nın resmi makroekonomik verileri
"""
import httpx
from datetime import datetime, timedelta
from typing import Optional
import structlog
from config import get_settings

log = structlog.get_logger()
settings = get_settings()

# En önemli EVDS seri kodları
SERIES = {
    # Döviz Kurları (günlük)
    "USD_BUYING":    ("TP.DK.USD.A", "Dolar Alış Kuru",          "currency"),
    "USD_SELLING":   ("TP.DK.USD.S", "Dolar Satış Kuru",         "currency"),
    "EUR_BUYING":    ("TP.DK.EUR.A", "Euro Alış Kuru",           "currency"),
    "GBP_BUYING":    ("TP.DK.GBP.A", "Sterlin Alış Kuru",        "currency"),

    # Faiz Oranları
    "POLICY_RATE":   ("TP.FG.J0",    "TCMB Politika Faizi (%)",  "interest"),
    "DEPOSIT_RATE":  ("TP.MABMIZ",   "Mevduat Faiz Oranı (%)",   "interest"),
    "LOAN_RATE":     ("TP.BKFS.01",  "Ticari Kredi Faiz Oranı (%)","interest"),

    # Enflasyon
    "CPI_MONTHLY":   ("TP.FE.OKTG01","TÜFE Aylık Değişim (%)",   "inflation"),
    "CPI_YEARLY":    ("TP.FE.OKTG09","TÜFE Yıllık Değişim (%)",  "inflation"),
    "PPI_MONTHLY":   ("TP.FG.J012",  "ÜFE Aylık Değişim (%)",    "inflation"),

    # Rezervler & Para Arzı
    "GROSS_RESERVES":("TP.AB.B1",    "Brüt Rezervler (Mn $)",     "reserve"),
    "M3":            ("TP.MD.TL03",  "M3 Para Arzı (Mn TL)",     "money_supply"),

    # Dış Ticaret
    "EXPORTS":       ("TP.DIE.D2",   "İhracat (Mn $)",            "trade"),
    "IMPORTS":       ("TP.DIE.D3",   "İthalat (Mn $)",            "trade"),
    "CURRENT_ACC":   ("TP.ODE.D1",   "Cari Hesap Dengesi (Mn $)", "trade"),
}

CATEGORY_TR = {
    "currency": "Döviz",
    "interest": "Faiz",
    "inflation": "Enflasyon",
    "reserve": "Rezerv",
    "money_supply": "Para Arzı",
    "trade": "Dış Ticaret",
}


async def _fetch_series(series_codes: list[str], days_back: int = 30) -> dict:
    if not settings.tcmb_evds_key:
        log.warning("tcmb_key_missing")
        return {}

    end_date = datetime.now().strftime("%d-%m-%Y")
    start_date = (datetime.now() - timedelta(days=days_back)).strftime("%d-%m-%Y")

    url = f"{settings.tcmb_evds_url}/series={'-'.join(series_codes)}"
    params = {
        "startDate": start_date,
        "endDate": end_date,
        "type": "json",
        "key": settings.tcmb_evds_key,
    }

    try:
        async with httpx.AsyncClient(timeout=15, verify=False, follow_redirects=True) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        log.error("tcmb_fetch_failed", series=series_codes[:3], error=str(e))
        return {}


def _extract_latest(data: dict, series_key: str) -> Optional[float]:
    try:
        items = data.get("items", [])
        if not items:
            return None
        for item in reversed(items):
            val = item.get(series_key)
            if val and val != "ND":
                return float(str(val).replace(",", "."))
        return None
    except Exception:
        return None


async def fetch_macro_data() -> dict:
    """Tüm makroekonomik verileri çek, kategorilere göre grupla."""
    results = {}
    series_codes = [v[0] for v in SERIES.values()]

    # EVDS max 40 seri destekler, gruplara böl
    batch_size = 10
    raw_data: dict = {}
    for i in range(0, len(series_codes), batch_size):
        batch = series_codes[i:i + batch_size]
        data = await _fetch_series(batch)
        if data:
            raw_data.update(data)

    for key, (code, name, category) in SERIES.items():
        value = _extract_latest(raw_data, code)
        if value is not None:
            results[key] = {
                "code": code,
                "name": name,
                "category": category,
                "category_tr": CATEGORY_TR.get(category, category),
                "value": value,
                "fetched_at": datetime.utcnow().isoformat(),
            }

    log.info("tcmb_fetched", count=len(results))
    return results


async def fetch_interest_rate() -> Optional[float]:
    """Sadece politika faizini çek (hızlı)."""
    data = await _fetch_series(["TP.FG.J0"], days_back=7)
    return _extract_latest(data, "TP_FG_J0")


async def fetch_exchange_rates() -> dict:
    """Sadece döviz kurlarını çek."""
    codes = ["TP.DK.USD.A", "TP.DK.EUR.A", "TP.DK.GBP.A"]
    data = await _fetch_series(codes, days_back=3)
    return {
        "USD": _extract_latest(data, "TP_DK_USD_A"),
        "EUR": _extract_latest(data, "TP_DK_EUR_A"),
        "GBP": _extract_latest(data, "TP_DK_GBP_A"),
        "fetched_at": datetime.utcnow().isoformat(),
    }


async def fetch_inflation() -> dict:
    """TÜFE ve ÜFE verilerini çek."""
    codes = ["TP.FE.OKTG01", "TP.FE.OKTG09", "TP.FG.J012"]
    data = await _fetch_series(codes, days_back=60)
    return {
        "cpi_monthly": _extract_latest(data, "TP_FE_OKTG01"),
        "cpi_yearly": _extract_latest(data, "TP_FE_OKTG09"),
        "ppi_monthly": _extract_latest(data, "TP_FG_J012"),
        "fetched_at": datetime.utcnow().isoformat(),
    }
