import React from 'react';
import { ShoppingBag, Sparkles, Cpu, Eye, Video, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  onNewVideo: () => void;
  isAnalyzing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onNewVideo, isAnalyzing }) => {
  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/10 bg-[#080B11]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={onNewVideo}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 p-[1px] shadow-glow-sm group-hover:shadow-glow-md transition-all duration-300">
            <div className="w-full h-full bg-[#0E131F] rounded-xl flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-[#0B0F17]">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-xl tracking-tight text-white group-hover:text-blue-300 transition-colors">
                SHOPVISION <span className="gradient-text-blue">AI</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v1.0 Pro
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-medium tracking-wide">
              AI-Powered Shoppable Video Object Tracking
            </p>
          </div>
        </div>

        {/* AI Engine Status Badges */}
        <div className="hidden md:flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-medium text-[11px]">YOLO11</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            <span className="font-medium text-[11px]">SAM 2 Tracking</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium text-[11px]">CLIP Visual Match</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-medium text-[11px]">Verified Stores</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onNewVideo}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs shadow-glow-sm hover:shadow-glow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Video className="w-4 h-4" />
            <span>Upload New Video</span>
          </button>
        </div>

      </div>
    </header>
  );
};
