import logging
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Generator, Tuple

logger = logging.getLogger(__name__)

class FrameExtractor:
    """
    High-performance video metadata and frame extractor.
    """
    @staticmethod
    def get_video_metadata(video_path: str) -> Dict[str, Any]:
        """Extracts resolution, frame rate, duration, and frame count."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Unable to open video file at {video_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = float(cap.get(cv2.CAP_PROP_FPS))
        if fps <= 0 or np.isnan(fps):
            fps = 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0.0

        cap.release()

        return {
            "width": width,
            "height": height,
            "fps": round(fps, 2),
            "total_frames": total_frames,
            "duration_seconds": round(duration, 2),
            "aspect_ratio": round(width / max(1, height), 3)
        }

    @staticmethod
    def generate_thumbnail(video_path: str, output_path: str) -> bool:
        """Captures a clean representative thumbnail from the video."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return False

        # Seek to 1 second or 10% of video
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        target_frame = min(30, max(0, int(total_frames * 0.1)))
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)

        ret, frame = cap.read()
        if ret and frame is not None:
            cv2.imwrite(output_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
            cap.release()
            return True

        cap.release()
        return False

    @staticmethod
    def extract_frames_sampled(
        video_path: str,
        sample_fps: float = 10.0
    ) -> Generator[Tuple[int, float, np.ndarray], None, None]:
        """
        Yields sampled video frames with (frame_idx, timestamp_seconds, frame_bgr).
        Sampling reduces redundant compute while maintaining smooth tracking.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Unable to open video file at {video_path}")

        video_fps = float(cap.get(cv2.CAP_PROP_FPS))
        if video_fps <= 0 or np.isnan(video_fps):
            video_fps = 30.0

        # Frame step
        step = max(1, int(round(video_fps / sample_fps)))

        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            if frame_idx % step == 0:
                timestamp = frame_idx / video_fps
                yield (frame_idx, timestamp, frame)

            frame_idx += 1

        cap.release()

frame_extractor = FrameExtractor()
