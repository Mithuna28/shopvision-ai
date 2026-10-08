import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from supabase import create_client, Client
from backend.config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    Unified database manager for SHOPVISION AI powered by Supabase PostgreSQL.
    Provides persistent storage for videos, jobs, products, and overlay tracks.
    """
    def __init__(self):
        self.client: Optional[Client] = None
        self._init_supabase()

    def _init_supabase(self):
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.error("Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_KEY must be set in your .env file.")
            return

        try:
            self.client = create_client(SUPABASE_URL, SUPABASE_KEY)
            # Verify connectivity with a lightweight query
            self.client.table("jobs").select("job_id").limit(1).execute()
            logger.info("Connected to Supabase successfully.")
        except Exception as e:
            logger.error(f"Failed to connect to Supabase: {e}")

    def _ensure_client(self) -> Client:
        if self.client is None:
            if not SUPABASE_URL or not SUPABASE_KEY:
                raise RuntimeError(
                    "Supabase is not configured. Please ensure SUPABASE_URL and SUPABASE_KEY "
                    "are set in your environment variables or .env file."
                )
            self._init_supabase()
            if self.client is None:
                raise RuntimeError("Failed to initialize Supabase client connection.")
        return self.client

    def check_connection(self) -> bool:
        """
        Health check helper to verify database connectivity.
        """
        if not SUPABASE_URL or not SUPABASE_KEY:
            return False
        try:
            client = self._ensure_client()
            client.table("jobs").select("job_id").limit(1).execute()
            return True
        except Exception as e:
            logger.warning(f"Supabase connection check failed: {e}")
            return False

    # --- Jobs ---
    def save_job(self, job_data: Dict[str, Any]):
        client = self._ensure_client()
        job_id = job_data["job_id"]
        now_iso = datetime.now(timezone.utc).isoformat()
        if "updated_at" not in job_data:
            job_data["updated_at"] = now_iso

        payload = {
            "job_id": job_id,
            "original_filename": job_data.get("original_filename"),
            "saved_filename": job_data.get("saved_filename"),
            "video_path": job_data.get("video_path"),
            "file_size_mb": job_data.get("file_size_mb"),
            "status": job_data.get("status", "uploaded"),
            "progress": job_data.get("progress", 0),
            "message": job_data.get("message", ""),
            "success": job_data.get("success"),
            "data": job_data,
            "updated_at": job_data.get("updated_at", now_iso),
        }
        if "created_at" in job_data:
            payload["created_at"] = job_data["created_at"]

        client.table("jobs").upsert(payload).execute()

    def update_job(self, job_id: str, updates: Dict[str, Any]):
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        current = self.get_job(job_id)
        if current:
            current.update(updates)
            self.save_job(current)
        else:
            job_data = {"job_id": job_id, **updates}
            self.save_job(job_data)

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        client = self._ensure_client()
        res = client.table("jobs").select("*").eq("job_id", job_id).limit(1).execute()
        if res.data and len(res.data) > 0:
            row = res.data[0]
            job_dict = dict(row.get("data") or {})
            for k in ["job_id", "original_filename", "saved_filename", "video_path", "file_size_mb", "status", "progress", "message", "success", "created_at", "updated_at"]:
                if k in row and row[k] is not None:
                    job_dict[k] = row[k]
            return job_dict
        return None

    def list_jobs(self) -> List[Dict[str, Any]]:
        client = self._ensure_client()
        res = client.table("jobs").select("*").order("updated_at", desc=True).execute()
        jobs_list = []
        for row in (res.data or []):
            job_dict = dict(row.get("data") or {})
            for k in ["job_id", "original_filename", "saved_filename", "video_path", "file_size_mb", "status", "progress", "message", "success", "created_at", "updated_at"]:
                if k in row and row[k] is not None:
                    job_dict[k] = row[k]
            jobs_list.append(job_dict)
        return jobs_list

    # --- Videos ---
    def save_video(self, video_data: Dict[str, Any]):
        client = self._ensure_client()
        video_id = video_data["video_id"]
        payload = {
            "video_id": video_id,
            "width": video_data.get("width"),
            "height": video_data.get("height"),
            "fps": video_data.get("fps"),
            "total_frames": video_data.get("total_frames"),
            "duration": video_data.get("duration"),
            "thumbnail_path": video_data.get("thumbnail_path"),
            "data": video_data
        }
        client.table("videos").upsert(payload).execute()

    def get_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        client = self._ensure_client()
        res = client.table("videos").select("*").eq("video_id", video_id).limit(1).execute()
        if res.data and len(res.data) > 0:
            row = res.data[0]
            v_dict = dict(row.get("data") or {})
            for k in ["video_id", "width", "height", "fps", "total_frames", "duration", "thumbnail_path"]:
                if k in row and row[k] is not None:
                    v_dict[k] = row[k]
            return v_dict
        return None

    # --- Products ---
    def save_products(self, job_id: str, products: List[Dict[str, Any]]):
        client = self._ensure_client()
        # Delete existing products for this job_id
        client.table("products").delete().eq("job_id", job_id).execute()
        if products:
            rows = []
            for p in products:
                prod_id = str(p.get("id") or p.get("product_id", ""))
                rows.append({
                    "job_id": job_id,
                    "product_id": prod_id,
                    "track_id": p.get("track_id"),
                    "title": p.get("title"),
                    "brand": p.get("brand"),
                    "category": p.get("category"),
                    "base_price": p.get("base_price"),
                    "currency": p.get("currency", "INR"),
                    "visual_similarity_score": p.get("visual_similarity_score"),
                    "has_catalog_match": p.get("has_catalog_match", False),
                    "data": p
                })
            client.table("products").insert(rows).execute()

    def get_products(self, job_id: str) -> List[Dict[str, Any]]:
        client = self._ensure_client()
        res = client.table("products").select("*").eq("job_id", job_id).execute()
        products = []
        for row in (res.data or []):
            p_dict = dict(row.get("data") or {})
            p_dict["job_id"] = row.get("job_id", job_id)
            if "id" not in p_dict and "product_id" in row:
                p_dict["id"] = row["product_id"]
            products.append(p_dict)
        return products

    # --- Overlay Tracks ---
    def save_overlay_tracks(self, job_id: str, overlay_data: Dict[str, Any]):
        client = self._ensure_client()
        payload = {
            "job_id": job_id,
            "video_width": overlay_data.get("video_width"),
            "video_height": overlay_data.get("video_height"),
            "duration": overlay_data.get("duration"),
            "fps": overlay_data.get("fps"),
            "data": overlay_data,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        client.table("overlay_tracks").upsert(payload).execute()

    def get_overlay_tracks(self, job_id: str) -> Optional[Dict[str, Any]]:
        client = self._ensure_client()
        res = client.table("overlay_tracks").select("*").eq("job_id", job_id).limit(1).execute()
        if res.data and len(res.data) > 0:
            row = res.data[0]
            ov_dict = dict(row.get("data") or {})
            ov_dict["job_id"] = row.get("job_id", job_id)
            return ov_dict
        return None

db = DatabaseManager()
