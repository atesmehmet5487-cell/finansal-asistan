from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import search, assets, news, watchlist, macro
from api.websocket import router as ws_router
from config import get_settings

settings = get_settings()

app = FastAPI(
    title="Finansal Asistan API",
    version="1.0.0",
    docs_url="/docs" if settings.is_dev else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
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
