import React from 'react';
import { CheckCircle2, Loader2, Circle, AlertCircle, Cpu, Sparkles, Layers, Eye, Search, Video } from 'lucide-react';
import { JobStatus } from '../types';

interface ProcessingStatusProps {
  status: JobStatus | null;
  onCancel?: () => void;
}

const STAGES = [
  { key: 'uploaded', label: 'Video Upload & Validation', icon: Video },
  { key: 'extracting_frames', label: 'Extracting Video Frames', icon: Eye },
  { key: 'detecting_products', label: 'YOLO11 Candidate Object Detection', icon: Cpu },
  { key: 'tracking_products', label: 'SAM 2 Spatio-Temporal Tracking & Masks', icon: Layers },
  { key: 'identifying_brands', label: 'Best Frame & Vision Brand Analysis', icon: Sparkles },
  { key: 'finding_products', label: 'CLIP Visual Matching & Multi-Store Search', icon: Search },
  { key: 'generating_overlays', label: 'Generating Responsive Interactive Overlays', icon: CheckCircle2 },
];

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ status }) => {
  if (!status) return null;

  const currentStageKey = status.status;
  const progressPct = status.progress || 0;

  // Determine stage state: 'completed' | 'current' | 'pending'
  const getStageState = (stageKey: string, index: number) => {
    if (status.status === 'completed') return 'completed';
    if (status.status === 'failed') return 'failed';

    const stageOrder = STAGES.map((s) => s.key);
    const currentIndex = stageOrder.indexOf(currentStageKey);

    if (currentIndex === -1) {
      return index === 0 ? 'current' : 'pending';
    }

    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="w-full max-w-xl mx-auto glass-panel p-6 sm:p-8 rounded-3xl space-y-6 border border-white/10 shadow-2xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="font-heading font-bold text-lg text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400 animate-spin" />
            <span>AI Shoppable Video Processing</span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {status.message || 'Analyzing video frames and building interactive shopping overlays...'}
          </p>
        </div>
        <span className="font-heading font-black text-2xl gradient-text-blue">
          {progressPct}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Stages List */}
      <div className="space-y-3.5">
        {STAGES.map((stage, idx) => {
          const state = getStageState(stage.key, idx);
          const IconComponent = stage.icon;

          return (
            <div
              key={stage.key}
              className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                state === 'current'
                  ? 'bg-blue-500/10 border border-blue-500/30 text-white'
                  : state === 'completed'
                  ? 'bg-white/[0.02] text-gray-300'
                  : 'text-gray-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    state === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : state === 'current'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-white/5 text-gray-600'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">{stage.label}</span>
              </div>

              {/* Status Indicator */}
              <div>
                {state === 'completed' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                {state === 'current' && (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                )}
                {state === 'pending' && (
                  <Circle className="w-3.5 h-3.5 text-gray-600" />
                )}
                {state === 'failed' && (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {status.status === 'failed' && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{status.message || 'An error occurred during video analysis.'}</span>
        </div>
      )}
    </div>
  );
};
