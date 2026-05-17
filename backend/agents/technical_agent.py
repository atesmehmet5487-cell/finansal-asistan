"""
Agent 3: Teknik İndikatör Analiz Ajanı
Kütüphane: pandas_ta
Model: Gemini 2.0 Flash (hesaplama sonrası kısa yorum)
"""
import json
import pandas as pd
import pandas_ta as ta
import numpy as np
from agents.gemini_client import generate
from collectors.price_collector import fetch_ohlcv
import structlog

log = structlog.get_logger()

SYSTEM = "Sen bir teknik analiz uzmanısın. Sana verilen indikatör değerlerini Türkçe olarak yorumlayacaksın. SADECE JSON döndür. Yatırım tavsiyesi verme."

INTERPRETATION_PROMPT = """Aşağıdaki teknik analiz verilerini yorumla:

Sembol: {symbol}
Fiyat: {price} ({change_pct:+.2f}%)
RSI(14): {rsi}
MACD Sinyali: {macd_signal}
Trend: {trend}
MA durumu: {ma_status}
Bollinger: {bb_position}

SADECE JSON döndür:
{{
  "composite_signal": <"BUY" veya "SELL" veya "NEUTRAL">,
  "signal_strength": <0.0-1.0>,
  "risk_level": <"LOW" veya "MEDIUM" veya "HIGH">,
  "confidence": <0.0-1.0>,
  "interpretation_tr": "<3-4 cümle Türkçe yorum>"
}}"""


def _safe_float(val) -> float | None:
    try:
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        return round(float(val), 4)
    except Exception:
        return None


def _compute_indicators(df: pd.DataFrame) -> dict:
    indicators = {}

    rsi = ta.rsi(df["Close"], length=14)
    if rsi is not None and not rsi.empty:
        val = _safe_float(rsi.iloc[-1])
        indicators["RSI_14"] = {
            "value": val,
            "signal": "OVERBOUGHT" if val and val > 70 else "OVERSOLD" if val and val < 30 else "NEUTRAL",
            "note": "Aşırı alım" if val and val > 70 else "Aşırı satım" if val and val < 30 else "Orta bölgede",
        }

    macd = ta.macd(df["Close"], fast=12, slow=26, signal=9)
    if macd is not None and not macd.empty:
        macd_val = _safe_float(macd["MACD_12_26_9"].iloc[-1])
        signal_val = _safe_float(macd["MACDs_12_26_9"].iloc[-1])
        hist_val = _safe_float(macd["MACDh_12_26_9"].iloc[-1])
        signal = "BUY" if (macd_val and signal_val and macd_val > signal_val) else "SELL"
        indicators["MACD"] = {"value": macd_val, "signal_line": signal_val, "histogram": hist_val, "signal": signal}

    for length, name in [(20, "MA20"), (50, "MA50"), (200, "MA200")]:
        sma = ta.sma(df["Close"], length=length)
        if sma is not None and not sma.empty and len(sma) >= length:
            val = _safe_float(sma.iloc[-1])
            current = _safe_float(df["Close"].iloc[-1])
            signal = "BUY" if (val and current and current > val) else "SELL"
            note = "Fiyat üzerinde" if signal == "BUY" else "Fiyat altında"
            indicators[name] = {"value": val, "signal": signal, "note": note}

    bb = ta.bbands(df["Close"], length=20, std=2)
    if bb is not None and not bb.empty:
        upper = _safe_float(bb["BBU_20_2.0"].iloc[-1])
        lower = _safe_float(bb["BBL_20_2.0"].iloc[-1])
        mid = _safe_float(bb["BBM_20_2.0"].iloc[-1])
        current = _safe_float(df["Close"].iloc[-1])
        if upper and lower and current:
            pct = (current - lower) / (upper - lower) * 100
            position = "UPPER" if pct > 80 else "LOWER" if pct < 20 else "MIDDLE"
        else:
            position = "UNKNOWN"
        indicators["Bollinger"] = {"upper": upper, "lower": lower, "mid": mid, "position": position, "signal": "NEUTRAL"}

    stoch = ta.stoch(df["High"], df["Low"], df["Close"], k=14, d=3, smooth_k=3)
    if stoch is not None and not stoch.empty:
        k_val = _safe_float(stoch["STOCHk_14_3_3"].iloc[-1])
        d_val = _safe_float(stoch["STOCHd_14_3_3"].iloc[-1])
        signal = "OVERBOUGHT" if k_val and k_val > 80 else "OVERSOLD" if k_val and k_val < 20 else "NEUTRAL"
        indicators["Stochastic"] = {"k": k_val, "d": d_val, "signal": signal}

    obv = ta.obv(df["Close"], df["Volume"])
    if obv is not None and not obv.empty and len(obv) >= 5:
        indicators["OBV"] = {"trend": "UP" if obv.iloc[-1] > obv.iloc[-5] else "DOWN"}

    return indicators


