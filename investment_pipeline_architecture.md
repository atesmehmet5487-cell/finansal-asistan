# Finansal Asistan — Pipeline Mimarisi

> **Kapsam**: Türk borsası (BIST) ve emtia odaklı, çok-ajanlı gerçek zamanlı finansal bilgi sistemi.  
> **Kısıt**: Yatırım tavsiyesi vermez; bilgilendirir, aydınlatır, uyarır.

---

## 1. GENEL MİMARİ — BÜYÜK RESİM

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           FINANSAL ASİSTAN SİSTEMİ                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────────┐
  │                     VERİ KAYNAKLARI (External)                      │
  │                                                                      │
  │  [Haber API'leri]  [Piyasa Verileri]  [Sosyal Medya]  [BIST/KAP]  │
  └───────────────────────────┬────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  VERİ TOPLAMA      │  ← APScheduler (farklı sıklıklar)
                    │  KATMANI           │
                    │  (Ingestion Layer) │
                    └──────────┬─────────┘
                               │
              ┌────────────────▼─────────────────┐
              │         MESAJ KUYRUĞU             │
              │         (Redis Streams)            │
              └─┬──────────────┬──────────────────┘
                │              │              │
   ┌────────────▼──┐   ┌───────▼─────────┐   ┌───────▼───────────┐
   │  AGENT 1      │   │  AGENT 2        │   │  AGENT 3          │
   │  Haber &      │   │  Yatırımcı      │   │  Teknik           │
   │  Emtia        │   │  Yorum          │   │  İndikatör        │
   │  Analizi      │   │  Analizi        │   │  Analizi          │
   │  (Haiku 4.5)  │   │  (Sonnet 4.6)   │   │  (Haiku 4.5)      │
   └──────┬────────┘   └────────┬────────┘   └────────┬──────────┘
          │                     │                      │
          └─────────────────────▼──────────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  AGENT 4: ORKESTRATÖr  │  ← Claude Sonnet 4.6
                    │  Tüm çıktıları birleştirir, ağırlıklı skor üretir
                    └───────────┬────────────┘
                                │
              ┌─────────────────▼───────────────────────┐
              │             ÇIKTI KATMANI                 │
              │                                           │
              │  [Web Arayüzü]  [REST API]  [WebSocket]  │
              │  [Telegram Bot]  [Bildirim Motoru]        │
              └───────────────────────────────────────────┘
```

---

## 2. VERİ KAYNAKLARI VE GÜNCELLEME SIKLIKLARI

### 2.1 Haber Kaynakları
| Kaynak | Yöntem | Sıklık | Öncelik |
|--------|--------|--------|---------|
| KAP (kap.org.tr) | RSS / Scrape | Her 5 dk | KRİTİK |
| TCMB Duyuruları | RSS | Her 30 dk | KRİTİK |
| NewsAPI | REST API | Her 15 dk | YÜKSEK |
| Alpha Vantage News | REST API | Her 15 dk | YÜKSEK |
| Reuters TR | RSS | Her 20 dk | YÜKSEK |
| Investing.com | RSS Parse | Her 10 dk | ORTA |

### 2.2 Piyasa Verisi Kaynakları
| Kaynak | Veri Tipi | Sıklık |
|--------|-----------|--------|
| yfinance | BIST hisseleri, endeksler | Her 1 dk |
| Alpha Vantage | Uluslararası, forex | Her 1 dk |
| metals-api.com | Altın, Gümüş | Her 5 dk |
| ExchangeRate-API | USD/TRY, EUR/TRY | Her 5 dk |
| CoinGecko | BTC, ETH | Her 5 dk |

### 2.3 Sosyal / Yorum Kaynakları
| Kaynak | Veri Tipi | Sıklık |
|--------|-----------|--------|
| Twitter/X API v2 | TR finans tweet'leri | Her 10 dk |
| Reddit (PRAW) | r/turkishfinance | Her 30 dk |
| Ekşi Sözlük | Hisse başlıkları | Her 1 saat |
| Mynet Finans | Yatırımcı yorumları | Her 30 dk |
| Finansgundem.com | Haber yorumları | Her 30 dk |

---

## 3. AGENT MİMARİSİ — DETAY

### Agent 1: Haber & Emtia Analiz Ajanı
```
Model:    Claude Haiku 4.5  (hız önceliği, batch işlem)
Girdi:    Ham haber metinleri (Redis Stream'den)
Çıktı:    Yapılandırılmış haber JSON'u
Çalışma:  Her 15 dakikada bir batch
```

**İşlem Akışı:**
```
1. Redis stream:raw_news'den mesajları al
2. URL/başlık hash ile tekrar eden haberleri ele
3. Claude ile analiz:
   - Duyarlılık skoru  → -1.0 ile +1.0 arası
   - İlgili varlıklar  → ["ASELS", "BIST100"]
   - Önem seviyesi     → CRITICAL / HIGH / MEDIUM / LOW
   - Türkçe özet       → 2-3 cümle
   - Kategori etiketleri
4. PostgreSQL (news tablosu) + Redis cache'e yaz
5. CRITICAL/HIGH haberleri → stream:notifications'a at
```

**Çıktı Şeması:**
```json
{
  "id": "uuid",
  "title": "Aselsan savunma ihracatı sözleşmesi imzaladı",
  "source": "KAP",
  "url": "https://...",
  "published_at": "2026-05-16T10:30:00Z",
  "sentiment_score": 0.88,
  "sentiment_label": "POSITIVE",
  "importance": "CRITICAL",
  "affected_assets": ["ASELS", "BIST100"],
  "categories": ["savunma", "ihracat", "sözleşme"],
  "summary_tr": "Aselsan, Orta Doğu'da büyük bir savunma tedarik sözleşmesi imzaladı..."
}
```

---

### Agent 2: Yatırımcı Yorum Analiz Ajanı
```
Model:    Claude Sonnet 4.6  (kalite önceliği, derin anlayış)
Girdi:    Ham sosyal medya verileri
Çıktı:    Duyarlılık özeti + en etkili yorumlar
Çalışma:  Her 30 dakikada bir batch
```

**İşlem Akışı:**
```
1. Kaynaklardan ham yorumları al
2. Spam/bot filtresi uygula (kısa, tekrarlayan içerik ele)
3. Etkileşim skoru hesapla:
   Twitter:  like + retweet×2 + reply×1.5
   Reddit:   upvote + comment×2
   Ekşi:     favori sayısı
4. En yüksek etkileşimli TOP 20 yorumu seç
5. Claude ile analiz:
   - Her yorumun tonu (BULLISH / BEARISH / NEUTRAL)
   - Güvenilirlik skoru (spam mı, içerikli mi?)
   - İlgili varlık etiketleme
   - Genel konsensüs hesaplama
6. Hisse başına: bullish%, bearish%, neutral%
7. Dashboard için "Öne Çıkan Yorumlar" listesi
```

**Çıktı Şeması:**
```json
{
  "asset": "THYAO",
  "window": "2026-05-16T00:00 / 2026-05-16T10:00",
  "total_mentions": 342,
  "sentiment": {
    "bullish_pct": 68,
    "bearish_pct": 22,
    "neutral_pct": 10,
    "overall": "BULLISH",
    "score": 0.64
  },
  "top_comments": [
    {
      "source": "twitter",
      "content": "THYAO teknik açıdan kritik direnci aştı...",
      "engagement_score": 94.5,
      "sentiment": "BULLISH",
      "url": "https://..."
    }
  ],
  "trending_keywords": ["temettü", "kargo", "büyüme"]
}
```

---

### Agent 3: Teknik İndikatör Analiz Ajanı
```
Model:    Claude Haiku 4.5  (hesaplama sonrası kısa yorum)
Kütüphane: pandas_ta  (130+ indikatör)
Girdi:    OHLCV fiyat verileri (yfinance)
Çıktı:    İndikatör sonuçları + Türkçe yorum
Çalışma:  Her 5 dakikada bir (piyasa saatlerinde)
```

**Hesaplanan İndikatörler:**
```
Trend:      MA20, MA50, MA200 | EMA12, EMA26 | MACD(12,26,9)
Momentum:   RSI(14) | Stochastic(14,3,3) | CCI(20)
Volatilite: Bollinger Bands(20,2) | ATR(14) | Keltner Channels
Hacim:      OBV | Volume MA(20) | VWAP
Seviyeler:  Pivot Points | Fibonacci | Lokal min/max
```

**Çıktı Şeması:**
```json
{
  "asset": "GARAN",
  "timestamp": "2026-05-16T10:35:00Z",
  "price": { "current": 45.20, "change_pct": 0.89, "volume": 12500000 },
  "indicators": {
    "RSI_14":    { "value": 58.3,  "signal": "NEUTRAL", "note": "Orta bölgede" },
    "MACD":      { "value": 0.42,  "signal": "BUY",     "note": "Bullish crossover" },
    "MA20":      { "value": 44.90, "signal": "BUY",     "note": "Fiyat üzerinde" },
    "MA50":      { "value": 43.50, "signal": "BUY",     "note": "Fiyat üzerinde" },
    "Bollinger": { "position": "MIDDLE", "signal": "NEUTRAL" }
  },
  "levels": {
    "support_1": 44.20, "support_2": 43.50,
    "resistance_1": 46.00, "resistance_2": 47.50,
    "pivot": 44.87
  },
  "trend": { "direction": "UPTREND", "strength": 0.71 },
  "composite_signal": "BUY",
  "confidence": 0.72,
  "interpretation_tr": "Teknik görünüm olumlu. MACD bullish crossover oluştu, fiyat MA20 üzerinde seyrediyor..."
}
```

---

### Agent 4: Orkestratör Ajanı
```
Model:    Claude Sonnet 4.6
Girdi:    Agent 1, 2, 3 çıktıları (bir varlık için)
Çıktı:    Konsolide analiz kartı
Tetikleyici: Tüm 3 agent çıktısı geldikten sonra (event-driven)
```

**Ağırlıklı Skor Hesabı:**
```
Teknik Analiz:       %35
Haber Duyarlılığı:  %35
Yatırımcı Yorumu:   %30
─────────────────────────
Composite Score:    0–10
```

**İşlem Akışı:**
```
1. Tüm agent çıktılarını topla
2. Çelişen sinyalleri tespit et (teknik BUY + haberler NEGATIVE gibi)
3. Ağırlıklı composite score hesapla
4. Claude ile nihai Türkçe özet paragraf + key points üret
5. Önceki analizle karşılaştır:
   - Skor ≥1.5 puan değişti mi?
   - Sentiment döndü mü?
   - Kritik haber var mı?
6. Bildirim kararı → stream:notifications'a at
7. PostgreSQL (consolidated_analysis) + Redis'e yaz
8. WebSocket üzerinden web'e push et
```

**Çıktı Şeması:**
```json
{
  "asset": "ASELS",
  "generated_at": "2026-05-16T10:40:00Z",
  "composite_score": 8.1,
  "scores": {
    "technical":         { "score": 0.72, "weight": 0.35, "signal": "POSITIVE" },
    "news_sentiment":    { "score": 0.88, "weight": 0.35, "signal": "STRONGLY_POSITIVE" },
    "investor_sentiment":{ "score": 0.64, "weight": 0.30, "signal": "POSITIVE" }
  },
  "overall_sentiment": "STRONGLY_POSITIVE",
  "key_points": [
    "KAP'ta kritik ihracat sözleşmesi açıklandı",
    "Teknik trend 14 gündür yukarı yönlü devam ediyor",
    "Sosyal medyada güçlü boğa eğilimi gözlemleniyor",
    "RSI henüz aşırı alım bölgesine ulaşmadı"
  ],
  "risk_factors": [
    "Küresel riskten kaçış TL değerini etkileyebilir",
    "Savunma bütçesi revizyonu ihtimali"
  ],
  "summary_tr": "Aselsan için genel tablo güçlü görünmektedir. KAP açıklamasıyla birlikte...",
  "notification_needed": true,
  "notification_reason": "KRİTİK haber + skor 1.8 puan arttı",
  "disclaimer": "Bu analiz bilgilendirme amaçlıdır. Yatırım tavsiyesi değildir."
}
```

---

## 4. VERİTABANI MİMARİSİ

### PostgreSQL Tablo Yapısı
```sql
-- Varlıklar
CREATE TABLE assets (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol    VARCHAR(20) UNIQUE NOT NULL,
  name      TEXT NOT NULL,
  type      VARCHAR(20),    -- 'stock' | 'commodity' | 'crypto' | 'currency'
  exchange  VARCHAR(20),    -- 'BIST' | 'NASDAQ' | 'COMEX'
  sector    TEXT
);

-- İşlenmiş haberler
CREATE TABLE news (
  id               UUID PRIMARY KEY,
  asset_ids        UUID[],
  title            TEXT NOT NULL,
  source           VARCHAR(100),
  url              TEXT UNIQUE,
  published_at     TIMESTAMPTZ,
  sentiment_score  DECIMAL(4,3),
  sentiment_label  VARCHAR(20),
  importance       VARCHAR(20),
  categories       TEXT[],
  summary_tr       TEXT
);

-- Teknik analiz sonuçları
CREATE TABLE technical_analysis (
  id           UUID PRIMARY KEY,
  asset_id     UUID REFERENCES assets(id),
  analyzed_at  TIMESTAMPTZ DEFAULT NOW(),
  price_data   JSONB,
  indicators   JSONB,
  levels       JSONB,
  signal       VARCHAR(20),
  confidence   DECIMAL(4,3)
);

-- Yatırımcı yorum analizi
CREATE TABLE sentiment_analysis (
  id              UUID PRIMARY KEY,
  asset_id        UUID REFERENCES assets(id),
  analyzed_at     TIMESTAMPTZ DEFAULT NOW(),
  overall_score   DECIMAL(4,3),
  bullish_pct     INTEGER,
  bearish_pct     INTEGER,
  total_mentions  INTEGER,
  top_comments    JSONB
);

-- Orkestratör çıktıları
CREATE TABLE consolidated_analysis (
  id                 UUID PRIMARY KEY,
  asset_id           UUID REFERENCES assets(id),
  generated_at       TIMESTAMPTZ DEFAULT NOW(),
  composite_score    DECIMAL(5,2),
  overall_sentiment  VARCHAR(30),
  scores             JSONB,
  key_points         TEXT[],
  risk_factors       TEXT[],
  summary_tr         TEXT,
  notification_sent  BOOLEAN DEFAULT FALSE
);

-- Kullanıcı watchlist (Telegram)
CREATE TABLE user_watchlist (
  id               UUID PRIMARY KEY,
  telegram_chat_id BIGINT,
  asset_id         UUID REFERENCES assets(id),
  notify_level     VARCHAR(20) DEFAULT 'HIGH',
  UNIQUE(telegram_chat_id, asset_id)
);

-- İndeksler
CREATE INDEX idx_news_assets   ON news USING GIN(asset_ids);
CREATE INDEX idx_news_time     ON news(published_at DESC);
CREATE INDEX idx_tech_asset    ON technical_analysis(asset_id, analyzed_at DESC);
CREATE INDEX idx_consol_asset  ON consolidated_analysis(asset_id, generated_at DESC);
```

### Redis Yapısı
```
# Cache (TTL'li)
cache:asset:{symbol}:technical      → 5 dk TTL
cache:asset:{symbol}:news           → 15 dk TTL
cache:asset:{symbol}:sentiment      → 30 dk TTL
cache:asset:{symbol}:consolidated   → 10 dk TTL
cache:search:{query}                → 1 saat TTL
cache:price:{symbol}                → 60 sn TTL

# Mesaj kuyrukları (Redis Streams)
stream:raw_news      → Agent 1 tüketir
stream:raw_social    → Agent 2 tüketir
stream:raw_price     → Agent 3 tüketir
stream:agent_output  → Orkestratör tüketir
stream:notifications → Telegram bot tüketir

# Gerçek zamanlı (WebSocket Pub/Sub)
pub:price:{symbol}       → Fiyat güncellemeleri
pub:analysis_update      → Analiz güncellemeleri
pub:breaking_news        → Kritik haberler
```

---

## 5. BACKEND API (FastAPI)

### REST Endpointleri
```
GET  /api/v1/search?q={query}
     → Varlık arama, cache'den hızlı

GET  /api/v1/assets/{symbol}
     → Fiyat + konsolide analiz

GET  /api/v1/assets/{symbol}/technical
GET  /api/v1/assets/{symbol}/news?limit=20
GET  /api/v1/assets/{symbol}/sentiment
GET  /api/v1/assets/{symbol}/history?days=30

GET  /api/v1/news/feed?category=bist&limit=50
GET  /api/v1/trending

WebSocket  /ws/live   → Gerçek zamanlı güncellemeler

POST   /api/v1/watchlist        → Takibe ekle
DELETE /api/v1/watchlist/{sym}  → Takipten çıkar
```

### WebSocket Mesaj Tipleri
```json
{ "type": "PRICE_UPDATE",    "symbol": "ASELS", "data": { "price": 1245.50, "change_pct": 2.35 } }
{ "type": "ANALYSIS_UPDATE", "symbol": "GARAN", "data": { "composite_score": 7.2, "change": 0.8 } }
{ "type": "BREAKING_NEWS",   "symbol": "BIST100","data": { "title": "TCMB faiz kararı", "importance": "CRITICAL" } }
```

---

## 6. TELEGRAM BOT

### Komutlar
```
/start           → Kayıt + hoş geldin
/izle ASELS      → Watchlist'e ekle
/cikar ASELS     → Watchlist'ten çıkar
/liste           → İzlediğim varlıklar
/analiz ASELS    → Anlık analiz gönder
/haberler ASELS  → Son 5 haber
/ayarlar         → Bildirim eşiği (KRİTİK/YÜKSEK/ORTA/HEPSI)
/yardim          → Komut listesi
```

### Bildirim Şablonu
```
🚨 KRİTİK HABER — ASELS

📰 Aselsan büyük ihracat sözleşmesi imzaladı

Duyarlılık: ✅ GÜÇLÜ POZİTİF (+0.88)
Kaynak: KAP  |  Saat: 10:41

📊 Anlık Durum
• Fiyat: ₺1.245,50 (+2,35%)
• Genel Skor: 8.1/10 ↑

Detay: finansal-asistanim.app/ASELS

⚠️ Bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.
```

### Bildirim Karar Mantığı
```python
def should_notify(prev, new, threshold):
    reasons = []
    if abs(new.score - prev.score) >= 1.5:
        reasons.append("Skor büyük değişim")
    if prev.sentiment != new.sentiment:
        reasons.append("Sentiment döndü")
    if new.has_critical_news:
        reasons.append("KRİTİK haber")
    if prev.technical_signal != new.technical_signal:
        reasons.append("Teknik sinyal değişti")
    return calculate_importance(reasons) >= threshold
```

---

## 7. FRONTEND MİMARİSİ (Next.js 14)

### Sayfa Yapısı
```
/                     Dashboard
├── Watchlist         → Canlı fiyat + mini skor gauge
├── Piyasa Genel      → BIST100, BIST30, USD/TRY, ALTIN
├── Breaking News     → Kritik haber akışı
└── Trending          → En çok bahsedilen varlıklar

/[symbol]             Detay Sayfası
├── Arama çubuğu      → Autocomplete (anlık öneri)
├── Fiyat kartı       → Canlı, büyük
├── Skor gauge        → 0-10 arası animasyonlu
├── 3 Panel:          → Haberler | Yorumlar | Teknik
├── TradingView chart → Mum grafiği + indikatörler
├── Top Yorumlar      → Etkileşim sırası
├── Haber timeline    → Duyarlılık renkli
└── Sorumluluk reddi

/news                 Haber Merkezi (BIST | Emtia | Makro)
/settings             Telegram bağlantı + watchlist + eşik
```

### UI Tasarım Sistemi
```
Renkler (Dark Mode):
  Arka plan:   #0A0F1E   Koyu lacivert
  Panel:       #111827   Koyu gri-mavi
  Accent:      #00D4FF   Neon mavi
  Pozitif:     #00FF94   Neon yeşil
  Negatif:     #FF4545   Kırmızı
  Nötr:        #FFB800   Amber
  Metin:       #E2E8F0

Animasyonlar:
  • Fiyat değişiminde renk flash (yeşil/kırmızı)
  • Skor gauge smooth interpolation
  • Yeni haberde slide-in animasyon
  • Hafif arka plan particle efekti

Kütüphaneler:
  • TradingView Lightweight Charts  (mum grafiği)
  • Recharts                        (skor tarihçesi)
  • Framer Motion                   (animasyonlar)
  • JetBrains Mono                  (rakamlar için monospace)
```

---

## 8. GÜNCELLEME DÖNGÜSÜ — TAM TIMELINE

```
          PİYASA SAATLERİ (09:00–18:00 TR)

T+0m   ── Ham veri çekimi (tüm kaynaklar paralel)
T+1m   ── Agent 1, 2, 3 paralel çalışmaya başlar
T+3m   ── Agent 1: Haber analizi tamamlandı → kuyruk
T+4m   ── Agent 3: Teknik analiz tamamlandı → kuyruk
T+6m   ── Agent 2: Yorum analizi tamamlandı → kuyruk
T+7m   ── Orkestratör: tüm çıktıları toplar
T+8m   ── Konsolide analiz üretilir
T+9m   ── PostgreSQL + Redis güncellenir
T+9m   ── WebSocket: anlık push (web arayüzü)
T+9m   ── Bildirim motoru çalışır
T+10m  ── Telegram bildirimleri gönderilir (gerekirse)

          PİYASA DIŞI (18:00–09:00)

  • Haber:   Her 30 dk
  • Teknik:  Güncelleme yok (piyasa kapalı)
  • Yorum:   Her 1 saat
  • 08:45:   Sabah özeti hazırlanır (piyasa öncesi)
```

---

## 9. TEKNOLOJİ STACK

| Katman | Teknoloji | Neden |
|--------|-----------|-------|
| AI Ajanlar | Claude API (Haiku + Sonnet) | Türkçe güçlü, direkt API = az bağımlılık |
| Web Framework | FastAPI (Python 3.11) | Async, hız, tip güvenliği |
| Teknik Analiz | pandas_ta + yfinance | 130+ indikatör, BIST verileri ücretsiz |
| Zamanlayıcı | APScheduler | Python native, basit kurulum |
| Kuyruk + Cache | Redis Streams + Redis | Tek instance, hem kuyruk hem cache |
| Veritabanı | PostgreSQL 16 | Güvenilir, JSONB desteği |
| ORM | SQLAlchemy + asyncpg | Async PostgreSQL bağlantısı |
| Frontend | Next.js 14 (App Router) | SSR + Client Components |
| Stil | Tailwind CSS + shadcn/ui | Hız + tutarlılık |
| Grafik | TradingView Lightweight Charts | Gerçek finans grafiği |
| State | Zustand + React Query | Basit global state + server cache |
| Animasyon | Framer Motion | Smooth transitions |
| Telegram | python-telegram-bot | Komut handler + async |
| Container | Docker + Docker Compose | Tek komutla tüm servisler |

---

## 10. PROJE KLASÖR YAPISI

```
finansal-asistan/
├── backend/
│   ├── agents/
│   │   ├── news_agent.py          ← Agent 1
│   │   ├── sentiment_agent.py     ← Agent 2
│   │   ├── technical_agent.py     ← Agent 3
│   │   └── orchestrator.py        ← Agent 4
│   ├── collectors/
│   │   ├── news_collector.py
│   │   ├── price_collector.py
│   │   └── social_collector.py
│   ├── api/
│   │   ├── main.py                ← FastAPI app
│   │   ├── routes/
│   │   │   ├── search.py
│   │   │   ├── assets.py
│   │   │   ├── news.py
│   │   │   └── watchlist.py
│   │   └── websocket.py
│   ├── db/
│   │   ├── models.py
│   │   ├── database.py
│   │   └── migrations/
│   ├── cache/
│   │   └── redis_client.py
│   ├── telegram/
│   │   ├── bot.py
│   │   └── notifier.py
│   ├── scheduler/
│   │   └── tasks.py
│   ├── config.py
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx               ← Dashboard
│   │   ├── [symbol]/page.tsx      ← Detay sayfası
│   │   ├── news/page.tsx
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── PriceCard.tsx
│   │   ├── ScoreGauge.tsx
│   │   ├── NewsCard.tsx
│   │   ├── TradingChart.tsx
│   │   ├── SentimentPanel.tsx
│   │   ├── TechnicalPanel.tsx
│   │   └── CommentCard.tsx
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useAsset.ts
│   │   └── useSearch.ts
│   └── package.json
│
├── docker-compose.yml
└── .env.example
```

---

## 11. GEREKLİ API KEY'LER (.env)

```env
# Yapay Zeka (Zorunlu)
ANTHROPIC_API_KEY=sk-ant-...

# Haber (En az biri)
NEWS_API_KEY=...                  # newsapi.org — ücretsiz 100/gün
ALPHA_VANTAGE_KEY=...             # ücretsiz 25/gün

# Sosyal Medya (Opsiyonel)
TWITTER_BEARER_TOKEN=...
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...

# Telegram (Zorunlu — bildirimler için)
TELEGRAM_BOT_TOKEN=...            # @BotFather'dan al

# Piyasa
METALS_API_KEY=...                # metals-api.com

# Veritabanı
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/finasistan
REDIS_URL=redis://localhost:6379/0
```

---

## 12. GELİŞTİRME PLAN

### Faz 1 — Altyapı (1-2 Hafta)
```
[ ] Docker Compose: PostgreSQL + Redis
[ ] FastAPI iskelet + health check
[ ] Veritabanı şeması + Alembic migration
[ ] yfinance ile BIST veri çekimi testi
[ ] Redis cache altyapısı
[ ] NewsAPI entegrasyonu + tekilleştirme
```

### Faz 2 — Ajanlar (2-3 Hafta)
```
[ ] Agent 1: Haber analizi (Claude Haiku)
[ ] Agent 3: Teknik analiz (pandas_ta)
[ ] Agent 2: Sosyal medya çekimi + duyarlılık
[ ] Agent 4: Orkestratör + ağırlıklı skor
[ ] APScheduler ile otomatik çalışma
[ ] Redis Streams kuyruk sistemi
```

### Faz 3 — API & WebSocket (1-2 Hafta)
```
[ ] Tüm REST endpoint'leri
[ ] WebSocket sunucusu (gerçek zamanlı)
[ ] Arama API'si (cache destekli, autocomplete)
[ ] Rate limiting + CORS
```

### Faz 4 — Frontend (2-3 Hafta)
```
[ ] Next.js + Tailwind + shadcn kurulumu
[ ] Dashboard (watchlist + piyasa genel)
[ ] Detay sayfası (3 analiz paneli)
[ ] TradingView chart entegrasyonu
[ ] WebSocket gerçek zamanlı güncellemeler
[ ] Dark mode + responsive
```

### Faz 5 — Telegram & Bildirimler (1 Hafta)
```
[ ] Bot kurulumu + komut handlers
[ ] Bildirim motoru (eşik mantığı)
[ ] Günlük özet scheduler (08:45 + 18:30)
[ ] Kullanıcı kayıt + watchlist DB
```

### Faz 6 — Cila & Yayın (1 Hafta)
```
[ ] Hata yönetimi + fallback'ler
[ ] Structured logging + monitoring
[ ] Tüm sayfalarda sorumluluk reddi bildirimi
[ ] Production Docker Compose
[ ] VPS/cloud deploy
```

---

## 13. GÜVENLİK VE YASAL ÇERÇEVE

### Bu Sistem Ne YAPMAZ
```
✗ "Şunu al / şunu sat" tavsiyesi vermez
✗ Fiyat tahmini yapmaz
✗ Getiri garantisi sunmaz
✗ Portföy yönetimi yapmaz
```

### Bu Sistem Ne YAPAR
```
✓ Kamuya açık haberleri toplar ve özetler
✓ Teknik indikatörleri hesaplar ve açıklar
✓ Yatırımcı yorumlarının genel eğilimini gösterir
✓ Önemli gelişmeleri zamanında bildirir
✓ Bilgilendirir, kararı kullanıcıya bırakır
```

### Zorunlu Sorumluluk Reddi (Her Yerde)
> *"Bu platform yalnızca bilgilendirme amacıyla hizmet vermektedir.  
> Sunulan içerikler yatırım tavsiyesi niteliği taşımaz.  
> Tüm finansal kararlar tamamen kullanıcının sorumluluğundadır.  
> Herhangi bir yatırım kararından önce lisanslı bir finansal danışmana başvurunuz."*

### Teknik Güvenlik
```
- API key'leri .env'de, kod içinde asla
- Telegram: sadece kayıtlı chat_id'lere bildirim
- Rate limiting: IP başına 60 istek/dakika
- HTTPS zorunlu (production)
- Redis: auth enabled + local network only
```

---

## 14. BAŞARI KRİTERLERİ

| Metrik | Hedef |
|--------|-------|
| API yanıt süresi (cache hit) | < 200ms |
| API yanıt süresi (cache miss) | < 2s |
| WebSocket gecikmesi | < 500ms |
| Telegram bildirim gecikmesi | < 10s (kritik) |
| Sistem uptime | > %99 |
| Haber güncellik gecikmesi | < 20 dk |
| Teknik analiz güncelliği | < 10 dk (piyasa saatinde) |
