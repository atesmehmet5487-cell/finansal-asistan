# Step-by-Step İmplementasyon Rehberi

## BÖLÜM 1: HAZIRLIK

### Adım 1: Geliştirme Ortamını Kurmak

```bash
# Python sanal ortamı oluştur
python -m venv venv
source venv/bin/activate  # Linux/Mac
# veya
venv\Scripts\activate  # Windows

# Gerekli kütüphaneleri kur
pip install fastapi uvicorn sqlalchemy psycopg2-binary redis \
    pandas numpy scikit-learn \
    langchain openai python-telegram-bot \
    aiohttp pydantic

# Node.js paketleri (Frontend)
npm init -y
npm install react next axios zustand socket.io-client
npm install -D tailwindcss shadcn-ui
```

### Adım 2: Veritabanı Kurulumu

```sql
-- PostgreSQL veritabanı oluştur
CREATE DATABASE investment_db;

-- Uygulamadan tablo oluştur:
# Python'da SQLAlchemy ile:
from models.database import Base, engine
Base.metadata.create_all(bind=engine)

-- Redis başlat
redis-server  # Veya Docker: docker run -d -p 6379:6379 redis
```

### Adım 3: API Keys Hazırlamak

```
1. NewsAPI (newsapi.org)
   - Ücretsiz plan: 100 istek/gün
   - Premium: Unlimited

2. Alpha Vantage (alphavantage.co)
   - Ücretsiz plan: 5 istek/dakika
   - Premium: Higher limits

3. IEX Cloud (iexcloud.io)
   - Sandbox hesab oluştur (testing için)
   - Hisse fiyatları ve haberler

4. OpenAI API (openai.com)
   - GPT-4 erişimi sağla
   - Token limiti ayarla

5. Telegram Bot (@BotFather via Telegram)
   - Token'ını kopyala
```

---

## BÖLÜM 2: BACKEND GELIŞTIRMESI (Aşama 1: Temel)

### Adım 4: API Sunucusunu Başlatmak

```python
# backend/api/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Investment Analysis API")

# CORS ayarı
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Route'ları import et
from api.routes import search, analysis, assets, notifications

app.include_router(search.router)
app.include_router(analysis.router)
app.include_router(assets.router)
app.include_router(notifications.router)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

```bash
# Çalıştır
python backend/api/main.py
# Veya
uvicorn backend.api.main:app --reload
```

### Adım 5: Veri Çekme Servisi

```python
# backend/services/data_fetcher.py

import aiohttp
import asyncio
from datetime import datetime
from typing import List, Dict

