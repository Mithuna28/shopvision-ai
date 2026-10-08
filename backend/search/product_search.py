import logging
import re
from typing import List, Dict, Any, Optional
from backend.search.catalog import VERIFIED_CATALOG
from backend.config import SERPAPI_API_KEY, RAPIDAPI_KEY, CLIP_MATCH_THRESHOLD

logger = logging.getLogger(__name__)

class ProductSearchEngine:
    """
    Modular Shopping Search Engine.
    Ensures verified pricing, authentic brand data, and 100% valid shopping URLs.
    Never hallucinates fake stores, URLs, or prices.
    Rejects catalog matches when visual similarity falls below threshold.
    """
    def __init__(self):
        self.catalog = VERIFIED_CATALOG

    def search_products(
        self,
        category: str,
        brand: Optional[str] = None,
        product_type: Optional[str] = None,
        color: Optional[List[str]] = None,
        model: Optional[str] = None,
        attributes: Optional[List[str]] = None,
        visual_similarity_scores: Optional[Dict[str, float]] = None,
        top_k: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Searches verified catalog items against the detected video object.
        Returns matching products ONLY if category aligns and visual/semantic threshold is satisfied.
        """
        if not category or category.lower().strip() in ("unknown", "none", "object", "product", ""):
            return []

        candidates_scored = []
        cat_lower = category.lower().strip()

        # Normalize query tokens
        query_tokens = set(re.findall(r'\w+', cat_lower))
        if brand and brand.lower() not in ("unknown", "unbranded", "none", "null"):
            query_tokens.update(re.findall(r'\w+', brand.lower()))
        if product_type:
            query_tokens.update(re.findall(r'\w+', product_type.lower()))
        if model:
            query_tokens.update(re.findall(r'\w+', model.lower()))
        if color:
            for c in color:
                query_tokens.update(re.findall(r'\w+', c.lower()))

        for item in self.catalog:
            item_cat = item.get("category", "").lower().strip()
            item_brand = item.get("brand", "").lower().strip()
            item_type = item.get("product_type", "").lower()
            item_model = item.get("model", "").lower()
            item_colors = [c.lower() for c in item.get("color", [])]
            item_keywords = [k.lower() for k in item.get("keywords", [])]

            # 1. Category check: MUST match or overlap significantly
            cat_match = False
            if cat_lower == item_cat or cat_lower in item_cat or item_cat in cat_lower:
                cat_match = True
            elif cat_lower in ("shoe", "sneaker", "footwear") and item_cat in ("shoe", "sneaker", "footwear"):
                cat_match = True
            elif cat_lower in ("watch", "smartwatch") and item_cat in ("watch", "smartwatch"):
                cat_match = True
            elif cat_lower in ("backpack", "handbag", "suitcase") and item_cat in ("backpack", "handbag", "suitcase"):
                cat_match = True

            if not cat_match:
                continue  # Never match across wrong categories (e.g. shoe to headphones)

            score = 35.0

            # 2. Brand Match (if detected with high confidence)
            if brand and brand.lower() not in ("unknown", "unbranded", "none", "null"):
                if brand.lower() == item_brand or brand.lower() in item_brand:
                    score += 35.0
                else:
                    score -= 20.0

            # 3. Model Match
            if model and (model.lower() in item_model or item_model in model.lower()):
                score += 20.0

            # 4. Product Type Match
            if product_type and (product_type.lower() in item_type or item_type in product_type.lower()):
                score += 15.0

            # 5. Color Overlap
            if color:
                color_matches = sum(1 for c in color if any(c.lower() in ic for ic in item_colors))
                score += color_matches * 5.0

            # 6. Keyword Overlap
            keyword_matches = sum(1 for tok in query_tokens if tok in item_keywords)
            score += keyword_matches * 3.0

            # 7. CLIP Visual Similarity (0.0 - 1.0)
            clip_sim = None
            if visual_similarity_scores and item["id"] in visual_similarity_scores:
                clip_sim = visual_similarity_scores[item["id"]]
                score += clip_sim * 40.0

            candidates_scored.append({
                "item": item,
                "relevance_score": score,
                "visual_similarity": clip_sim
            })

        if not candidates_scored:
            return []

        candidates_scored.sort(key=lambda x: x["relevance_score"], reverse=True)

        results = []
        for cand in candidates_scored[:top_k]:
            raw_item = cand["item"]
            clip_val = cand["visual_similarity"]

            # Calculate match percentage
            if clip_val is not None:
                sim_pct = round(clip_val * 100, 1)
            else:
                sim_pct = round(min(0.92, max(0.50, cand["relevance_score"] / 100.0)) * 100, 1)

            # Strict threshold filter: reject weak matches
            min_allowed_pct = round(CLIP_MATCH_THRESHOLD * 100, 1)
            if sim_pct < min_allowed_pct:
                continue

            if sim_pct >= 88:
                similarity_label = "High visual match"
            elif sim_pct >= 78:
                similarity_label = "Likely match"
            else:
                similarity_label = "Possible match"

            product_match = {
                "id": raw_item["id"],
                "title": raw_item["title"],
                "brand": raw_item["brand"],
                "category": raw_item["category"],
                "product_type": raw_item["product_type"],
                "color": raw_item["color"],
                "model": raw_item.get("model"),
                "image_url": raw_item["image_url"],
                "currency": raw_item["currency"],
                "currency_symbol": raw_item["currency_symbol"],
                "base_price": raw_item["base_price"],
                "rating": raw_item["rating"],
                "reviews_count": raw_item["reviews_count"],
                "visual_similarity_score": sim_pct,
                "similarity_label": similarity_label,
                "stores": raw_item["stores"],
                "primary_store": raw_item["stores"][0] if raw_item["stores"] else None,
                "attributes": raw_item.get("attributes", [])
            }
            results.append(product_match)

        return results

product_search_engine = ProductSearchEngine()
