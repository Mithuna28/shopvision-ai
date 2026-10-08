import cv2
from pathlib import Path

for name in ["job_cdd236eb52.mp4", "job_1a9c2ff9f8.mp4"]:
    p = Path(f"backend/uploads/{name}")
    if not p.exists():
        continue
    cap = cv2.VideoCapture(str(p))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"{name}: {total} frames")
    # Save 1 frame to inspect
    cap.set(cv2.CAP_PROP_POS_FRAMES, min(30, total - 1))
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(f"sample_{name}.jpg", frame)
        print(f"Saved sample_{name}.jpg: shape {frame.shape}")
    cap.release()