class DataFetcher:
    def __init__(self, config):
        self.newsapi_key = config.NEWSAPI_KEY
        self.alpha_vantage_key = config.ALPHA_VANTAGE_KEY
        self.base_news_url = "https://newsapi.org/v2"
        self.base_av_url = "https://www.alphavantage.co/query"
    
    async def fetch_news(self, keywords: List[str]) -> List[Dict]:
        """Haberler çek"""
        async with aiohttp.ClientSession() as session:
            news_list = []
            
            for keyword in keywords:
                url = f"{self.base_news_url}/everything"
                params = {
                    'q': keyword,
                    'language': 'tr',
                    'sortBy': 'publishedAt',
                    'apiKey': self.newsapi_key,
                    'pageSize': 20
                }
                
                try:
                    async with session.get(url, params=params) as resp:
                        data = await resp.json()
                        
                        for article in data.get('articles', []):
                            news_list.append({
                                'id': f"{keyword}_{article['publishedAt']}",
                                'headline': article['title'],
                                'content': article['description'] or article['content'],
                                'source': article['source']['name'],
                                'url': article['url'],
                                'timestamp': article['publishedAt'],
                                'image': article.get('urlToImage')
                            })
                except Exception as e:
                    print(f"Error fetching news for {keyword}: {e}")
            
            return news_list
    
    async def fetch_stock_price(self, symbol: str) -> Dict:
        """Hisse fiyatını çek"""
        params = {
            'function': 'GLOBAL_QUOTE',
            'symbol': symbol,
            'apikey': self.alpha_vantage_key
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(self.base_av_url, params=params) as resp:
                data = await resp.json()
                
                if 'Global Quote' in data:
                    quote = data['Global Quote']
                    return {
                        'symbol': symbol,
                        'price': float(quote.get('05. price', 0)),
                        'change': float(quote.get('09. change', 0)),
                        'change_percent': float(quote.get('10. change percent', '0').strip('%')),
                        'timestamp': datetime.now().isoformat()
                    }
        
        return None
    
    async def fetch_historical_data(self, symbol: str, days: int = 90) -> List[Dict]:
        """Tarihçi fiyat verisi çek"""
        params = {
            'function': 'TIME_SERIES_DAILY',
            'symbol': symbol,
            'outputsize': 'full',
            'apikey': self.alpha_vantage_key
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(self.base_av_url, params=params) as resp:
                data = await resp.json()
                
                prices = []
                if 'Time Series (Daily)' in data:
                    time_series = data['Time Series (Daily)']
                    
                    for date_str, ohlc in list(time_series.items())[:days]:
                        prices.append({
                            'date': date_str,
                            'open': float(ohlc['1. open']),
                            'high': float(ohlc['2. high']),
                            'low': float(ohlc['3. low']),
                            'close': float(ohlc['4. close']),
                            'volume': int(ohlc['5. volume'])
                        })
                
                return prices[::-1]  # Reverse to chronological order

# Kullanım
fetcher = DataFetcher(config)
news = await fetcher.fetch_news(['BIST', 'ASELS', 'altın'])
price = await fetcher.fetch_stock_price('ASELS')
history = await fetcher.fetch_historical_data('ASELS')
```

### Adım 6: Agent Pipeline'ını Bağlamak

```python
# backend/services/analysis_service.py

from agents.news_analyzer import NewsAnalyzerAgent
from agents.technical_analyzer import TechnicalAnalyzerAgent
from agents.investment_analyst import InvestmentAnalystAgent
from agents.orchestrator import OrchestratorAgent
from services.data_fetcher import DataFetcher
import asyncio

class AnalysisService:
    def __init__(self):
        self.data_fetcher = DataFetcher(config)
        self.news_agent = NewsAnalyzerAgent()
        self.technical_agent = TechnicalAnalyzerAgent()
        self.investment_agent = InvestmentAnalystAgent()
        self.orchestrator = OrchestratorAgent()
    
    async def analyze_asset(self, symbol: str):
        """Bir hisse'yi tam analiz et"""
        
        # 1. Veri çek (paralel)
        news_task = self.data_fetcher.fetch_news([symbol])
        price_task = self.data_fetcher.fetch_stock_price(symbol)
        history_task = self.data_fetcher.fetch_historical_data(symbol)
        
        news_data, price_data, historical = await asyncio.gather(
            news_task, price_task, history_task
        )
        
        # 2. Agentler analiz et (paralel)
        news_analysis = self.news_agent.analyze_news(news_data)
        
        # DataFrame'e dönüştür
        import pandas as pd
        df = pd.DataFrame(historical)
        technical_analysis = self.technical_agent.analyze_asset(symbol, df)
        
        # Uzman görüşleri çek (simule edilmiş)
        analyst_analysis = self.investment_agent.analyze_asset(symbol)
        
        # 3. Organize et
        final_analysis = self.orchestrator.consolidate_analysis(
            news_analysis[0] if news_analysis else {},
            technical_analysis,
            analyst_analysis
        )
        
        return final_analysis

# Endpoint'te kullan
@app.get("/api/analyze/{symbol}")
async def analyze(symbol: str):
    service = AnalysisService()
    result = await service.analyze_asset(symbol)
    return result
```

---

## BÖLÜM 3: FRONTEND GELIŞTIRMESI (Aşama 2: Web Arayüzü)

### Adım 7: Temel React Yapısı

```typescript
// frontend/src/App.tsx

import React, { useState } from 'react'
import SearchBar from './components/SearchBar'
import Dashboard from './components/Dashboard'
import AnalysisDetail from './pages/analysis-detail'

export default function App() {
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [view, setView] = useState('dashboard')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <header className="bg-slate-950 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">📊 Yatırım Analiz</h1>
          <SearchBar onSelect={(asset) => {
            setSelectedAsset(asset)
            setView('detail')
          }} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'dashboard' && <Dashboard />}
        {view === 'detail' && selectedAsset && (
          <AnalysisDetail asset={selectedAsset} />
        )}
      </main>
    </div>
  )
}
```

### Adım 8: Arama Bileşeni

```typescript
// frontend/src/components/SearchBar.tsx

