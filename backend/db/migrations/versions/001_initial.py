"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('assets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('type', sa.String(20), nullable=True),
        sa.Column('exchange', sa.String(20), nullable=True),
        sa.Column('sector', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('symbol')
    )
    op.create_index('ix_assets_symbol', 'assets', ['symbol'])

    op.create_table('news',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('asset_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('url', sa.Text(), nullable=True),
        sa.Column('published_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('processed_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('sentiment_score', sa.Numeric(4, 3), nullable=True),
        sa.Column('sentiment_label', sa.String(20), nullable=True),
        sa.Column('importance', sa.String(20), nullable=True),
        sa.Column('categories', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('summary_tr', sa.Text(), nullable=True),
        sa.Column('raw_content', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('url')
    )
    op.create_index('ix_news_published_at', 'news', ['published_at'])

    op.create_table('technical_analysis',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('asset_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('analyzed_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('price_data', postgresql.JSONB(), nullable=True),
        sa.Column('indicators', postgresql.JSONB(), nullable=True),
        sa.Column('levels', postgresql.JSONB(), nullable=True),
        sa.Column('trend', postgresql.JSONB(), nullable=True),
        sa.Column('signal', sa.String(20), nullable=True),
        sa.Column('confidence', sa.Numeric(4, 3), nullable=True),
        sa.Column('interpretation_tr', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_technical_asset_time', 'technical_analysis', ['asset_id', 'analyzed_at'])

    op.create_table('sentiment_analysis',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('asset_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('analyzed_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('window_start', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('window_end', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('overall_score', sa.Numeric(4, 3), nullable=True),
        sa.Column('bullish_pct', sa.Integer(), nullable=True),
        sa.Column('bearish_pct', sa.Integer(), nullable=True),
        sa.Column('neutral_pct', sa.Integer(), nullable=True),
        sa.Column('total_mentions', sa.Integer(), nullable=True),
        sa.Column('top_comments', postgresql.JSONB(), nullable=True),
        sa.Column('trending_keywords', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id']),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('consolidated_analysis',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('asset_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('generated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('composite_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('overall_sentiment', sa.String(30), nullable=True),
        sa.Column('scores', postgresql.JSONB(), nullable=True),
        sa.Column('key_points', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('risk_factors', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('summary_tr', sa.Text(), nullable=True),
        sa.Column('notification_sent', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_consolidated_asset_time', 'consolidated_analysis', ['asset_id', 'generated_at'])

    op.create_table('user_watchlist',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('telegram_chat_id', sa.BigInteger(), nullable=False),
        sa.Column('asset_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notify_level', sa.String(20), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('telegram_chat_id', 'asset_id')
    )
    op.create_index('ix_watchlist_chat', 'user_watchlist', ['telegram_chat_id'])

    op.create_table('notification_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chat_id', sa.BigInteger(), nullable=False),
        sa.Column('asset_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('analysis_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('sent_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('notification_type', sa.String(20), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id']),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('notification_history')
    op.drop_table('user_watchlist')
    op.drop_table('consolidated_analysis')
    op.drop_table('sentiment_analysis')
    op.drop_table('technical_analysis')
    op.drop_table('news')
    op.drop_table('assets')
