from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from .database import init_db
from .api import router

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_ROOT / "frontend"

@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv('VERCEL', '').lower() == '1' and not os.getenv('JWT_SECRET', '').strip():
        raise RuntimeError('JWT_SECRET is required in Vercel Project Environment Variables.')
    init_db()
    yield

app = FastAPI(
    title="Baki Khata API",
    description="Bangla-first, tenant-scoped digital credit ledger API",
    version="0.1.0",
    lifespan=lifespan,
)
app.include_router(router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "bakikhata-api", "version": app.version}

@app.get("/api")
def api_root():
    return {"message": "Baki Khata API is running", "docs": "/docs", "health": "/health"}

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
