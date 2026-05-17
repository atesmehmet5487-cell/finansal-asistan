from datetime import datetime
from sqlalchemy import String, Text, Numeric, Integer, Boolean, ARRAY, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import TIMESTAMP as TIMESTAMPTZ
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
import uuid
from db.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(20))   # stock | commodity | crypto | currency
    exchange: Mapped[str] = mapped_column(String(20))  # BIST | NASDAQ | COMEX
    sector: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, server_default=func.now())


class News(Base):
    __tablename__ = "news"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_ids: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(String(100))
    url: Mapped[str | None] = mapped_column(Text, unique=True)
    published_at: Mapped[datetime | None] = mapped_column(TIMESTAMPTZ)
    processed_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, server_default=func.now())
    sentiment_score: Mapped[float | None] = mapped_column(Numeric(4, 3))
    sentiment_label: Mapped[str | None] = mapped_column(String(20))
    importance: Mapped[str | None] = mapped_column(String(20))
    categories: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    summary_tr: Mapped[str | None] = mapped_column(Text)
    raw_content: Mapped[str | None] = mapped_column(Text)


class TechnicalAnalysis(Base):
    __tablename__ = "technical_analysis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"), index=True)
    analyzed_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, server_default=func.now(), index=True)
    price_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    indicators: Mapped[dict] = mapped_column(JSONB, default=dict)
    levels: Mapped[dict] = mapped_column(JSONB, default=dict)
    trend: Mapped[dict] = mapped_column(JSONB, default=dict)
    signal: Mapped[str | None] = mapped_column(String(20))
    confidence: Mapped[float | None] = mapped_column(Numeric(4, 3))
    interpretation_tr: Mapped[str | None] = mapped_column(Text)

    asset: Mapped["Asset"] = relationship("Asset")


class SentimentAnalysis(Base):
    __tablename__ = "sentiment_analysis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"), index=True)
    analyzed_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, server_default=func.now(), index=True)
    window_start: Mapped[datetime | None] = mapped_column(TIMESTAMPTZ)
    window_end: Mapped[datetime | None] = mapped_column(TIMESTAMPTZ)
    overall_score: Mapped[float | None] = mapped_column(Numeric(4, 3))
    bullish_pct: Mapped[int | None] = mapped_column(Integer)
    bearish_pct: Mapped[int | None] = mapped_column(Integer)
    neutral_pct: Mapped[int | None] = mapped_column(Integer)
    total_mentions: Mapped[int | None] = mapped_column(Integer)
    top_comments: Mapped[list] = mapped_column(JSONB, default=list)
    trending_keywords: Mapped[list] = mapped_column(ARRAY(Text), default=list)

    asset: Mapped["Asset"] = relationship("Asset")


class ConsolidatedAnalysis(Base):
    __tablename__ = "consolidated_analysis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"), index=True)
    generated_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, server_default=func.now(), index=True)
    composite_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    overall_sentiment: Mapped[str | None] = mapped_column(String(30))
    scores: Mapped[dict] = mapped_column(JSONB, default=dict)
    key_points: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    risk_factors: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    summary_tr: Mapped[str | None] = mapped_column(Text)
    notification_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    asset: Mapped["Asset"] = relationship("Asset")


class UserWatchlist(Base):
    __tablename__ = "user_watchlist"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    telegram_chat_id: Mapped[int] = mapped_column(nullable=False, index=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    notify_level: Mapped[str] = mapped_column(String(20), default="HIGH")  # CRITICAL|HIGH|MEDIUM|ALL
    created_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, server_default=func.now())

    asset: Mapped["Asset"] = relationship("Asset")


class NotificationHistory(Base):
    __tablename__ = "notification_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id: Mapped[int] = mapped_column(nullable=False)
    asset_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    analysis_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    sent_at: Mapped[datetime] = mapped_column(TIMESTAMPTZ, server_default=func.now())
    message: Mapped[str | None] = mapped_column(Text)
    notification_type: Mapped[str | None] = mapped_column(String(20))
