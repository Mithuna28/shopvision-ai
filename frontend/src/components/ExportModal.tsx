import React, { useState } from 'react';
import { X, Download, Video, CheckCircle2, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../services/api';

interface ExportModalProps {
  jobId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ jobId, isOpen, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !jobId) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const res = await api.exportVideo(jobId);
      if (res.success) {
        setExportDownloadUrl(api.getExportDownloadUrl(jobId));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate video export.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md bg-[#0F1422] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-white">
                Export Video with Burned-In Overlays
              </h3>
              <p className="text-[11px] text-gray-400">
                Generate standalone MP4 video file with shopping tags rendered.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-xs text-gray-300 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Burned-In Video Mode</span>
            </div>
            <p className="text-gray-400 text-[11px] leading-relaxed">
              This will encode glowing bounding boxes, curved connector lines, product brand tags, and prices directly into the video stream for sharing or offline playback.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {exportDownloadUrl ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>MP4 Video rendered successfully!</span>
              </div>

              <a
                href={exportDownloadUrl}
                download
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-glow-emerald transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Exported MP4</span>
              </a>
            </div>
          ) : (
            <button
              onClick={handleStartExport}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-glow-sm hover:shadow-glow-md transition-all disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Rendering MP4 Video...</span>
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  <span>Render & Generate MP4</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
