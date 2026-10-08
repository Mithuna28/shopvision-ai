import logging
import cv2
import numpy as np
import torch
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from ultralytics import YOLO
from backend.config import (
    YOLO_MODEL,
    DEVICE,
    MIN_DETECTION_CONFIDENCE,
    MIN_OBJECT_AREA_RATIO,
    MAX_OBJECT_AREA_RATIO,
    PRODUCT_VOCABULARY
)

logger = logging.getLogger(__name__)

# Open-vocabulary shoppable classes for YOLO-World
SHOPPING_VOCAB = PRODUCT_VOCABULARY

# Canonical category mapping (preserves true object identities without fake fallbacks)
CLASS_CATEGORY_MAP = {
    # Footwear
    "sneaker": ("shoe", "sneaker"),
    "running shoe": ("shoe", "running shoe"),
    "shoe": ("shoe", "shoe"),
    "footwear": ("shoe", "footwear"),
    "boots": ("shoe", "boots"),
    # Watches & Smartwatches
    "smartwatch": ("watch", "smartwatch"),
    "wristwatch": ("watch", "wristwatch"),
    "watch": ("watch", "watch"),
    # Audio
    "headphones": ("headphones", "headphones"),
    "over-ear headphones": ("headphones", "over-ear headphones"),
    "earbuds": ("headphones", "earbuds"),
    "earphones": ("headphones", "earbuds"),
    # Eyewear
    "sunglasses": ("sunglasses", "sunglasses"),
    "glasses": ("sunglasses", "glasses"),
    "eyewear": ("sunglasses", "eyewear"),
    # Bags & Luggage
    "backpack": ("backpack", "backpack"),
    "handbag": ("handbag", "handbag"),
    "purse": ("handbag", "purse"),
    "tote bag": ("handbag", "tote bag"),
    "suitcase": ("backpack", "suitcase"),
    # Tech Devices & Gadgets
    "laptop": ("laptop", "laptop"),
    "cell phone": ("cell phone", "smartphone"),
    "mobile phone": ("cell phone", "mobile phone"),
    "smartphone": ("cell phone", "smartphone"),
    "camera": ("camera", "camera"),
    "keyboard": ("keyboard", "keyboard"),
    "mouse": ("mouse", "mouse"),
    # Daily Items & Drinkware (Strictly individual classes)
    "bottle": ("bottle", "bottle"),
    "water bottle": ("bottle", "water bottle"),
    "cup": ("cup", "cup"),
    "wine glass": ("cup", "wine glass"),
    # Apparel & Accessories
    "jacket": ("apparel", "jacket"),
    "coat": ("apparel", "coat"),
    "shirt": ("apparel", "shirt"),
    "t-shirt": ("apparel", "t-shirt"),
    "pants": ("apparel", "pants"),
    "dress": ("apparel", "dress"),
    "wallet": ("wallet", "wallet"),
}

