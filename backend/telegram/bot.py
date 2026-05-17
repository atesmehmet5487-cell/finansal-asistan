"""
Telegram Bot — Komut işleyicileri ve bildirim döngüsü
"""
import asyncio
import json
from telegram import Update, BotCommand
from telegram.ext import Application, CommandHandler, ContextTypes
from cache.redis_client import get_redis, cache_get
from db.database import AsyncSessionLocal
from db.models import Asset, UserWatchlist
from sqlalchemy import select
from telegram.notifier import (
    format_analysis_message, format_news_message, format_daily_summary, send_message
)
from config import get_settings
import structlog

log = structlog.get_logger()
settings = get_settings()

COMMANDS_HELP = """
*Finansal Asistan Bot*

📋 *Komutlar:*
/izle ASELS — Varlığı takibe al
/cikar ASELS — Takipten çıkar
/liste — İzlediğin varlıklar
/analiz ASELS — Anlık analiz
/haberler ASELS — Son haberler
/ayarlar — Bildirim eşiği ayarla
/yardim — Bu mesaj

⚠️ _Bilgilendirme amaçlıdır. Yatırım tavsiyesi değildir._
"""


async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        f"👋 Merhaba! Finansal Asistan'a hoş geldiniz.\n\n{COMMANDS_HELP}",
        parse_mode="Markdown",
    )


