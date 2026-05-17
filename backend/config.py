from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # AI
    gemini_api_key: str

    # Haber
    news_api_key: str = ""
    alpha_vantage_key: str = ""

    # Sosyal Medya
    twitter_bearer_token: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_user_agent: str = "FinansalAsistan/1.0"

    # Telegram
    telegram_bot_token: str

    # TCMB EVDS
    tcmb_evds_key: str = ""
    tcmb_evds_url: str = "https://evds2.tcmb.gov.tr/service/evds"

    # Google Takvim (gizli iCal URL)
    google_calendar_ical_url: str = ""

    # Piyasa
    metals_api_key: str = ""

    # Veritabanı
    database_url: str = ""
    supabase_url: str = ""
    redis_url: str

    @property
    def db_url(self) -> str:
        # SUPABASE_URL öncelikli, yoksa DATABASE_URL kullan
        url = self.supabase_url or self.database_url
        if "pooler.supabase.com" in url:
            # aws-X-REGION.pooler.supabase.com → db.PROJECT.supabase.co
            import re
            m = re.search(r"postgres\.([a-z]+):", url)
            if m:
                project = m.group(1)
                url = re.sub(
                    r"@[^/]+\.pooler\.supabase\.com:\d+",
                    f"@db.{project}.supabase.co:5432",
                    url,
                )
                # asyncpg direkt bağlantıda user postgres olmalı
                url = url.replace(f"postgres.{project}:", "postgres:")
        return url

    # Uygulama
    app_env: str = "development"
    app_secret_key: str = "change_me"
    frontend_url: str = "http://localhost:3000"

    @property
    def is_dev(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
