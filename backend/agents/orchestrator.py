"""
Agent 4: Orkestratör Ajanı
Model: Gemini 1.5 Pro
Ağırlıklar: Teknik %35, Haber %35, Yorum %30
"""
import json
from datetime import datetime
from agents.gemini_client import generate
import structlog

log = structlog.get_logger()

WEIGHTS = {"technical": 0.35, "news": 0.35, "sentiment": 0.30}

SYSTEM = "Sen bir finansal analiz uzmanısın. Teknik analiz, haber ve yatırımcı yorumu verilerini birleştirerek bütünsel değerlendirme yaparsın. Yatırım tavsiyesi VERME. SADECE JSON döndür."

ORCHESTRATION_PROMPT = """Aşağıdaki verileri {symbol} için birleştir:

TEKNİK: Sinyal={technical_signal}, Güven={technical_confidence}, Trend={trend_direction}
HABERLER: Duyarlılık={news_sentiment}, Skor={news_score}, Kritik haber={has_critical_news}
YATIRIMCILAR: Görünüm={investor_sentiment}, Skor={investor_score}, Temalar={trending_keywords}
MAKRO: Politika Faizi={policy_rate}, TÜFE={cpi_yearly}, USD/TRY={usd_rate}

SADECE JSON döndür:
{{
  "overall_sentiment": <"STRONGLY_POSITIVE" veya "POSITIVE" veya "NEUTRAL" veya "NEGATIVE" veya "STRONGLY_NEGATIVE">,
  "key_points": [<3-5 Türkçe madde>],
  "risk_factors": [<2-3 Türkçe risk>],
  "summary_tr": "<3-4 cümle tarafsız Türkçe özet>",
  "notification_reason": <null veya bildirim gerekçesi>
}}"""

DISCLAIMER = "Bu analiz bilgilendirme amaçlıdır. Yatırım tavsiyesi değildir."


def _normalize(score: float) -> float:
    return max(-1.0, min(1.0, score))


def _sentiment_to_score(sentiment: str) -> float:
    return {
        "STRONGLY_BULLISH": 0.9, "BULLISH": 0.6, "POSITIVE": 0.6, "STRONGLY_POSITIVE": 0.9,
        "NEUTRAL": 0.0,
        "BEARISH": -0.6, "NEGATIVE": -0.6, "STRONGLY_BEARISH": -0.9, "STRONGLY_NEGATIVE": -0.9,
    }.get(sentiment.upper(), 0.0)


def _signal_to_score(signal: str) -> float:
    return {"BUY": 0.7, "SELL": -0.7, "NEUTRAL": 0.0}.get(signal.upper(), 0.0)


def _score_to_10(score: float) -> float:
    return round((score + 1.0) * 5.0, 2)


def _score_to_sentiment(score: float) -> str:
    if score >= 0.7: return "STRONGLY_POSITIVE"
    if score >= 0.3: return "POSITIVE"
    if score >= -0.3: return "NEUTRAL"
    if score >= -0.7: return "NEGATIVE"
    return "STRONGLY_NEGATIVE"


def _should_notify(prev_score, new_score, has_critical, prev_sent, new_sent):
    reasons = []
    if has_critical:
        reasons.append("KRİTİK haber mevcut")
    if prev_score is not None and abs(new_score - prev_score) >= 1.5:
        reasons.append(f"Skor {abs(new_score - prev_score):.1f} puan değişti")
    if prev_sent and prev_sent != new_sent and new_sent in ("STRONGLY_POSITIVE", "STRONGLY_NEGATIVE", "POSITIVE", "NEGATIVE"):
        reasons.append("Genel görünüm değişti")
    return (True, " | ".join(reasons)) if reasons else (False, None)


