from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Inventory Core API"
    VERSION: str = "0.1.0"
    SECRET_KEY: str  # No default — must be set in .env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEFAULT_ADMIN_USERNAME: str | None = None
    DEFAULT_ADMIN_PASSWORD: str | None = None

    # Database — individual parts, URL constructed via property
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "inventory"

    # CORS — comma-separated origins
    CORS_ORIGINS: str = "http://localhost:3000"

    # Drone service
    DRONE_HOST: str = "192.168.1.1"
    DRONE_RTSP_PORT: int = 7070
    DRONE_RTSP_URL: str = "rtsp://192.168.1.1:7070/webcam"
    DRONE_CLIENT_PORT_BASE: int | None = None
    DRONE_VERBOSE_RTSP: bool = False
    DRONE_SPEED: int = 30
    DRONE_AXIS_DELTA: int = 90
    DRONE_HOVER_THROTTLE: int = 128
    DRONE_TRIM_AIL: int = 164
    DRONE_TRIM_ELE: int = 128
    DRONE_TRIM_RUDD: int = 128
    DRONE_SEND_INTERVAL: float = 0.04
    DRONE_STREAM_TOKEN_TTL_SECONDS: int = 180

    # Vision service
    VISION_SERVICE_URL: str = "http://vision:8001"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    model_config = SettingsConfigDict(
        env_file="../../.env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
