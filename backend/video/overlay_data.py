import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Approximate card normalized dimensions for layout collision avoidance
CARD_APPROX_WIDTH = 0.28
CARD_APPROX_HEIGHT = 0.16
CARD_MARGIN = 0.02

class OverlayDataGenerator:
    """
    Generates time-synchronized, responsive, collision-free shopping overlay coordinates.
    """
    @staticmethod
    def calculate_card_position(
        obj_bbox: Dict[str, float],
        existing_cards: List[Dict[str, float]],
        video_aspect: float = 16/9
    ) -> Dict[str, Any]:
        """
        Calculates optimal placement ('right', 'left', 'top', 'bottom')
        to keep card inside screen boundaries and avoid overlapping existing cards.
        """
        ox = obj_bbox["x"]
        oy = obj_bbox["y"]
        ow = obj_bbox["width"]
        oh = obj_bbox["height"]

        # Center of object
        cx = ox + (ow / 2.0)
        cy = oy + (oh / 2.0)

        # Candidate placements in order of preference: Right, Left, Top, Bottom
        candidates = [
            {
                "placement": "right",
                "card_x": ox + ow + CARD_MARGIN,
                "card_y": max(0.02, min(0.98 - CARD_APPROX_HEIGHT, cy - (CARD_APPROX_HEIGHT / 2.0))),
                "anchor_x": ox + ow,
                "anchor_y": cy
            },
            {
                "placement": "left",
                "card_x": ox - CARD_APPROX_WIDTH - CARD_MARGIN,
                "card_y": max(0.02, min(0.98 - CARD_APPROX_HEIGHT, cy - (CARD_APPROX_HEIGHT / 2.0))),
                "anchor_x": ox,
                "anchor_y": cy
            },
            {
                "placement": "top",
                "card_x": max(0.02, min(0.98 - CARD_APPROX_WIDTH, cx - (CARD_APPROX_WIDTH / 2.0))),
                "card_y": oy - CARD_APPROX_HEIGHT - CARD_MARGIN,
                "anchor_x": cx,
                "anchor_y": oy
            },
            {
                "placement": "bottom",
                "card_x": max(0.02, min(0.98 - CARD_APPROX_WIDTH, cx - (CARD_APPROX_WIDTH / 2.0))),
                "card_y": oy + oh + CARD_MARGIN,
                "anchor_x": cx,
                "anchor_y": oy + oh
            }
        ]

        best_candidate = None
        min_penalty = float("inf")

        for cand in candidates:
            cx_pos = cand["card_x"]
            cy_pos = cand["card_y"]
            cw_pos = CARD_APPROX_WIDTH
            ch_pos = CARD_APPROX_HEIGHT

            penalty = 0.0

            # 1. Out of bounds penalty
            if cx_pos < 0.01:
                penalty += (0.01 - cx_pos) * 500.0
            if (cx_pos + cw_pos) > 0.99:
                penalty += ((cx_pos + cw_pos) - 0.99) * 500.0
            if cy_pos < 0.01:
                penalty += (0.01 - cy_pos) * 500.0
            if (cy_pos + ch_pos) > 0.99:
                penalty += ((cy_pos + ch_pos) - 0.99) * 500.0

            # 2. Overlap penalty with already placed cards
            for other in existing_cards:
                ox2 = other["card_x"]
                oy2 = other["card_y"]
                ow2 = other.get("card_width", CARD_APPROX_WIDTH)
                oh2 = other.get("card_height", CARD_APPROX_HEIGHT)

                inter_x = max(0.0, min(cx_pos + cw_pos, ox2 + ow2) - max(cx_pos, ox2))
                inter_y = max(0.0, min(cy_pos + ch_pos, oy2 + oh2) - max(cy_pos, oy2))
                inter_area = inter_x * inter_y
                if inter_area > 0:
                    penalty += (inter_area / (cw_pos * ch_pos)) * 1000.0

            if penalty < min_penalty:
                min_penalty = penalty
                best_candidate = cand

        if best_candidate is None:
            best_candidate = candidates[0]

        # Clamp inside boundaries
        clamped_x = max(0.01, min(0.99 - CARD_APPROX_WIDTH, best_candidate["card_x"]))
        clamped_y = max(0.01, min(0.99 - CARD_APPROX_HEIGHT, best_candidate["card_y"]))

        return {
            "placement": best_candidate["placement"],
            "card_x": round(clamped_x, 4),
            "card_y": round(clamped_y, 4),
            "card_width": round(CARD_APPROX_WIDTH, 4),
            "card_height": round(CARD_APPROX_HEIGHT, 4),
            "anchor_x": round(best_candidate["anchor_x"], 4),
            "anchor_y": round(best_candidate["anchor_y"], 4)
        }

    @classmethod
    def generate_timeline_overlay_data(
        cls,
        products: List[Dict[str, Any]],
        video_metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Builds a comprehensive synchronized overlay dataset for the frontend video player.
        """
        video_duration = video_metadata.get("duration_seconds", 0.0)
        video_aspect = video_metadata.get("aspect_ratio", 16/9)

        # Collect all unique timestamps from product trajectories
        timestamp_map: Dict[float, List[Dict[str, Any]]] = {}

        for prod in products:
            prod_id = prod["id"]
            track_points = prod.get("track", [])
            for pt in track_points:
                t = round(pt["timestamp"], 2)
                if t not in timestamp_map:
                    timestamp_map[t] = []
                timestamp_map[t].append({
                    "product_id": prod_id,
                    "point": pt
                })

        # Index products by ID for fast, unambiguous lookup per track
        product_by_id: Dict[str, Dict[str, Any]] = {p["id"]: p for p in products}

        # Process each time slice with collision resolution
        timeline_frames = []
        for t in sorted(timestamp_map.keys()):
            items_at_t = timestamp_map[t]
            placed_cards = []
            frame_overlays = []

            for item in items_at_t:
                prod_id = item["product_id"]
                prod = product_by_id.get(prod_id, {})
                pt = item["point"]
                norm_bbox = pt["normalized_bbox"]

                # Calculate optimal card placement
                pos_info = cls.calculate_card_position(norm_bbox, placed_cards, video_aspect)
                placed_cards.append({
                    "card_x": pos_info["card_x"],
                    "card_y": pos_info["card_y"],
                    "card_width": pos_info["card_width"],
                    "card_height": pos_info["card_height"]
                })

                track_id = prod.get("track_id", 0)
                crop_url = prod.get("crop_image")
                image_url = prod.get("catalog_image") or crop_url
                primary_store = prod.get("primary_store") or {}
                product_url = primary_store.get("url") if isinstance(primary_store, dict) else None

                frame_overlays.append({
                    "product_id": prod_id,
                    "track_id": track_id,
                    "timestamp": t,
                    "title": prod.get("title", "Detected Object"),
                    "brand": prod.get("brand", "Unknown"),
                    "category": prod.get("category", "Unknown"),
                    "class_name": prod.get("class_name", prod.get("category", "Unknown")),
                    "image_url": image_url,
                    "crop_url": crop_url,
                    "has_catalog_match": prod.get("has_catalog_match", False),
                    "product_url": product_url,
                    "similarity": prod.get("visual_similarity_score"),
                    "visual_similarity_score": prod.get("visual_similarity_score"),
                    "bbox": norm_bbox,
                    "center": pt.get("center", {"x": norm_bbox["x"] + norm_bbox["width"]/2, "y": norm_bbox["y"] + norm_bbox["height"]/2}),
                    "polygon": pt.get("polygon", []),
                    "card_position": {
                        "placement": pos_info["placement"],
                        "x": pos_info["card_x"],
                        "y": pos_info["card_y"],
                        "width": pos_info["card_width"],
                        "height": pos_info["card_height"]
                    },
                    "anchor": {
                        "x": pos_info["anchor_x"],
                        "y": pos_info["anchor_y"]
                    },
                    "confidence": pt.get("confidence", 0.9)
                })

            timeline_frames.append({
                "timestamp": t,
                "overlays": frame_overlays
            })

        # Summary of product presence intervals for timeline markers
        product_intervals = []
        for prod in products:
            track = prod.get("track", [])
            if track:
                crop_url = prod.get("crop_image")
                image_url = prod.get("catalog_image") or crop_url
                product_intervals.append({
                    "product_id": prod["id"],
                    "track_id": prod.get("track_id", 0),
                    "title": prod.get("title", prod.get("category", "Detected Object")),
                    "category": prod.get("category", "Unknown"),
                    "class_name": prod.get("class_name", prod.get("category", "Unknown")),
                    "brand": prod.get("brand", "Unknown"),
                    "has_catalog_match": prod.get("has_catalog_match", False),
                    "crop_image": crop_url,
                    "crop_url": crop_url,
                    "image_url": image_url,
                    "start_time": prod.get("timestamp_start", track[0]["timestamp"]),
                    "end_time": prod.get("timestamp_end", track[-1]["timestamp"]),
                    "best_timestamp": prod.get("best_timestamp", track[len(track)//2]["timestamp"])
                })

        return {
            "duration": video_duration,
            "aspect_ratio": video_aspect,
            "product_intervals": product_intervals,
            "timeline_frames": timeline_frames
        }

overlay_data_generator = OverlayDataGenerator()