async def cmd_yardim(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(COMMANDS_HELP, parse_mode="Markdown")


async def cmd_izle(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Kullanım: /izle ASELS")
        return

    symbol = ctx.args[0].upper()
    chat_id = update.effective_chat.id

    async with AsyncSessionLocal() as db:
        asset = (await db.execute(select(Asset).where(Asset.symbol == symbol))).scalar_one_or_none()
        if not asset:
            await update.message.reply_text(f"❌ {symbol} bulunamadı. Sembolü kontrol edin.")
            return

        existing = (await db.execute(
            select(UserWatchlist).where(
                UserWatchlist.telegram_chat_id == chat_id,
                UserWatchlist.asset_id == asset.id,
            )
        )).scalar_one_or_none()

        if existing:
            await update.message.reply_text(f"✅ {symbol} zaten listenizde.")
            return

        wl = UserWatchlist(telegram_chat_id=chat_id, asset_id=asset.id, notify_level="HIGH")
        db.add(wl)
        await db.commit()

    await update.message.reply_text(
        f"✅ *{symbol}* izlemeye alındı.\n"
        f"Önemli gelişmelerde bildirim alacaksınız.",
        parse_mode="Markdown",
    )


async def cmd_cikar(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Kullanım: /cikar ASELS")
        return

    symbol = ctx.args[0].upper()
    chat_id = update.effective_chat.id

    async with AsyncSessionLocal() as db:
        asset = (await db.execute(select(Asset).where(Asset.symbol == symbol))).scalar_one_or_none()
        if not asset:
            await update.message.reply_text(f"❌ {symbol} bulunamadı.")
            return

        wl = (await db.execute(
            select(UserWatchlist).where(
                UserWatchlist.telegram_chat_id == chat_id,
                UserWatchlist.asset_id == asset.id,
            )
        )).scalar_one_or_none()

        if not wl:
            await update.message.reply_text(f"{symbol} listenizde değil.")
            return

        await db.delete(wl)
        await db.commit()

    await update.message.reply_text(f"✅ *{symbol}* takipten çıkarıldı.", parse_mode="Markdown")


async def cmd_liste(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    async with AsyncSessionLocal() as db:
        records = (await db.execute(
            select(UserWatchlist, Asset)
            .join(Asset, UserWatchlist.asset_id == Asset.id)
            .where(UserWatchlist.telegram_chat_id == chat_id)
        )).all()

    if not records:
        await update.message.reply_text("📋 İzleme listeniz boş. /izle ASELS ile ekleyin.")
        return

    items = []
    for wl, asset in records:
        price_data = await cache_get(f"cache:price:{asset.symbol}")
        consolidated = await cache_get(f"cache:asset:{asset.symbol}:consolidated")
        items.append({
            "symbol": asset.symbol,
            "price": price_data.get("price") if price_data else None,
            "change_pct": price_data.get("change_pct") if price_data else None,
            "composite_score": consolidated.get("composite_score") if consolidated else None,
            "overall_sentiment": consolidated.get("overall_sentiment") if consolidated else None,
        })

    msg = format_daily_summary(items)
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_analiz(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Kullanım: /analiz ASELS")
        return

    symbol = ctx.args[0].upper()
    analysis = await cache_get(f"cache:asset:{symbol}:consolidated")
    price_data = await cache_get(f"cache:price:{symbol}")

    if not analysis:
        await update.message.reply_text(f"❌ {symbol} için analiz henüz hazır değil. Birkaç dakika sonra tekrar deneyin.")
        return

    msg = format_analysis_message(symbol, analysis, price_data)
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_haberler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Kullanım: /haberler ASELS")
        return

    symbol = ctx.args[0].upper()
    news_feed = await cache_get("cache:news:feed:latest") or []
    news = [n for n in news_feed if symbol in n.get("affected_assets", [])]

    if not news:
        await update.message.reply_text(f"📰 {symbol} için güncel haber bulunamadı.")
        return

    msg = format_news_message(symbol, news)
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_ayarlar(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "⚙️ *Bildirim Eşiği Ayarları*\n\n"
        "Şu anda: YÜKSEK (kritik ve önemli haberler)\n\n"
        "Seçenekler:\n"
        "• KRİTİK — Sadece acil haberler\n"
        "• YÜKSEK — Önemli gelişmeler (önerilen)\n"
        "• ORTA — Tüm önemli haberler\n"
        "• HEPSI — Her güncelleme\n\n"
        "_Ayar değiştirme yakında eklenecek._",
        parse_mode="Markdown",
    )


async def notification_loop(app: Application):
    r = get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe("stream:notifications")

    log.info("notification_loop_started")

    async for message in pubsub.listen():
        if message["type"] != "message":
            continue
        try:
            data = json.loads(message["data"])
            symbol = data.get("symbol", "")
            analysis = data.get("analysis", {})

            async with AsyncSessionLocal() as db:
                asset = (await db.execute(select(Asset).where(Asset.symbol == symbol))).scalar_one_or_none()
                if not asset:
                    continue

                watchers = (await db.execute(
                    select(UserWatchlist).where(UserWatchlist.asset_id == asset.id)
                )).scalars().all()

            price_data = await cache_get(f"cache:price:{symbol}")

            for watcher in watchers:
                importance = analysis.get("overall_sentiment", "NEUTRAL")
                threshold = watcher.notify_level

                if _passes_threshold(importance, threshold):
                    msg = format_analysis_message(symbol, analysis, price_data)
                    await send_message(watcher.telegram_chat_id, msg)

        except Exception as e:
            log.error("notification_failed", error=str(e))


def _passes_threshold(sentiment: str, level: str) -> bool:
    order = ["CRITICAL", "HIGH", "MEDIUM", "ALL"]
    sentiment_importance = {
        "STRONGLY_POSITIVE": "HIGH", "STRONGLY_NEGATIVE": "HIGH",
        "POSITIVE": "MEDIUM", "NEGATIVE": "MEDIUM",
        "NEUTRAL": "ALL",
    }
    item_level = sentiment_importance.get(sentiment, "ALL")
    try:
        return order.index(item_level) <= order.index(level)
    except ValueError:
        return False


def main():
    app = Application.builder().token(settings.telegram_bot_token).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("yardim", cmd_yardim))
    app.add_handler(CommandHandler("izle", cmd_izle))
    app.add_handler(CommandHandler("cikar", cmd_cikar))
    app.add_handler(CommandHandler("liste", cmd_liste))
    app.add_handler(CommandHandler("analiz", cmd_analiz))
    app.add_handler(CommandHandler("haberler", cmd_haberler))
    app.add_handler(CommandHandler("ayarlar", cmd_ayarlar))

    async def post_init(app):
        await app.bot.set_my_commands([
            BotCommand("izle", "Varlığı takibe al (örn: /izle ASELS)"),
            BotCommand("cikar", "Takipten çıkar"),
            BotCommand("liste", "İzlediğin varlıklar"),
            BotCommand("analiz", "Anlık analiz (örn: /analiz ASELS)"),
            BotCommand("haberler", "Son haberler"),
            BotCommand("ayarlar", "Bildirim ayarları"),
            BotCommand("yardim", "Yardım"),
        ])
        asyncio.create_task(notification_loop(app))

    app.post_init = post_init
    app.run_polling(allowed_updates=["message"])


if __name__ == "__main__":
    main()
