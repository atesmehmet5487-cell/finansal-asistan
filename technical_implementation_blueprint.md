# Teknik İmplementasyon Blueprint

## DİZİN YAPISI

```
investment-analysis-system/
├── backend/
│   ├── agents/
│   │   ├── news_analyzer.py
│   │   ├── investment_analyst.py
│   │   ├── technical_analyzer.py
│   │   └── orchestrator.py
│   ├── api/
│   │   ├── routes/
│   │   │   ├── search.py
│   │   │   ├── analysis.py
│   │   │   ├── assets.py
│   │   │   └── notifications.py
│   │   └── main.py (FastAPI app)
│   ├── services/
│   │   ├── data_fetcher.py (API'lerden veri çekme)
│   │   ├── cache_service.py (Redis)
│   │   ├── notification_service.py (Telegram)
│   │   └── database_service.py (PostgreSQL)
│   ├── models/
│   │   ├── schemas.py (Pydantic models)
│   │   └── database.py (SQLAlchemy ORM)
│   ├── utils/
│   │   ├── indicators.py (Teknik göstergeler)
│   │   ├── sentiment.py (Duyarlılık analizi)
│   │   └── validators.py
│   ├── config/
│   │   └── settings.py (Çevre değişkenleri)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── AnalysisChart.tsx
│   │   │   ├── NewsCard.tsx
│   │   │   └── AnalystOpinionCard.tsx
│   │   ├── pages/
│   │   │   ├── home.tsx
│   │   │   ├── search-results.tsx
│   │   │   └── settings.tsx
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── websocket.ts
│   │   └── App.tsx
│   ├── public/
│   └── package.json
├── telegram-bot/
│   ├── bot.py
│   └── handlers/
│       ├── start.py
│       ├── watch.py
│       └── analysis.py
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## AGENT IMPLEMENTATIONS

### 1. News Analyzer Agent

```python
# backend/agents/news_analyzer.py

from langchain.chat_models import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.chains import LLMChain
from typing import Dict, List
import json

class NewsAnalyzerAgent:
    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-4", temperature=0.7)
        self.sentiment_prompt = ChatPromptTemplate.from_template("""
        Finansal bir haberi analiz et ve şu bilgileri sağla:
        
        Haber: {news_content}
        
        Lütfen JSON formatında şunları yap:
        1. Duyarlılık skoru (-1.0 ile 1.0 arası)
        2. Kategori (positive/negative/neutral)
        3. İlgili hisse/emtiaları tanımla
        4. Önemlilik seviyesi (critical/high/normal/low)
        5. 2 cümlelik özet
        
        JSON Yanıtı:
        {{"sentiment_score": 0.75, "category": "positive", ...}}
        """)
        
        self.sentiment_chain = LLMChain(
            llm=self.llm,
            prompt=self.sentiment_prompt
        )
    
    def analyze_news(self, news_data: List[Dict]) -> List[Dict]:
        """Haberleri analiz et"""
        results = []
        
        for news in news_data:
            response = self.sentiment_chain.run(
                news_content=news['content']
            )
            
            try:
                analysis = json.loads(response)
                analysis['news_id'] = news['id']
                analysis['source'] = news['source']
                analysis['timestamp'] = news['timestamp']
                results.append(analysis)
            except json.JSONDecodeError:
                # Fallback sentiment analysis
                analysis = self._fallback_analysis(news)
                results.append(analysis)
        
        return results
    
    def _fallback_analysis(self, news: Dict) -> Dict:
        """Yedek analiz yöntemi"""
        # Simple keyword-based sentiment
        positive_words = ['yükseliş', 'kazanç', 'büyüme', 'olumlu', 'güçlü']
        negative_words = ['düşüş', 'kayıp', 'olumsuz', 'zayıf', 'kriz']
        
        content = news['content'].lower()
        pos_count = sum(1 for word in positive_words if word in content)
        neg_count = sum(1 for word in negative_words if word in content)
        
        score = (pos_count - neg_count) / max(pos_count + neg_count, 1)
        
        return {
            'news_id': news['id'],
            'source': news['source'],
            'timestamp': news['timestamp'],
            'sentiment_score': score,
            'category': 'positive' if score > 0 else 'negative' if score < 0 else 'neutral',
            'importance': 'high' if abs(score) > 0.5 else 'normal'
        }

