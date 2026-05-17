"""
Zamanlanmış görevler — tüm pipeline'ı döndüren motor
"""
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from collectors.news_collector import fetch_all_news
from collectors.price_collector import fetch_all_prices, fetch_ohlcv
from collectors.social_collector import fetch_all_social
from collectors.tcmb_collector import fetch_macro_data
from agents.news_agent import analyze_news_batch
from agents.technical_agent import analyze_technical
from agents.sentiment_agent import analyze_sentiment_batch
from agents.orchestrator import orchestrate
from cache.redis_client import cache_set, cache_get, pubsub_publish, TTL
from db.database import AsyncSessionLocal
from db.models import Asset, News, TechnicalAnalysis, SentimentAnalysis, ConsolidatedAnalysis
from sqlalchemy import select
import structlog

log = structlog.get_logger()

TRACKED_SYMBOLS = [
    "ASELS", "THYAO", "GARAN", "AKBNK", "ISCTR",
    "EREGL", "KCHOL", "BIMAS", "TCELL", "PGSUS",
    "BIST100",
]


async def run_news_pipeline():
    log.info("pipeline_start", stage="news")
    raw_news = await fetch_all_news()
    if not raw_news:
        return

    analyzed = await analyze_news_batch(raw_news)

    try:
        async with AsyncSessionLocal() as db:
            for item in analyzed:
                existing = await db.execute(select(News).where(News.url == item.get("url")))
                if existing.scalar_one_or_none():
                    continue
                news = News(
                    title=item.get("title", ""),
                    source=item.get("source", ""),
                    url=item.get("url"),
                    published_at=item.get("published_at"),
                    sentiment_score=item.get("sentiment_score"),
                    sentiment_label=item.get("sentiment_label"),
                    importance=item.get("importance"),
                    categories=item.get("categories", []),
                    summary_tr=item.get("summary_tr"),
                    raw_content=item.get("content", "")[:2000],
                )
                db.add(news)
            await db.commit()
    except Exception as e:
        log.warning("news_db_save_failed", error=str(e))

    critical = [n for n in analyzed if n.get("importance") == "CRITICAL"]
    if critical:
        await pubsub_publish("pub:breaking_news", {"news": critical})

    await cache_set("cache:news:feed:latest", analyzed[:50], TTL["news"])
    log.info("pipeline_done", stage="news", count=len(analyzed))


async def run_price_pipeline():
    log.info("pipeline_start", stage="price")
    prices = await fetch_all_prices()
    for price in prices:
        symbol = price["symbol"]
        await cache_set(f"cache:price:{symbol}", price, TTL["price"])
        await pubsub_publish(f"pub:price:{symbol}", price)
    log.info("pipeline_done", stage="price", count=len(prices))


async def run_technical_pipeline():
    log.info("pipeline_start", stage="technical")

    yf_map = {
        "ASELS": "ASELS.IS", "THYAO": "THYAO.IS", "GARAN": "GARAN.IS",
        "AKBNK": "AKBNK.IS", "ISCTR": "ISCTR.IS", "EREGL": "EREGL.IS",
        "KCHOL": "KCHOL.IS", "BIMAS": "BIMAS.IS", "TCELL": "TCELL.IS",
        "PGSUS": "PGSUS.IS", "BIST100": "XU100.IS",
    }

    for symbol in TRACKED_SYMBOLS:
        try:
            result = await analyze_technical(symbol, yf_map.get(symbol))
            if result:
                await cache_set(f"cache:asset:{symbol}:technical", result, TTL["technical"])
                await pubsub_publish("pub:analysis_update", {"symbol": symbol, "type": "technical"})

                try:
                    async with AsyncSessionLocal() as db:
                        asset = (await db.execute(select(Asset).where(Asset.symbol == symbol))).scalar_one_or_none()
                        if asset:
                            ta_record = TechnicalAnalysis(
                                asset_id=asset.id,
                                price_data=result.get("price", {}),
                                indicators=result.get("indicators", {}),
                                levels=result.get("levels", {}),
                                trend=result.get("trend", {}),
                                signal=result.get("composite_signal"),
                                confidence=result.get("confidence"),
                                interpretation_tr=result.get("interpretation_tr"),
                            )
                            db.add(ta_record)
                            await db.commit()
                except Exception as db_err:
                    log.warning("technical_db_save_failed", symbol=symbol, error=str(db_err))
        except Exception as e:
            log.error("technical_pipeline_failed", symbol=symbol, error=str(e))

    log.info("pipeline_done", stage="technical")


