import os
import cv2
import numpy as np
import logging
from pathlib import Path
from backend.config import DEMOS_DIR

logger = logging.getLogger(__name__)

ASSETS_DIR = DEMOS_DIR / "assets"

def overlay_transparent(background: np.ndarray, overlay: np.ndarray, x: int, y: int) -> np.ndarray:
    """Overlays an image onto background with bounds clipping."""
    bg_h, bg_w = background.shape[:2]
    ov_h, ov_w = overlay.shape[:2]

    if x >= bg_w or y >= bg_h or x + ov_w <= 0 or y + ov_h <= 0:
        return background

    # Calculate clipping bounds
    x1 = max(0, x)
    y1 = max(0, y)
    x2 = min(bg_w, x + ov_w)
    y2 = min(bg_h, y + ov_h)

    ov_x1 = max(0, -x)
    ov_y1 = max(0, -y)
    ov_x2 = ov_x1 + (x2 - x1)
    ov_y2 = ov_y1 + (y2 - y1)

    ov_crop = overlay[ov_y1:ov_y2, ov_x1:ov_x2]
    if ov_crop.shape[2] == 4:
        alpha = ov_crop[:, :, 3] / 255.0
        for c in range(3):
            background[y1:y2, x1:x2, c] = (
                alpha * ov_crop[:, :, c] + (1.0 - alpha) * background[y1:y2, x1:x2, c]
            )
    else:
        background[y1:y2, x1:x2] = ov_crop[:, :, :3]

    return background

def generate_demo_video(scenario_type: str = "sneaker") -> str:
    """
    Generates a realistic test video using photorealistic product assets with smooth motion paths.
    Scenarios:
    1. 'sneaker': One Nike shoe moving across the screen (Test Scenario 1 & 3)
    2. 'tech_accessories': Two products (watch + headphones) moving independently (Test Scenario 2)
    3. 'lifestyle': Backpack and sunglasses
    """
    width, height = 1280, 720
    fps = 30.0
    duration_sec = 6.0
    total_frames = int(fps * duration_sec)

    output_filename = f"demo_{scenario_type}.mp4"
    output_path = DEMOS_DIR / output_filename

    # If already generated and valid, return path
    if output_path.exists() and output_path.stat().st_size > 50000:
        return str(output_path)

    # Load assets
    sneaker_img = cv2.imread(str(ASSETS_DIR / "sneaker.png"))
    watch_img = cv2.imread(str(ASSETS_DIR / "watch.png"))
    headphones_img = cv2.imread(str(ASSETS_DIR / "headphones.png"))
    backpack_img = cv2.imread(str(ASSETS_DIR / "backpack.png"))
    sunglasses_img = cv2.imread(str(ASSETS_DIR / "sunglasses.png"))

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

    # Clean modern studio background gradient
    bg_base = np.zeros((height, width, 3), dtype=np.uint8)
    for y in range(height):
        val = int(22 + (y / height) * 35)
        bg_base[y, :] = [val + 8, val + 4, val]

    # Floor runway perspective lines
    for x in range(-200, width + 400, 100):
        cv2.line(bg_base, (x, int(height * 0.55)), (int(x * 1.4 - 300), height), (45, 50, 62), 1)
    cv2.line(bg_base, (0, int(height * 0.55)), (width, int(height * 0.55)), (70, 78, 95), 2)

    for i in range(total_frames):
        frame = bg_base.copy()
        progress = i / float(total_frames)

        if scenario_type == "sneaker":
            if sneaker_img is not None:
                # Resize sneaker to realistic size
                snk_w = 340
                snk_h = int(sneaker_img.shape[0] * (snk_w / max(1, sneaker_img.shape[1])))
                snk_resized = cv2.resize(sneaker_img, (snk_w, snk_h))

                # Smooth lateral walk motion with vertical walking step bounce
                pos_x = int(120 + progress * 720)
                pos_y = int(320 + np.abs(np.sin(progress * 8 * np.pi)) * 35)

                # Shadow
                cv2.ellipse(frame, (pos_x + snk_w//2, pos_y + snk_h + 10), (snk_w//3, 16), 0, 0, 360, (12, 14, 18), -1)

                # Composite sneaker
                frame = overlay_transparent(frame, snk_resized, pos_x, pos_y)

        elif scenario_type == "tech_accessories":
            # Product 1: Apple Watch (Upper Left -> Center)
            if watch_img is not None:
                w_w = 260
                w_h = int(watch_img.shape[0] * (w_w / max(1, watch_img.shape[1])))
                w_resized = cv2.resize(watch_img, (w_w, w_h))
                w_x = int(180 + np.sin(progress * 2 * np.pi) * 120)
                w_y = int(140 + np.cos(progress * 2 * np.pi) * 40)
                cv2.ellipse(frame, (w_x + w_w//2, w_y + w_h + 10), (w_w//3, 14), 0, 0, 360, (12, 14, 18), -1)
                frame = overlay_transparent(frame, w_resized, w_x, w_y)

            # Product 2: Sony Headphones (Right -> Center motion)
            if headphones_img is not None:
                h_w = 280
                h_h = int(headphones_img.shape[0] * (h_w / max(1, headphones_img.shape[1])))
                h_resized = cv2.resize(headphones_img, (h_w, h_h))
                h_x = int(820 - progress * 380)
                h_y = int(280 + np.sin(progress * 4 * np.pi) * 45)
                cv2.ellipse(frame, (h_x + h_w//2, h_y + h_h + 10), (h_w//3, 16), 0, 0, 360, (12, 14, 18), -1)
                frame = overlay_transparent(frame, h_resized, h_x, h_y)

        else: # Lifestyle / Backpack & Sunglasses
            if backpack_img is not None:
                b_w = 300
                b_h = int(backpack_img.shape[0] * (b_w / max(1, backpack_img.shape[1])))
                b_resized = cv2.resize(backpack_img, (b_w, b_h))
                b_x = int(220 + np.sin(progress * np.pi) * 200)
                b_y = int(200)
                cv2.ellipse(frame, (b_x + b_w//2, b_y + b_h + 10), (b_w//3, 18), 0, 0, 360, (12, 14, 18), -1)
                frame = overlay_transparent(frame, b_resized, b_x, b_y)

            if sunglasses_img is not None:
                s_w = 260
                s_h = int(sunglasses_img.shape[0] * (s_w / max(1, sunglasses_img.shape[1])))
                s_resized = cv2.resize(sunglasses_img, (s_w, s_h))
                s_x = int(780 - np.sin(progress * np.pi) * 160)
                s_y = int(240 + np.cos(progress * 2 * np.pi) * 30)
                cv2.ellipse(frame, (s_x + s_w//2, s_y + s_h + 8), (s_w//3, 12), 0, 0, 360, (12, 14, 18), -1)
                frame = overlay_transparent(frame, s_resized, s_x, s_y)

        # Subtle watermark
        cv2.putText(frame, f"SHOPVISION AI DEMO [{progress * duration_sec:.1f}s]", (40, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (140, 155, 175), 1, cv2.LINE_AA)

        out.write(frame)

    out.release()
    logger.info(f"Generated realistic demo video '{scenario_type}' at {output_path}")
    return str(output_path)
