import os
import uuid
import shutil
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from backend.config import UPLOADS_DIR, ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_MB
from backend.db.database import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Upload"])

@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    Uploads a video file, validates format and size, and assigns a unique job_id.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    job_id = f"job_{uuid.uuid4().hex[:10]}"
    saved_filename = f"{job_id}{ext}"
    saved_path = UPLOADS_DIR / saved_filename

    # Save file to disk
    try:
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save uploaded video: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    file_size_mb = os.path.getsize(saved_path) / (1024 * 1024)
    if file_size_mb > MAX_UPLOAD_SIZE_MB:
        os.remove(saved_path)
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of {MAX_UPLOAD_SIZE_MB}MB (Uploaded: {file_size_mb:.1f}MB)"
        )

    # Register initial job in DB
    job_data = {
        "job_id": job_id,
        "original_filename": file.filename,
        "saved_filename": saved_filename,
        "video_path": str(saved_path),
        "file_size_mb": round(file_size_mb, 2),
        "status": "uploaded",
        "progress": 5,
        "message": "Video uploaded successfully. Ready for AI analysis."
    }
    db.save_job(job_data)

    return {
        "success": True,
        "job_id": job_id,
        "filename": file.filename,
        "size_mb": round(file_size_mb, 2),
        "status": "uploaded",
        "video_url": f"/api/video/{job_id}"
    }

@router.post("/demos/{demo_id}/load")
async def load_demo_video(demo_id: str):
    """
    Generates/loads a preset demo video and creates a job ready for AI analysis.
    """
    from backend.video.demo_generator import generate_demo_video

    scenario = "sneaker"
    if "dual" in demo_id:
        scenario = "tech_accessories"
    elif "streetwear" in demo_id:
        scenario = "lifestyle"

    demo_video_path = generate_demo_video(scenario)
    job_id = f"job_demo_{scenario}_{uuid.uuid4().hex[:6]}"
    
    file_size_mb = os.path.getsize(demo_video_path) / (1024 * 1024)

    # Register initial job in DB
    job_data = {
        "job_id": job_id,
        "original_filename": f"demo_{scenario}.mp4",
        "saved_filename": f"demo_{scenario}.mp4",
        "video_path": demo_video_path,
        "file_size_mb": round(file_size_mb, 2),
        "status": "uploaded",
        "progress": 5,
        "message": f"Demo video ({scenario}) loaded. Ready for AI analysis."
    }
    db.save_job(job_data)

    return {
        "success": True,
        "job_id": job_id,
        "filename": f"demo_{scenario}.mp4",
        "size_mb": round(file_size_mb, 2),
        "status": "uploaded",
        "video_url": f"/api/video/{job_id}"
    }

