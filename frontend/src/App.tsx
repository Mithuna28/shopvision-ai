import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { UploadBox } from './components/UploadBox';
import { DemoSelector } from './components/DemoSelector';
import { ProcessingStatus } from './components/ProcessingStatus';
import { VideoPlayer } from './components/VideoPlayer';
import { ProductSidebar } from './components/ProductSidebar';
import { ProductDrawer } from './components/ProductDrawer';
import { ExportModal } from './components/ExportModal';
import { api } from './services/api';
import { JobStatus, ProductMatch, OverlayDataset } from './types';
import { Sparkles, ShoppingBag, Eye, Cpu, Layers, ShieldCheck, ArrowRight, Video } from 'lucide-react';
import confetti from 'canvas-confetti';

export function App() {
  // Application State
  const [currentView, setCurrentView] = useState<'upload' | 'processing' | 'results'>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Analysis Results
  const [products, setProducts] = useState<ProductMatch[]>([]);
  const [overlayData, setOverlayData] = useState<OverlayDataset | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductMatch | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Loading States
  const [isUploading, setIsUploading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  // 1. Handle Video Upload & Start Analysis Flow
  const handleFileSelected = async (file: File) => {
    setIsUploading(true);
    try {
      const uploadRes = await api.uploadVideo(file);
      setJobId(uploadRes.job_id);
      setVideoUrl(api.getVideoStreamUrl(uploadRes.job_id));

      // Trigger analysis
      setCurrentView('processing');
      await api.startAnalysis(uploadRes.job_id);
      startStatusPolling(uploadRes.job_id);
    } catch (err: any) {
      alert(`Upload error: ${err.message || 'Failed to upload'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // 2. Handle 1-Click Demo Selection
  const handleSelectDemo = async (demoId: string) => {
    setIsDemoLoading(true);
    try {
      const demoRes = await api.loadDemo(demoId);
      setJobId(demoRes.job_id);
      setVideoUrl(api.getVideoStreamUrl(demoRes.job_id));

      setCurrentView('processing');
      await api.startAnalysis(demoRes.job_id);
      startStatusPolling(demoRes.job_id);
    } catch (err: any) {
      alert(`Failed to load demo scenario: ${err.message || 'Error'}`);
    } finally {
      setIsDemoLoading(false);
    }
  };

  // 3. Status Polling & SSE Stream Listener
  const startStatusPolling = (activeJobId: string) => {
    // Connect SSE stream
    const unsubscribe = api.subscribeStatusStream(
      activeJobId,
      (status) => {
        setJobStatus(status);
        if (status.status === 'completed') {
          loadResults(activeJobId);
        }
      },
      (err) => {
        // Fallback to polling if SSE encounters issues
        const interval = setInterval(async () => {
          try {
            const st = await api.getJobStatus(activeJobId);
            setJobStatus(st);
            if (st.status === 'completed') {
              clearInterval(interval);
              loadResults(activeJobId);
            } else if (st.status === 'failed') {
              clearInterval(interval);
            }
          } catch (e) {
            console.error('Polling error:', e);
          }
        }, 1200);
      }
    );
  };

  // 4. Load Results
  const loadResults = async (activeJobId: string) => {
    try {
      const [prodRes, overlayRes] = await Promise.all([
        api.getProducts(activeJobId),
        api.getOverlays(activeJobId),
      ]);

      setProducts(prodRes.products);
      setOverlayData(overlayRes);
      setCurrentView('results');

      // Trigger celebration confetti
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3B82F6', '#8B5CF6', '#10B981']
      });
    } catch (err) {
      console.error('Error fetching results:', err);
    }
  };

  // 5. Reset to New Video
  const handleNewVideo = () => {
    setCurrentView('upload');
    setJobId(null);
    setJobStatus(null);
    setVideoUrl(null);
    setProducts([]);
    setOverlayData(null);
    setSelectedProduct(null);
  };

  return (
    <div className="min-h-screen bg-[#080B11] text-gray-100 flex flex-col antialiased selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar onNewVideo={handleNewVideo} isAnalyzing={currentView === 'processing'} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* VIEW 1: UPLOAD & DEMO EXPLORATION */}
        {currentView === 'upload' && (
          <div className="space-y-12 animate-fade-in">
            {/* Hero Section */}
            <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold shadow-glow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Gen AI Shoppable Video Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-black tracking-tight text-white leading-tight">
                Turn Every Object In Video Into A{' '}
                <span className="gradient-text-blue">Clickable Shopping Card</span>
              </h1>

              <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
                Upload any video. YOLO11 detects the products, SAM 2 tracks their movement across frames, CLIP identifies matching items, and dynamic shopping cards follow the objects in real-time.
              </p>
            </div>

            {/* Upload Zone */}
            <UploadBox onFileSelected={handleFileSelected} isUploading={isUploading} />

            {/* Test Scenarios Demo Selector */}
            <DemoSelector onSelectDemo={handleSelectDemo} isLoading={isDemoLoading} />

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
              <div className="glass-panel p-4 rounded-2xl space-y-2 border border-white/5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <h4 className="font-heading font-bold text-sm text-white">YOLO11 Detection</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Real-time candidate shoppable product bounding boxes and category recognition.
                </p>
              </div>

              <div className="glass-panel p-4 rounded-2xl space-y-2 border border-white/5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="font-heading font-bold text-sm text-white">SAM 2 Object Tracking</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Maintains continuous object identity and smooth normalized coordinates across frames.
                </p>
              </div>

              <div className="glass-panel p-4 rounded-2xl space-y-2 border border-white/5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="font-heading font-bold text-sm text-white">CLIP Visual Matching</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Cosine visual embeddings compare best product crops with verified catalog images.
                </p>
              </div>

              <div className="glass-panel p-4 rounded-2xl space-y-2 border border-white/5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="font-heading font-bold text-sm text-white">Verified Multi-Store</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Authentic verified prices and store links across Amazon, Myntra, Flipkart, and brand stores.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: REAL-TIME PROCESSING PIPELINE */}
        {currentView === 'processing' && (
          <div className="py-12">
            <ProcessingStatus status={jobStatus} />
          </div>
        )}

        {/* VIEW 3: INTERACTIVE RESULTS & VIDEO PLAYER */}
        {currentView === 'results' && videoUrl && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Results Bar */}
            <div className="flex items-center justify-between flex-wrap gap-4 glass-panel p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-base text-white">
                    Interactive Shoppable Video Ready
                  </h2>
                  <p className="text-xs text-gray-400">
                    Found {products.length} unique shoppable {products.length === 1 ? 'product' : 'products'} tracked across time.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-glow-emerald transition-all"
                >
                  <Video className="w-4 h-4" />
                  <span>Export MP4 Video</span>
                </button>

                <button
                  onClick={handleNewVideo}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
                >
                  New Video
                </button>
              </div>
            </div>

            {/* Video Player + Products Sidebar Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Main Interactive Video Player (8 Cols) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <VideoPlayer
                  videoUrl={videoUrl}
                  overlayData={overlayData}
                  products={products}
                  selectedProduct={selectedProduct}
                  onSelectProduct={(p) => setSelectedProduct(p)}
                  onOpenExportModal={() => setIsExportModalOpen(true)}
                />
              </div>

              {/* Discovered Products List Sidebar (4 Cols) */}
              <div className="lg:col-span-4 h-[580px]">
                <ProductSidebar
                  products={products}
                  selectedProduct={selectedProduct}
                  onSelectProduct={(p) => setSelectedProduct(p)}
                  onJumpToTimestamp={(t) => {
                    // Video player seek handled by child or ref
                    const videoEl = document.querySelector('video');
                    if (videoEl) {
                      videoEl.currentTime = t;
                      videoEl.play();
                    }
                  }}
                />
              </div>
            </div>

            {/* Product Details Side Drawer */}
            <ProductDrawer
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
              onJumpToTimestamp={(t) => {
                const videoEl = document.querySelector('video');
                if (videoEl) {
                  videoEl.currentTime = t;
                  videoEl.play();
                }
              }}
            />

            {/* MP4 Export Modal */}
            <ExportModal
              jobId={jobId}
              isOpen={isExportModalOpen}
              onClose={() => setIsExportModalOpen(false)}
            />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 bg-[#06080D] text-center text-xs text-gray-500">
        <p>© 2026 SHOPVISION AI — AI Shoppable Video Product Detection & Tracking Platform</p>
      </footer>
    </div>
  );
}

export default App;
