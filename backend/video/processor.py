import os
import cv2
import numpy as np
import logging
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from backend.config import FRAMES_DIR, CROPS_DIR, UPLOADS_DIR
from backend.db.database import db
from backend.video.frame_extractor import frame_extractor
from backend.ai.yolo_detector import yolo_detector
from backend.ai.sam_tracker import SAMTracker
from backend.ai.product_analyzer import product_analyzer
from backend.ai.clip_matcher import clip_matcher
from backend.search.product_search import product_search_engine
from backend.video.overlay_data import overlay_data_generator

logger = logging.getLogger(__name__)

class VideoAnalysisProcessor:
    """
    Complete Asynchronous AI Shoppable Video Pipeline Orchestrator.
    Executes the 7-stage detection, tracking, VLM analysis, CLIP visual matching,
    and interactive overlay generation flow.
    """
    def __init__(self):
        pass

    async def process_video_job(self, job_id: str, video_path: str, options: Optional[Dict[str, Any]] = None):
        """
        Executes analysis pipeline in background.
        """
        options = options or {}
        sample_fps = options.get("sample_fps", 8.0)  # 8-10 fps sampling for rapid high-res inference

        try:
            # Stage 1: Extract Video Metadata & Thumbnail
            self._update_job_status(job_id, "extracting_frames", "Extracting video metadata & keyframes...", 15)
            video_meta = frame_extractor.get_video_metadata(video_path)
            thumb_path = str(FRAMES_DIR / f"{job_id}_thumb.jpg")
            frame_extractor.generate_thumbnail(video_path, thumb_path)
            video_meta["thumbnail_path"] = thumb_path
            db.save_video({"video_id": job_id, **video_meta})

            # Stage 2: YOLO11 Object Detection & SAM 2 Spatio-Temporal Tracking
            self._update_job_status(job_id, "detecting_products", "Running YOLO11 object detection on frames...", 30)
            tracker = SAMTracker()
            
            frame_count = 0
            for frame_idx, timestamp, frame in frame_extractor.extract_frames_sampled(video_path, sample_fps=sample_fps):
                frame_count += 1
                # Run YOLO detector
                detections = yolo_detector.detect_frame(frame, frame_idx=frame_idx, timestamp=timestamp, conf_threshold=0.25)
                # Update SAM tracker
                tracker.update_tracks(frame, detections, frame_idx=frame_idx, timestamp=timestamp)

                # Progress updates during detection
                if frame_count % 15 == 0:
                    pct = min(55, 30 + int((timestamp / max(1.0, video_meta["duration_seconds"])) * 25))
                    self._update_job_status(job_id, "tracking_products", f"Tracking candidate products across frames ({timestamp:.1f}s)...", pct)
                
                await asyncio.sleep(0.001)

            # Finalize completed tracks
            raw_tracks = tracker.finalize()
            logger.info(f"Video {job_id}: Found {len(raw_tracks)} candidate product tracks.")

            if not raw_tracks:
                # Handle no products scenario gracefully
                self._update_job_status(job_id, "completed", "No recognizable shopping products detected in this video.", 100, is_success=True)
                db.save_products(job_id, [])
                db.save_overlay_tracks(job_id, overlay_data_generator.generate_timeline_overlay_data([], video_meta))
                return

            # Stage 3: Best Frame Selection & Vision-Language Product Analysis
            self._update_job_status(job_id, "identifying_brands", "Analyzing best product crops for brands & attributes...", 65)
            
            analyzed_products = []
            for i, track in enumerate(raw_tracks):
                track_id = track["track_id"]
                prod_id = f"p{track_id}"
                cat = track.get("category", "Unknown")
                cname = track.get("class_name", cat)
                best_info = track.get("best_frame_info")

                crop_img = None
                crop_filename = None
                if best_info and best_info.get("crop_img") is not None:
                    # Deep copy track-specific crop to guarantee isolation
                    crop_img = best_info["crop_img"].copy()
                    crop_filename = f"{job_id}_track_{track_id}.jpg"
                    crop_save_path = CROPS_DIR / crop_filename
                    cv2.imwrite(str(crop_save_path), crop_img, [cv2.IMWRITE_JPEG_QUALITY, 95])

                # Run Vision-Language Product Analysis per track
                avg_conf = float(np.mean(track["confidences"])) if track["confidences"] else 0.85
                vlm_res = product_analyzer.analyze_product_crop(crop_img, cat, avg_conf)

                # Save best frame timestamp
                best_ts = best_info["timestamp"] if best_info else track["first_seen"]

                crop_url = f"/api/crops/{crop_filename}" if crop_filename else None

                analyzed_products.append({
                    "id": prod_id,
                    "track_id": track_id,
                    "category": vlm_res["category"],
                    "class_name": cname,
                    "brand": vlm_res["brand"],
                    "brand_status": vlm_res["brand_status"],
                    "color": vlm_res["color"],
                    "product_type": vlm_res["product_type"],
                    "visible_logo": vlm_res["visible_logo"],
                    "possible_model": vlm_res["possible_model"],
                    "visual_attributes": vlm_res["visual_attributes"],
                    "confidence": vlm_res["confidence"],
                    "crop_image": crop_url,
                    "crop_img_array": crop_img,
                    "best_timestamp": round(best_ts, 2),
                    "timestamp_start": round(track["first_seen"], 2),
                    "timestamp_end": round(track["last_seen"], 2),
                    "track": track["trajectory"]
                })

            # Stage 4: CLIP Visual Matching & Multi-Store Shopping Search
            self._update_job_status(job_id, "finding_products", "Running CLIP visual matching & multi-store search...", 80)
            
            final_products = []
            for prod in analyzed_products:
                crop_arr = prod.pop("crop_img_array", None)
                
                # Compute CLIP visual similarity scores against verified catalog
                visual_sim_scores = {}
                if crop_arr is not None and prod["category"].lower() not in ("unknown", "none", "object"):
                    visual_sim_scores = clip_matcher.match_crop_against_catalog(crop_arr, product_search_engine.catalog)

                # Search verified product catalog
                shopping_matches = []
                if prod["category"].lower() not in ("unknown", "none", "object"):
                    shopping_matches = product_search_engine.search_products(
                        category=prod["category"],
                        brand=prod["brand"],
                        product_type=prod["product_type"],
                        color=prod["color"],
                        model=prod["possible_model"],
                        attributes=prod["visual_attributes"],
                        visual_similarity_scores=visual_sim_scores,
                        top_k=4
                    )

                if shopping_matches:
                    best_match = shopping_matches[0]
                    prod["has_catalog_match"] = True
                    prod["title"] = best_match["title"]
                    prod["brand"] = best_match.get("brand") or prod.get("brand") or "Unknown"
                    prod["base_price"] = best_match["base_price"]
                    prod["currency"] = best_match["currency"]
                    prod["currency_symbol"] = best_match["currency_symbol"]
                    prod["rating"] = best_match["rating"]
                    prod["reviews_count"] = best_match["reviews_count"]
                    prod["catalog_image"] = best_match["image_url"]
                    prod["visual_similarity_score"] = best_match["visual_similarity_score"]
                    prod["similarity_label"] = best_match["similarity_label"]
                    prod["stores"] = best_match["stores"]
                    prod["primary_store"] = best_match["primary_store"]
                    prod["all_matches"] = shopping_matches
                else:
                    # Fallback unverified item (Strictly never hallucinate fake price/url)
                    prod["has_catalog_match"] = False
                    brand_val = prod.get("brand")
                    if not brand_val or str(brand_val).lower() in ["unknown", "none", "unbranded", "null"]:
                        prod["brand"] = "Unknown"
                        if prod["category"] == "Unknown":
                            prod["title"] = "Detected Object"
                        else:
                            prod["title"] = f"Detected {prod['product_type'].title()}"
                    else:
                        prod["title"] = f"{brand_val} {prod['product_type'].title()}"
                    prod["base_price"] = None
                    prod["currency"] = "INR"
                    prod["currency_symbol"] = "₹"
                    prod["rating"] = None
                    prod["reviews_count"] = None
                    # Use the track-specific crop image for unverified items
                    prod["catalog_image"] = prod["crop_image"]
                    prod["visual_similarity_score"] = None
                    prod["similarity_label"] = "No verified catalog match"
                    prod["stores"] = []
                    prod["primary_store"] = None
                    prod["all_matches"] = []

                final_products.append(prod)

            # Stage 5: Generate Synchronized Responsive Overlays
            self._update_job_status(job_id, "generating_overlays", "Computing collision-free responsive overlay tracks...", 95)
            overlay_data = overlay_data_generator.generate_timeline_overlay_data(final_products, video_meta)

            # Stage 6: Save Results & Complete
            db.save_products(job_id, final_products)
            db.save_overlay_tracks(job_id, overlay_data)
            
            self._update_job_status(job_id, "completed", "Analysis complete! Ready for interactive shopping.", 100, is_success=True)
            logger.info(f"Video job {job_id} successfully completed with {len(final_products)} verified products.")

        except Exception as e:
            logger.exception(f"Error processing video job {job_id}: {e}")
            self._update_job_status(job_id, "failed", f"Processing error: {str(e)}", 0, is_success=False)

    def _update_job_status(self, job_id: str, stage: str, message: str, progress: int, is_success: Optional[bool] = None):
        job_data = db.get_job(job_id) or {"job_id": job_id}
        job_data["status"] = stage
        job_data["message"] = message
        job_data["progress"] = progress
        if is_success is not None:
            job_data["success"] = is_success
        db.save_job(job_data)

video_processor = VideoAnalysisProcessor()
