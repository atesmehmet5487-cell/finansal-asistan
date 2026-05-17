# Finansal Asistan — Başlangıç Kılavuzu

## 1. Ön Koşullar

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) kurulu olmalı
- Python 3.11+ (isteğe bağlı — Docker olmadan çalıştırmak için)
- Node.js 20+ (isteğe bağlı)

---

## 2. API Key'lerini Ayarla

`.env.example` dosyasını `.env` olarak kopyala ve doldur:

```
ANTHROPIC_API_KEY=sk-ant-...        ← Zorunlu (anthropic.com)
TELEGRAM_BOT_TOKEN=...              ← Zorunlu (@BotFather'dan al)
NEWS_API_KEY=...                    ← Önerilen (newsapi.org — ücretsiz)
```

Diğerleri isteğe bağlı. Sadece bu 3 key ile sistem çalışır.

---

## 3. Docker ile Başlat (Önerilen)

```bash
# Proje dizininde:
docker-compose up --build
```

Servisler:
- Backend API:  http://localhost:8000
- Frontend UI:  http://localhost:3000
- PostgreSQL:   localhost:5432
- Redis:        localhost:6379

---

## 4. İlk Veri Tabanı Kurulumu

Docker başladıktan sonra migration'ı çalıştır:

```bash
docker-compose exec backend alembic upgrade head
```

Temel varlıkları ekle:

```bash
docker-compose exec backend python -c "
import asyncio
from db.database import AsyncSessionLocal, engine, Base
from db.models import Asset
from db import models  # noqa

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    assets = [
        ('ASELS', 'Aselsan Elektronik', 'stock', 'BIST', 'Savunma Sanayii'),
        ('THYAO', 'Türk Hava Yolları', 'stock', 'BIST', 'Havacılık'),
        ('GARAN', 'Garanti BBVA', 'stock', 'BIST', 'Bankacılık'),
        ('AKBNK', 'Akbank', 'stock', 'BIST', 'Bankacılık'),
        ('ISCTR', 'İş Bankası C', 'stock', 'BIST', 'Bankacılık'),
        ('EREGL', 'Ereğli Demir Çelik', 'stock', 'BIST', 'Metal'),
        ('KCHOL', 'Koç Holding', 'stock', 'BIST', 'Holding'),
        ('BIMAS', 'BİM Mağazalar', 'stock', 'BIST', 'Perakende'),
        ('TCELL', 'Turkcell', 'stock', 'BIST', 'Telekomünikasyon'),
        ('PGSUS', 'Pegasus', 'stock', 'BIST', 'Havacılık'),
        ('BIST100', 'BIST 100 Endeksi', 'index', 'BIST', None),
        ('BIST30', 'BIST 30 Endeksi', 'index', 'BIST', None),
        ('ALTIN', 'Altın', 'commodity', 'COMEX', None),
        ('GUMUS', 'Gümüş', 'commodity', 'COMEX', None),
        ('PETROL', 'Ham Petrol Brent', 'commodity', 'ICE', None),
        ('DOLAR', 'ABD Doları', 'currency', 'FOREX', None),
        ('EURO', 'Euro', 'currency', 'FOREX', None),
        ('BTC', 'Bitcoin', 'crypto', 'CRYPTO', None),
        ('ETH', 'Ethereum', 'crypto', 'CRYPTO', None),
    ]
    
    async with AsyncSessionLocal() as db:
        for symbol, name, type_, exchange, sector in assets:
            a = Asset(symbol=symbol, name=name, type=type_, exchange=exchange, sector=sector)
            db.add(a)
        await db.commit()
    print('Varlıklar eklendi.')

asyncio.run(seed())
"
```

---

## 5. İlk Pipeline Çalıştır

```bash
# Bir kerelik tüm pipeline'ı başlat
docker-compose exec backend python -c "
import asyncio
from scheduler.tasks import full_pipeline
asyncio.run(full_pipeline())
"
```

---

## 6. Telegram Bot

1. Telegram'da @BotFather'a yaz: `/newbot`
2. Bot adı ver, token al
3. `.env`'e `TELEGRAM_BOT_TOKEN=...` ekle
4. `docker-compose up` çalışıyorken bota `/start` yaz

---

## 7. Klasör Yapısı

```
finansal-asistan/
├── backend/
│   ├── agents/         ← 4 AI ajanı
│   ├── collectors/     ← Veri çekiciler
│   ├── api/            ← FastAPI + WebSocket
│   ├── db/             ← PostgreSQL modelleri
│   ├── cache/          ← Redis
│   ├── telegram/       ← Bot + bildirimler
│   └── scheduler/      ← Zamanlayıcı
├── frontend/           ← Next.js UI
├── docker-compose.yml
└── .env
```

---

## 8. Sorumluluk Reddi

Bu platform yalnızca bilgilendirme amacıyla hizmet vermektedir.  
Sunulan içerikler yatırım tavsiyesi niteliği taşımaz.  
Tüm finansal kararlar tamamen kullanıcının sorumluluğundadır.
