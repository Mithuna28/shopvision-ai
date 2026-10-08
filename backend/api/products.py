import os
import re
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, Response, Header
from fastapi.responses import FileResponse, StreamingResponse
from typing import Optional

from backend.db.database import db
from backend.config import UPLOADS_DIR, CROPS_DIR, FRAMES_DIR, DEMOS_DIR

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Products & Media"])

@router.get("/products/{job_id}")
async def get_job_products(job_id: str):
    """
    Returns verified detected products, brand status, visual attributes, similarity scores,
    and multi-store shopping matches.
    """
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    products = db.get_products(job_id)
    return {
        "job_id": job_id,
        "total_products": len(products),
        "products": products
    }

@router.get("/overlays/{job_id}")
async def get_job_overlays(job_id: str):
    """
    Returns time-synchronized object tracking coordinates and collision-free card layouts.
    """
    overlays = db.get_overlay_tracks(job_id)
    if not overlays:
        raise HTTPException(status_code=404, detail="Overlay tracking data not found.")

    return overlays

@router.get("/video/{job_id}")
async def stream_video(job_id: str, request: Request, range: Optional[str] = Header(None)):
    """
    Streams video with HTTP 206 Partial Content range requests for smooth seeking in HTML5 video player.
    """
    job = db.get_job(job_id)
    if not job or "video_path" not in job:
        raise HTTPException(status_code=404, detail="Video not found.")

    video_path = Path(job["video_path"])
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file missing on disk.")

    file_size = os.path.getsize(video_path)
    
    # Range header parsing for video seeking
    if range:
        range_match = re.match(r"bytes=(\d+)-(\d*)", range)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
            start = min(start, file_size - 1)
            end = min(end, file_size - 1)
            content_length = (end - start) + 1

            def iterfile():
                with open(video_path, mode="rb") as file_like:
                    file_like.seek(start)
                    bytes_left = content_length
                    while bytes_left > 0:
                        chunk_size = min(64 * 1024, bytes_left)
                        data = file_like.read(chunk_size)
                        if not data:
                            break
                        bytes_left -= len(data)
                        yield data

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": "video/mp4",
            }
            return StreamingResponse(iterfile(), status_code=206, headers=headers)

    return FileResponse(path=str(video_path), media_type="video/mp4")

@router.get("/crops/{filename}")
async def get_crop_image(filename: str):
    """
    Serves cropped product image.
    """
    crop_path = CROPS_DIR / filename
    if not crop_path.exists():
        raise HTTPException(status_code=404, detail="Crop image not found.")
    return FileResponse(path=str(crop_path), media_type="image/jpeg")

@router.get("/demos")
async def get_demo_scenarios():
    """
    Returns built-in high-quality test scenarios for instant 1-click testing.
    """
    return {
        "demos": [
            {
                "id": "demo_nike_sneaker",
                "title": "Nike Sneaker Walk & Movement",
                "category": "shoe",
                "description": "Moving Nike sneaker across frame with dynamic lateral motion tracking.",
                "duration": "8.5s",
                "products_count": 1,
                "preview_image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
                "preset_video_type": "sneaker"
            },
            {
                "id": "demo_dual_products",
                "title": "Dual Product: Apple Watch & Headphones",
                "category": "watch_headphones",
                "description": "Simultaneous tracking of smartwatch and audio headphones with collision avoidance.",
                "duration": "10.2s",
                "products_count": 2,
                "preview_image": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
                "preset_video_type": "tech_accessories"
            },
            {
                "id": "demo_streetwear_fit",
                "title": "Urban Streetwear: Backpack & Shades",
                "category": "streetwear",
                "description": "Multi-product outfit showcase with Herschel backpack and Ray-Ban sunglasses.",
                "duration": "9.0s",
                "products_count": 2,
                "preview_image": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80",
                "preset_video_type": "lifestyle"
            }
        ]
    }