def nms_boxes(boxes: List[List[float]], scores: List[float], iou_threshold: float = 0.4) -> List[int]:
    """Non-Maximum Suppression to filter duplicate candidate bounding boxes."""
    if not boxes:
        return []
    boxes_np = np.array(boxes, dtype=np.float32)
    scores_np = np.array(scores, dtype=np.float32)
    x1 = boxes_np[:, 0]
    y1 = boxes_np[:, 1]
    x2 = boxes_np[:, 2]
    y2 = boxes_np[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores_np.argsort()[::-1]
    keep = []

    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        ovr = inter / (areas[i] + areas[order[1:]] - inter)

        inds = np.where(ovr <= iou_threshold)[0]
        order = order[inds + 1]

    return keep

class YOLODetector:
    """
    Robust Product Detector powered by YOLO11 / YOLO-World open-vocabulary detection.
    Strictly detects genuine visual objects present in video frames without fabricating products.
    """
    def __init__(self, model_name: str = YOLO_MODEL):
        self.model_name = model_name
        self.model = None
        self.device = DEVICE
        self.is_world_model = False
        self._load_model()

    def _load_model(self):
        try:
            logger.info(f"Loading YOLO detector '{self.model_name}' on device '{self.device}'...")
            self.model = YOLO(self.model_name)
            if self.device == "cuda" and torch.cuda.is_available():
                self.model.to("cuda")

            # Configure open-vocabulary classes if YOLO-World model or method exists
            if hasattr(self.model, "set_classes"):
                try:
                    self.model.set_classes(SHOPPING_VOCAB)
                    self.is_world_model = True
                    logger.info(f"YOLO detector initialized with {len(SHOPPING_VOCAB)} custom shopping classes via set_classes.")
                except Exception as we:
                    logger.warning(f"Could not set custom classes on YOLO model: {we}")
            elif "world" in str(self.model_name).lower():
                try:
                    self.model.set_classes(SHOPPING_VOCAB)
                    self.is_world_model = True
                    logger.info(f"YOLO-World initialized with {len(SHOPPING_VOCAB)} custom shopping classes.")
                except Exception as we:
                    logger.warning(f"Could not set custom classes on YOLO-World: {we}")
            
            logger.info(f"YOLO detector '{self.model_name}' loaded successfully on {self.device}.")
        except Exception as e:
            logger.error(f"Error loading YOLO model '{self.model_name}': {e}")
            self.model = None

    def detect_frame(
        self,
        frame: np.ndarray,
        frame_idx: int = 0,
        timestamp: float = 0.0,
        conf_threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Runs object detection on a single frame.
        Filters out low-confidence detections, out-of-bounds boxes, and non-product noise.
        """
        if frame is None or frame.size == 0 or self.model is None:
            return []

        h, w = frame.shape[:2]
        if h == 0 or w == 0:
            return []

        effective_conf = conf_threshold if conf_threshold is not None else MIN_DETECTION_CONFIDENCE

        raw_candidates = []

        try:
            results = self.model.predict(
                source=frame,
                conf=effective_conf,
                device=self.device,
                verbose=False
            )
            if results and results[0].boxes is not None:
                for box in results[0].boxes:
                    cls_id = int(box.cls[0].item())
                    class_name = self.model.names[cls_id].lower()
                    conf = float(box.conf[0].item())

                    # Check if class is a shoppable product
                    matched_category = None
                    matched_type = class_name

                    if class_name in CLASS_CATEGORY_MAP:
                        matched_category, matched_type = CLASS_CATEGORY_MAP[class_name]
                    else:
                        # Substring match for open-vocabulary tokens
                        for key, (cat, ptype) in CLASS_CATEGORY_MAP.items():
                            if key in class_name or class_name in key:
                                matched_category, matched_type = cat, ptype
                                break

                    # If category is not in known map, safely mark as 'Unknown'
                    if matched_category is None:
                        matched_category = "Unknown"
                        matched_type = class_name

                    xyxy = box.xyxy[0].tolist()
                    x1 = max(0.0, min(float(w), xyxy[0]))
                    y1 = max(0.0, min(float(h), xyxy[1]))
                    x2 = max(0.0, min(float(w), xyxy[2]))
                    y2 = max(0.0, min(float(h), xyxy[3]))

                    bw = x2 - x1
                    bh = y2 - y1
                    area_ratio = (bw * bh) / float(w * h)

                    # Validation: reject boxes that are too small or too large
                    if area_ratio < MIN_OBJECT_AREA_RATIO or area_ratio > MAX_OBJECT_AREA_RATIO:
                        continue

                    # Validation: reject degenerate width/height
                    if bw < 12 or bh < 12:
                        continue

                    raw_candidates.append({
                        "bbox": [x1, y1, x2, y2],
                        "confidence": conf,
                        "class_id": cls_id,
                        "category": matched_category,
                        "class_name": matched_type,
                        "area_ratio": area_ratio
                    })
        except Exception as e:
            logger.error(f"YOLO inference error at frame {frame_idx}: {e}")
            return []

        if not raw_candidates:
            return []

        # Apply Non-Maximum Suppression to remove duplicate overlapping proposals
        boxes = [c["bbox"] for c in raw_candidates]
        scores = [c["confidence"] for c in raw_candidates]
        keep_indices = nms_boxes(boxes, scores, iou_threshold=0.35)

        detections = []
        for idx in keep_indices:
            c = raw_candidates[idx]
            x1, y1, x2, y2 = c["bbox"]
            bw = max(1.0, x2 - x1)
            bh = max(1.0, y2 - y1)

            detections.append({
                "detection_id": f"det_{frame_idx}_{idx}",
                "frame_idx": frame_idx,
                "timestamp": round(timestamp, 3),
                "class_id": c.get("class_id", -1),
                "class_name": c["class_name"],
                "category": c["category"],
                "confidence": round(c["confidence"], 4),
                "bbox": [round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2)],
                "normalized_bbox": {
                    "x": round(x1 / w, 4),
                    "y": round(y1 / h, 4),
                    "width": round(bw / w, 4),
                    "height": round(bh / h, 4)
                },
                "center": {
                    "x": round((x1 + x2) / (2 * w), 4),
                    "y": round((y1 + y2) / (2 * h), 4)
                },
                "area_ratio": round(c["area_ratio"], 4)
            })

        return detections

yolo_detector = YOLODetector()
