import os
import torch
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

# Server Configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

# Storage Directories
UPLOADS_DIR = BASE_DIR / "uploads"
FRAMES_DIR = BASE_DIR / "frames"
CROPS_DIR = BASE_DIR / "crops"
EXPORTS_DIR = BASE_DIR / "exports"
MODELS_DIR = BASE_DIR / "models"
DEMOS_DIR = BASE_DIR / "demos"

for folder in [UPLOADS_DIR, FRAMES_DIR, CROPS_DIR, EXPORTS_DIR, MODELS_DIR, DEMOS_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

# Hardware Acceleration
_device_setting = os.getenv("DEVICE", "auto").lower()
if _device_setting == "cuda" and torch.cuda.is_available():
    DEVICE = "cuda"
elif _device_setting == "cpu":
    DEVICE = "cpu"
else:
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

DEVICE_NAME = torch.cuda.get_device_name(0) if torch.cuda.is_available() and DEVICE == "cuda" else "CPU"

# AI Model Settings
_world_model_path = BASE_DIR.parent / "yolov8s-worldv2.pt"
_default_yolo = str(_world_model_path) if _world_model_path.exists() else ("yolo11n.pt" if (BASE_DIR.parent / "yolo11n.pt").exists() else "yolov8s-worldv2.pt")
YOLO_MODEL = os.getenv("YOLO_MODEL", _default_yolo)
USE_SAM2 = os.getenv("USE_SAM2", "True").lower() in ("true", "1", "yes")
CLIP_MODEL_NAME = os.getenv("CLIP_MODEL", "sentence-transformers/clip-ViT-B-32")

# Shoppable Product Vocabulary for Open-Vocabulary YOLO-World
PRODUCT_VOCABULARY = [
    "shoe",
    "sneaker",
    "watch",
    "headphones",
    "earbuds",
    "sunglasses",
    "backpack",
    "handbag",
    "laptop",
    "mobile phone",
    "smartphone",
    "bottle",
    "cup",
    "jacket",
    "shirt",
    "t-shirt",
    "pants",
    "dress",
    "wallet",
    "camera",
    "keyboard",
    "mouse"
]

# Detection & Tracking Validation Thresholds
MIN_DETECTION_CONFIDENCE = float(os.getenv("MIN_DETECTION_CONFIDENCE", "0.30"))
MIN_TRACK_FRAMES = int(os.getenv("MIN_TRACK_FRAMES", "3"))
MIN_OBJECT_AREA_RATIO = float(os.getenv("MIN_OBJECT_AREA_RATIO", "0.003"))
MAX_OBJECT_AREA_RATIO = float(os.getenv("MAX_OBJECT_AREA_RATIO", "0.85"))
CLIP_MATCH_THRESHOLD = float(os.getenv("CLIP_MATCH_THRESHOLD", "0.70"))

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY", "")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")

# Supabase Database Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Max limits
MAX_UPLOAD_SIZE_MB = 250
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

# Target Shoppable Object Classes from YOLO COCO / Objects365
SHOPPABLE_CLASSES = {
    "shoe": ["sneakers", "running shoe", "footwear", "boots", "loafers", "sandals", "high heels"],
    "watch": ["wristwatch", "smartwatch", "analog watch", "digital watch", "luxury watch"],
    "handbag": ["handbag", "purse", "tote bag", "shoulder bag", "crossbody bag", "clutch"],
    "backpack": ["backpack", "travel bag", "school bag", "knapsack"],
    "suitcase": ["luggage", "trolley bag", "travel suitcase"],
    "laptop": ["laptop", "macbook", "notebook computer", "ultrabook"],
    "cell phone": ["smartphone", "iphone", "android phone", "mobile phone"],
    "headphones": ["over-ear headphones", "wireless headphones", "earphones", "earbuds", "airpods"],
    "sports ball": ["soccer ball", "basketball", "tennis ball", "football"],
    "baseball glove": ["sports glove", "glove"],
    "skateboard": ["skateboard", "longboard"],
    "tennis racket": ["tennis racket", "badminton racket"],
    "bottle": ["water bottle", "hydro flask", "tumbler", "sports bottle"],
    "cup": ["coffee mug", "thermal cup", "travel tumbler"],
    "sunglasses": ["sunglasses", "eyewear", "glasses", "shades"],
    "tie": ["necktie", "bow tie"],
    "book": ["book", "novel", "hardcover book"],
    "chair": ["gaming chair", "ergonomic office chair", "lounge chair"],
    "couch": ["sofa", "sectional couch", "couch"],
    "tv": ["smart tv", "oled tv", "4k monitor", "television"],
}
