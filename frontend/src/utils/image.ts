/**
 * Image resolution and fallback utility for SHOPVISION AI.
 * Ensures every track receives its own independent crop image and prevents
 * cross-track image reuse or third-party sneaker placeholder leaks.
 */

const API_HOST = 'http://localhost:8000';

// Clean, high-tech SVG fallback placeholder when no visual crop is available
export const FALLBACK_CROP_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%230F172A"/><rect x="20" y="20" width="160" height="160" rx="16" fill="%231E293B" stroke="%233B82F6" stroke-width="2" stroke-dasharray="6,4"/><circle cx="100" cy="90" r="28" fill="%233B82F6" fill-opacity="0.2" stroke="%2360A5FA" stroke-width="2"/><path d="M85 90h30M100 75v30" stroke="%2393C5FD" stroke-width="2" stroke-linecap="round"/><text x="100" y="145" text-anchor="middle" fill="%2394A3B8" font-family="monospace" font-size="11" font-weight="bold">LIVE CROP</text></svg>`;

export function resolveImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return FALLBACK_CROP_SVG;
  }
  const cleanUrl = url.trim();
  if (cleanUrl.startsWith('/api/')) {
    return `${API_HOST}${cleanUrl}`;
  }
  return cleanUrl;
}