# Kullanım:
analyzer = NewsAnalyzerAgent()
analyzed_news = analyzer.analyze_news(raw_news_data)
```

### 2. Technical Analyzer Agent

```python
# backend/agents/technical_analyzer.py

import pandas as pd
import numpy as np
from typing import Dict, Tuple
from utils.indicators import TechnicalIndicators

class TechnicalAnalyzerAgent:
    def __init__(self):
        self.indicators = TechnicalIndicators()
    
    def analyze_asset(self, 
                     symbol: str, 
                     price_data: pd.DataFrame) -> Dict:
        """Teknik analiz yap"""
        
        # İndikatörleri hesapla
        rsi = self.indicators.calculate_rsi(price_data['close'], period=14)
        macd = self.indicators.calculate_macd(price_data['close'])
        ma_20 = self.indicators.calculate_sma(price_data['close'], 20)
        ma_50 = self.indicators.calculate_sma(price_data['close'], 50)
        ma_200 = self.indicators.calculate_sma(price_data['close'], 200)
        bollinger = self.indicators.calculate_bollinger_bands(
            price_data['close'], period=20
        )
        
        current_price = price_data['close'].iloc[-1]
        current_rsi = rsi.iloc[-1]
        current_macd = macd.iloc[-1]
        
        # Trend analizi
        trend = self._determine_trend(
            current_price, 
            ma_20.iloc[-1], 
            ma_50.iloc[-1], 
            ma_200.iloc[-1]
        )
        
        # Destek ve direnç
        support, resistance = self._calculate_support_resistance(price_data)
        
        # Sinyal üretimi
        signal = self._generate_signal(
            current_rsi,
            current_macd,
            current_price,
            bollinger
        )
        
        return {
            'symbol': symbol,
            'current_price': float(current_price),
            'trend': trend,
            'indicators': {
                'RSI': float(current_rsi),
                'MACD': float(current_macd),
                'MA20': float(ma_20.iloc[-1]),
                'MA50': float(ma_50.iloc[-1]),
                'MA200': float(ma_200.iloc[-1]),
                'Bollinger_Upper': float(bollinger['upper'].iloc[-1]),
                'Bollinger_Lower': float(bollinger['lower'].iloc[-1]),
            },
            'support': float(support),
            'resistance': float(resistance),
            'signal': signal,
            'confidence': self._calculate_confidence(
                current_rsi, current_macd, signal
            ),
            'risk_level': self._assess_risk(current_price, support, resistance)
        }
    
    def _determine_trend(self, price, ma20, ma50, ma200) -> str:
        if ma20 > ma50 > ma200:
            return "strong_uptrend"
        elif ma20 > ma50:
            return "uptrend"
        elif ma20 < ma50 < ma200:
            return "strong_downtrend"
        elif ma20 < ma50:
            return "downtrend"
        else:
            return "sideways"
    
    def _generate_signal(self, rsi, macd, price, bollinger) -> str:
        buy_signals = 0
        sell_signals = 0
        
        # RSI sinyali
        if rsi < 30:
            buy_signals += 1
        elif rsi > 70:
            sell_signals += 1
        
        # MACD sinyali
        if macd > 0:
            buy_signals += 1
        else:
            sell_signals += 1
        
        # Bollinger Bands sinyali
        if price < bollinger['lower'].iloc[-1]:
            buy_signals += 1
        elif price > bollinger['upper'].iloc[-1]:
            sell_signals += 1
        
        if buy_signals >= 2:
            return "buy"
        elif sell_signals >= 2:
            return "sell"
        else:
            return "hold"
    
    def _calculate_confidence(self, rsi, macd, signal) -> float:
        base_confidence = 0.5
        
        if signal == "buy":
            if rsi < 30:
                base_confidence += 0.15
            if macd > 0:
                base_confidence += 0.15
        elif signal == "sell":
            if rsi > 70:
                base_confidence += 0.15
            if macd < 0:
                base_confidence += 0.15
        
        return min(base_confidence, 1.0)
    
    def _assess_risk(self, price, support, resistance) -> str:
        distance_to_support = abs(price - support) / price
        distance_to_resistance = abs(resistance - price) / price
        
        if distance_to_support < 0.05 or distance_to_resistance < 0.05:
            return "high"
        elif distance_to_support < 0.10 or distance_to_resistance < 0.10:
            return "medium"
        else:
            return "low"
    
    def _calculate_support_resistance(self, df) -> Tuple[float, float]:
        # Simplest: use local min/max
        window = 20
        support = df['close'].tail(window).min()
        resistance = df['close'].tail(window).max()
        return float(support), float(resistance)
