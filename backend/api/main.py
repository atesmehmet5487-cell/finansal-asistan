from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import search, assets, news, watchlist, macro
from api.websocket import router as ws_router
from config import get_settings
import asyncio
import structlog

log = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ilk veri çekimi ve scheduler'ı başlat
    asyncio.create_task(_startup_pipeline())
    asyncio.create_task(_start_scheduler())
    yield


async def _startup_pipeline():
    await asyncio.sleep(5)
    try:
        from scheduler.tasks import run_price_pipeline, run_news_pipeline
        log.info("startup_pipeline_begin")
        await run_price_pipeline()
        await run_news_pipeline()
        log.info("startup_pipeline_done")
    except Exception as e:
        log.error("startup_pipeline_failed", error=str(e))


async def _start_scheduler():
    await asyncio.sleep(30)
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from scheduler.tasks import (
            run_price_pipeline, run_news_pipeline,
            run_technical_pipeline, run_macro_pipeline,
        )
        scheduler = AsyncIOScheduler()
        scheduler.add_job(run_price_pipeline, "interval", minutes=5)
        scheduler.add_job(run_news_pipeline, "interval", minutes=15)
        scheduler.add_job(run_technical_pipeline, "interval", minutes=10)
        scheduler.add_job(run_macro_pipeline, "interval", minutes=30)
        scheduler.start()
        log.info("scheduler_started")
    except Exception as e:
        log.error("scheduler_start_failed", error=str(e))


app = FastAPI(
    title="Finansal Asistan API",
    version="1.0.0",
    docs_url="/docs" if settings.is_dev else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router, prefix="/api/v1", tags=["search"])
app.include_router(assets.router, prefix="/api/v1", tags=["assets"])
app.include_router(news.router, prefix="/api/v1", tags=["news"])
app.include_router(watchlist.router, prefix="/api/v1", tags=["watchlist"])
app.include_router(macro.router, prefix="/api/v1", tags=["macro"])
app.include_router(ws_router, tags=["websocket"])


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/debug")
async def debug():
    results = {}
    try:
        from cache.redis_client import cache_get
        await cache_get("test:ping")
        results["redis"] = "ok"
    except Exception as e:
        results["redis"] = str(e)
    try:
        import re
        raw = settings.database_url
        host = re.search(r"@([^/]+)/", raw)
        results["db_host"] = host.group(1) if host else "unknown"
        results["db_url_used"] = settings.db_url[settings.db_url.find("@"):settings.db_url.find("/postgres")]
    except Exception as e:
        results["db_url_err"] = str(e)
    try:
        from db.database import AsyncSessionLocal
        import sqlalchemy
        async with AsyncSessionLocal() as db:
            await db.execute(sqlalchemy.text("SELECT 1"))
        results["db"] = "ok"
    except Exception as e:
        results["db"] = str(e)
    return results