async def run_sentiment_pipeline():
    log.info("pipeline_start", stage="sentiment")
    social_posts = await fetch_all_social()
    if not social_posts:
        return

    for symbol in TRACKED_SYMBOLS:
        try:
            result = await analyze_sentiment_batch(social_posts, target_symbol=symbol)
            if result:
                await cache_set(f"cache:asset:{symbol}:sentiment", result, TTL["sentiment"])
        except Exception as e:
            log.error("sentiment_pipeline_failed", symbol=symbol, error=str(e))

    log.info("pipeline_done", stage="sentiment")


async def run_macro_pipeline():
    log.info("pipeline_start", stage="macro")
    data = await fetch_macro_data()
    if data:
        await cache_set("cache:macro:all", data, TTL["macro"])
        await pubsub_publish("pub:macro_update", {"count": len(data)})
        log.info("pipeline_done", stage="macro", count=len(data))


async def run_orchestration_pipeline():
    log.info("pipeline_start", stage="orchestration")

    for symbol in TRACKED_SYMBOLS:
        try:
            technical = await cache_get(f"cache:asset:{symbol}:technical")
            news_feed = await cache_get("cache:news:feed:latest")
            news_for_symbol = [
                n for n in (news_feed or [])
                if symbol in n.get("affected_assets", [])
            ]
            sentiment = await cache_get(f"cache:asset:{symbol}:sentiment")
            prev_analysis = await cache_get(f"cache:asset:{symbol}:consolidated")
            macro = await cache_get("cache:macro:all")

            result = await orchestrate(
                symbol=symbol,
                technical=technical,
                news_results=news_for_symbol,
                sentiment=sentiment,
                prev_analysis=prev_analysis,
                macro=macro,
            )

            await cache_set(f"cache:asset:{symbol}:consolidated", result, TTL["consolidated"])
            await pubsub_publish("pub:analysis_update", {"symbol": symbol, "type": "consolidated", "data": result})

            async with AsyncSessionLocal() as db:
                asset = (await db.execute(select(Asset).where(Asset.symbol == symbol))).scalar_one_or_none()
                if asset:
                    record = ConsolidatedAnalysis(
                        asset_id=asset.id,
                        composite_score=result.get("composite_score"),
                        overall_sentiment=result.get("overall_sentiment"),
                        scores=result.get("scores", {}),
                        key_points=result.get("key_points", []),
                        risk_factors=result.get("risk_factors", []),
                        summary_tr=result.get("summary_tr"),
                        notification_sent=False,
                    )
                    db.add(record)
                    await db.commit()

            if result.get("notification_needed"):
                await pubsub_publish("stream:notifications", {
                    "symbol": symbol,
                    "analysis": result,
                    "reason": result.get("notification_reason", ""),
                })

        except Exception as e:
            log.error("orchestration_pipeline_failed", symbol=symbol, error=str(e))

    log.info("pipeline_done", stage="orchestration")


async def full_pipeline():
    await run_news_pipeline()
    await run_price_pipeline()
    await run_macro_pipeline()
    await run_sentiment_pipeline()
    await run_technical_pipeline()
    await run_orchestration_pipeline()


def main():
    scheduler = AsyncIOScheduler()

    scheduler.add_job(run_price_pipeline, IntervalTrigger(minutes=1), id="price", replace_existing=True)
    scheduler.add_job(run_news_pipeline, IntervalTrigger(minutes=15), id="news", replace_existing=True)
    scheduler.add_job(run_sentiment_pipeline, IntervalTrigger(minutes=30), id="sentiment", replace_existing=True)
    scheduler.add_job(run_technical_pipeline, IntervalTrigger(minutes=5), id="technical", replace_existing=True)
    scheduler.add_job(run_orchestration_pipeline, IntervalTrigger(minutes=10), id="orchestration", replace_existing=True)
    scheduler.add_job(run_macro_pipeline, IntervalTrigger(minutes=30), id="macro", replace_existing=True)

    scheduler.add_job(
        full_pipeline,
        CronTrigger(hour=8, minute=45),
        id="morning_brief",
        replace_existing=True,
    )

    scheduler.start()
    log.info("scheduler_started")

    loop = asyncio.get_event_loop()
    loop.run_forever()


if __name__ == "__main__":
    main()
