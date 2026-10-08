import React, { useState, useRef } from 'react';
import { Upload, Video, FileCheck, AlertCircle, Sparkles, Zap, Clock, Maximize2 } from 'lucide-react';

interface UploadBoxProps {
  onFileSelected: (file: File) => void;
  isUploading: boolean;
}

export const UploadBox: React.FC<UploadBoxProps> = ({ onFileSelected, isUploading }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ duration?: number; width?: number; height?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);
    const validExtensions = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!validExtensions.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|webm|mkv)$/i)) {
      setError('Please select a valid video format (.mp4, .mov, .webm, .avi)');
      return;
    }

    if (file.size > 250 * 1024 * 1024) {
      setError('File size exceeds the 250MB limit.');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Read metadata
    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      setVideoMeta({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmUpload = () => {
    if (selectedFile) {
      onFileSelected(selectedFile);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Drag and Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={`relative overflow-hidden rounded-3xl p-8 sm:p-10 border-2 border-dashed transition-all duration-300 text-center cursor-pointer glass-panel ${
          isDragOver
            ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
            : selectedFile
            ? 'border-emerald-500/40 bg-emerald-500/[0.02]'
            : 'border-white/15 hover:border-blue-500/50 hover:bg-white/[0.02]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/avi"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />

        {!selectedFile ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            {/* Pulsing Icon */}
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600/30 via-indigo-500/20 to-purple-600/30 border border-blue-500/30 flex items-center justify-center shadow-glow-sm group-hover:scale-105 transition-transform">
              <Upload className="w-9 h-9 text-blue-400 animate-bounce" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-heading font-bold text-white">
                Drag & Drop Video or Click to Browse
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto">
                Upload any video showing sneakers, watches, bags, headphones, or accessories.
              </p>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-2">
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">MP4</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">MOV</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">WEBM</span>
              <span>• Up to 250MB</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            {/* Video Preview */}
            {previewUrl && (
              <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden bg-black/60 border border-white/10 shadow-lg">
                <video src={previewUrl} className="w-full h-full object-contain" controls />
              </div>
            )}

            <div className="w-full max-w-md p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-left">
              <div className="flex items-center gap-2.5 truncate">
                <Video className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-bold text-white truncate">{selectedFile.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                    {videoMeta?.duration && ` • ${videoMeta.duration.toFixed(1)}s`}
                    {videoMeta?.width && ` • ${videoMeta.width}x${videoMeta.height}`}
                  </p>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
              >
                Change
              </button>
            </div>

            {/* Start Analysis Button */}
            <button
              onClick={handleConfirmUpload}
              disabled={isUploading}
              className="w-full max-w-md flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-heading font-bold text-sm shadow-glow-md hover:shadow-glow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>{isUploading ? 'Uploading & Analyzing...' : 'Start AI Shoppable Video Analysis'}</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
