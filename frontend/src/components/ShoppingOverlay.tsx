import React, { useMemo, useState, useRef } from 'react';
import { ProductCard } from './ProductCard';
import { ProductMatch, OverlayDataset, OverlayItem } from '../types';
import { Sparkles, MousePointerClick } from 'lucide-react';

interface ShoppingOverlayProps {
  currentTime: number;
  overlayData?: OverlayDataset | null;
  productsMap: Map<string, ProductMatch>;
  containerRect: { width: number; height: number };
  videoNaturalSize: { width: number; height: number };
  isCompactMode?: boolean;
  isDebugMode?: boolean;
  selectedProductId?: string | null;
  onSelectProduct: (product: ProductMatch) => void;
}

// Target display/hold duration in seconds to avoid rapid flickering
const HOLD_DURATION = 3.0;

// Maximum number of simultaneous shopping cards
const MAX_VISIBLE_CARDS = 1;

interface DominanceScoreBreakdown {
  total: number;
  bboxAreaScore: number;
  confidenceScore: number;
  trackStabilityScore: number;
  visibilityScore: number;
  centerProximityScore: number;
  rawArea: number;
}

/**
 * Calculates a robust multi-factor dominance score for a candidate overlay item.
 *
 * Factors:
 * 1. Bounding-Box Area relative to frame (50% weight): Larger visible object = higher score.
 * 2. Detection Confidence (20% weight): Higher model confidence = higher score.
 * 3. Track Stability (15% weight): Established tracks with consistent temporal presence = higher score.
 * 4. Visibility & Boundary Completeness (10% weight): Minimally occluded/unclipped = higher score.
 * 5. Center Proximity (5% weight): Objects closer to viewing center receive a small bonus.
 */
function calculateDominanceScore(
  ov: OverlayItem,
  prod: ProductMatch | undefined,
  currentTime: number
): DominanceScoreBreakdown {
  // 1. Normalized Bounding Box Area (Weight: 0.50)
  // rawArea is width * height in normalized [0, 1] frame space.
  // Objects occupying >= 35% of the frame achieve maximum area score (1.0).
  const rawArea = Math.max(0, Math.min(1.0, ov.bbox.width * ov.bbox.height));
  const bboxAreaScore = Math.min(1.0, rawArea / 0.35);

  // 2. Detection Confidence (Weight: 0.20)
  const rawConf = ov.confidence ?? prod?.confidence ?? 0.85;
  const confidenceScore = Math.max(0, Math.min(1.0, rawConf));

  // 3. Track Stability (Weight: 0.15)
  // Measures track longevity and established presence across video frames
  const trackSpan = prod ? Math.max(0, (prod.timestamp_end ?? 0) - (prod.timestamp_start ?? 0)) : 1.0;
  const trackSpanScore = Math.min(1.0, Math.max(0.1, trackSpan / 3.0));
  const elapsedPresence = prod ? Math.max(0, currentTime - (prod.timestamp_start ?? currentTime)) : 0.5;
  const presenceScore = Math.min(1.0, Math.max(0.2, elapsedPresence / 1.0));
  const trackStabilityScore = (0.65 * trackSpanScore) + (0.35 * presenceScore);

  // 4. Visibility & Occlusion / Frame Boundary Clipping (Weight: 0.10)
  // Evaluates how much of the bounding box is fully contained within visible [0, 1] frame
  const x1 = Math.max(0, ov.bbox.x);
  const y1 = Math.max(0, ov.bbox.y);
  const x2 = Math.min(1, ov.bbox.x + ov.bbox.width);
  const y2 = Math.min(1, ov.bbox.y + ov.bbox.height);
  const visibleW = Math.max(0, x2 - x1);
  const visibleH = Math.max(0, y2 - y1);
  const visibleArea = visibleW * visibleH;
  const nominalArea = Math.max(1e-6, ov.bbox.width * ov.bbox.height);
  const boundaryVis = Math.min(1.0, visibleArea / nominalArea);

  // Tiny dimension factor (penalize extreme slivers)
  const minDim = Math.min(ov.bbox.width, ov.bbox.height);
  const dimFactor = minDim >= 0.03 ? 1.0 : Math.max(0.1, minDim / 0.03);
  const visibilityScore = Math.max(0, Math.min(1.0, boundaryVis * dimFactor));

  // 5. Center Proximity (Weight: 0.05)
  // Distance from object center (cx, cy) to screen center (0.5, 0.5)
  const cx = ov.center?.x ?? (ov.bbox.x + (ov.bbox.width / 2.0));
  const cy = ov.center?.y ?? (ov.bbox.y + (ov.bbox.height / 2.0));
  const distFromCenter = Math.hypot(cx - 0.5, cy - 0.5);
  const maxCornerDist = 0.707106; // Math.hypot(0.5, 0.5)
  const centerProximityScore = Math.max(0, 1.0 - (distFromCenter / maxCornerDist));

  // Composite Weighted Dominance Score
  const total =
    (0.50 * bboxAreaScore) +
    (0.20 * confidenceScore) +
    (0.15 * trackStabilityScore) +
    (0.10 * visibilityScore) +
    (0.05 * centerProximityScore);

  return {
    total,
    bboxAreaScore,
    confidenceScore,
    trackStabilityScore,
    visibilityScore,
    centerProximityScore,
    rawArea,
  };
}

