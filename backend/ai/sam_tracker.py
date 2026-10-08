import logging
import math
import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from backend.config import MIN_TRACK_FRAMES

logger = logging.getLogger(__name__)

def calculate_iou(boxA: List[float], boxB: List[float]) -> float:
    """Calculates Intersection over Union between two [x1, y1, x2, y2] bounding boxes."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    boxAArea = max(1.0, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    boxBArea = max(1.0, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

    iou = interArea / float(boxAArea + boxBArea - interArea)
    return max(0.0, min(1.0, iou))

def compute_spatial_similarity(boxA: List[float], boxB: List[float], frame_w: int, frame_h: int) -> float:
    """
    Computes composite spatial similarity using IoU, normalized center distance, and scale consistency.
    Allows continuous tracking even when objects move quickly across frames.
    """
    iou = calculate_iou(boxA, boxB)
    
    # Centers
    cA_x = (boxA[0] + boxA[2]) / 2.0
    cA_y = (boxA[1] + boxA[3]) / 2.0
    cB_x = (boxB[0] + boxB[2]) / 2.0
    cB_y = (boxB[1] + boxB[3]) / 2.0

    diag = math.sqrt(float(frame_w**2 + frame_h**2)) + 1e-6
    dist = math.sqrt((cA_x - cB_x)**2 + (cA_y - cB_y)**2)
    norm_dist = dist / diag  # 0.0 to 1.0

    center_sim = max(0.0, 1.0 - (norm_dist * 3.0))  # High within 33% screen radius

    # Area similarity
    areaA = max(1.0, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    areaB = max(1.0, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))
    scale_sim = min(areaA, areaB) / max(areaA, areaB)

    # Weighted composite score
    composite = (iou * 0.45) + (center_sim * 0.40) + (scale_sim * 0.15)
    return composite

class SAMTracker:
    """
    SAM 2 / Advanced Multi-Object Spatio-Temporal Video Tracker.
    Associates candidate detections across video frames into persistent unique product tracks,
    generates segmentation masks, smooths bounding box trajectories, and merges broken tracks.
    """
    def __init__(self, max_lost_frames: int = 24, match_threshold: float = 0.22):
        self.max_lost_frames = max_lost_frames
        self.match_threshold = match_threshold
        self.next_track_id = 1
        self.active_tracks: Dict[int, Dict[str, Any]] = {}
        self.completed_tracks: List[Dict[str, Any]] = []

    def reset(self):
        self.next_track_id = 1
        self.active_tracks.clear()
        self.completed_tracks.clear()

    def generate_segmentation_mask(
        self,
        frame: np.ndarray,
        bbox: List[float]
    ) -> Dict[str, Any]:
        """
        Generates object segmentation mask/contour given a bounding box prompt.
        Uses GrabCut / adaptive foreground segmentation for clean object mask polygon.
        """
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = [int(v) for v in bbox]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        bw = x2 - x1
        bh = y2 - y1
        if bw <= 4 or bh <= 4:
            return {"polygon": [], "mask_area_ratio": 0.0}

        try:
            roi = frame[y1:y2, x1:x2]
            mask = np.zeros(roi.shape[:2], np.uint8)
            bgd_model = np.zeros((1, 65), np.float64)
            fgd_model = np.zeros((1, 65), np.float64)

            rect = (1, 1, bw - 2, bh - 2)
            cv2.grabCut(roi, mask, rect, bgd_model, fgd_model, 1, cv2.GC_INIT_WITH_RECT)
            mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')

            contours, _ = cv2.findContours(mask2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            polygon_norm = []
            if contours:
                largest_c = max(contours, key=cv2.contourArea)
                epsilon = 0.02 * cv2.arcLength(largest_c, True)
                approx = cv2.approxPolyDP(largest_c, epsilon, True)
                for pt in approx:
                    px, py = pt[0]
                    polygon_norm.append([
                        round((x1 + px) / w, 4),
                        round((y1 + py) / h, 4)
                    ])

            mask_area = float(np.sum(mask2))
            mask_area_ratio = mask_area / float(w * h)
            return {
                "polygon": polygon_norm if polygon_norm else [
                    [round(x1/w, 4), round(y1/h, 4)],
                    [round(x2/w, 4), round(y1/h, 4)],
                    [round(x2/w, 4), round(y2/h, 4)],
                    [round(x1/w, 4), round(y2/h, 4)],
                ],
                "mask_area_ratio": round(mask_area_ratio, 4)
            }
        except Exception:
            return {
                "polygon": [
                    [round(x1/w, 4), round(y1/h, 4)],
                    [round(x2/w, 4), round(y1/h, 4)],
                    [round(x2/w, 4), round(y2/h, 4)],
                    [round(x1/w, 4), round(y2/h, 4)],
                ],
                "mask_area_ratio": round((bw * bh) / float(w * h), 4)
            }

    def update_tracks(
        self,
        frame: np.ndarray,
        detections: List[Dict[str, Any]],
        frame_idx: int,
        timestamp: float
    ) -> List[Dict[str, Any]]:
        """
        Associates current frame detections to existing active tracks or creates new tracks.
        """
        h, w = frame.shape[:2]
        matched_tracks = set()
        matched_detections = set()

        active_ids = list(self.active_tracks.keys())
        if active_ids and detections:
            cost_matrix = []
            for tid in active_ids:
                track = self.active_tracks[tid]
                last_box = track["last_bbox"]
                track_cat = track["category"]
                track_cname = track.get("class_name")
                row = []
                for det in detections:
                    if det["category"] == track_cat and (not track_cname or det.get("class_name") == track_cname):
                        score = compute_spatial_similarity(last_box, det["bbox"], w, h)
                    else:
                        score = 0.0
                    row.append(score)
                cost_matrix.append(row)

            # Hungarian greedy matching
            cost_matrix = np.array(cost_matrix)
            while True:
                if cost_matrix.size == 0:
                    break
                max_val = np.max(cost_matrix)
                if max_val < self.match_threshold:
                    break
                r_idx, c_idx = np.unravel_index(np.argmax(cost_matrix), cost_matrix.shape)
                tid = active_ids[r_idx]
                det = detections[c_idx]

                matched_tracks.add(tid)
                matched_detections.add(c_idx)

                self._add_detection_to_track(frame, tid, det, frame_idx, timestamp)

                cost_matrix[r_idx, :] = -1.0
                cost_matrix[:, c_idx] = -1.0

        # Create new tracks for unmatched detections
        for i, det in enumerate(detections):
            if i not in matched_detections:
                new_id = self.next_track_id
                self.next_track_id += 1
                self.active_tracks[new_id] = {
                    "track_id": new_id,
                    "product_id": f"prod_track_{new_id}",
                    "category": det["category"],
                    "class_name": det["class_name"],
                    "class_id": det.get("class_id", -1),
                    "first_seen": timestamp,
                    "last_seen": timestamp,
                    "first_frame": frame_idx,
                    "last_frame": frame_idx,
                    "lost_count": 0,
                    "last_bbox": det["bbox"],
                    "detection_count": 0,
                    "confidences": [],
                    "trajectory": [],
                    "best_frame_info": None
                }
                self._add_detection_to_track(frame, new_id, det, frame_idx, timestamp)

        # Handle lost tracks
        tracks_to_remove = []
        for tid in active_ids:
            if tid not in matched_tracks:
                track = self.active_tracks[tid]
                track["lost_count"] += 1
                if track["lost_count"] > self.max_lost_frames:
                    tracks_to_remove.append(tid)

        for tid in tracks_to_remove:
            completed_track = self.active_tracks.pop(tid)
            if completed_track["detection_count"] >= MIN_TRACK_FRAMES:
                self.completed_tracks.append(completed_track)

        # Return active tracking items
        current_tracked_detections = []
        for tid in matched_tracks:
            track = self.active_tracks[tid]
            if track["trajectory"]:
                last_traj = track["trajectory"][-1]
                current_tracked_detections.append({
                    "track_id": tid,
                    "product_id": track["product_id"],
                    "category": track["category"],
                    "bbox": track["last_bbox"],
                    "normalized_bbox": last_traj["normalized_bbox"],
                    "center": last_traj["center"],
                    "confidence": last_traj["confidence"],
                    "polygon": last_traj.get("polygon", [])
                })

        return current_tracked_detections

    def _add_detection_to_track(
        self,
        frame: np.ndarray,
        track_id: int,
        det: Dict[str, Any],
        frame_idx: int,
        timestamp: float
    ):
        track = self.active_tracks[track_id]
        track["last_seen"] = timestamp
        track["last_frame"] = frame_idx
        track["lost_count"] = 0
        track["detection_count"] += 1
        track["confidences"].append(det["confidence"])

        # Exponential Moving Average for jitter reduction
        alpha = 0.60
        if track["trajectory"]:
            prev_bbox = track["last_bbox"]
            smooth_bbox = [
                alpha * det["bbox"][0] + (1 - alpha) * prev_bbox[0],
                alpha * det["bbox"][1] + (1 - alpha) * prev_bbox[1],
                alpha * det["bbox"][2] + (1 - alpha) * prev_bbox[2],
                alpha * det["bbox"][3] + (1 - alpha) * prev_bbox[3],
            ]
        else:
            smooth_bbox = det["bbox"]

        track["last_bbox"] = smooth_bbox
        h, w = frame.shape[:2]

        norm_x = smooth_bbox[0] / w
        norm_y = smooth_bbox[1] / h
        norm_w = (smooth_bbox[2] - smooth_bbox[0]) / w
        norm_h = (smooth_bbox[3] - smooth_bbox[1]) / h
        center_x = (smooth_bbox[0] + smooth_bbox[2]) / (2 * w)
        center_y = (smooth_bbox[1] + smooth_bbox[3]) / (2 * h)

        seg_info = self.generate_segmentation_mask(frame, smooth_bbox)

        # Sharpness score
        x1, y1, x2, y2 = [int(v) for v in smooth_bbox]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        crop_roi = frame[y1:y2, x1:x2]
        sharpness = 0.0
        if crop_roi.size > 0:
            gray_crop = cv2.cvtColor(crop_roi, cv2.COLOR_BGR2GRAY)
            sharpness = float(cv2.Laplacian(gray_crop, cv2.CV_64F).var())

        frame_score = (det["confidence"] * 40.0) + (min(100.0, sharpness) * 0.3) + (min(1.0, norm_w * norm_h * 10) * 30.0)

        point_data = {
            "frame_idx": frame_idx,
            "timestamp": round(timestamp, 3),
            "bbox": [round(v, 2) for v in smooth_bbox],
            "normalized_bbox": {
                "x": round(norm_x, 4),
                "y": round(norm_y, 4),
                "width": round(norm_w, 4),
                "height": round(norm_h, 4)
            },
            "center": {
                "x": round(center_x, 4),
                "y": round(center_y, 4)
            },
            "confidence": round(det["confidence"], 4),
            "sharpness": round(sharpness, 2),
            "frame_score": round(frame_score, 2),
            "polygon": seg_info.get("polygon", [])
        }
        track["trajectory"].append(point_data)

        if track["best_frame_info"] is None or frame_score > track["best_frame_info"]["frame_score"]:
            track["best_frame_info"] = {
                "frame_idx": frame_idx,
                "timestamp": timestamp,
                "frame_score": frame_score,
                "bbox": smooth_bbox,
                "normalized_bbox": point_data["normalized_bbox"],
                "crop_img": crop_roi.copy() if crop_roi.size > 0 else None
            }

    def finalize(self) -> List[Dict[str, Any]]:
        """
        Finalizes active tracks, merges temporally continuous tracks belonging to the same physical object,
        and filters noise tracks that do not meet minimum persistence.
        """
        for tid, track in self.active_tracks.items():
            if track["detection_count"] >= MIN_TRACK_FRAMES:
                self.completed_tracks.append(track)
        self.active_tracks.clear()

        # Step 1: Merge fragmented tracks of same category with sequential / overlapping continuity
        merged_tracks: List[Dict[str, Any]] = []
        # Sort tracks by first seen timestamp
        sorted_tracks = sorted(self.completed_tracks, key=lambda x: x["first_seen"])

        for tr in sorted_tracks:
            # Check if this track can be merged into an existing track in merged_tracks
            merged = False
            for parent in merged_tracks:
                # Same category and class_name required
                if parent["category"] != tr["category"] or parent.get("class_name") != tr.get("class_name"):
                    continue

                # Check if time intervals are contiguous (e.g. gap < 2.0 seconds) without simultaneous conflict
                time_gap = tr["first_seen"] - parent["last_seen"]
                if 0.0 <= time_gap <= 2.2:
                    # Spatial proximity between parent's last position and tr's first position
                    p_last_traj = parent["trajectory"][-1]["normalized_bbox"]
                    tr_first_traj = tr["trajectory"][0]["normalized_bbox"]

                    dx = abs(p_last_traj["x"] - tr_first_traj["x"])
                    dy = abs(p_last_traj["y"] - tr_first_traj["y"])

                    # If within 40% screen distance, it is the same physical product continuing
                    if dx < 0.40 and dy < 0.40:
                        # Merge tr into parent
                        parent["last_seen"] = tr["last_seen"]
                        parent["last_frame"] = tr["last_frame"]
                        parent["detection_count"] += tr["detection_count"]
                        parent["confidences"].extend(tr["confidences"])
                        parent["trajectory"].extend(tr["trajectory"])
                        
                        # Update best frame info if tr has higher score
                        if (tr.get("best_frame_info") and 
                            (not parent.get("best_frame_info") or 
                             tr["best_frame_info"]["frame_score"] > parent["best_frame_info"]["frame_score"])):
                            parent["best_frame_info"] = {
                                **tr["best_frame_info"],
                                "crop_img": tr["best_frame_info"]["crop_img"].copy() if tr["best_frame_info"].get("crop_img") is not None else None
                            }

                        merged = True
                        break

            if not merged:
                merged_tracks.append(tr)

        # Step 2: Final validation filter (minimum frame count and valid crop)
        valid_tracks = []
        final_id = 1
        for tr in merged_tracks:
            if tr["detection_count"] >= MIN_TRACK_FRAMES and tr.get("best_frame_info") and tr["best_frame_info"].get("crop_img") is not None:
                tr["track_id"] = final_id
                tr["product_id"] = f"p{final_id}"
                # Guarantee independent crop copy per track
                tr["best_frame_info"]["crop_img"] = tr["best_frame_info"]["crop_img"].copy()
                final_id += 1
                valid_tracks.append(tr)

        logger.info(f"SAMTracker: Validated {len(valid_tracks)} persistent unique physical tracks.")
        return valid_tracks
