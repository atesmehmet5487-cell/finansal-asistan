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

    # Piyasa
    metals_api_key: str = ""

    # Veritabanı
    database_url: str
    redis_url: str

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