// Utility for linear interpolation between numbers
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export const ShoppingOverlay: React.FC<ShoppingOverlayProps> = ({
  currentTime,
  overlayData,
  productsMap,
  containerRect,
  videoNaturalSize,
  isCompactMode = false,
  isDebugMode = false,
  selectedProductId = null,
  onSelectProduct,
}) => {
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);

  // Persistent refs for temporal hold stabilization across animation frames
  const lockedProductIdRef = useRef<string | null>(null);
  const lockStartTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(currentTime);
  const previousSelectedIdRef = useRef<string | null>(selectedProductId);

  // 1. Calculate exact video render box within container (handling letterboxing/pillarboxing)
  const videoRenderBox = useMemo(() => {
    const { width: cw, height: ch } = containerRect;
    const { width: vw, height: vh } = videoNaturalSize;

    if (cw === 0 || ch === 0 || vw === 0 || vh === 0) {
      return { x: 0, y: 0, width: cw, height: ch };
    }

    const containerAspect = cw / ch;
    const videoAspect = vw / vh;

    let rw = cw;
    let rh = ch;
    let ox = 0;
    let oy = 0;

    if (containerAspect > videoAspect) {
      // Pillarboxed (bars on left/right)
      rh = ch;
      rw = ch * videoAspect;
      ox = (cw - rw) / 2;
    } else {
      // Letterboxed (bars on top/bottom)
      rw = cw;
      rh = cw / videoAspect;
      oy = (ch - rh) / 2;
    }

    return { x: ox, y: oy, width: rw, height: rh };
  }, [containerRect, videoNaturalSize]);

  // 2. Compute smooth interpolated active overlay items for current playback timestamp
  const activeOverlays = useMemo((): OverlayItem[] => {
    if (!overlayData || !overlayData.timeline_frames || overlayData.timeline_frames.length === 0) {
      return [];
    }

    const frames = overlayData.timeline_frames;
    const count = frames.length;

    // Edge cases: before first frame or after last frame
    if (currentTime <= frames[0].timestamp) {
      const diff = frames[0].timestamp - currentTime;
      return diff <= 0.4 ? frames[0].overlays : [];
    }

    if (currentTime >= frames[count - 1].timestamp) {
      const diff = currentTime - frames[count - 1].timestamp;
      return diff <= 0.4 ? frames[count - 1].overlays : [];
    }

    // Binary search to find adjacent bracket frames [i, i+1]
    let low = 0;
    let high = count - 1;
    let frameIdx = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (frames[mid].timestamp <= currentTime) {
        frameIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const nextIdx = Math.min(count - 1, frameIdx + 1);
    const fA = frames[frameIdx];
    const fB = frames[nextIdx];

    if (frameIdx === nextIdx || fA.timestamp === fB.timestamp) {
      return fA.overlays;
    }

    const timeSpan = fB.timestamp - fA.timestamp;
    // If frames are too far apart (> 0.6s), use closest frame without interpolation
    if (timeSpan > 0.6) {
      const diffA = Math.abs(currentTime - fA.timestamp);
      const diffB = Math.abs(currentTime - fB.timestamp);
      if (diffA < diffB && diffA <= 0.35) return fA.overlays;
      if (diffB <= 0.35) return fB.overlays;
      return [];
    }

    const alpha = Math.max(0, Math.min(1, (currentTime - fA.timestamp) / timeSpan));

    // Interpolate overlays between frame A and frame B
    const bOverlayMap = new Map<string, OverlayItem>();
    fB.overlays.forEach((item) => bOverlayMap.set(item.product_id, item));

    const interpolatedList: OverlayItem[] = [];

    fA.overlays.forEach((itemA) => {
      const itemB = bOverlayMap.get(itemA.product_id);
      if (itemB) {
        // Smoothly interpolate bounding box, center, card_position, and anchor
        interpolatedList.push({
          product_id: itemA.product_id,
          track_id: itemA.track_id || itemB.track_id,
          title: itemA.title || itemB.title,
          brand: itemA.brand || itemB.brand,
          category: itemA.category || itemB.category,
          class_name: itemA.class_name || itemB.class_name,
          image_url: itemA.image_url || itemB.image_url,
          crop_url: itemA.crop_url || itemB.crop_url,
          product_url: itemA.product_url || itemB.product_url,
          similarity: itemA.similarity ?? itemB.similarity,
          has_catalog_match: itemA.has_catalog_match ?? itemB.has_catalog_match,
          visual_similarity_score: itemA.visual_similarity_score ?? itemB.visual_similarity_score,
          bbox: {
            x: lerp(itemA.bbox.x, itemB.bbox.x, alpha),
            y: lerp(itemA.bbox.y, itemB.bbox.y, alpha),
            width: lerp(itemA.bbox.width, itemB.bbox.width, alpha),
            height: lerp(itemA.bbox.height, itemB.bbox.height, alpha),
          },
          center: {
            x: lerp(itemA.center.x, itemB.center.x, alpha),
            y: lerp(itemA.center.y, itemB.center.y, alpha),
          },
          polygon: alpha < 0.5 ? itemA.polygon : itemB.polygon,
          card_position: {
            placement: alpha < 0.5 ? itemA.card_position.placement : itemB.card_position.placement,
            x: lerp(itemA.card_position.x, itemB.card_position.x, alpha),
            y: lerp(itemA.card_position.y, itemB.card_position.y, alpha),
            width: lerp(itemA.card_position.width, itemB.card_position.width, alpha),
            height: lerp(itemA.card_position.height, itemB.card_position.height, alpha),
          },
          anchor: {
            x: lerp(itemA.anchor.x, itemB.anchor.x, alpha),
            y: lerp(itemA.anchor.y, itemB.anchor.y, alpha),
          },
          confidence: lerp(itemA.confidence, itemB.confidence, alpha),
        });
      } else if (alpha < 0.4) {
        interpolatedList.push(itemA);
      }
    });

    // Check items present in B but not in A
    fB.overlays.forEach((itemB) => {
      const existsInA = fA.overlays.some((a) => a.product_id === itemB.product_id);
      if (!existsInA && alpha >= 0.6) {
        interpolatedList.push(itemB);
      }
    });

    return interpolatedList;
  }, [overlayData, currentTime]);

  // 3. Calculate Dominance Scores for all currently visible valid tracks
  const scoredOverlays = useMemo(() => {
    return activeOverlays
      .map((ov) => {
        const prod = productsMap.get(ov.product_id);
        const breakdown = calculateDominanceScore(ov, prod, currentTime);
        return {
          overlay: ov,
          product: prod,
          score: breakdown.total,
          breakdown,
        };
      })
      .filter((item): item is { overlay: OverlayItem; product: ProductMatch; score: number; breakdown: DominanceScoreBreakdown } => {
        return item.product !== undefined && item.overlay.bbox.width > 0 && item.overlay.bbox.height > 0;
      })
      .sort((a, b) => b.score - a.score);
  }, [activeOverlays, productsMap, currentTime]);

  // 4. Select the SINGLE MOST DOMINANT VALID PRODUCT with ~3s temporal hold stabilization
  const dominantItem = useMemo(() => {
    if (scoredOverlays.length === 0) {
      lockedProductIdRef.current = null;
      lockStartTimeRef.current = currentTime;
      lastTimeRef.current = currentTime;
      return null;
    }

    const prevTime = lastTimeRef.current;
    const timeJumped = Math.abs(currentTime - prevTime) > 0.65;
    const timeReversed = currentTime < lockStartTimeRef.current;
    const userSelectionChanged = selectedProductId && selectedProductId !== previousSelectedIdRef.current;
    previousSelectedIdRef.current = selectedProductId;

    // A. If user explicitly selected a product and it is visible in the current frame, lock onto it
    if (userSelectionChanged && selectedProductId) {
      const userSelected = scoredOverlays.find((s) => s.overlay.product_id === selectedProductId);
      if (userSelected) {
        lockedProductIdRef.current = selectedProductId;
        lockStartTimeRef.current = currentTime;
        lastTimeRef.current = currentTime;
        return userSelected;
      }
    }

    const currentLockedId = lockedProductIdRef.current;
    const lockedStillVisible = currentLockedId
      ? scoredOverlays.find((s) => s.overlay.product_id === currentLockedId)
      : null;

    // B. If video seeked/jumped, reversed, or the previously locked product left the frame:
    // Immediately choose the highest-scoring valid product and start a fresh hold interval
    if (timeJumped || timeReversed || !currentLockedId || !lockedStillVisible) {
      const best = scoredOverlays[0];
      lockedProductIdRef.current = best.overlay.product_id;
      lockStartTimeRef.current = currentTime;
      lastTimeRef.current = currentTime;
      return best;
    }

    // C. Check if the ~3-second display/hold interval has elapsed
    const holdElapsed = currentTime - lockStartTimeRef.current;
    if (holdElapsed >= HOLD_DURATION) {
      // Recalculate dominance! Pick the current highest-scoring product
      const best = scoredOverlays[0];
      lockedProductIdRef.current = best.overlay.product_id;
      lockStartTimeRef.current = currentTime;
      lastTimeRef.current = currentTime;
      return best;
    }

    // D. Hold interval is active and locked product is still visible:
    // Continuously follow and update the locked product's live bounding box
    lastTimeRef.current = currentTime;
    return lockedStillVisible;
  }, [scoredOverlays, currentTime, selectedProductId]);

  if (!dominantItem || videoRenderBox.width <= 0 || videoRenderBox.height <= 0) {
    return null;
  }

  const { overlay: ov, product: prod, breakdown } = dominantItem;
  const isHovered = hoveredProductId === ov.product_id;
  const isSelected = selectedProductId === ov.product_id;

  const cardW = isCompactMode ? 210 : 275;
  const cardH = isCompactMode ? 44 : 145;

  // Object pixel coordinates
  const objX = videoRenderBox.x + (ov.bbox.x * videoRenderBox.width);
  const objY = videoRenderBox.y + (ov.bbox.y * videoRenderBox.height);
  const objW = Math.max(16, ov.bbox.width * videoRenderBox.width);
  const objH = Math.max(16, ov.bbox.height * videoRenderBox.height);

  // Card pixel coordinates with viewport boundary clamping
  const rawCardX = videoRenderBox.x + (ov.card_position.x * videoRenderBox.width);
  const rawCardY = videoRenderBox.y + (ov.card_position.y * videoRenderBox.height);

  const minCardX = videoRenderBox.x + 8;
  const maxCardX = Math.max(minCardX, videoRenderBox.x + videoRenderBox.width - cardW - 8);
  const minCardY = videoRenderBox.y + 8;
  const maxCardY = Math.max(minCardY, videoRenderBox.y + videoRenderBox.height - cardH - 8);

  const clampedCardX = Math.max(minCardX, Math.min(maxCardX, rawCardX));
  const clampedCardY = Math.max(minCardY, Math.min(maxCardY, rawCardY));

  // Object anchor / center point
  const startX = videoRenderBox.x + (ov.anchor.x * videoRenderBox.width);
  const startY = videoRenderBox.y + (ov.anchor.y * videoRenderBox.height);

  // Dynamic connector end point on card edge closest to object anchor
  let endX = clampedCardX;
  let endY = clampedCardY + (cardH / 2);

  if (startX < clampedCardX) {
    // Object is to the left of the card -> connect to left edge
    endX = clampedCardX;
    endY = Math.max(clampedCardY + 14, Math.min(clampedCardY + cardH - 14, startY));
  } else if (startX > clampedCardX + cardW) {
    // Object is to the right of the card -> connect to right edge
    endX = clampedCardX + cardW;
    endY = Math.max(clampedCardY + 14, Math.min(clampedCardY + cardH - 14, startY));
  } else if (startY < clampedCardY) {
    // Object is above the card -> connect to top edge
    endX = Math.max(clampedCardX + 14, Math.min(clampedCardX + cardW - 14, startX));
    endY = clampedCardY;
  } else {
    // Object is below the card -> connect to bottom edge
    endX = Math.max(clampedCardX + 14, Math.min(clampedCardX + cardW - 14, startX));
    endY = clampedCardY + cardH;
  }

  // Smooth Bezier Curve
  const midX = (startX + endX) / 2;
  const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

  const trackNum = ov.track_id || prod.track_id || 1;
  const yoloClass = ov.class_name || (prod as any).class_name || prod.product_type || prod.category;
  const confPct = Math.round((ov.confidence || prod.confidence || 0.9) * 100);
  const clipVal = prod.visual_similarity_score ? (prod.visual_similarity_score / 100).toFixed(2) : 'N/A';
  const cropLabel = prod.crop_image ? prod.crop_image.split('/').pop()?.replace('.jpg', '') : `track_${trackNum}`;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {/* SVG Layer for Glowing Bounding Boxes & Dynamic Bezier Connector Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          {/* Glowing gradient for connector lines */}
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#60A5FA" stopOpacity="1" />
          </linearGradient>

          {/* Active hover gradient */}
          <linearGradient id="lineGradHover" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="1" />
            <stop offset="50%" stopColor="#EC4899" stopOpacity="1" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="1" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Strong hover glow */}
          <filter id="strongGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g key={`svg_${ov.product_id}`}>
          {/* 1. Object Bounding Box with Rounded Corners & Interactive Click Target */}
          <rect
            x={objX}
            y={objY}
            width={objW}
            height={objH}
            rx={8}
            ry={8}
            fill={isHovered || isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.12)'}
            stroke={isHovered || isSelected ? '#60A5FA' : '#3B82F6'}
            strokeWidth={isHovered || isSelected ? 2.8 : 2}
            strokeDasharray={isHovered || isSelected ? 'none' : '4 2'}
            filter={isHovered || isSelected ? 'url(#strongGlow)' : 'url(#glow)'}
            className="pointer-events-auto cursor-pointer transition-all duration-150"
            onClick={(e) => {
              e.stopPropagation();
              onSelectProduct(prod);
            }}
            onMouseEnter={() => setHoveredProductId(ov.product_id)}
            onMouseLeave={() => setHoveredProductId(null)}
          />

          {/* 2. Center Pulsing Target Dot */}
          <circle
            cx={startX}
            cy={startY}
            r={isHovered || isSelected ? 6 : 4.5}
            fill="#60A5FA"
            stroke="#FFFFFF"
            strokeWidth={1.5}
            className="pointer-events-none"
          />
          <circle
            cx={startX}
            cy={startY}
            r={isHovered || isSelected ? 3.5 : 2.5}
            fill="#3B82F6"
            className="pointer-events-none"
          />

          {/* 3. Smooth Bezier Curved Connector Line */}
          <path
            d={pathD}
            fill="none"
            stroke={isHovered || isSelected ? 'url(#lineGradHover)' : 'url(#lineGrad)'}
            strokeWidth={isHovered || isSelected ? 3 : 2.2}
            strokeLinecap="round"
            className="pointer-events-none"
          />

          {/* 4. Card Anchor Point Dot */}
          <circle
            cx={endX}
            cy={endY}
            r={3.5}
            fill={isHovered || isSelected ? '#EC4899' : '#8B5CF6'}
            stroke="#FFFFFF"
            strokeWidth={1.2}
            className="pointer-events-none"
          />
        </g>
      </svg>

      {/* HTML Interactive Layers: Single Dominant Card & Debug HUD & Click Badge */}
      <React.Fragment key={`interactive_track_${trackNum}_${ov.product_id}`}>
        {/* Clickable Object Tag Overlay above bounding box */}
        <div
          className="absolute pointer-events-auto cursor-pointer transition-all duration-150 select-none z-30"
          style={{
            left: `${Math.max(videoRenderBox.x + 4, objX)}px`,
            top: `${Math.max(videoRenderBox.y + 4, objY - 24)}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectProduct(prod);
          }}
          onMouseEnter={() => setHoveredProductId(ov.product_id)}
          onMouseLeave={() => setHoveredProductId(null)}
        >
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold backdrop-blur-md border transition-all ${
            isHovered || isSelected
              ? 'bg-blue-600 text-white border-blue-400 shadow-glow-sm scale-105'
              : 'bg-black/75 text-blue-300 border-white/20 hover:bg-blue-600 hover:text-white'
          }`}>
            <MousePointerClick className="w-2.5 h-2.5" />
            <span>{prod.brand && prod.brand !== 'Unknown' ? prod.brand : prod.category.toUpperCase()}</span>
            <span className="text-[9px] opacity-75">#{trackNum}</span>
          </div>
        </div>

        {/* Debug Mode HUD Badge (When Debug Mode is Enabled) */}
        {isDebugMode && (
          <div
            className="absolute pointer-events-none z-40 bg-black/95 text-emerald-400 border border-emerald-500/50 rounded-xl p-3 font-mono text-[9px] space-y-1 shadow-2xl backdrop-blur-md min-w-[215px]"
            style={{
              left: `${Math.max(videoRenderBox.x + 4, objX)}px`,
              top: `${objY + (ov.bbox.height * videoRenderBox.height) + 6}px`,
            }}
          >
            <div className="flex items-center justify-between text-white font-bold border-b border-white/20 pb-0.5 mb-1">
              <span className="flex items-center gap-1 text-blue-400">
                <Sparkles className="w-3 h-3 text-amber-400" />
                DOMINANT #{trackNum}
              </span>
              <span className="text-emerald-300 font-bold">{confPct}%</span>
            </div>
            <div>YOLO CLASS: <span className="text-cyan-300 uppercase">{yoloClass}</span></div>
            <div>CATEGORY: <span className="text-white">{ov.category || prod.category}</span></div>
            <div>BRAND: <span className="text-white">{ov.brand || prod.brand || 'Unknown'}</span></div>
            <div>CROP: <span className="text-amber-300">{cropLabel}</span></div>
            <div>CLIP: <span className={prod.has_catalog_match ? 'text-emerald-300' : 'text-gray-400'}>{clipVal}</span></div>
            <div>
              CATALOG: <span className={prod.has_catalog_match ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {prod.has_catalog_match ? 'MATCH' : 'NO MATCH'}
              </span>
            </div>
            {/* Dominance Score Breakdown */}
            <div className="border-t border-emerald-500/30 pt-1 mt-1 text-[8.5px] space-y-0.5 text-emerald-300">
              <div className="font-bold text-amber-300 flex justify-between">
                <span>DOMINANCE SCORE:</span>
                <span>{(breakdown.total * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>• Area (50%):</span>
                <span>{(breakdown.rawArea * 100).toFixed(1)}% frame</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>• Confidence (20%):</span>
                <span>{(breakdown.confidenceScore * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>• Stability (15%):</span>
                <span>{(breakdown.trackStabilityScore * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>• Visibility (10%):</span>
                <span>{(breakdown.visibilityScore * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>• Center Prox (5%):</span>
                <span>{(breakdown.centerProximityScore * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-cyan-300 font-bold pt-0.5">
                <span>• Hold Timer:</span>
                <span>{Math.max(0, currentTime - lockStartTimeRef.current).toFixed(1)}s / {HOLD_DURATION.toFixed(1)}s</span>
              </div>
            </div>
          </div>
        )}

        {/* Product Card Positioned beside Object */}
        <div
          className={`absolute pointer-events-auto will-change-transform transition-all duration-150 ${
            isHovered || isSelected ? 'scale-[1.02] z-30' : 'z-20'
          }`}
          style={{
            left: `${clampedCardX}px`,
            top: `${clampedCardY}px`,
          }}
          onMouseEnter={() => setHoveredProductId(ov.product_id)}
          onMouseLeave={() => setHoveredProductId(null)}
        >
          <ProductCard
            product={prod}
            position={ov.card_position}
            isCompact={isCompactMode}
            onSelectProduct={onSelectProduct}
          />
        </div>
      </React.Fragment>
    </div>
  );
};
