import asyncio
import requests
import yfinance as yf
import pandas as pd
from datetime import datetime
from typing import Optional
import structlog

log = structlog.get_logger()

BIST_SYMBOLS = {
    "ASELS": "ASELS.IS", "THYAO": "THYAO.IS", "GARAN": "GARAN.IS",
    "AKBNK": "AKBNK.IS", "ISCTR": "ISCTR.IS", "EREGL": "EREGL.IS",
    "KCHOL": "KCHOL.IS", "SAHOL": "SAHOL.IS", "SISE": "SISE.IS",
    "TUPRS": "TUPRS.IS", "BIMAS": "BIMAS.IS", "MGROS": "MGROS.IS",
    "TCELL": "TCELL.IS", "ARCLK": "ARCLK.IS", "TOASO": "TOASO.IS",
    "FROTO": "FROTO.IS", "DOHOL": "DOHOL.IS", "TTKOM": "TTKOM.IS",
    "PGSUS": "PGSUS.IS", "VESTL": "VESTL.IS",
    "YKBNK": "YKBNK.IS", "VAKBN": "VAKBN.IS", "HALKB": "HALKB.IS",
    "QNBFB": "QNBFB.IS",
    "PETKM": "PETKM.IS", "AKSEN": "AKSEN.IS", "ODAS": "ODAS.IS",
    "ENKAI": "ENKAI.IS", "TKFEN": "TKFEN.IS", "AEFES": "AEFES.IS",
    "GUBRF": "GUBRF.IS", "BRSAN": "BRSAN.IS", "ISDMR": "ISDMR.IS",
    "EKGYO": "EKGYO.IS", "TRGYO": "TRGYO.IS", "ZRGYO": "ZRGYO.IS",
    "GLYHO": "GLYHO.IS", "ALARK": "ALARK.IS",
    "SOKM": "SOKM.IS", "MAVI": "MAVI.IS", "ADESE": "ADESE.IS",
    "ULKER": "ULKER.IS", "CCOLA": "CCOLA.IS",
    "TAVHL": "TAVHL.IS", "OTKAR": "OTKAR.IS",
    "KOZAL": "KOZAL.IS", "KOZAA": "KOZAA.IS",
    "LOGO": "LOGO.IS", "NETAS": "NETAS.IS", "MPARK": "MPARK.IS",
    "SASA": "SASA.IS", "CIMSA": "CIMSA.IS", "KORDS": "KORDS.IS",
    "BERA": "BERA.IS", "IHAAS": "IHAAS.IS",
    "BIST100": "XU100.IS", "BIST30": "XU030.IS",
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


def _make_session() -> requests.Session:
    """Yahoo Finance cookie akışını tamamlayan session."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
    })
    try:
        session.get("https://finance.yahoo.com", timeout=10)
    except Exception:
        pass
    return session


def _fetch_price_sync(symbol: str, yf_symbol: str) -> dict | None:
    try:
        session = _make_session()
        ticker = yf.Ticker(yf_symbol, session=session)
        info = ticker.fast_info

        def _get(attr):
            try:
                v = getattr(info, attr, None)
                return v if v and str(v) not in ("None", "nan") else None
            except Exception:
                return None

        price = _get("last_price")
        prev_close = _get("previous_close")

        if price is None:
            try:
                df = yf.download(
                    yf_symbol, period="5d", interval="1d",
                    progress=False, auto_adjust=True, session=session
                )
                if not df.empty:
                    price = float(df["Close"].iloc[-1])
                    if len(df) >= 2 and prev_close is None:
                        prev_close = float(df["Close"].iloc[-2])
            except Exception:
                pass

        change_pct = None
        if price and prev_close and prev_close != 0:
            change_pct = round((price - prev_close) / prev_close * 100, 4)

        return {
            "symbol": symbol,
            "price": float(price) if price else None,
            "open": float(_get("open") or 0) or None,
            "high": float(_get("day_high") or 0) or None,
            "low": float(_get("day_low") or 0) or None,
            "volume": int(_get("three_month_average_volume") or 0) or None,
            "change_pct": change_pct,
            "market_cap": float(_get("market_cap") or 0) or None,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        log.error("price_fetch_failed", symbol=symbol, error=str(e))
        return None


async def fetch_price(symbol: str, yf_symbol: str | None = None) -> dict | None:
    return await asyncio.to_thread(_fetch_price_sync, symbol, yf_symbol or symbol)


async def fetch_ohlcv(symbol: str, period: str = "1y", interval: str = "1d") -> Optional[pd.DataFrame]:
    def _sync():
        try:
            session = _make_session()
            ticker = yf.Ticker(symbol, session=session)
            df = ticker.history(period=period, interval=interval)
            if df.empty:
                return None
            df.index = pd.to_datetime(df.index)
            return df[["Open", "High", "Low", "Close", "Volume"]].dropna()
        except Exception as e:
            log.error("ohlcv_fetch_failed", symbol=symbol, error=str(e))
            return None

    return await asyncio.to_thread(_sync)


async def fetch_all_prices() -> list[dict]:
    tasks = []
    for display_name, yf_sym in BIST_SYMBOLS.items():
        tasks.append(fetch_price(display_name, yf_sym))
    for display_name, yf_sym in COMMODITY_SYMBOLS.items():
        tasks.append(fetch_price(display_name, yf_sym))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if isinstance(r, dict)]