async def orchestrate(
    symbol: str,
    technical: dict | None,
    news_results: list[dict] | None,
    sentiment: dict | None,
    prev_analysis: dict | None = None,
    macro: dict | None = None,
) -> dict:
    tech_signal = (technical or {}).get("composite_signal", "NEUTRAL")
    tech_confidence = (technical or {}).get("confidence", 0.5)
    trend_direction = (technical or {}).get("trend", {}).get("direction", "SIDEWAYS")

    news_scores = [n.get("sentiment_score", 0.0) for n in (news_results or []) if n.get("sentiment_score") is not None]
    avg_news_score = sum(news_scores) / len(news_scores) if news_scores else 0.0
    has_critical = any(n.get("importance") == "CRITICAL" for n in (news_results or []))
    news_sentiments = [n.get("sentiment_label", "NEUTRAL") for n in (news_results or [])]
    dominant_news = max(set(news_sentiments), key=news_sentiments.count) if news_sentiments else "NEUTRAL"

    investor_overall = (sentiment or {}).get("sentiment", {}).get("overall", "NEUTRAL")
    investor_score = (sentiment or {}).get("sentiment", {}).get("score", 0.0)
    trending = (sentiment or {}).get("trending_keywords", [])

    tech_score = _signal_to_score(tech_signal) * (tech_confidence or 0.5)
    composite_raw = (
        tech_score * WEIGHTS["technical"]
        + _normalize(avg_news_score) * WEIGHTS["news"]
        + _sentiment_to_score(investor_overall) * WEIGHTS["sentiment"]
    )
    composite_score = _score_to_10(composite_raw)
    overall_sentiment = _score_to_sentiment(composite_raw)

    policy_rate = (macro or {}).get("POLICY_RATE", {}).get("value", "N/A")
    cpi_yearly = (macro or {}).get("CPI_YEARLY", {}).get("value", "N/A")
    usd_rate = (macro or {}).get("USD_BUYING", {}).get("value", "N/A")

    llm_result = await _llm_synthesis(
        symbol=symbol,
        technical_signal=tech_signal,
        technical_confidence=tech_confidence,
        trend_direction=trend_direction,
        news_sentiment=dominant_news,
        news_score=round(avg_news_score, 3),
        has_critical_news=has_critical,
        investor_sentiment=investor_overall,
        investor_score=round(investor_score, 3),
        trending_keywords=", ".join(trending[:5]),
        policy_rate=policy_rate,
        cpi_yearly=cpi_yearly,
        usd_rate=usd_rate,
    )

    prev_score = (prev_analysis or {}).get("composite_score")
    prev_sent = (prev_analysis or {}).get("overall_sentiment")
    notify, notify_reason = _should_notify(prev_score, composite_score, has_critical, prev_sent, overall_sentiment)

    return {
        "asset": symbol,
        "generated_at": datetime.utcnow().isoformat(),
        "composite_score": composite_score,
        "scores": {
            "technical": {"score": round(tech_score, 3), "weight": WEIGHTS["technical"], "signal": tech_signal, "confidence": tech_confidence},
            "news_sentiment": {"score": round(_normalize(avg_news_score), 3), "weight": WEIGHTS["news"], "signal": dominant_news, "has_critical": has_critical},
            "investor_sentiment": {"score": round(_sentiment_to_score(investor_overall), 3), "weight": WEIGHTS["sentiment"], "signal": investor_overall},
        },
        "overall_sentiment": llm_result.get("overall_sentiment", overall_sentiment),
        "key_points": llm_result.get("key_points", []),
        "risk_factors": llm_result.get("risk_factors", []),
        "summary_tr": llm_result.get("summary_tr", ""),
        "notification_needed": notify,
        "notification_reason": notify_reason or llm_result.get("notification_reason"),
        "disclaimer": DISCLAIMER,
    }


async def _llm_synthesis(**kwargs) -> dict:
    prompt = ORCHESTRATION_PROMPT.format(**kwargs)
    try:
        raw = await generate(prompt, system=SYSTEM, quality="pro")
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        log.error("orchestration_llm_failed", error=str(e))
        return {
            "overall_sentiment": "NEUTRAL",
            "key_points": ["Analiz tamamlandı."],
            "risk_factors": ["Veri güvenilirliği kontrol edilmeli."],
            "summary_tr": "Analiz işlendi.",
            "notification_reason": None,
        }
