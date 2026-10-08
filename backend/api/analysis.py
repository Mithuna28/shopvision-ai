import asyncio
import json
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any

from backend.db.database import db
from backend.video.processor import video_processor
from backend.video.exporter import video_exporter
from backend.config import EXPORTS_DIR

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Analysis"])

class AnalyzeRequest(BaseModel):
    job_id: str
    sample_fps: Optional[float] = 8.0

@router.post("/analyze")
async def start_analysis(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Triggers asynchronous AI shoppable video detection & tracking pipeline.
    """
    job = db.get_job(req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    video_path = job.get("video_path")
    if not video_path or not Path(video_path).exists():
        raise HTTPException(status_code=400, detail="Video file not found on server.")

    # Update job state
    job["status"] = "queued"
    job["progress"] = 10
    job["message"] = "Analysis queued..."
    db.save_job(job)

    # Launch background task
    background_tasks.add_task(
        video_processor.process_video_job,
        job_id=req.job_id,
        video_path=video_path,
        options={"sample_fps": req.sample_fps}
    )

    return {
        "success": True,
        "job_id": req.job_id,
        "status": "queued",
        "message": "AI analysis started in background."
    }

@router.get("/status/{job_id}")
async def get_job_status(job_id: str):
    """
    Returns current processing status, stage, progress percentage, and real message.
    """
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    return {
        "job_id": job_id,
        "status": job.get("status", "unknown"),
        "progress": job.get("progress", 0),
        "message": job.get("message", ""),
        "success": job.get("success", None),
        "updated_at": job.get("updated_at")
    }

@router.get("/status/{job_id}/stream")
async def stream_job_status(job_id: str):
    """
    Server-Sent Events (SSE) stream for real-time progress updates without polling.
    """
    async def event_generator():
        last_status = None
        last_progress = None

        while True:
            job = db.get_job(job_id)
            if not job:
                yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                break

            status = job.get("status")
            progress = job.get("progress", 0)
            message = job.get("message", "")

            # Send update if state changed
            if status != last_status or progress != last_progress:
                last_status = status
                last_progress = progress
                payload = {
                    "job_id": job_id,
                    "status": status,
                    "progress": progress,
                    "message": message,
                    "success": job.get("success")
                }
                yield f"data: {json.dumps(payload)}\n\n"

            if status in ("completed", "failed"):
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/export/{job_id}")
async def export_video(job_id: str):
    """
    Generates burned-in MP4 export with overlays rendered into the video.
    """
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    video_path = job.get("video_path")
    if not video_path or not Path(video_path).exists():
        raise HTTPException(status_code=400, detail="Video file not found.")

    overlay_data = db.get_overlay_tracks(job_id)
    products = db.get_products(job_id)
    if not overlay_data:
        raise HTTPException(status_code=400, detail="No overlay data available for export.")

    products_map = {p["id"]: p for p in products}
    export_filename = f"export_{job_id}.mp4"
    export_path = str(EXPORTS_DIR / export_filename)

    # Render exported MP4
    success = video_exporter.render_exported_video(
        input_video_path=video_path,
        output_video_path=export_path,
        overlay_data=overlay_data,
        products_map=products_map
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to render exported video.")

    return {
        "success": True,
        "job_id": job_id,
        "export_url": f"/api/export/{job_id}/download",
        "export_filename": export_filename
    }

@router.get("/export/{job_id}/download")
async def download_exported_video(job_id: str):
    """
    Downloads rendered MP4 video.
    """
    export_filename = f"export_{job_id}.mp4"
    export_path = EXPORTS_DIR / export_filename
    if not export_path.exists():
        raise HTTPException(status_code=404, detail="Exported video file not ready.")

    return FileResponse(
        path=str(export_path),
        media_type="video/mp4",
        filename=f"shopvision_{job_id}.mp4"
    )
