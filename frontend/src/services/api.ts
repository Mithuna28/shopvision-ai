import { JobStatus, ProductMatch, OverlayDataset, DemoScenario } from '../types';

const API_BASE = 'http://localhost:8000/api';

export const api = {
  async uploadVideo(file: File): Promise<{ success: boolean; job_id: string; filename: string; size_mb: number; video_url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  async loadDemo(demoId: string): Promise<{ success: boolean; job_id: string; filename: string; size_mb: number; video_url: string }> {
    const res = await fetch(`${API_BASE}/demos/${demoId}/load`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to load demo' }));
      throw new Error(err.detail || 'Failed to load demo');
    }
    return res.json();
  },

  async startAnalysis(jobId: string, sampleFps: number = 8.0): Promise<{ success: boolean; job_id: string }> {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, sample_fps: sampleFps }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Analysis failed to start' }));
      throw new Error(err.detail || 'Failed to start analysis');
    }
    return res.json();
  },

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const res = await fetch(`${API_BASE}/status/${jobId}`);
    if (!res.ok) {
      throw new Error('Failed to fetch job status');
    }
    return res.json();
  },

  async getProducts(jobId: string): Promise<{ total_products: number; products: ProductMatch[] }> {
    const res = await fetch(`${API_BASE}/products/${jobId}`);
    if (!res.ok) {
      throw new Error('Failed to fetch products');
    }
    return res.json();
  },

  async getOverlays(jobId: string): Promise<OverlayDataset> {
    const res = await fetch(`${API_BASE}/overlays/${jobId}`);
    if (!res.ok) {
      throw new Error('Failed to fetch overlay tracking data');
    }
    return res.json();
  },

  async exportVideo(jobId: string): Promise<{ success: boolean; export_url: string; export_filename: string }> {
    const res = await fetch(`${API_BASE}/export/${jobId}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Export failed' }));
      throw new Error(err.detail || 'Export failed');
    }
    return res.json();
  },

  async getDemos(): Promise<{ demos: DemoScenario[] }> {
    const res = await fetch(`${API_BASE}/demos`);
    if (!res.ok) {
      throw new Error('Failed to fetch demos');
    }
    return res.json();
  },

  getVideoStreamUrl(jobId: string): string {
    return `${API_BASE}/video/${jobId}`;
  },

  getExportDownloadUrl(jobId: string): string {
    return `${API_BASE}/export/${jobId}/download`;
  },

  subscribeStatusStream(jobId: string, onUpdate: (status: JobStatus) => void, onError?: (err: any) => void): () => void {
    const eventSource = new EventSource(`${API_BASE}/status/${jobId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data);
        if (data.status === 'completed' || data.status === 'failed') {
          eventSource.close();
        }
      } catch (e) {
        console.error('Error parsing SSE event:', e);
      }
    };

    eventSource.onerror = (err) => {
      if (onError) onError(err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }
};
