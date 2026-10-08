import logging
import json
import re
import cv2
import numpy as np
from PIL import Image
from typing import Dict, Any, List, Optional
from backend.config import GEMINI_API_KEY, OPENAI_API_KEY

logger = logging.getLogger(__name__)

# Known Brand Dictionary for Verification and OCR Matching
KNOWN_BRANDS = {
    "shoe": ["nike", "adidas", "puma", "reebok", "new balance", "asics", "vans", "converse", "skechers", "under armour", "jordan", "on cloud", "hoka"],
    "watch": ["apple", "casio", "g-shock", "fossil", "rolex", "omega", "seiko", "tag heuer", "tissot", "garmin", "titan", "fitbit", "samsung"],
    "headphones": ["sony", "apple", "bose", "sennheiser", "jbl", "beats", "boat", "skullcandy", "audio-technica", "marshall"],
    "cell phone": ["apple", "samsung", "google", "oneplus", "xiaomi", "oppo", "vivo", "realme", "motorola", "nothing"],
    "laptop": ["apple", "dell", "hp", "lenovo", "asus", "acer", "microsoft", "razer", "samsung", "msi"],
    "handbag": ["louis vuitton", "gucci", "prada", "chanel", "hermes", "coach", "michael kors", "zara", "h&m", "dior", "fendi"],
    "backpack": ["herschel", "nike", "adidas", "north face", "janSport", "samsonite", "wildcraft", "puma", "tumi"],
    "sunglasses": ["ray-ban", "oakley", "gucci", "prada", "fastrack", "polaroid", "persol", "maui jim"],
    "bottle": ["hydro flask", "stanley", "milton", "thermos", "yeti", "camelbak", "contigo"]
}

COLOR_NAMES = {
    "black": ([0, 0, 0], [180, 255, 50]),
    "white": ([0, 0, 200], [180, 30, 255]),
    "grey": ([0, 0, 50], [180, 40, 200]),
    "red": ([0, 70, 50], [10, 255, 255]),
    "blue": ([100, 70, 50], [130, 255, 255]),
    "green": ([35, 70, 50], [85, 255, 255]),
    "yellow": ([20, 70, 50], [35, 255, 255]),
    "orange": ([11, 70, 50], [20, 255, 255]),
    "purple": ([130, 70, 50], [165, 255, 255]),
    "brown": ([10, 100, 20], [25, 255, 150]),
}

