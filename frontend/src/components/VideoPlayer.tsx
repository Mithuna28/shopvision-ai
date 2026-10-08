import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Layers, Sparkles, Download, RotateCcw, Bug, Eye } from 'lucide-react';
import { ShoppingOverlay } from './ShoppingOverlay';
import { TimelineBar } from './TimelineBar';
import { ProductMatch, OverlayDataset } from '../types';

interface VideoPlayerProps {
  videoUrl: string;
  overlayData?: OverlayDataset | null;
  products: ProductMatch[];
  selectedProduct?: ProductMatch | null;
  onSelectProduct: (product: ProductMatch) => void;
  onOpenExportModal: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  overlayData,
  products,
  selectedProduct,
  onSelectProduct,
  onOpenExportModal,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverlays, setShowOverlays] = useState(true);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);

  const [containerRect, setContainerRect] = useState({ width: 0, height: 0 });
  const [videoNaturalSize, setVideoNaturalSize] = useState({ width: 1280, height: 720 });

  // Map products by ID for fast lookup
  const productsMap = React.useMemo(() => {
    const map = new Map<string, ProductMatch>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Track container resize to keep overlays responsive
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerRect({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Sync Video Metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      setVideoNaturalSize({
        width: videoRef.current.videoWidth || 1280,
        height: videoRef.current.videoHeight || 720,
      });
    }
  };

  // Sync Playback Time via high-frequency requestAnimationFrame during playback
  useEffect(() => {
    let animationFrameId: number;

    const syncTime = () => {
      if (videoRef.current && !videoRef.current.paused) {
        setCurrentTime(videoRef.current.currentTime);
        animationFrameId = requestAnimationFrame(syncTime);
      }
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(syncTime);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying]);

  // Fallback TimeUpdate for pause/seek events
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Play / Pause Toggle
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(console.error);
      }
    }
  };

  // Handle click on video area with normalized coordinate hit testing
  const handleVideoAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Calculate videoRenderBox
    const cw = rect.width;
    const ch = rect.height;
    const vw = videoNaturalSize.width || 1280;
    const vh = videoNaturalSize.height || 720;
    const containerAspect = cw / ch;
    const videoAspect = vw / vh;

    let rw = cw;
    let rh = ch;
    let ox = 0;
    let oy = 0;

    if (containerAspect > videoAspect) {
      rh = ch;
      rw = ch * videoAspect;
      ox = (cw - rw) / 2;
    } else {
      rw = cw;
      rh = cw / videoAspect;
      oy = (ch - rh) / 2;
    }

    // Check if click was inside the rendered video area
    if (clickX >= ox && clickX <= ox + rw && clickY >= oy && clickY <= oy + rh) {
      const normX = (clickX - ox) / rw;
      const normY = (clickY - oy) / rh;

      // Find active overlays at currentTime
      if (overlayData?.timeline_frames && overlayData.timeline_frames.length > 0) {
        const frames = overlayData.timeline_frames;
        let bestFrame = frames[0];
        let minDiff = Math.abs(currentTime - frames[0].timestamp);
        for (let i = 1; i < frames.length; i++) {
          const diff = Math.abs(currentTime - frames[i].timestamp);
          if (diff < minDiff) {
            minDiff = diff;
            bestFrame = frames[i];
          }
        }

        if (minDiff <= 0.45 && bestFrame.overlays.length > 0) {
          // Check hit against bounding boxes
          for (const ov of bestFrame.overlays) {
            const bx = ov.bbox.x;
            const by = ov.bbox.y;
            const bw = ov.bbox.width;
            const bh = ov.bbox.height;
            // Expand hit area slightly (2% margin) for responsive interaction
            if (
              normX >= bx - 0.02 &&
              normX <= bx + bw + 0.02 &&
              normY >= by - 0.02 &&
              normY <= by + bh + 0.02
            ) {
              const matchedProd = productsMap.get(ov.product_id);
              if (matchedProd) {
                onSelectProduct(matchedProd);
                return; // Successfully selected clicked object!
              }
            }
          }
        }
      }
    }

    // If no detected object hit, toggle play/pause
    togglePlay();
  };

  // Seek
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMute = !isMuted;
      videoRef.current.muted = nextMute;
      setIsMuted(nextMute);
      if (!nextMute && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  // Playback Rate
  const changeSpeed = () => {
    const rates = [0.5, 1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Video Container with Dynamic Overlay Layer */}
      <div
        ref={containerRef}
        onClick={handleVideoAreaClick}
        className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl border border-white/10 group select-none cursor-pointer"
      >
        {/* HTML5 Video Element */}
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain pointer-events-none"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          playsInline
        />

        {/* Dynamic Interactive AI Shopping Overlays Layer */}
        {showOverlays && (
          <ShoppingOverlay
            currentTime={currentTime}
            overlayData={overlayData}
            productsMap={productsMap}
            containerRect={containerRect}
            videoNaturalSize={videoNaturalSize}
            isCompactMode={isCompactMode}
            isDebugMode={isDebugMode}
            selectedProductId={selectedProduct?.id || null}
            onSelectProduct={onSelectProduct}
          />
        )}

        {/* Big Center Play/Pause Overlay Indicator when paused */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-opacity z-10 pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-blue-600/90 hover:bg-blue-500 text-white flex items-center justify-center shadow-glow-lg transition-transform hover:scale-110 active:scale-95">
              <Play className="w-8 h-8 fill-white ml-1" />
            </div>
          </div>
        )}

        {/* Live AI Overlay Active Badge */}
        {showOverlays && (
          <div className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-white text-xs font-semibold pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 -ml-4" />
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>AI Tracking Active</span>
          </div>
        )}
      </div>

      {/* Video Control Bar & Timeline */}
      <div className="glass-panel p-4 rounded-2xl space-y-3">
        {/* Timeline Bar with Detected Product Markers */}
        <TimelineBar
          currentTime={currentTime}
          duration={duration || overlayData?.duration || 0}
          productIntervals={overlayData?.product_intervals || []}
          onSeek={handleSeek}
        />

        {/* Control Buttons Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left Controls: Play, Volume, Time */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-glow-sm transition-all"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>

            {/* Restart button */}
            <button
              onClick={() => handleSeek(0)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Replay from start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 sm:w-20 accent-blue-500 h-1.5 bg-white/20 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Right Controls: Overlay Toggles, Debug Mode, Speed, Export, Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Toggle Overlay Visibility */}
            <button
              onClick={() => setShowOverlays(!showOverlays)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                showOverlays
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showOverlays ? 'Overlays On' : 'Overlays Off'}</span>
            </button>

            {/* Toggle Compact Mode */}
            <button
              onClick={() => setIsCompactMode(!isCompactMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isCompactMode
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'
              }`}
            >
              <span>{isCompactMode ? 'Pill Mode' : 'Card Mode'}</span>
            </button>

            {/* Toggle Debug Mode HUD */}
            <button
              onClick={() => setIsDebugMode(!isDebugMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isDebugMode
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-glow-emerald'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'
              }`}
              title="Toggle AI Debug HUD (Confidence, BBox, Track ID, CLIP Sim)"
            >
              <Bug className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isDebugMode ? 'Debug HUD: ON' : 'Debug'}</span>
            </button>

            {/* Playback Speed */}
            <button
              onClick={changeSpeed}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-gray-300 hover:text-white transition-colors"
              title="Playback Speed"
            >
              {playbackRate}x
            </button>

            {/* Export Video Button */}
            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition-colors"
              title="Export Burned-In MP4 Video"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export MP4</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

