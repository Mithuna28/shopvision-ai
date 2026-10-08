export interface StoreDeal {
  store_name: string;
  price: number;
  original_price: number;
  discount: number;
  url: string;
  in_stock: boolean;
  badge?: string;
}

export interface ProductMatch {
  id: string;
  track_id: number;
  has_catalog_match?: boolean;
  title: string;
  brand: string | null;
  brand_status: 'verified' | 'likely' | 'unknown';
  category: string;
  product_type: string;
  color: string[];
  possible_model?: string | null;
  visible_logo?: string | null;
  visual_attributes: string[];
  confidence: number;
  crop_image?: string | null;
  catalog_image?: string | null;
  base_price?: number | null;
  currency: string;
  currency_symbol: string;
  rating?: number | null;
  reviews_count?: number | null;
  visual_similarity_score?: number | null;
  similarity_label: string;
  stores: StoreDeal[];
  primary_store?: StoreDeal | null;
  all_matches?: ProductMatch[];
  timestamp_start: number;
  timestamp_end: number;
  best_timestamp: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardPosition {
  placement: 'right' | 'left' | 'top' | 'bottom';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnchorPoint {
  x: number;
  y: number;
}

export interface OverlayItem {
  product_id: string;
  track_id?: number;
  title?: string;
  brand?: string | null;
  category?: string;
  class_name?: string;
  image_url?: string | null;
  crop_url?: string | null;
  product_url?: string | null;
  similarity?: number | null;
  has_catalog_match?: boolean;
  visual_similarity_score?: number | null;
  bbox: BoundingBox;
  center: { x: number; y: number };
  polygon: number[][];
  card_position: CardPosition;
  anchor: AnchorPoint;
  confidence: number;
}

export interface TimelineFrame {
  timestamp: number;
  overlays: OverlayItem[];
}

export interface ProductInterval {
  product_id: string;
  track_id?: number;
  title: string;
  category: string;
  brand: string | null;
  has_catalog_match?: boolean;
  crop_image?: string | null;
  start_time: number;
  end_time: number;
  best_timestamp: number;
}

export interface OverlayDataset {
  duration: number;
  aspect_ratio: number;
  product_intervals: ProductInterval[];
  timeline_frames: TimelineFrame[];
}

export interface JobStatus {
  job_id: string;
  status: 'uploaded' | 'queued' | 'extracting_frames' | 'detecting_products' | 'tracking_products' | 'identifying_brands' | 'finding_products' | 'generating_overlays' | 'completed' | 'failed';
  progress: number;
  message: string;
  success?: boolean | null;
  updated_at?: string;
}

export interface DemoScenario {
  id: string;
  title: string;
  category: string;
  description: string;
  duration: string;
  products_count: number;
  preview_image: string;
  preset_video_type: string;
}
