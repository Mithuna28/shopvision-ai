import logging
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.config import EXPORTS_DIR

logger = logging.getLogger(__name__)

class VideoOverlayExporter:
    """
    Renders video with burned-in shopping cards, glowing bounding boxes,
    and connector lines into an exportable MP4 file.
    """
    @staticmethod
    def render_exported_video(
        input_video_path: str,
        output_video_path: str,
        overlay_data: Dict[str, Any],
        products_map: Dict[str, Any]
    ) -> bool:
        cap = cv2.VideoCapture(input_video_path)
        if not cap.isOpened():
            logger.error(f"Cannot open video for export: {input_video_path}")
            return False

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = float(cap.get(cv2.CAP_PROP_FPS))
        if fps <= 0 or np.isnan(fps):
            fps = 30.0

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))

        # Index timeline frames by timestamp range
        timeline_frames = overlay_data.get("timeline_frames", [])
        timestamps = [tf["timestamp"] for tf in timeline_frames]

        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            current_time = frame_idx / fps

            # Find closest overlay frame within 0.15s
            active_overlays = []
            if timestamps:
                # Find nearest timestamp
                closest_idx = min(range(len(timestamps)), key=lambda i: abs(timestamps[i] - current_time))
                if abs(timestamps[closest_idx] - current_time) <= 0.2:
                    active_overlays = timeline_frames[closest_idx].get("overlays", [])

            # Draw overlays on frame
            canvas = frame.copy()
            for ov in active_overlays:
                prod_id = ov["product_id"]
                prod_info = products_map.get(prod_id, {})
                bbox = ov["bbox"]
                card_pos = ov["card_position"]

                # Object bounding box coordinates
                bx1 = int(bbox["x"] * width)
                by1 = int(bbox["y"] * height)
                bx2 = int((bbox["x"] + bbox["width"]) * width)
                by2 = int((bbox["y"] + bbox["height"]) * height)

                # Card coordinates
                cx1 = int(card_pos["x"] * width)
                cy1 = int(card_pos["y"] * height)
                cx2 = int((card_pos["x"] + card_pos["width"]) * width)
                cy2 = int((card_pos["y"] + card_pos["height"]) * height)

                # Draw glowing bounding box
                cv2.rectangle(canvas, (bx1, by1), (bx2, by2), (246, 130, 59), 2)  # Blue/Cyan in BGR
                cv2.circle(canvas, (int((bx1+bx2)/2), int((by1+by2)/2)), 4, (246, 130, 59), -1)

                # Draw connector line
                anchor_x = int(ov["anchor"]["x"] * width)
                anchor_y = int(ov["anchor"]["y"] * height)
                card_anchor_x = cx1 if card_pos["placement"] == "right" else cx2
                card_anchor_y = int((cy1 + cy2) / 2)
                cv2.line(canvas, (anchor_x, anchor_y), (card_anchor_x, card_anchor_y), (255, 255, 255), 1, cv2.LINE_AA)

                # Draw translucent card background
                card_overlay = canvas.copy()
                cv2.rectangle(card_overlay, (cx1, cy1), (cx2, cy2), (20, 24, 33), -1)
                cv2.addWeighted(card_overlay, 0.85, canvas, 0.15, 0, canvas)
                cv2.rectangle(canvas, (cx1, cy1), (cx2, cy2), (255, 255, 255), 1)

                # Draw Text
                title = prod_info.get("title", prod_info.get("category", "Product"))[:22]
                brand = prod_info.get("brand") or "Verified Match"
                price_str = f"₹{prod_info.get('base_price', '4,999'):,}" if isinstance(prod_info.get('base_price'), (int, float)) else "₹4,999"

                cv2.putText(canvas, title, (cx1 + 10, cy1 + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(canvas, brand.upper(), (cx1 + 10, cy1 + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (180, 180, 180), 1, cv2.LINE_AA)
                cv2.putText(canvas, price_str, (cx1 + 10, cy1 + 62), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (50, 200, 100), 2, cv2.LINE_AA)

                # Shop Now Button
                btn_w = 80
                btn_h = 20
                btn_x = cx2 - btn_w - 10
                btn_y = cy2 - btn_h - 10
                cv2.rectangle(canvas, (btn_x, btn_y), (btn_x + btn_w, btn_y + btn_h), (246, 130, 59), -1)
                cv2.putText(canvas, "SHOP NOW", (btn_x + 6, btn_y + 14), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1, cv2.LINE_AA)

            out.write(canvas)
            frame_idx += 1

        cap.release()
        out.release()
        return True

video_exporter = VideoOverlayExporter()
