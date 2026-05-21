from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from core.config import settings
from db.session import engine
from routers.auth import router as auth_router
from routers.inventory_boxes import router as inventory_boxes_router
from routers.media import router as media_router
from routers.products import router as products_router
from routers.files import router as files_router
from routers.production_plans import router as production_plans_router
from routers.reports import router as reports_router
from routers.snapshots import router as snapshots_router


def check_db_connection() -> bool:
    """Check if database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except OperationalError:
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(products_router)
app.include_router(inventory_boxes_router)
app.include_router(files_router)
app.include_router(media_router)
app.include_router(snapshots_router)
app.include_router(production_plans_router)
app.include_router(reports_router)

uploads_dir = Path(__file__).resolve().parent / "storage" / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    """Health check endpoint for container orchestration."""
    db_healthy = check_db_connection()
    return {
        "status": "healthy" if db_healthy else "degraded",
        "database": "connected" if db_healthy else "disconnected",
    }


@app.get("/")
def root():
    """Root endpoint."""
    return {"message": settings.PROJECT_NAME, "version": settings.VERSION}