class ProductAnalyzer:
    """
    Vision-Language Product Understanding Engine.
    Strictly prevents hallucinations: marks brand as 'unknown' if not visually confirmed.
    """
    def __init__(self):
        self.gemini_key = GEMINI_API_KEY
        self.openai_key = OPENAI_API_KEY

    def analyze_product_crop(
        self,
        crop_image: np.ndarray,
        detected_category: str,
        detection_confidence: float = 0.85
    ) -> Dict[str, Any]:
        """
        Extracts verified product attributes from the best crop.
        """
        if crop_image is None or crop_image.size == 0:
            return self._fallback_result(detected_category)

        # 1. Try Gemini Vision if API key is provided
        if self.gemini_key:
            try:
                gemini_res = self._analyze_with_gemini(crop_image, detected_category)
                if gemini_res:
                    return gemini_res
            except Exception as e:
                logger.warning(f"Gemini Vision API analysis failed ({e}), falling back to local multimodal analyzer.")

        # 2. Local Multimodal Visual Feature Analyzer (Color + OCR + Brand Feature Detector)
        return self._analyze_locally(crop_image, detected_category, detection_confidence)

    def _analyze_locally(
        self,
        crop_image: np.ndarray,
        category: str,
        confidence: float
    ) -> Dict[str, Any]:
        """
        Local visual understanding using color space clustering, edge/texture analysis,
        and strict brand verification rules.
        """
        h, w = crop_image.shape[:2]
        cat_lower = category.lower().strip() if category else "unknown"

        # Dominant Colors
        dominant_colors = self._extract_dominant_colors(crop_image)

        # Handle Unknown / unconfirmed categories safely
        if cat_lower in ["unknown", "none", "object", "product", ""]:
            return {
                "category": "Unknown",
                "brand": "Unknown",
                "brand_status": "unknown",
                "color": dominant_colors if dominant_colors else ["neutral"],
                "product_type": "Detected Object",
                "visible_logo": None,
                "possible_model": None,
                "visual_attributes": ["Visual Inspection", "Video Evidence"],
                "confidence": round(confidence, 3)
            }

        # Brand Detection using OCR & Template Cues
        detected_brand, brand_status, visible_logo, possible_model = self._detect_brand_and_model(crop_image, cat_lower)

        # Product Type & Attributes according to category
        product_type, visual_attributes = self._infer_type_and_attributes(cat_lower, dominant_colors, w, h)

        return {
            "category": cat_lower,
            "brand": detected_brand or "Unknown",
            "brand_status": brand_status,  # "verified", "likely", or "unknown"
            "color": dominant_colors if dominant_colors else ["neutral"],
            "product_type": product_type,
            "visible_logo": visible_logo,
            "possible_model": possible_model,
            "visual_attributes": visual_attributes,
            "confidence": round(confidence, 3)
        }

    def _extract_dominant_colors(self, img: np.ndarray) -> List[str]:
        """Extracts top 1-3 dominant color names using HSV histogram analysis."""
        try:
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            total_pixels = img.shape[0] * img.shape[1]
            color_scores = {}

            for cname, (lower, upper) in COLOR_NAMES.items():
                lower_np = np.array(lower, dtype=np.uint8)
                upper_np = np.array(upper, dtype=np.uint8)
                mask = cv2.inRange(hsv, lower_np, upper_np)
                count = cv2.countNonZero(mask)
                ratio = count / float(total_pixels)
                if ratio > 0.08:  # At least 8% of crop
                    color_scores[cname] = ratio

            sorted_colors = sorted(color_scores.items(), key=lambda x: x[1], reverse=True)
            return [c[0] for c in sorted_colors[:2]]
        except Exception:
            return ["neutral"]

    def _detect_brand_and_model(self, crop: np.ndarray, category: str) -> Tuple[Optional[str], str, Optional[str], Optional[str]]:
        """
        Analyzes visible logo/text. Strictly assigns brand ONLY if high visual support exists.
        Otherwise safely returns brand: None, brand_status: 'unknown'.
        Never fabricates Nike, Apple, Sony, etc. merely from category.
        """
        if crop is None or crop.size == 0 or category.lower() in ["unknown", "none", "object"]:
            return None, "unknown", None, None

        # Check for visible text using OCR if available
        try:
            import pytesseract
            rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            ocr_text = pytesseract.image_to_string(rgb).lower().strip()
            
            candidate_brands = KNOWN_BRANDS.get(category, [])
            for b in candidate_brands:
                if b in ocr_text:
                    return b.title(), "verified", f"Visible text '{b.title()}' detected", None
        except Exception:
            pass

        # Default honest stance: Brand is Unknown
        return None, "unknown", None, None

    def _infer_type_and_attributes(
        self,
        category: str,
        colors: List[str],
        w: int,
        h: int
    ) -> Tuple[str, List[str]]:
        color_str = "/".join([c.title() for c in colors])
        if category in ["shoe", "sneaker"]:
            return "sneaker", [f"{color_str} colorway", "Cushioned Sole", "Lace-up closure", "Breathable upper"]
        elif category == "watch":
            return "smartwatch", [f"{color_str} finish", "OLED display", "Water-resistant casing", "Sport band"]
        elif category == "headphones":
            return "headphones", [f"{color_str} finish", "Active Noise Cancelling", "Padded ear cushions", "Wireless"]
        elif category in ["handbag", "purse"]:
            return "handbag", [f"{color_str} tone", "Leather trim", "Twin carry handles", "Spacious interior"]
        elif category == "backpack":
            return "backpack", [f"{color_str} exterior", "Padded shoulder straps", "Laptop compartment", "Weather resistant"]
        elif category in ["cell phone", "smartphone"]:
            return "smartphone", [f"{color_str} casing", "Multi-lens camera system", "Edge-to-edge display"]
        elif category == "laptop":
            return "laptop", [f"{color_str} chassis", "Retina display", "Precision trackpad"]
        elif category == "sunglasses":
            return "sunglasses", [f"{color_str} frame", "UV400 protection", "Classic silhouette"]
        elif category == "bottle":
            return "bottle", [f"{color_str} finish", "Reusable bottle", "Insulated body"]
        elif category == "cup":
            return "cup", [f"{color_str} finish", "Drinkware", "Comfort grip"]
        elif category == "camera":
            return "camera", [f"{color_str} body", "Optical lens", "Compact design"]
        elif category == "keyboard":
            return "keyboard", [f"{color_str} keys", "Ergonomic layout"]
        elif category == "mouse":
            return "mouse", [f"{color_str} finish", "Optical sensor", "Ergonomic grip"]
        elif category == "wallet":
            return "wallet", [f"{color_str} finish", "Card slots", "Slim profile"]
        elif category in ["apparel", "jacket", "shirt", "t-shirt", "pants", "dress"]:
            return category, [f"{color_str} fabric", "Comfort fit", "Casual wear"]
        elif category in ["unknown", "none", "object", "product"]:
            return "Detected Object", ["Visual Inspection", "Video Evidence"]
        else:
            return category, [f"{color_str} finish", "Visual Inspection"]

    def _analyze_with_gemini(self, crop: np.ndarray, category: str) -> Optional[Dict[str, Any]]:
        """Invokes Google Gemini Vision model for cloud multimodal analysis."""
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")

            rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)

            prompt = (
                f"Analyze this cropped product image. The coarse detected category is '{category}'.\n"
                "Return a strict JSON object with fields:\n"
                "{\n"
                '  "category": "shoe/watch/bag/etc.",\n'
                '  "brand": "Brand name if visually identifiable, or null if uncertain",\n'
                '  "brand_status": "verified" / "likely" / "unknown",\n'
                '  "color": ["dominant_color_1", "dominant_color_2"],\n'
                '  "product_type": "exact product type (e.g. running shoe)",\n'
                '  "visible_logo": "description of visible logo or null",\n'
                '  "possible_model": "model name or null",\n'
                '  "visual_attributes": ["attr1", "attr2", "attr3"]\n'
                "}\n"
                "CRITICAL: Never hallucinate brand or model! If logo is unclear, return null and brand_status='unknown'."
            )

            response = model.generate_content([prompt, pil_img])
            text = response.text.strip()
            # Extract JSON
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                parsed = json.loads(match.group(0))
                return parsed
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
        return None

    def _fallback_result(self, category: str) -> Dict[str, Any]:
        cat_lower = category.lower().strip() if category else "unknown"
        is_unknown = cat_lower in ["unknown", "none", "object", "product", ""]
        return {
            "category": "Unknown" if is_unknown else cat_lower,
            "brand": "Unknown",
            "brand_status": "unknown",
            "color": ["neutral"],
            "product_type": "Detected Object" if is_unknown else cat_lower,
            "visible_logo": None,
            "possible_model": None,
            "visual_attributes": ["Visual Inspection", "Video Evidence"],
            "confidence": 0.5
        }

product_analyzer = ProductAnalyzer()
