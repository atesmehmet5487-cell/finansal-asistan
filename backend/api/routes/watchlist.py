from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.database import AsyncSessionLocal
from db.models import Asset, UserWatchlist
from sqlalchemy import select, delete

router = APIRouter()


class WatchlistAdd(BaseModel):
    telegram_chat_id: int
    symbol: str
    notify_level: str = "HIGH"


@router.post("/watchlist")
async def add_to_watchlist(body: WatchlistAdd):
    symbol = body.symbol.upper()
    async with AsyncSessionLocal() as db:
        asset = (await db.execute(select(Asset).where(Asset.symbol == symbol))).scalar_one_or_none()
        if not asset:
            raise HTTPException(status_code=404, detail=f"{symbol} veritabanında bulunamadı")

        existing = (await db.execute(
            select(UserWatchlist).where(
                UserWatchlist.telegram_chat_id == body.telegram_chat_id,
                UserWatchlist.asset_id == asset.id,
            )
        )).scalar_one_or_none()

        if existing:
            return {"status": "already_watching", "symbol": symbol}

        watchlist_item = UserWatchlist(
            telegram_chat_id=body.telegram_chat_id,
            asset_id=asset.id,
            notify_level=body.notify_level,
        )
        db.add(watchlist_item)
        await db.commit()

    return {"status": "added", "symbol": symbol, "notify_level": body.notify_level}


@router.delete("/watchlist/{symbol}")
async def remove_from_watchlist(symbol: str, telegram_chat_id: int):
    symbol = symbol.upper()
    async with AsyncSessionLocal() as db:
        asset = (await db.execute(select(Asset).where(Asset.symbol == symbol))).scalar_one_or_none()
        if not asset:
            raise HTTPException(status_code=404, detail=f"{symbol} bulunamadı")

        await db.execute(
            delete(UserWatchlist).where(
                UserWatchlist.telegram_chat_id == telegram_chat_id,
                UserWatchlist.asset_id == asset.id,
            )
        )
        await db.commit()

    return {"status": "removed", "symbol": symbol}


@router.get("/watchlist/{telegram_chat_id}")
async def get_watchlist(telegram_chat_id: int):
    async with AsyncSessionLocal() as db:
        records = (await db.execute(
            select(UserWatchlist, Asset)
            .join(Asset, UserWatchlist.asset_id == Asset.id)
            .where(UserWatchlist.telegram_chat_id == telegram_chat_id)
        )).all()

    items = []
    for wl, asset in records:
        items.append({
            "symbol": asset.symbol,
            "name": asset.name,
            "notify_level": wl.notify_level,
            "added_at": wl.created_at.isoformat(),
        })

    return {"chat_id": telegram_chat_id, "watchlist": items}