```

### 3. Orchestrator Agent

```python
# backend/agents/orchestrator.py

from typing import Dict, List

class OrchestratorAgent:
    def __init__(self):
        self.news_weights = 0.25
        self.technical_weights = 0.35
        self.analyst_weights = 0.40
    
    def consolidate_analysis(self,
                           news_analysis: Dict,
                           technical_analysis: Dict,
                           analyst_analysis: Dict) -> Dict:
        """Tüm analizi birleştir"""
        
        # Normalize puanlar (0-1 aralığında)
        news_score = (news_analysis['sentiment_score'] + 1) / 2
        technical_score = self._score_technical(technical_analysis)
        analyst_score = (analyst_analysis['bullish_score'] + 
                        analyst_analysis['neutral_score'] * 0.5) / 1.5
        
        # Ağırlıklı toplam
        overall_score = (
            news_score * self.news_weights +
            technical_score * self.technical_weights +
            analyst_score * self.analyst_weights
        )
        
        # Konsensüs
        consensus = self._determine_consensus(
            news_analysis,
            technical_analysis,
            analyst_analysis
        )
        
        return {
            'asset': technical_analysis['symbol'],
            'timestamp': news_analysis['timestamp'],
            'overall_score': overall_score,
            'analysis': {
                'technical_signal': technical_analysis['signal'],
                'technical_confidence': technical_analysis['confidence'],
                'news_sentiment': news_analysis['category'],
                'news_score': news_score,
                'analyst_consensus': consensus,
                'analyst_confidence': analyst_analysis.get('confidence', 0.5)
            },
            'final_recommendation': self._get_recommendation(overall_score),
            'recommendation_confidence': self._get_confidence(overall_score),
            'key_points': self._extract_key_points(
                news_analysis,
                technical_analysis,
                analyst_analysis
            ),
            'risks': self._identify_risks(
                technical_analysis,
                analyst_analysis
            ),
            'price_target': technical_analysis.get('resistance'),
            'stop_loss': technical_analysis.get('support')
        }
    
    def _score_technical(self, analysis: Dict) -> float:
        if analysis['signal'] == 'buy':
            return 0.7 + (analysis['confidence'] * 0.3)
        elif analysis['signal'] == 'sell':
            return 0.3 - (analysis['confidence'] * 0.3)
        else:  # hold
            return 0.5
    
    def _determine_consensus(self, news, technical, analyst) -> str:
        signals = [
            news['category'],
            technical['signal'],
            'bullish' if analyst['bullish_score'] > 0.5 else 'bearish'
        ]
        
        bullish_count = signals.count('buy') + signals.count('bullish')
        bearish_count = signals.count('sell') + signals.count('bearish')
        
        if bullish_count >= 2:
            return 'bullish'
        elif bearish_count >= 2:
            return 'bearish'
        else:
            return 'neutral'
    
    def _get_recommendation(self, score: float) -> str:
        if score >= 0.75:
            return 'STRONG BUY'
        elif score >= 0.60:
            return 'BUY'
        elif score >= 0.45:
            return 'LOOK'
        elif score >= 0.30:
            return 'SELL'
        else:
            return 'STRONG SELL'
    
    def _get_confidence(self, score: float) -> float:
        return abs(score - 0.5) * 2  # 0-1 aralığında
    
    def _extract_key_points(self, news, technical, analyst) -> List[str]:
        points = []
        
        if technical['signal'] == 'buy' and technical['confidence'] > 0.7:
            points.append(f"Teknik analiz satın alma sinyali gösteriyor")
        
        if news['category'] == 'positive':
            points.append(f"Haberler olumlu ({news['sentiment_score']:.2f})")
        
        if analyst['bullish_score'] > 0.7:
            points.append(f"Piyasa konsensüsü yüksek bullish ({analyst['bullish_count']} analist)")
        
        return points
    
    def _identify_risks(self, technical, analyst) -> List[str]:
        risks = []
        
        if technical['risk_level'] == 'high':
            risks.append('Kısa vadeli dalgalanma riski yüksek')
        
        if analyst.get('bearish_score', 0) > 0.3:
            risks.append(f"Bazı analistler olumsuz bakış açısı taşıyor")
        
        risks.append('Makroekonomik belirsizlik')
        
        return risks
