import os
from pathlib import Path
from dotenv import load_dotenv

# Search for .env in the backend directory or project root
_backend_dir = Path(__file__).resolve().parent.parent
_env_file = _backend_dir / ".env"

if _env_file.exists():
    load_dotenv(dotenv_path=_env_file)
else:
    load_dotenv()


class Settings:
    """Application and database settings."""
    PROJECT_NAME: str = "Diabetes Readmission Intervention Queue"
    VERSION: str = "1.0.0"

    # PostgreSQL configuration
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_NAME: str = os.getenv("DB_NAME", "fde_db")
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "admin")

    # Allowed CORS origins
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ]

    @property
    def db_config(self) -> dict[str, str | int]:
        """Dictionary unpacked into psycopg2.connect(**settings.db_config)."""
        return {
            "host": self.DB_HOST,
            "port": self.DB_PORT,
            "database": self.DB_NAME,
            "user": self.DB_USER,
            "password": self.DB_PASSWORD,
        }


settings = Settings()
