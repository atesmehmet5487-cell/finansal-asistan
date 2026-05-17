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


async def fetch_price(symbol: str, yf_symbol: str | None = None) -> dict | None:
    try:
        ticker_sym = yf_symbol or symbol
        ticker = yf.Ticker(ticker_sym)
        info = ticker.fast_info

        def _get(attr):
            try:
                v = getattr(info, attr, None)
                return v if v and str(v) not in ("None", "nan") else None
            except Exception:
                return None

        price = _get("last_price")
        prev_close = _get("previous_close")
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


async def fetch_ohlcv(symbol: str, period: str = "1y", interval: str = "1d") -> Optional[pd.DataFrame]:
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


async def fetch_all_prices() -> list[dict]:
    results = []
    for display_name, yf_sym in BIST_SYMBOLS.items():
        data = await fetch_price(display_name, yf_sym)
        if data:
            results.append(data)

    for display_name, yf_sym in COMMODITY_SYMBOLS.items():
        data = await fetch_price(display_name, yf_sym)
        if data:
            results.append(data)

    return results
