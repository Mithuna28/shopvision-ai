import React from 'react';
import { X, ExternalLink, Sparkles, CheckCircle2, ShieldAlert, Star, ShoppingBag, Eye, Search, Globe, ShoppingCart } from 'lucide-react';
import { ProductMatch } from '../types';
import { resolveImageUrl, FALLBACK_CROP_SVG } from '../utils/image';

interface ProductDrawerProps {
  product: ProductMatch | null;
  onClose: () => void;
  onJumpToTimestamp?: (time: number) => void;
}

export const ProductDrawer: React.FC<ProductDrawerProps> = ({
  product,
  onClose,
  onJumpToTimestamp,
}) => {
  if (!product) return null;

  const hasVerifiedMatch = product.has_catalog_match !== false && (product.stores && product.stores.length > 0) && !!product.base_price;
  
  // Construct search query for Case B
  const searchQuery = [
    product.brand && product.brand !== 'Unknown' ? product.brand : '',
    product.color && product.color.length > 0 ? product.color[0] : '',
    product.product_type || product.category || 'product',
    product.possible_model || ''
  ].filter(Boolean).join(' ');

  const googleShopUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(searchQuery)}`;
  const amazonSearchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(searchQuery)}`;
  const myntraSearchUrl = `https://www.myntra.com/${encodeURIComponent(searchQuery)}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative z-10 w-full max-w-md bg-[#0F1422] border-l border-white/10 shadow-2xl flex flex-col h-full overflow-y-auto animate-slide-left">
        
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-[#0F1422]/95 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-400" />
            <h3 className="font-heading font-bold text-lg text-white">
              {hasVerifiedMatch ? 'Product Match Details' : 'Detected Product Analysis'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">

          {/* Visual Images: Crop vs Catalog Comparison */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Visual Video Evidence
              </span>
              <span className="text-[11px] font-mono text-gray-400">
                Track #{product.track_id}
              </span>
            </div>

            <div className={`grid ${hasVerifiedMatch ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              {/* Detected Video Crop */}
              <div className="flex flex-col gap-1.5">
                <div className="relative aspect-square rounded-xl overflow-hidden bg-black/40 border border-white/10">
                  <img
                    src={resolveImageUrl(product.crop_image)}
                    alt="Detected Crop"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = FALLBACK_CROP_SVG;
                    }}
                  />
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-gray-300 font-medium border border-white/10">
                    Live Video Crop
                  </span>
                </div>
                {onJumpToTimestamp && (
                  <button
                    onClick={() => onJumpToTimestamp(product.best_timestamp || product.timestamp_start)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 font-medium"
                  >
                    <Eye className="w-3 h-3" />
                    Jump to {product.best_timestamp?.toFixed(1) || '0.0'}s
                  </button>
                )}
              </div>

              {/* Matched Catalog Product (Only when verified match exists) */}
              {hasVerifiedMatch && (
                <div className="flex flex-col gap-1.5">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-black/40 border border-white/10">
                    <img
                      src={resolveImageUrl(product.catalog_image)}
                      alt="Catalog Match"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_CROP_SVG;
                      }}
                    />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-emerald-950/80 text-[10px] text-emerald-300 font-medium border border-emerald-500/30 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Catalog Match
                    </span>
                  </div>
                  <div className="text-[11px] text-purple-300 text-center py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 font-medium">
                    {product.visual_similarity_score}% CLIP Similarity
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Title & Brand Authenticity */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {product.brand && product.brand !== 'Unknown' ? (
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  {product.brand} ({product.brand_status || 'verified'})
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-gray-500/20 border border-gray-500/30 text-gray-400 font-medium text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Brand: Unknown
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs capitalize">
                {product.product_type || product.category}
              </span>
            </div>

            <h2 className="text-xl font-heading font-bold text-white leading-tight">
              {product.title}
            </h2>

            {product.rating && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex items-center gap-1 text-amber-400 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{product.rating}</span>
                </div>
                <span>•</span>
                <span>{product.reviews_count?.toLocaleString()} verified ratings</span>
              </div>
            )}
          </div>

          {/* Color & Visual Attributes */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Visual Attributes
            </span>
            {product.color && product.color.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {product.color.map((c, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-md bg-white/10 text-white text-xs capitalize flex items-center gap-1.5"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/30"
                      style={{ backgroundColor: c.toLowerCase() }}
                    />
                    {c}
                  </span>
                ))}
              </div>
            )}

            {product.visual_attributes && product.visual_attributes.length > 0 && (
              <ul className="space-y-1.5 pt-2 border-t border-white/5">
                {product.visual_attributes.map((attr, i) => (
                  <li key={i} className="text-xs text-gray-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>{attr}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Case A: Multi-Store Price Comparison Table (When Verified Match Exists) */}
          {hasVerifiedMatch && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Available Multi-Store Pricing
                </span>
                <span className="text-[11px] text-emerald-400 font-medium">
                  Verified Stores
                </span>
              </div>

              <div className="space-y-2">
                {product.stores.map((store, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">
                          {store.store_name}
                        </span>
                        {store.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {store.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-extrabold text-emerald-400">
                          {product.currency_symbol || '₹'}{store.price.toLocaleString('en-IN')}
                        </span>
                        {store.original_price > store.price && (
                          <span className="text-[10px] text-gray-500 line-through">
                            {product.currency_symbol || '₹'}{store.original_price.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <a
                      href={store.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-glow-sm transition-all"
                    >
                      <span>Shop</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Case B: Direct Multi-Platform Search Actions (When No Verified Match Exists) */}
          {!hasVerifiedMatch && (
            <div className="space-y-3 p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
                  <Search className="w-3.5 h-3.5 text-purple-400" />
                  <span>Search This Product Online</span>
                </div>
                <p className="text-[11px] text-gray-300">
                  This exact item is detected in the video. Click below to search verified live store prices:
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <a
                  href={googleShopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-semibold transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span>Search on Google Shopping</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-white" />
                </a>

                <a
                  href={amazonSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-semibold transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-amber-400" />
                    <span>Search on Amazon India</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-white" />
                </a>

                <a
                  href={myntraSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-semibold transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-pink-400" />
                    <span>Search on Myntra Fashion</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-white" />
                </a>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

