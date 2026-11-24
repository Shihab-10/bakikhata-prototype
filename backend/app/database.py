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

# Vercel Marketplace PostgreSQL integrations may expose DATABASE_URL or POSTGRES_URL.
# DATABASE_URL takes priority; POSTGRES_URL is supported as a fallback.
RAW_DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("POSTGRES_URL")
    or os.getenv("POSTGRES_PRISMA_URL")
    or ""
).strip()

if RAW_DATABASE_URL:
    DATABASE_URL = RAW_DATABASE_URL
elif IS_VERCEL:
    # Allows build-time module import; init_db() refuses to run without persistent PostgreSQL.
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
    # Keep a small pool for serverless function instances and use TLS settings from the provider URL.
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
    if IS_VERCEL and DATABASE_URL.startswith("sqlite"):
        raise RuntimeError(
            "BakiKhata production requires persistent PostgreSQL. "
            "Connect Neon/Supabase and set DATABASE_URL or POSTGRES_URL in Vercel."
        )
    from . import models  # noqa: F401 - register models before create_all
    Base.metadata.create_all(bind=engine)
