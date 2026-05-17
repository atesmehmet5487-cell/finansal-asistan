"""
Agent 1: Haber & Emtia Analiz Ajanı
Model: Gemini 2.0 Flash (hız öncelikli batch işlem)
"""
import json
from agents.gemini_client import generate
import structlog

log = structlog.get_logger()

BIST_SYMBOLS = [
    "ASELS", "THYAO", "GARAN", "AKBNK", "ISCTR", "EREGL", "KCHOL",
    "SAHOL", "SISE", "TUPRS", "BIMAS", "MGROS", "TCELL", "ARCLK",
    "TOASO", "FROTO", "DOHOL", "TTKOM", "PGSUS", "VESTL",
    "BIST100", "BIST30", "ALTIN", "GUMUS", "PETROL", "DOLAR", "EURO",
]

SYSTEM_PROMPT = """Sen bir finansal haber analiz uzmanısın. Türkiye piyasaları konusunda uzmansın.
Sana verilen haberleri analiz edip SADECE geçerli JSON döndür, başka hiçbir şey yazma.
Duyarlılık skoru: -1.0 (çok negatif) ile +1.0 (çok pozitif) arası.
Önem seviyeleri: CRITICAL, HIGH, MEDIUM, LOW.
affected_assets listesi için sadece şunları kullan: """ + ", ".join(BIST_SYMBOLS)

USER_PROMPT_TEMPLATE = """Aşağıdaki haberi analiz et ve SADECE JSON döndür:

Başlık: {title}
Kaynak: {source}
İçerik: {content}

Döndür:
{{
  "sentiment_score": <-1.0 ile 1.0 arası sayı>,
  "sentiment_label": <"POSITIVE" veya "NEGATIVE" veya "NEUTRAL">,
  "importance": <"CRITICAL" veya "HIGH" veya "MEDIUM" veya "LOW">,
  "affected_assets": [<listeden ilgili semboller>],
  "categories": [<konu etiketleri>],
  "summary_tr": "<2-3 cümle Türkçe özet>"
}}"""


async def analyze_news_batch(articles: list[dict]) -> list[dict]:
    analyzed = []
    for article in articles:
        try:
            result = await _analyze_single(article)
            if result:
                analyzed.append({**article, **result})
        except Exception as e:
            log.error("news_analysis_failed", title=article.get("title", "")[:50], error=str(e))
            analyzed.append({
                **article,
                "sentiment_score": 0.0,
                "sentiment_label": "NEUTRAL",
                "importance": article.get("importance_hint", "LOW"),
                "affected_assets": [],
                "categories": [],
                "summary_tr": article.get("content", "")[:200],
            })
    return analyzed


async def _analyze_single(article: dict) -> dict | None:
    prompt = USER_PROMPT_TEMPLATE.format(
        title=article.get("title", ""),
        source=article.get("source", ""),
        content=(article.get("content", "") or "")[:500],
    )

    raw = await generate(prompt, system=SYSTEM_PROMPT, quality="fast")
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)