```

---

## API ENDPOINTS

```python
# backend/api/routes/search.py

from fastapi import APIRouter, Query
from services.cache_service import CacheService
from services.database_service import DatabaseService

router = APIRouter(prefix="/api/search", tags=["search"])
cache = CacheService()
db = DatabaseService()

@router.get("/{query}")
async def search_asset(query: str):
    """Hisse/emtia ara"""
    
    # Cache'den kontrol et
    cached = cache.get(f"search:{query}")
    if cached:
        return cached
    
    # Veritabanında ara
    asset = db.search_asset(query)
    
    if not asset:
        return {"error": "Asset not found"}
    
    # En son analizi getir
    latest_analysis = db.get_latest_analysis(asset.id)
    
    response = {
        "asset": asset.to_dict(),
        "current_analysis": latest_analysis.to_dict(),
        "recent_news": db.get_recent_news(asset.id, limit=5),
        "analyst_opinions": db.get_analyst_opinions(asset.id),
        "technical_chart_data": db.get_price_history(asset.id, days=90)
    }
    
    # Cache'e kaydet (10 dakika)
    cache.set(f"search:{query}", response, ttl=600)
    
    return response

@router.get("/suggestions")
async def autocomplete(q: str = Query(..., min_length=1)):
    """Otomatik tamamlama"""
    suggestions = db.search_assets_like(q, limit=10)
    return [{"symbol": s.symbol, "name": s.name} for s in suggestions]

@router.get("/trending")
async def get_trending():
    """Trende çıkan hisseler"""
    return db.get_trending_assets(limit=10)

@router.post("/watch")
async def add_to_watchlist(asset_id: str, user_id: str):
    """İzlemeye ekle"""
    db.add_to_watchlist(user_id, asset_id)
    return {"status": "success"}

@router.delete("/watch/{asset_id}")
async def remove_from_watchlist(asset_id: str, user_id: str):
    """İzlemekten çıkar"""
    db.remove_from_watchlist(user_id, asset_id)
    return {"status": "success"}

@router.get("/watchlist")
async def get_watchlist(user_id: str):
    """İzleme listesini getir"""
    assets = db.get_watchlist(user_id)
    
    results = []
    for asset in assets:
        latest = db.get_latest_analysis(asset.id)
        results.append({
            "asset": asset.to_dict(),
            "latest_analysis": latest.to_dict()
        })
    
    return results
