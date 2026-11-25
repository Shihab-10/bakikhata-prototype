from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from .database import init_db, IS_VERCEL, CLOUD_DATABASE_ENABLED
from .api import router

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
LOCAL_ONLY_DEPLOY = IS_VERCEL and not CLOUD_DATABASE_ENABLED

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.local_only_mode = LOCAL_ONLY_DEPLOY
    if not LOCAL_ONLY_DEPLOY:
        if IS_VERCEL and not os.getenv("JWT_SECRET", "").strip():
            raise RuntimeError("JWT_SECRET is required when cloud database mode is enabled.")
        init_db()
    yield

app = FastAPI(
    title="Baki Khata API",
    description="Bangla-first, tenant-scoped digital credit ledger API",
    version="0.1.0",
    lifespan=lifespan,
)

@app.middleware("http")
async def local_only_api_guard(request: Request, call_next):
    if LOCAL_ONLY_DEPLOY and request.url.path.startswith("/api/v1/"):
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Cloud API is disabled in Local Account Mode. "
                          "Use the browser-local account and ledger features."
            },
        )
    return await call_next(request)

app.include_router(router)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "bakikhata-api",
        "version": app.version,
        "mode": "local-only" if LOCAL_ONLY_DEPLOY else "server-database",
    }

@app.get("/api")
def api_root():
    return {
        "message": "Baki Khata API is running",
        "mode": "local-only" if LOCAL_ONLY_DEPLOY else "server-database",
        "docs": "/docs",
        "health": "/health",
    }

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")