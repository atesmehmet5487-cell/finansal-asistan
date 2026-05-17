"""
Agent 2: Yatırımcı Yorum Analiz Ajanı
Model: Gemini 1.5 Pro (derin anlayış, kalite öncelikli)
"""
import json
from agents.gemini_client import generate
import structlog

log = structlog.get_logger()

ASSET_KEYWORDS = {
    "ASELS": ["aselsan", "asels"],
    "THYAO": ["thy", "thyao", "türk hava", "turkish airlines"],
    "GARAN": ["garanti", "garan", "garanti bankası"],
    "AKBNK": ["akbank", "akbnk"],
    "ISCTR": ["iş bankası", "işbank", "isctr"],
    "EREGL": ["ereğli", "erdemir", "eregl"],
    "BIST100": ["bist", "borsa", "endeks", "bist100"],
    "ALTIN": ["altın", "gold", "xau"],
    "DOLAR": ["dolar", "usd", "döviz"],
}

SYSTEM = "Sen bir finansal sosyal medya analiz uzmanısın. Türk yatırımcıların yorumlarını analiz ediyorsun. SADECE JSON döndür. Yatırım tavsiyesi verme."

BATCH_PROMPT = """Aşağıdaki sosyal medya yorumlarını analiz et, her biri için duyarlılık belirle:

{comments}

SADECE JSON array döndür:
[
  {{
    "index": <0-tabanlı indeks>,
    "sentiment": <"BULLISH" veya "BEARISH" veya "NEUTRAL">,
    "confidence": <0.0-1.0>,
    "relevant_assets": [<semboller>],
    "is_spam": <true veya false>
  }}
]"""

SUMMARY_PROMPT = """Aşağıdaki duyarlılık verilerini {symbol} için özetle:

Toplam: {total}, Boğa: {bullish}, Ayı: {bearish}, Nötr: {neutral}
En etkili yorumlar: {top_comments}

SADECE JSON döndür:
{{
  "overall": <"STRONGLY_BULLISH" veya "BULLISH" veya "NEUTRAL" veya "BEARISH" veya "STRONGLY_BEARISH">,
  "score": <-1.0 ile 1.0>,
  "key_themes": [<Türkçe temalar, max 5>],
  "summary_tr": "<2-3 cümle özet>"
}}"""


def _detect_assets(text: str) -> list[str]:
    text_lower = text.lower()
    return [sym for sym, kws in ASSET_KEYWORDS.items() if any(kw in text_lower for kw in kws)]


async def analyze_sentiment_batch(posts: list[dict], target_symbol: str | None = None) -> dict:
    if not posts:
        return _empty_result(target_symbol or "GENEL")

    relevant = []
    for post in posts:
        assets = _detect_assets(post.get("content", ""))
        if not target_symbol or target_symbol in assets or not assets:
            relevant.append({**post, "detected_assets": assets})

    if not relevant:
        relevant = posts[:20]

    top_30 = sorted(relevant, key=lambda x: x.get("engagement_score", 0), reverse=True)[:30]
    sentiments = await _analyze_comments(top_30)

    bullish = sum(1 for s in sentiments if s.get("sentiment") == "BULLISH" and not s.get("is_spam"))
    bearish = sum(1 for s in sentiments if s.get("sentiment") == "BEARISH" and not s.get("is_spam"))
    neutral = sum(1 for s in sentiments if s.get("sentiment") == "NEUTRAL" and not s.get("is_spam"))
    total = bullish + bearish + neutral

    top_comments = []
    for i, post in enumerate(top_30[:10]):
        sent_data = next((s for s in sentiments if s.get("index") == i), {})
        if not sent_data.get("is_spam"):
            top_comments.append({
                "source": post.get("source", ""),
                "content": post.get("content", "")[:280],
                "author": post.get("author", ""),
                "engagement_score": post.get("engagement_score", 0),
                "sentiment": sent_data.get("sentiment", "NEUTRAL"),
                "url": post.get("url", ""),
            })

    summary = await _summarize(
        symbol=target_symbol or "GENEL",
        bullish=bullish, bearish=bearish, neutral=neutral, total=total,
        top_comments=top_comments[:5],
    )

    bullish_pct = round(bullish / total * 100) if total else 0
    bearish_pct = round(bearish / total * 100) if total else 0

    return {
        "asset": target_symbol or "GENEL",
        "total_mentions": len(relevant),
        "analyzed_count": total,
        "sentiment": {
            "bullish_pct": bullish_pct,
            "bearish_pct": bearish_pct,
            "neutral_pct": 100 - bullish_pct - bearish_pct,
            "overall": summary.get("overall", "NEUTRAL"),
            "score": summary.get("score", 0.0),
        },
        "top_comments": top_comments,
        "trending_keywords": summary.get("key_themes", []),
        "summary_tr": summary.get("summary_tr", ""),
    }


async def _analyze_comments(posts: list[dict]) -> list[dict]:
    comments_text = "\n".join(
        f"{i}. [{p.get('source', '')}] {p.get('content', '')[:200]}"
        for i, p in enumerate(posts)
    )
    prompt = BATCH_PROMPT.format(comments=comments_text)
    try:
        raw = await generate(prompt, system=SYSTEM, quality="pro")
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        log.error("sentiment_batch_failed", error=str(e))
        return [{"index": i, "sentiment": "NEUTRAL", "confidence": 0.5, "is_spam": False} for i in range(len(posts))]


async def _summarize(symbol: str, bullish: int, bearish: int, neutral: int, total: int, top_comments: list) -> dict:
    comments_text = "\n".join(f"- [{c['sentiment']}] {c['content'][:150]}" for c in top_comments)
    prompt = SUMMARY_PROMPT.format(
        symbol=symbol, total=total,
        bullish=bullish, bearish=bearish, neutral=neutral,
        top_comments=comments_text,
    )
    try:
        raw = await generate(prompt, system=SYSTEM, quality="pro")
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        log.error("summary_failed", symbol=symbol, error=str(e))
        score = 0.4 if bullish > bearish else -0.4 if bearish > bullish else 0.0
        overall = "BULLISH" if bullish > bearish else "BEARISH" if bearish > bullish else "NEUTRAL"
        return {"overall": overall, "score": score, "key_themes": [], "summary_tr": ""}


def _empty_result(symbol: str) -> dict:
    return {
        "asset": symbol,
        "total_mentions": 0,
        "analyzed_count": 0,
        "sentiment": {"bullish_pct": 0, "bearish_pct": 0, "neutral_pct": 100, "overall": "NEUTRAL", "score": 0.0},
        "top_comments": [],
        "trending_keywords": [],
        "summary_tr": "Yeterli veri bulunamadı.",
    }
