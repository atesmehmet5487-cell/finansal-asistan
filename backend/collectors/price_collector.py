"""
Fiyat toplayıcı — Yahoo Finance Chart API (httpx ile direkt çağrı).
yfinance kütüphanesi Railway/cloud ortamlarında bloklandığından
API'ye doğrudan httpx ile bağlanıyoruz.
"""
import asyncio
import httpx
from datetime import datetime
from typing import Optional
import pandas as pd
import structlog

log = structlog.get_logger()

BIST_SYMBOLS = {
    # BIST 30 — büyük cap
    "ASELS": "ASELS.IS", "THYAO": "THYAO.IS", "GARAN": "GARAN.IS",
    "AKBNK": "AKBNK.IS", "ISCTR": "ISCTR.IS", "EREGL": "EREGL.IS",
    "KCHOL": "KCHOL.IS", "SAHOL": "SAHOL.IS", "SISE": "SISE.IS",
    "TUPRS": "TUPRS.IS", "BIMAS": "BIMAS.IS", "MGROS": "MGROS.IS",
    "TCELL": "TCELL.IS", "ARCLK": "ARCLK.IS", "TOASO": "TOASO.IS",
    "FROTO": "FROTO.IS", "DOHOL": "DOHOL.IS", "TTKOM": "TTKOM.IS",
    "PGSUS": "PGSUS.IS", "VESTL": "VESTL.IS",
    # Bankacılık
    "YKBNK": "YKBNK.IS", "VAKBN": "VAKBN.IS", "HALKB": "HALKB.IS",
    "QNBFB": "QNBFB.IS", "SKBNK": "SKBNK.IS", "ALBRK": "ALBRK.IS",
    "TSKB": "TSKB.IS", "FIBABANKA": "FIBABANKA.IS",
    # Sigorta & Emeklilik
    "TURSG": "TURSG.IS", "ANHYT": "ANHYT.IS", "ANSGR": "ANSGR.IS",
    "AKGRT": "AKGRT.IS", "RAYSG": "RAYSG.IS", "GUSGF": "GUSGF.IS",
    # Holding
    "AGHOL": "AGHOL.IS", "GLYHO": "GLYHO.IS", "ALARK": "ALARK.IS",
    "BERA": "BERA.IS", "POLHO": "POLHO.IS", "IHAAS": "IHAAS.IS",
    "DENGE": "DENGE.IS",
    # Enerji & Elektrik
    "AKSEN": "AKSEN.IS", "ODAS": "ODAS.IS", "ZOREN": "ZOREN.IS",
    "AYDEM": "AYDEM.IS", "AYEN": "AYEN.IS", "GWIND": "GWIND.IS",
    "EUPWR": "EUPWR.IS", "SMART": "SMART.IS", "AKFYE": "AKFYE.IS",
    "ORGE": "ORGE.IS", "KONTR": "KONTR.IS", "MAGEN": "MAGEN.IS",
    "IPEKE": "IPEKE.IS", "ENKAI": "ENKAI.IS", "TKFEN": "TKFEN.IS",
    "ULUSE": "ULUSE.IS",
    # Petrokimya & Kimya
    "PETKM": "PETKM.IS", "SASA": "SASA.IS", "AKSA": "AKSA.IS",
    "ALKIM": "ALKIM.IS", "BAGFS": "BAGFS.IS", "GUBRF": "GUBRF.IS",
    "EPLAS": "EPLAS.IS",
    # Demir Çelik & Metal
    "ISDMR": "ISDMR.IS", "BRSAN": "BRSAN.IS",
    "KRDMA": "KRDMA.IS", "KRDMB": "KRDMB.IS", "KRDMD": "KRDMD.IS",
    "CELHA": "CELHA.IS", "CEMAS": "CEMAS.IS", "CEMTS": "CEMTS.IS",
    "PRKME": "PRKME.IS",
    # Çimento & Cam & Seramik
    "CIMSA": "CIMSA.IS", "NUHCM": "NUHCM.IS", "KCAER": "KCAER.IS",
    "AKCNS": "AKCNS.IS", "BOLUC": "BOLUC.IS", "GOLTS": "GOLTS.IS",
    "UNYEC": "UNYEC.IS", "ADANA": "ADANA.IS", "BUCIM": "BUCIM.IS",
    "MRDIN": "MRDIN.IS", "KONYA": "KONYA.IS",
    "TRKCM": "TRKCM.IS", "ANACM": "ANACM.IS", "USAK": "USAK.IS",
    # GYO (Gayrimenkul Yatırım Ortaklığı)
    "EKGYO": "EKGYO.IS", "TRGYO": "TRGYO.IS", "ZRGYO": "ZRGYO.IS",
    "HLGYO": "HLGYO.IS", "ISGYO": "ISGYO.IS", "SNGYO": "SNGYO.IS",
    "ALGYO": "ALGYO.IS", "OZGYO": "OZGYO.IS", "KLGYO": "KLGYO.IS",
    "VKGYO": "VKGYO.IS", "AGYO": "AGYO.IS", "MRGYO": "MRGYO.IS",
    "RYGYO": "RYGYO.IS", "DZGYO": "DZGYO.IS",
    # Otomotiv & Yan Sanayi
    "OTKAR": "OTKAR.IS", "KARSN": "KARSN.IS", "TTRAK": "TTRAK.IS",
    "ASUZU": "ASUZU.IS", "DOAS": "DOAS.IS", "JANTS": "JANTS.IS",
    "PARSN": "PARSN.IS", "DITAS": "DITAS.IS", "BFREN": "BFREN.IS",
    "GOODY": "GOODY.IS", "BRISA": "BRISA.IS",
    # Havacılık & Ulaştırma & Lojistik
    "TAVHL": "TAVHL.IS", "CLEBI": "CLEBI.IS", "RYSAS": "RYSAS.IS",
    # Teknoloji & Bilişim
    "LOGO": "LOGO.IS", "NETAS": "NETAS.IS", "INDES": "INDES.IS",
    "TKNSA": "TKNSA.IS", "KAREL": "KAREL.IS", "ARDYZ": "ARDYZ.IS",
    "PKART": "PKART.IS", "LINK": "LINK.IS", "ARENA": "ARENA.IS",
    "ESCOM": "ESCOM.IS",
    # Sağlık & İlaç
    "MPARK": "MPARK.IS", "DEVA": "DEVA.IS", "SELEC": "SELEC.IS",
    "ECILC": "ECILC.IS", "LKMNH": "LKMNH.IS", "MEDTR": "MEDTR.IS",
    "ECZYT": "ECZYT.IS",
    # Gıda & İçecek
    "AEFES": "AEFES.IS", "CCOLA": "CCOLA.IS", "ULKER": "ULKER.IS",
    "SOKM": "SOKM.IS", "ADESE": "ADESE.IS", "AVOD": "AVOD.IS",
    "PNSUT": "PNSUT.IS", "TATGD": "TATGD.IS", "PENGD": "PENGD.IS",
    "KENT": "KENT.IS", "TUKAS": "TUKAS.IS", "BANVT": "BANVT.IS",
    "KNFRT": "KNFRT.IS",
    # Perakende & Tekstil
    "MAVI": "MAVI.IS", "LCWAL": "LCWAL.IS", "KORDS": "KORDS.IS",
    "ARSAN": "ARSAN.IS", "DESA": "DESA.IS", "YATAS": "YATAS.IS",
    # Madencilik & Değerli Maden
    "KOZAL": "KOZAL.IS", "KOZAA": "KOZAA.IS", "GOLDAS": "GOLDAS.IS",
    # Spor Kulüpleri
    "FENER": "FENER.IS", "BJKAS": "BJKAS.IS", "GSRAY": "GSRAY.IS",
    "TSPOR": "TSPOR.IS",
    # Endeksler
    "BIST100": "XU100.IS", "BIST30": "XU030.IS", "BIST50": "XU050.IS",
}

