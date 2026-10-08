import React from 'react';
import { ShoppingBag, Sparkles, ExternalLink, Eye, CheckCircle2, ShieldAlert, Tag, Search } from 'lucide-react';
import { ProductMatch } from '../types';
import { resolveImageUrl, FALLBACK_CROP_SVG } from '../utils/image';

interface ProductSidebarProps {
  products: ProductMatch[];
  selectedProduct: ProductMatch | null;
  onSelectProduct: (product: ProductMatch) => void;
  onJumpToTimestamp: (time: number) => void;
}

export const ProductSidebar: React.FC<ProductSidebarProps> = ({
  products,
  selectedProduct,
  onSelectProduct,
  onJumpToTimestamp,
}) => {
  return (
    <div className="glass-panel p-5 rounded-3xl space-y-4 border border-white/10 flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-blue-400" />
          <h3 className="font-heading font-bold text-sm text-white">
            Detected Video Products
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-bold">
          {products.length} Unique {products.length === 1 ? 'Track' : 'Tracks'}
        </span>
      </div>

      {/* Product List */}
      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        {products.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400 space-y-2">
            <ShoppingBag className="w-8 h-8 text-gray-600 mx-auto" />
            <p>No shoppable items detected in this video.</p>
          </div>
        ) : (
          products.map((prod) => {
            const isSelected = selectedProduct?.id === prod.id;
            const primaryStore = prod.primary_store || (prod.stores && prod.stores[0]);
            const hasVerifiedMatch = prod.has_catalog_match !== false && !!primaryStore?.url && !!prod.base_price;
            const itemImageSrc = resolveImageUrl(prod.catalog_image || prod.crop_image);

            return (
              <div
                key={prod.id || `sidebar_track_${prod.track_id}`}
                onClick={() => onSelectProduct(prod)}
                className={`p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col gap-2.5 ${
                  isSelected
                    ? 'bg-blue-500/15 border-blue-500/50 shadow-glow-sm scale-[1.01]'
                    : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0">
                    <img
                      src={itemImageSrc}
                      alt={prod.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_CROP_SVG;
                      }}
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-center text-gray-300 font-mono">
                      #{prod.track_id}
                    </span>
                  </div>

                  {/* Title & Brand */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      {prod.brand && prod.brand !== 'Unknown' ? (
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {prod.brand}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          Unknown Brand
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">•</span>
                      {hasVerifiedMatch && prod.visual_similarity_score ? (
                        <span className="text-[10px] text-purple-300 font-medium">
                          {prod.visual_similarity_score}% match
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-300 font-medium">
                          Detected
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                      {prod.title}
                    </h4>

                    {hasVerifiedMatch && prod.base_price ? (
                      <p className="text-xs font-extrabold text-emerald-400 mt-1">
                        {prod.currency_symbol || '₹'}{prod.base_price.toLocaleString('en-IN')}
                      </p>
                    ) : (
                      <p className="text-[11px] font-medium text-gray-400 mt-1">
                        Visual Detected Item
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToTimestamp(prod.best_timestamp || prod.timestamp_start);
                    }}
                    className="flex items-center gap-1 text-gray-400 hover:text-blue-300 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Jump to {prod.best_timestamp?.toFixed(1) || '0.0'}s</span>
                  </button>

                  {hasVerifiedMatch && primaryStore?.url ? (
                    <a
                      href={primaryStore.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold"
                    >
                      <span>Shop Now</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProduct(prod);
                      }}
                      className="flex items-center gap-1 text-purple-400 hover:text-purple-300 font-semibold"
                    >
                      <Search className="w-3 h-3" />
                      <span>Search</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

