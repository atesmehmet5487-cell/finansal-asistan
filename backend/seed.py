"""
Veritabanını başlangıç verileriyle doldur.
Kullanım: docker-compose exec backend python seed.py
"""
import asyncio
from db.database import AsyncSessionLocal, engine, Base
from db import models  # noqa
from db.models import Asset


ASSETS = [
    ("ASELS",   "Aselsan Elektronik",          "stock",     "BIST", "Savunma Sanayii"),
    ("THYAO",   "Türk Hava Yolları",            "stock",     "BIST", "Havacılık"),
    ("GARAN",   "Garanti BBVA",                 "stock",     "BIST", "Bankacılık"),
    ("AKBNK",   "Akbank",                       "stock",     "BIST", "Bankacılık"),
    ("ISCTR",   "İş Bankası C",                 "stock",     "BIST", "Bankacılık"),
    ("EREGL",   "Ereğli Demir Çelik",           "stock",     "BIST", "Metal"),
    ("KCHOL",   "Koç Holding",                  "stock",     "BIST", "Holding"),
    ("SAHOL",   "Sabancı Holding",              "stock",     "BIST", "Holding"),
    ("SISE",    "Şişecam",                      "stock",     "BIST", "Cam & Kimya"),
    ("TUPRS",   "Tüpraş",                       "stock",     "BIST", "Enerji"),
    ("BIMAS",   "BİM Mağazalar",                "stock",     "BIST", "Perakende"),
    ("MGROS",   "Migros",                       "stock",     "BIST", "Perakende"),
    ("TCELL",   "Turkcell",                     "stock",     "BIST", "Telekomünikasyon"),
    ("ARCLK",   "Arçelik",                      "stock",     "BIST", "Tüketici Elektroniği"),
    ("TOASO",   "Tofaş Otomobil",               "stock",     "BIST", "Otomotiv"),
    ("FROTO",   "Ford Otosan",                  "stock",     "BIST", "Otomotiv"),
    ("DOHOL",   "Doğan Holding",                "stock",     "BIST", "Holding"),
    ("TTKOM",   "Türk Telekom",                 "stock",     "BIST", "Telekomünikasyon"),
    ("PGSUS",   "Pegasus Hava Yolları",         "stock",     "BIST", "Havacılık"),
    ("VESTL",   "Vestel",                       "stock",     "BIST", "Tüketici Elektroniği"),
    ("BIST100", "BIST 100 Endeksi",             "index",     "BIST", None),
    ("BIST30",  "BIST 30 Endeksi",              "index",     "BIST", None),
    ("ALTIN",   "Altın (Ons)",                  "commodity", "COMEX", None),
    ("GUMUS",   "Gümüş (Ons)",                  "commodity", "COMEX", None),
    ("PETROL",  "Ham Petrol Brent",             "commodity", "ICE",   None),
    ("DOLAR",   "ABD Doları (USD/TRY)",         "currency",  "FOREX", None),
    ("EURO",    "Euro (EUR/TRY)",               "currency",  "FOREX", None),
    ("BTC",     "Bitcoin",                      "crypto",    "CRYPTO", None),
    ("ETH",     "Ethereum",                     "crypto",    "CRYPTO", None),
]


async def seed():
    async with AsyncSessionLocal() as db:
        for symbol, name, type_, exchange, sector in ASSETS:
            from sqlalchemy import select
            existing = (await db.execute(select(Asset).where(Asset.symbol == symbol))).scalar_one_or_none()
            if not existing:
                db.add(Asset(symbol=symbol, name=name, type=type_, exchange=exchange, sector=sector))
                print(f"  + {symbol}: {name}")
            else:
                print(f"  ~ {symbol}: zaten var")
        await db.commit()
    print("\nSeed tamamlandı.")


if __name__ == "__main__":
    asyncio.run(seed())
