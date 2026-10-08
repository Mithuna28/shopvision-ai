import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.config import HOST, PORT, DEBUG, DEVICE, DEVICE_NAME, UPLOADS_DIR, CROPS_DIR, EXPORTS_DIR
from backend.api.upload import router as upload_router
from backend.api.analysis import router as analysis_router
from backend.api.products import router as products_router

# Setup logging
logging.basicConfig(
    level=logging.INFO if DEBUG else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("shopvision")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("🚀 SHOPVISION AI Backend Initializing...")
    logger.info(f"⚡ Hardware Acceleration: {DEVICE.upper()} ({DEVICE_NAME})")
    logger.info("=" * 60)
    yield
    logger.info("SHOPVISION AI Backend Shutting Down.")

app = FastAPI(
    title="SHOPVISION AI API",
    description="AI Shoppable Video Platform — Product Detection, Tracking & Dynamic Overlays",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(upload_router)
app.include_router(analysis_router)
app.include_router(products_router)

@app.get("/")
async def root():
    return {
        "app": "SHOPVISION AI",
        "version": "1.0.0",
        "status": "online",
        "device": DEVICE,
        "device_name": DEVICE_NAME,
        "endpoints": {
            "upload": "POST /api/upload",
            "analyze": "POST /api/analyze",
            "status": "GET /api/status/{job_id}",
            "products": "GET /api/products/{job_id}",
            "overlays": "GET /api/overlays/{job_id}",
            "video_stream": "GET /api/video/{job_id}",
            "export": "POST /api/export/{job_id}",
            "demos": "GET /api/demos"
        }
    }

@app.get("/api/health")
async def health_check():
    from backend.db.database import db
    db_connected = db.check_connection()
    return {
        "status": "healthy",
        "database": "connected" if db_connected else "disconnected",
        "hardware": {
            "device": DEVICE,
            "device_name": DEVICE_NAME
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host=HOST, port=PORT, reload=DEBUG)