```

---

## DATABASE SCHEMA

```python
# backend/models/database.py

from sqlalchemy import Column, String, Float, DateTime, Integer, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Asset(Base):
    __tablename__ = "assets"
    
    id = Column(String, primary_key=True)
    symbol = Column(String, unique=True)
    name = Column(String)
    sector = Column(String)
    exchange = Column(String)
    
    news = relationship("News", back_populates="asset")
    analysis = relationship("ConsolidatedAnalysis", back_populates="asset")
    indicators = relationship("TechnicalIndicator", back_populates="asset")

class News(Base):
    __tablename__ = "news"
    
    id = Column(String, primary_key=True)
    asset_id = Column(String, ForeignKey("assets.id"))
    headline = Column(String)
    content = Column(String)
    source = Column(String)
    
    # Analysis
    sentiment_score = Column(Float)  # -1 to 1
    category = Column(String)  # positive, negative, neutral
    importance = Column(String)  # critical, high, normal, low
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    asset = relationship("Asset", back_populates="news")

class ConsolidatedAnalysis(Base):
    __tablename__ = "consolidated_analysis"
    
    id = Column(String, primary_key=True)
    asset_id = Column(String, ForeignKey("assets.id"))
    
    overall_score = Column(Float)
    recommendation = Column(String)
    confidence = Column(Float)
    
    technical_signal = Column(String)
    technical_confidence = Column(Float)
    news_sentiment = Column(String)
    analyst_consensus = Column(String)
    
    price_target = Column(Float)
    stop_loss = Column(Float)
    
    key_points = Column(String)  # JSON
    risks = Column(String)  # JSON
    
    created_at = Column(DateTime, default=datetime.utcnow)
    asset = relationship("Asset", back_populates="analysis")

class TechnicalIndicator(Base):
    __tablename__ = "technical_indicators"
    
    id = Column(String, primary_key=True)
    asset_id = Column(String, ForeignKey("assets.id"))
    
    rsi = Column(Float)
    macd = Column(Float)
    ma_20 = Column(Float)
    ma_50 = Column(Float)
    ma_200 = Column(Float)
    
    support = Column(Float)
    resistance = Column(Float)
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    asset = relationship("Asset", back_populates="indicators")

class UserPreference(Base):
    __tablename__ = "user_preferences"
    
    user_id = Column(String, primary_key=True)
    telegram_id = Column(String)
    
    notification_level = Column(String)  # critical, high, all
    enabled = Column(Integer, default=1)  # 1 = enabled, 0 = disabled
    
    created_at = Column(DateTime, default=datetime.utcnow)

class Watchlist(Base):
    __tablename__ = "watchlist"
    
    user_id = Column(String, ForeignKey("user_preferences.user_id"))
    asset_id = Column(String, ForeignKey("assets.id"))
    added_at = Column(DateTime, default=datetime.utcnow)
```

---

## TELEGRAM BOT

```python
# telegram-bot/bot.py

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
import aiohttp
import json

API_BASE_URL = "http://localhost:8000/api"