COMMODITY_SYMBOLS = {
    "ALTIN": "GC=F",
    "GUMUS": "SI=F",
    "PETROL_BRENT": "BZ=F",
    "DOLAR": "USDTRY=X",
    "EURO": "EURTRY=X",
    "BTC": "BTC-USD",
    "ETH": "ETH-USD",
}

_YF_CHART = "https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; financial-dashboard/1.0)",
    "Accept": "application/json",
}


def _parse_chart(symbol: str, data: dict) -> dict | None:
    """Yahoo Finance Chart API yanıtını fiyat dict'ine çevirir."""
    try:
        result = data.get("chart", {}).get("result") or []
        if not result:
            return None
        r = result[0]
        meta = r.get("meta", {})

        # Önce meta'dan anlık fiyatı al
        price = meta.get("regularMarketPrice") or meta.get("previousClose")
        prev_close = meta.get("previousClose") or meta.get("chartPreviousClose")

        # Yoksa kapanış serisinden son değeri al
        if not price:
            closes = (r.get("indicators", {}).get("adjclose") or [{}])[0].get("adjclose") or []
            closes = [c for c in closes if c is not None]
            if closes:
                price = closes[-1]
                if len(closes) >= 2:
                    prev_close = prev_close or closes[-2]

        if not price:
            return None

        change_pct = None
        if prev_close and prev_close != 0:
            change_pct = round((price - prev_close) / prev_close * 100, 4)

        return {
            "symbol": symbol,
            "price": float(price),
            "open": float(meta.get("regularMarketOpen") or 0) or None,
            "high": float(meta.get("regularMarketDayHigh") or 0) or None,
            "low": float(meta.get("regularMarketDayLow") or 0) or None,
            "volume": int(meta.get("regularMarketVolume") or 0) or None,
            "change_pct": change_pct,
            "market_cap": float(meta.get("marketCap") or 0) or None,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        log.warning("chart_parse_failed", symbol=symbol, error=str(e))
        return None


async def fetch_price(symbol: str, yf_symbol: str | None = None) -> dict | None:
    """Tek sembol için asenkron fiyat çekimi."""
    yf_sym = yf_symbol or symbol
    url = _YF_CHART.format(symbol=yf_sym)
    try:
        async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
            resp = await client.get(url, params={"interval": "1d", "range": "5d"})
            resp.raise_for_status()
            return _parse_chart(symbol, resp.json())
    except Exception as e:
        log.error("price_fetch_failed", symbol=symbol, error=str(e))
        return None


async def fetch_all_prices() -> list[dict]:
    """Tüm sembolleri paralel httpx çağrılarıyla çeker."""
    all_syms = {**BIST_SYMBOLS, **COMMODITY_SYMBOLS}

    async def _fetch_one(display: str, yf_sym: str) -> dict | None:
        return await fetch_price(display, yf_sym)

    tasks = [_fetch_one(d, y) for d, y in all_syms.items()]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    prices = [r for r in results if isinstance(r, dict) and r.get("price")]
    log.info("prices_fetched", count=len(prices), total=len(all_syms))
    return prices


# OHLCV — teknik analiz için (yfinance kullanmaya devam)
async def fetch_ohlcv(symbol: str, period: str = "1y", interval: str = "1d") -> Optional[pd.DataFrame]:
    import yfinance as yf

    def _sync():
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval)
            if df.empty:
                return None
            df.index = pd.to_datetime(df.index)
            return df[["Open", "High", "Low", "Close", "Volume"]].dropna()
        except Exception as e:
            log.error("ohlcv_fetch_failed", symbol=symbol, error=str(e))
            return None

    return await asyncio.to_thread(_sync)


def _fetch_price_sync(symbol: str, yf_symbol: str) -> dict | None:
    """On-demand senkron çağrı (assets.py fallback için)."""
    import asyncio as _asyncio
    try:
        loop = _asyncio.new_event_loop()
        result = loop.run_until_complete(fetch_price(symbol, yf_symbol))
        loop.close()
        return result
    except Exception:
        return None
