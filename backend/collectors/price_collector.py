import asyncio
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


def _parse_ticker_df(display_name: str, ticker_df: pd.DataFrame) -> dict | None:
    """Bir sembolün DataFrame'inden fiyat dict'i oluşturur."""
    try:
        clean = ticker_df.dropna(subset=["Close"])
        if clean.empty:
            return None
        latest = clean.iloc[-1]
        prev = clean.iloc[-2] if len(clean) >= 2 else None

        price = float(latest["Close"])
        if price == 0:
            return None

        prev_close = float(prev["Close"]) if prev is not None else None
        change_pct = None
        if prev_close and prev_close != 0:
            change_pct = round((price - prev_close) / prev_close * 100, 4)

        return {
            "symbol": display_name,
            "price": price,
            "open": float(latest.get("Open") or 0) or None,
            "high": float(latest.get("High") or 0) or None,
            "low": float(latest.get("Low") or 0) or None,
            "volume": int(latest.get("Volume") or 0) or None,
            "change_pct": change_pct,
            "market_cap": None,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        log.warning("price_parse_failed", symbol=display_name, error=str(e))
        return None


def _fetch_all_sync() -> list[dict]:
    """Tek batch yf.download() ile tüm sembolleri çeker."""
    all_syms = {**BIST_SYMBOLS, **COMMODITY_SYMBOLS}
    yf_list = list(all_syms.values())
    display_map = {v: k for k, v in all_syms.items()}

    results = []
    # Batch boyutu 30 ile böl — çok büyük batch'ler bazen boş döner
    chunk_size = 30
    chunks = [yf_list[i:i+chunk_size] for i in range(0, len(yf_list), chunk_size)]

    for chunk in chunks:
        try:
            df = yf.download(
                chunk, period="5d", interval="1d",
                group_by="ticker", auto_adjust=True,
                progress=False, threads=False,
            )
            if df.empty:
                log.warning("batch_empty", symbols=chunk[:3])
                continue

            for yf_sym in chunk:
                display = display_map.get(yf_sym, yf_sym)
                try:
                    # Tek sembol varsa df doğrudan OHLCV, çoksa df[yf_sym]
                    if len(chunk) == 1:
                        ticker_df = df
                    else:
                        if yf_sym not in df.columns.get_level_values(0):
                            continue
                        ticker_df = df[yf_sym]
                    parsed = _parse_ticker_df(display, ticker_df)
                    if parsed:
                        results.append(parsed)
                except Exception as e:
                    log.warning("ticker_extract_failed", symbol=display, error=str(e))
        except Exception as e:
            log.error("batch_download_failed", chunk_size=len(chunk), error=str(e))

    log.info("prices_fetched", count=len(results), total=len(all_syms))
    return results


def _fetch_price_sync(symbol: str, yf_symbol: str) -> dict | None:
    """Tek sembol için senkron yfinance çağrısı (on-demand fallback)."""
    try:
        df = yf.download(yf_symbol, period="5d", interval="1d", progress=False, auto_adjust=True)
        if not df.empty:
            return _parse_ticker_df(symbol, df)

        # download başarısız → fast_info dene
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
        if not price:
            return None

        change_pct = None
        if prev_close and prev_close != 0:
            change_pct = round((price - prev_close) / prev_close * 100, 4)

        return {
            "symbol": symbol,
            "price": float(price),
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
    """Tüm sembolleri batch download ile çeker."""
    return await asyncio.to_thread(_fetch_all_sync)
