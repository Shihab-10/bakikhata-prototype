from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BASE_DIR.parent
load_dotenv(BASE_DIR / ".env")

IS_VERCEL = os.getenv("VERCEL", "").lower() == "1"
CLOUD_DATABASE_ENABLED = os.getenv("BK_ENABLE_CLOUD_DATABASE", "").strip().lower() in {"1", "true", "yes"}

# Local-only mode is the default on Vercel. Existing DATABASE_URL/POSTGRES_URL
# values are deliberately ignored until BK_ENABLE_CLOUD_DATABASE=1 is enabled.
if IS_VERCEL and not CLOUD_DATABASE_ENABLED:
    DATABASE_URL = "sqlite://"
else:
    RAW_DATABASE_URL = (
        os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_PRISMA_URL")
        or ""
    ).strip()

    if RAW_DATABASE_URL:
        DATABASE_URL = RAW_DATABASE_URL
    elif IS_VERCEL:
        DATABASE_URL = "sqlite://"
    else:
        DATABASE_URL = "sqlite:///./data/bakikhata.db"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

if DATABASE_URL.startswith("sqlite:///./"):
    db_path = BASE_DIR / DATABASE_URL.replace("sqlite:///./", "", 1)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{db_path.as_posix()}"

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine_options = {"pool_pre_ping": True}

if DATABASE_URL.startswith("postgresql+psycopg://"):
    engine_options.update({
        "pool_size": 1,
        "max_overflow": 0,
        "pool_recycle": 300,
        "connect_args": {"connect_timeout": 10},
    })

engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_options)

if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    if IS_VERCEL and not CLOUD_DATABASE_ENABLED:
        raise RuntimeError("Server database is disabled in local-only deployment.")
    if IS_VERCEL and DATABASE_URL.startswith("sqlite"):
        raise RuntimeError(
            "Cloud database mode requires persistent PostgreSQL. "
            "Set BK_ENABLE_CLOUD_DATABASE=1 and DATABASE_URL when enabling cloud mode."
        )
    from . import models  # noqa: F401 - register models before create_all
    Base.metadata.create_all(bind=engine)