import React, { useState, useEffect } from 'react'
import { api } from '../services/api'

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    const delaySearch = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await api.get('/search/suggestions', {
          params: { q: query }
        })
        setSuggestions(response.data)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(delaySearch)
  }, [query])

  const handleSelect = async (symbol) => {
    try {
      const analysis = await api.get(`/search/${symbol}`)
      onSelect(analysis.data)
      setQuery('')
    } catch (error) {
      console.error('Analysis fetch error:', error)
    }
  }

  return (
    <div className="relative w-96">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Hisse ara... (ASELS, THYAO, ALTUN)"
        className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg
                   border border-slate-600 focus:border-blue-500 outline-none"
      />
      
      {suggestions.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-slate-800 
                        border border-slate-600 rounded-lg shadow-lg z-10">
          {suggestions.map((item) => (
            <div
              key={item.symbol}
              onClick={() => handleSelect(item.symbol)}
              className="px-4 py-2 hover:bg-slate-700 cursor-pointer"
            >
              <div className="font-semibold text-white">{item.symbol}</div>
              <div className="text-sm text-slate-400">{item.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Adım 9: Analiz Detay Sayfası

```typescript
// frontend/src/pages/analysis-detail.tsx

import React, { useEffect, useState } from 'react'
import { api } from '../services/api'
import AnalysisChart from '../components/AnalysisChart'
import NewsCard from '../components/NewsCard'
import ScoreGauge from '../components/ScoreGauge'

export default function AnalysisDetail({ asset }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [watched, setWatched] = useState(false)

  useEffect(() => {
    fetchAnalysis()
  }, [asset.symbol])

  const fetchAnalysis = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/search/${asset.symbol}`)
      setAnalysis(response.data)
    } catch (error) {
      console.error('Error fetching analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center py-8">Yükleniyor...</div>

  const { current_analysis, recent_news, analyst_opinions } = analysis

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-950 border border-slate-700 rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {asset.symbol}
            </h2>
            <p className="text-slate-400">{asset.name}</p>
          </div>
          
          <button
            onClick={() => setWatched(!watched)}
            className={`px-6 py-2 rounded-lg font-semibold transition
                        ${watched 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : 'bg-blue-600 hover:bg-blue-700'} 
                        text-white`}
          >
            {watched ? '👁️ İzleniyor' : '👁️ İzle'}
          </button>
        </div>

        {/* Price & Change */}
        <div className="mt-4 flex gap-8">
          <div>
            <p className="text-slate-400 text-sm">Fiyat</p>
            <p className="text-3xl font-bold text-white">
              ₺{current_analysis.current_price}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Değişim</p>
            <p className={`text-2xl font-bold ${
              current_analysis.change >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {current_analysis.change > 0 ? '+' : ''}{current_analysis.change}%
            </p>
          </div>
        </div>
      </div>

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Score Gauge */}
        <div className="bg-slate-950 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Genel Skor</h3>
          <ScoreGauge score={current_analysis.overall_score} />
        </div>

        {/* Recommendation */}
        <div className="bg-slate-950 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Tavsiye</h3>
          <div className={`text-3xl font-bold mb-2 ${
            current_analysis.final_recommendation.includes('BUY') 
              ? 'text-green-400' 
              : 'text-red-400'
          }`}>
            {current_analysis.final_recommendation}
          </div>
          <p className="text-slate-400 text-sm">
            Güven: {(current_analysis.recommendation_confidence * 100).toFixed(0)}%
          </p>
        </div>

        {/* Technical Signal */}
        <div className="bg-slate-950 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Teknik Analiz</h3>
          <div className="text-2xl font-bold text-blue-400 mb-2">
            {current_analysis.analysis.technical_signal.toUpperCase()}
          </div>
          <p className="text-slate-400 text-sm">
            Güven: {(current_analysis.analysis.technical_confidence * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <AnalysisChart symbol={asset.symbol} />

      {/* News Section */}
      <div className="bg-slate-950 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Son Haberler</h3>
        <div className="space-y-3">
          {recent_news.map((news) => (
            <NewsCard key={news.id} news={news} />
          ))}
        </div>
      </div>

      {/* Analyst Opinions */}
      <div className="bg-slate-950 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Piyasa Konsensüsü</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">
              {analyst_opinions.bullish_count}
            </div>
            <p className="text-slate-400">Bullish</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400">
              {analyst_opinions.neutral_count}
            </div>
            <p className="text-slate-400">Nötr</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400">
              {analyst_opinions.bearish_count}
            </div>
            <p className="text-slate-400">Bearish</p>
          </div>
        </div>
      </div>

      {/* Risks & Price Targets */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-950 border border-red-900/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-400 mb-4">⚠️ Riskler</h3>
          <ul className="space-y-2">
            {current_analysis.risks.map((risk, i) => (
              <li key={i} className="text-slate-300">• {risk}</li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-950 border border-green-900/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-400 mb-4">🎯 Hedefler</h3>
          <div className="space-y-3">
            <div>
              <p className="text-slate-400 text-sm">Fiyat Hedefi</p>
              <p className="text-2xl font-bold text-green-400">
                ₺{current_analysis.price_target}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Stop Loss</p>
              <p className="text-2xl font-bold text-red-400">
                ₺{current_analysis.stop_loss}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## BÖLÜM 4: TELEGRAM BOT ENTEGRASYONU (Aşama 3)

### Adım 10: Bot'u Çalıştırmak

```bash
# telegram-bot klasörüne git
cd telegram-bot

# Gereksiz paketleri kur
pip install python-telegram-bot aiohttp

# Bot'u çalıştır
python bot.py
```

### Adım 11: Otomatik Bildirim Sistemi

```python
# backend/services/notification_service.py

from telegram.ext import Application
import asyncio
from datetime import datetime

class NotificationService:
    def __init__(self, telegram_token):
        self.app = Application.builder().token(telegram_token).build()
        self.notification_queue = asyncio.Queue()
    
    async def send_critical_alert(self, user_id: str, analysis: dict):
        """Acil bildiri gönder"""
        message = f"""
🔴 <b>AYRAN ALERT!</b> {analysis['symbol']}

Genel Skor: {analysis['overall_score']}/10
Tavsiye: {analysis['final_recommendation']}

Fiyat Hedefi: ₺{analysis['price_target']}
Stop Loss: ₺{analysis['stop_loss']}

<i>Web detayları görüntüle: [link]</i>
        """
        
        await self.app.bot.send_message(
            chat_id=user_id,
            text=message,
            parse_mode="HTML"
        )
    
    async def send_batch_summary(self, user_id: str, analyses: list):
        """Saatlik özet gönder"""
        message = "📊 <b>Saatlik Analiz Özeti</b>\n\n"
        
        for analysis in analyses:
            emoji = "🟢" if "BUY" in analysis['final_recommendation'] else "🔴"
            message += f"{emoji} <b>{analysis['symbol']}</b> {analysis['final_recommendation']}\n"
        
        await self.app.bot.send_message(
            chat_id=user_id,
            text=message,
            parse_mode="HTML"
        )

# Background task
async def notification_handler():
    service = NotificationService(TELEGRAM_TOKEN)
    
    while True:
        # Her saat başında kontrol et
        await asyncio.sleep(3600)
        
        # Veritabanından izlenen hisseleri getir
        watchlist = db.get_all_watchlists()
        
        for user_id, assets in watchlist.items():
            analyses = []
            
            for asset_id in assets:
                analysis = db.get_latest_analysis(asset_id)
                if analysis:
                    analyses.append(analysis)
            
            if analyses:
                await service.send_batch_summary(user_id, analyses)
```

---

## BÖLÜM 5: GERÇEK ZAMANLI GÜNCELLEMELER (Aşama 4)

### Adım 12: WebSocket Bağlantısı

```python
# backend/api/websocket.py

from fastapi import WebSocket, WebSocketDisconnect
from typing import List
import json
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        """Tüm istemcilere broadcast yap"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

@app.websocket("/ws/analysis/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):
    await manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            # Güncellemeler gönder
            analysis = await analysis_service.analyze_asset(symbol)
            
            await websocket.send_json({
                "type": "analysis_update",
                "symbol": symbol,
                "analysis": analysis,
                "timestamp": datetime.now().isoformat()
            })
            
            # Her 30 saniyede bir güncelle
            await asyncio.sleep(30)
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

```typescript
// frontend/src/services/websocket.ts

export class WebSocketService {
  private ws: WebSocket | null = null

  connect(symbol: string, onUpdate: (data: any) => void) {
    this.ws = new WebSocket(
      `ws://${window.location.hostname}:8000/ws/analysis/${symbol}`
    )

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      onUpdate(data)
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
    }
  }
}
```

---

## BÖLÜM 6: DEPLOYMENT (Aşama 5)

### Adım 13: Docker Yapılandırması

```dockerfile
# Dockerfile

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml

version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: investment_db
      POSTGRES_USER: invest_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://invest_user:secure_password@db/investment_db
      REDIS_URL: redis://redis:6379
      NEWSAPI_KEY: ${NEWSAPI_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
    depends_on:
      - db
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:8000

volumes:
  postgres_data:
```

```bash
# Çalıştırma
docker-compose up -d
```

---

## TAMAMLAMA ÇEK LİSTESİ

- [ ] PostgreSQL veritabanı kuruldu
- [ ] Redis cache'i çalışıyor
- [ ] API sunucusu http://localhost:8000'de çalışıyor
- [ ] FastAPI docs: http://localhost:8000/docs
- [ ] Frontend React: http://localhost:3000
- [ ] Telegram bot test edildi
- [ ] WebSocket bağlantısı çalışıyor
- [ ] Tüm env variables ayarlandı
- [ ] Rate limiting uygulandı
- [ ] Error handling tamamlandı
- [ ] Logging konfigüre edildi
- [ ] Unit testler yazıldı
- [ ] Docker deployment hazır
- [ ] SSL/HTTPS ayarlandı (production için)

Bu rehberi takip ederek adım adım sistemi kurup çalıştırabilirsiniz!
