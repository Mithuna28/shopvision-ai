import cv2
from pathlib import Path
from ultralytics import YOLO

video_path = Path("backend/uploads/job_cdd236eb52.mp4")
print("Video exists:", video_path.exists())

cap = cv2.VideoCapture(str(video_path))
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS)
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
print(f"Total frames: {total}, FPS: {fps}, Resolution: {w}x{h}")

model = YOLO("yolo11n.pt")

for f_idx in [0, 15, 30, 45, 60, 75]:
    cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
    ret, frame = cap.read()
    if not ret:
        continue
    res = model.predict(frame, conf=0.20, verbose=False)
    boxes = res[0].boxes
    print(f"Frame {f_idx}: {len(boxes)} boxes")
    for b in boxes:
        cls_id = int(b.cls[0].item())
        name = model.names[cls_id]
        conf = float(b.conf[0].item())
        xy = [round(x, 1) for x in b.xyxy[0].tolist()]
        print(f"   -> {name} ({conf:.2f}): {xy}")

cap.release()