class InvestmentBot:
    def __init__(self, token: str):
        self.token = token
        self.app = Application.builder().token(token).build()
        self.setup_handlers()
    
    def setup_handlers(self):
        self.app.add_handler(CommandHandler("start", self.start))
        self.app.add_handler(CommandHandler("watch", self.watch))
        self.app.add_handler(CommandHandler("unwatch", self.unwatch))
        self.app.add_handler(CommandHandler("analysis", self.get_analysis))
        self.app.add_handler(CommandHandler("watchlist", self.get_watchlist))
        self.app.add_handler(CommandHandler("settings", self.settings))
        self.app.add_handler(CommandHandler("help", self.help))
    
    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Bot başlangıcı"""
        await update.message.reply_text(
            "Hoş geldin! 📊\n\n"
            "Yatırım analiz botuna hoş geldiniz.\n\n"
            "Komutlar:\n"
            "/watch SYMBOL - Sembolü izlemeye ekle\n"
            "/analysis SYMBOL - Analiz al\n"
            "/watchlist - İzleme listesi\n"
            "/settings - Ayarları değiştir\n"
            "/help - Yardım"
        )
    
    async def watch(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Hisse izlemeye ekle"""
        if not context.args:
            await update.message.reply_text("Kullanım: /watch ASELS")
            return
        
        symbol = context.args[0].upper()
        user_id = str(update.effective_user.id)
        
        # API'ye gönder
        async with aiohttp.ClientSession() as session:
            try:
                async with session.post(
                    f"{API_BASE_URL}/search/watch",
                    json={"asset_id": symbol, "user_id": user_id}
                ) as resp:
                    if resp.status == 200:
                        await update.message.reply_text(
                            f"✅ {symbol} izlemeye eklendi."
                        )
                    else:
                        await update.message.reply_text(
                            f"❌ {symbol} bulunamadı."
                        )
            except Exception as e:
                await update.message.reply_text(f"Hata: {str(e)}")
    
    async def get_analysis(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Analiz getir"""
        if not context.args:
            await update.message.reply_text("Kullanım: /analysis ASELS")
            return
        
        symbol = context.args[0].upper()
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(
                    f"{API_BASE_URL}/search/{symbol}"
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        analysis = data['current_analysis']
                        
                        message = self._format_analysis(symbol, analysis)
                        await update.message.reply_text(
                            message,
                            parse_mode="HTML"
                        )
                    else:
                        await update.message.reply_text(f"❌ {symbol} bulunamadı")
            except Exception as e:
                await update.message.reply_text(f"❌ Hata: {str(e)}")
    
    def _format_analysis(self, symbol: str, analysis: dict) -> str:
        """Analizi formatlı metne dönüştür"""
        score = analysis['overall_score']
        rec = analysis['final_recommendation']
        
        # Emoji seç
        emoji = "🟢" if rec in ["BUY", "STRONG BUY"] else "🔴" if rec in ["SELL", "STRONG SELL"] else "🟡"
        
        message = f"""
{emoji} <b>{symbol} Analiz Sonucu</b>

<b>Genel Skor:</b> {score:.1f}/10 ({rec})

<b>Bileşen Analiz:</b>
📈 Teknik: {analysis['analysis']['technical_signal'].upper()}
📰 Haberler: {analysis['analysis']['news_sentiment'].upper()}
👥 Analistler: {analysis['analysis']['analyst_consensus'].upper()}

<b>Fiyat Hedefi:</b> ₺{analysis.get('price_target', 'N/A')}
<b>Stop Loss:</b> ₺{analysis.get('stop_loss', 'N/A')}

<b>Riskler:</b>
{chr(10).join('• ' + r for r in analysis.get('risks', []))}

<i>Bu analiz eğitim amaçlıdır, finansal tavsiye değildir.</i>
        """
        return message
    
    def run(self):
        """Botu başlat"""
        self.app.run_polling()

# Başlatma
if __name__ == "__main__":
    bot = InvestmentBot("YOUR_TELEGRAM_TOKEN")
    bot.run()
```

---

## ENVIRONMENT CONFIGURATION

```bash
# .env.example

# Database
DATABASE_URL=postgresql://user:password@localhost/investment_db
REDIS_URL=redis://localhost:6379

# APIs
NEWSAPI_KEY=your_newsapi_key
ALPHA_VANTAGE_KEY=your_alpha_vantage_key
IEX_CLOUD_KEY=your_iex_cloud_key

# LLM
OPENAI_API_KEY=your_openai_key

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_token

# App
ENVIRONMENT=development
LOG_LEVEL=INFO
```

Bu implementation blueprint'i kullanarak tam bir yatırım analiz sistemi kurabilirsiniz!
