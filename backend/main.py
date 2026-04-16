"""FastAPI application entry point."""

import os
import sys
import traceback

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from database import Base, engine
    from routers import auth, reconciliation, reports

    # Create tables
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully", flush=True)
except Exception as e:
    print(f"STARTUP ERROR: {e}", flush=True)
    traceback.print_exc()
    sys.exit(1)

app = FastAPI(
    title="Conciliacao Philips-Stankhelp API",
    version="1.0.0",
)

# CORS - allow frontend origins
allowed_origins = [
    "http://localhost:3000",
]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(reconciliation.router)
app.include_router(reports.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