def _compute_levels(df: pd.DataFrame) -> dict:
    high = df["High"].iloc[-1]
    low = df["Low"].iloc[-1]
    close = df["Close"].iloc[-1]
    pivot = (high + low + close) / 3
    r1 = 2 * pivot - low
    s1 = 2 * pivot - high
    r2 = pivot + (high - low)
    s2 = pivot - (high - low)
    return {
        "pivot": _safe_float(pivot),
        "resistance_1": _safe_float(r1),
        "resistance_2": _safe_float(r2),
        "support_1": _safe_float(s1),
        "support_2": _safe_float(s2),
        "period_high": _safe_float(df["High"].rolling(20).max().iloc[-1]),
        "period_low": _safe_float(df["Low"].rolling(20).min().iloc[-1]),
    }


def _determine_trend(df: pd.DataFrame, indicators: dict) -> dict:
    buy_signals = sum(1 for v in indicators.values() if isinstance(v, dict) and v.get("signal") == "BUY")
    sell_signals = sum(1 for v in indicators.values() if isinstance(v, dict) and v.get("signal") == "SELL")
    total = buy_signals + sell_signals

    if total == 0:
        direction, strength = "SIDEWAYS", 0.5
    elif buy_signals > sell_signals:
        direction, strength = "UPTREND", buy_signals / total
    else:
        direction, strength = "DOWNTREND", sell_signals / total

    current = _safe_float(df["Close"].iloc[-1])
    above_count = sum(
        1 for name in ["MA20", "MA50", "MA200"]
        if indicators.get(name, {}).get("value") and current and current > indicators[name]["value"]
    )

    return {
        "direction": direction,
        "strength": _safe_float(strength),
        "buy_signals": buy_signals,
        "sell_signals": sell_signals,
        "above_ma_count": above_count,
    }


async def analyze_technical(symbol: str, yf_symbol: str | None = None) -> dict | None:
    ticker = yf_symbol or (symbol + ".IS" if not symbol.endswith(".IS") and "=" not in symbol else symbol)
    df = await fetch_ohlcv(ticker)

    if df is None or len(df) < 50:
        log.warning("insufficient_data", symbol=symbol)
        return None

    try:
        current_price = _safe_float(df["Close"].iloc[-1])
        prev_close = _safe_float(df["Close"].iloc[-2])
        change_pct = ((current_price - prev_close) / prev_close * 100) if current_price and prev_close else None

        indicators = _compute_indicators(df)
        levels = _compute_levels(df)
        trend = _determine_trend(df, indicators)
        interpretation = await _get_interpretation(symbol, current_price, change_pct or 0, indicators, trend)

        return {
            "symbol": symbol,
            "price": {
                "current": current_price,
                "change_pct": change_pct,
                "volume": int(df["Volume"].iloc[-1]),
            },
            "indicators": indicators,
            "levels": levels,
            "trend": trend,
            **interpretation,
        }
    except Exception as e:
        log.error("technical_analysis_failed", symbol=symbol, error=str(e))
        return None


async def _get_interpretation(symbol: str, price: float, change_pct: float, indicators: dict, trend: dict) -> dict:
    rsi = indicators.get("RSI_14", {}).get("value", "N/A")
    macd_signal = indicators.get("MACD", {}).get("signal", "N/A")
    bb_position = indicators.get("Bollinger", {}).get("position", "N/A")
    above_ma = trend.get("above_ma_count", 0)

    prompt = INTERPRETATION_PROMPT.format(
        symbol=symbol, price=price or 0, change_pct=change_pct,
        rsi=rsi, macd_signal=macd_signal, trend=trend.get("direction", "UNKNOWN"),
        ma_status=f"{above_ma}/3 hareketli ortalama üzerinde", bb_position=bb_position,
    )

    try:
        raw = await generate(prompt, system=SYSTEM, quality="fast")
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        log.error("interpretation_failed", symbol=symbol, error=str(e))
        buy = trend.get("buy_signals", 0)
        sell = trend.get("sell_signals", 0)
        return {
            "composite_signal": "BUY" if buy > sell else "SELL" if sell > buy else "NEUTRAL",
            "signal_strength": 0.5,
            "risk_level": "MEDIUM",
            "confidence": 0.5,
            "interpretation_tr": "Teknik analiz verisi mevcut.",
        }
