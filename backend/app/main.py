from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import triage, override
from .config import settings

# Create all database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PatientTriage.ai API",
    version="1.0.0",
    description="AI-powered Emergency Department Triage System using LightGBM ordinal regression."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for hackathon demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(triage.router)
app.include_router(override.router)

@app.get("/")
def root():
    return {
        "message": "PatientTriage.ai API is running.",
        "docs": "/docs",
        "surge_mode": settings.SURGE_MODE
    }

@app.post("/surge/toggle")
def toggle_surge():
    """Toggle surge mode on/off. In surge mode, patients are auto-escalated if they wait too long."""
    settings.SURGE_MODE = not settings.SURGE_MODE
    return {
        "surge_mode": settings.SURGE_MODE,
        "message": f"Surge mode {'ACTIVATED' if settings.SURGE_MODE else 'DEACTIVATED'}"
    }
