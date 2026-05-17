from telegram import Bot
from config import get_settings

settings = get_settings()

IMPORTANCE_EMOJI = {
    "STRONGLY_POSITIVE": "🚀",
    "POSITIVE": "📈",
    "NEUTRAL": "➡️",
    "NEGATIVE": "📉",
    "STRONGLY_NEGATIVE": "🔻",
}

SENTIMENT_TR = {
    "STRONGLY_POSITIVE": "Güçlü Pozitif",
    "POSITIVE": "Pozitif",
    "NEUTRAL": "Nötr",
    "NEGATIVE": "Negatif",
    "STRONGLY_NEGATIVE": "Güçlü Negatif",
}

DISCLAIMER = "⚠️ Bilgilendirme amaçlıdır, yatırım tavsiyesi değildir."


def format_analysis_message(symbol: str, analysis: dict, price_data: dict | None = None) -> str:
    sentiment = analysis.get("overall_sentiment", "NEUTRAL")
    score = analysis.get("composite_score", 0)
    emoji = IMPORTANCE_EMOJI.get(sentiment, "➡️")
    sentiment_tr = SENTIMENT_TR.get(sentiment, "Nötr")

    lines = [
        f"{emoji} *{symbol} Analiz Güncellemesi*",
        "",
        f"Genel Görünüm: *{sentiment_tr}*  ({score:.1f}/10)",
        "",
    ]

    if price_data and price_data.get("price"):
        change = price_data.get("change_pct", 0) or 0
        change_str = f"+{change:.2f}%" if change >= 0 else f"{change:.2f}%"
        lines.append(f"💰 Fiyat: *{price_data['price']:,.2f}* ({change_str})")
        lines.append("")

    scores = analysis.get("scores", {})
    tech = scores.get("technical", {})
    news = scores.get("news_sentiment", {})
    inv = scores.get("investor_sentiment", {})

    lines.append("📊 *Alt Skorlar*")
    if tech:
        lines.append(f"  📈 Teknik: {tech.get('signal', 'N/A')}")
    if news:
        crit = " 🚨 Kritik haber!" if news.get("has_critical") else ""
        lines.append(f"  📰 Haberler: {news.get('signal', 'N/A')}{crit}")
    if inv:
        lines.append(f"  👥 Yatırımcılar: {inv.get('signal', 'N/A')}")

    key_points = analysis.get("key_points", [])
    if key_points:
        lines.append("")
        lines.append("🔑 *Öne Çıkanlar*")
        for point in key_points[:3]:
            lines.append(f"  • {point}")

    risk_factors = analysis.get("risk_factors", [])
    if risk_factors:
        lines.append("")
        lines.append("⚠️ *Riskler*")
        for risk in risk_factors[:2]:
            lines.append(f"  • {risk}")

    lines.append("")
    lines.append(DISCLAIMER)

    return "\n".join(lines)


def format_news_message(symbol: str, news: list[dict]) -> str:
    lines = [f"📰 *{symbol} — Son Haberler*", ""]
    for n in news[:5]:
        importance = n.get("importance", "")
        emoji = "🚨" if importance == "CRITICAL" else "📌" if importance == "HIGH" else "•"
        lines.append(f"{emoji} {n.get('title', '')}")
        lines.append(f"   _{n.get('source', '')}_ | {n.get('summary_tr', '')[:100]}...")
        lines.append("")
    lines.append(DISCLAIMER)
    return "\n".join(lines)


def format_daily_summary(watchlist_data: list[dict]) -> str:
    from datetime import date
    today = date.today().strftime("%d %B %Y")

    lines = [f"📊 *Günlük Özet — {today}*", "", "İzlediğin Varlıklar:", ""]

    for item in watchlist_data:
        symbol = item.get("symbol", "")
        price = item.get("price")
        change = item.get("change_pct", 0) or 0
        score = item.get("composite_score", 0) or 0
        sentiment = item.get("overall_sentiment", "NEUTRAL")
        emoji = IMPORTANCE_EMOJI.get(sentiment, "➡️")

        change_str = f"+{change:.2f}%" if change >= 0 else f"{change:.2f}%"
        price_str = f"{price:,.2f}" if price else "N/A"

        lines.append(f"{emoji} *{symbol}*  {price_str}  {change_str}  {score:.1f}/10")

    lines.append("")
    lines.append(DISCLAIMER)
    return "\n".join(lines)


async def send_message(chat_id: int, text: str, parse_mode: str = "Markdown") -> bool:
    try:
        bot = Bot(token=settings.telegram_bot_token)
        await bot.send_message(chat_id=chat_id, text=text, parse_mode=parse_mode)
        return True
    except Exception:
        return False
