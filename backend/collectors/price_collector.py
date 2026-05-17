import asyncio
import yfinance as yf
import pandas as pd
from datetime import datetime
from typing import Optional
import structlog

log = structlog.get_logger()

BIST_SYMBOLS = {
    # BIST 30 çekirdeği
    "ASELS": "ASELS.IS", "THYAO": "THYAO.IS", "GARAN": "GARAN.IS",
    "AKBNK": "AKBNK.IS", "ISCTR": "ISCTR.IS", "EREGL": "EREGL.IS",
    "KCHOL": "KCHOL.IS", "SAHOL": "SAHOL.IS", "SISE": "SISE.IS",
    "TUPRS": "TUPRS.IS", "BIMAS": "BIMAS.IS", "MGROS": "MGROS.IS",
    "TCELL": "TCELL.IS", "ARCLK": "ARCLK.IS", "TOASO": "TOASO.IS",
    "FROTO": "FROTO.IS", "DOHOL": "DOHOL.IS", "TTKOM": "TTKOM.IS",
    "PGSUS": "PGSUS.IS", "VESTL": "VESTL.IS",
    # Bankacılık
    "YKBNK": "YKBNK.IS", "VAKBN": "VAKBN.IS", "HALKB": "HALKB.IS",
    "QNBFB": "QNBFB.IS",
    # Enerji & Sanayi
    "PETKM": "PETKM.IS", "AKSEN": "AKSEN.IS", "ODAS": "ODAS.IS",
    "ENKAI": "ENKAI.IS", "TKFEN": "TKFEN.IS", "AEFES": "AEFES.IS",
    "GUBRF": "GUBRF.IS", "BRSAN": "BRSAN.IS", "ISDMR": "ISDMR.IS",
    # GYO & Finans
    "EKGYO": "EKGYO.IS", "TRGYO": "TRGYO.IS", "ZRGYO": "ZRGYO.IS",
    "GLYHO": "GLYHO.IS", "ALARK": "ALARK.IS",
    # Tüketim & Perakende
    "SOKM": "SOKM.IS", "MAVI": "MAVI.IS", "ADESE": "ADESE.IS",
    "ULKER": "ULKER.IS", "CCOLA": "CCOLA.IS",
    # Turizm & Ulaştırma
    "TAVHL": "TAVHL.IS", "OTKAR": "OTKAR.IS",
    # Madencilik
    "KOZAL": "KOZAL.IS", "KOZAA": "KOZAA.IS",
    # Teknoloji & Diğer
    "LOGO": "LOGO.IS", "NETAS": "NETAS.IS", "MPARK": "MPARK.IS",
    "SASA": "SASA.IS", "CIMSA": "CIMSA.IS", "KORDS": "KORDS.IS",
    "BERA": "BERA.IS", "IHAAS": "IHAAS.IS",
    # Endeksler
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


def _fetch_price_sync(symbol: str, yf_symbol: str) -> dict | None:
    """Senkron yfinance çağrısı — asyncio.to_thread ile çalıştırılır."""
    try:
        ticker = yf.Ticker(yf_symbol)
        info = ticker.fast_info

        def _get(attr):
            try:
                v = getattr(info, attr, None)
                return v if v and str(v) not in ("None", "nan") else None
            except Exception:
                return None

        price = _get("last_price")
        prev_close = _get("previous_close")

        # Piyasa kapalıysa (hafta sonu / tatil) son kapanışa düş
        if price is None:
            try:
                df = yf.download(yf_symbol, period="5d", interval="1d", progress=False, auto_adjust=True)
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


async def fetch_all_prices() -> list[dict]:
    tasks = []
    symbols_list = []

    for display_name, yf_sym in BIST_SYMBOLS.items():
        tasks.append(fetch_price(display_name, yf_sym))
        symbols_list.append(display_name)
    for display_name, yf_sym in COMMODITY_SYMBOLS.items():
        tasks.append(fetch_price(display_name, yf_sym))
        symbols_list.append(display_name)

    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if isinstance(r, dict)]
