import React from 'react';
import { ProductInterval } from '../types';

interface TimelineBarProps {
  currentTime: number;
  duration: number;
  productIntervals: ProductInterval[];
  onSeek: (time: number) => void;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  currentTime,
  duration,
  productIntervals,
  onSeek,
}) => {
  const safeDuration = duration > 0 ? duration : 1.0;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(clickRatio * safeDuration);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full space-y-2 select-none">
      {/* Time Progress Bar */}
      <div
        onClick={handleTimelineClick}
        className="relative h-2.5 w-full bg-white/10 hover:bg-white/15 rounded-full cursor-pointer transition-all group overflow-visible"
      >
        {/* Product Presence Highlight Intervals */}
        {productIntervals.map((interval, i) => {
          const startPct = (interval.start_time / safeDuration) * 100;
          const widthPct = Math.max(2, ((interval.end_time - interval.start_time) / safeDuration) * 100);
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0 rounded-full bg-blue-500/40 border-t border-b border-blue-400/80 group-hover:bg-blue-500/60 transition-colors"
              style={{
                left: `${startPct}%`,
                width: `${widthPct}%`,
              }}
              title={`Product detected: ${interval.title} (${interval.start_time.toFixed(1)}s - ${interval.end_time.toFixed(1)}s)`}
            />
          );
        })}

        {/* Current Playhead Fill */}
        <div
          className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Draggable Scrubber Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-glow-sm group-hover:scale-125 transition-transform"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      {/* Time Indicators & Product Marker Pills */}
      <div className="flex items-center justify-between text-xs text-gray-400 px-1">
        <span className="font-mono">{formatTime(currentTime)}</span>

        {/* Product Fast-Jump Badges */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {productIntervals.map((interval, i) => (
            <button
              key={i}
              onClick={() => onSeek(interval.best_timestamp || interval.start_time)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-blue-500/20 text-[10px] text-gray-300 hover:text-blue-300 border border-white/10 hover:border-blue-500/30 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="truncate max-w-[90px] font-medium">{interval.title}</span>
              <span className="text-gray-500 font-mono">@{interval.start_time.toFixed(1)}s</span>
            </button>
          ))}
        </div>

        <span className="font-mono">{formatTime(safeDuration)}</span>
      </div>
    </div>
  );
};
