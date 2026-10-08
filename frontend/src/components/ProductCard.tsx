import React from 'react';
import { ExternalLink, Sparkles, CheckCircle2, ShieldAlert, ShoppingCart, Tag, Search } from 'lucide-react';
import { ProductMatch, CardPosition } from '../types';
import { resolveImageUrl, FALLBACK_CROP_SVG } from '../utils/image';

interface ProductCardProps {
  product: ProductMatch;
  position: CardPosition;
  isCompact?: boolean;
  onSelectProduct: (product: ProductMatch) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  position,
  isCompact = false,
  onSelectProduct,
}) => {
  const primaryStore = product.primary_store || (product.stores && product.stores[0]);
  const hasVerifiedMatch = product.has_catalog_match !== false && !!primaryStore?.url && !!product.base_price;
  const shopUrl = primaryStore?.url || '#';
  
  const priceDisplay = product.base_price 
    ? `${product.currency_symbol || '₹'}${product.base_price.toLocaleString('en-IN')}` 
    : 'No Catalog Match';

  const cardImageSrc = resolveImageUrl(product.catalog_image || product.crop_image);

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (hasVerifiedMatch && shopUrl && shopUrl !== '#' && shopUrl.startsWith('http')) {
      window.open(shopUrl, '_blank', 'noopener,noreferrer');
    } else {
      onSelectProduct(product);
    }
  };

  // Compact / Mobile Pill Mode
  if (isCompact) {
    return (
      <div
        onClick={() => onSelectProduct(product)}
        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111827]/95 hover:bg-[#1F2937] backdrop-blur-xl border border-blue-500/40 shadow-glow-sm hover:shadow-glow-md cursor-pointer transition-all duration-150 select-none max-w-[230px]"
      >
        <div className="w-6 h-6 rounded-full overflow-hidden bg-black/40 flex-shrink-0 border border-white/20">
          <img
            src={cardImageSrc}
            alt={product.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_CROP_SVG;
            }}
          />
        </div>
        <div className="flex flex-col min-w-0 pr-1">
          <span className="text-[11px] font-bold text-white truncate group-hover:text-blue-300">
            {product.brand && product.brand !== 'Unknown' ? product.brand : product.category}
          </span>
          <span className={`text-[10px] font-semibold ${hasVerifiedMatch ? 'text-emerald-400' : 'text-gray-400'}`}>
            {hasVerifiedMatch ? priceDisplay : 'Detected'}
          </span>
        </div>
        <button
          onClick={handleActionClick}
          className={`p-1 rounded-full text-white ${hasVerifiedMatch ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'}`}
          title={hasVerifiedMatch ? 'Shop Now' : 'Search Product'}
        >
          {hasVerifiedMatch ? <ExternalLink className="w-3 h-3" /> : <Search className="w-3 h-3" />}
        </button>
      </div>
    );
  }

  // Full Rich Glassmorphism Shopping Card
  return (
    <div
      onClick={() => onSelectProduct(product)}
      className="glass-card group relative flex flex-col w-[265px] sm:w-[275px] p-3 rounded-2xl cursor-pointer hover:border-blue-400/70 transition-all duration-150 select-none shadow-2xl border border-white/15"
      style={{
        background: 'rgba(15, 23, 42, 0.90)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Top Bar: Brand Badge & Similarity */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5">
          {product.brand && product.brand !== 'Unknown' ? (
            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />
              {product.brand}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-gray-500/20 border border-gray-500/30 text-gray-400 font-medium text-[10px] uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-2.5 h-2.5 text-gray-400" />
              Unknown Brand
            </span>
          )}
        </div>

        {/* Visual Similarity Badge or Detected Label */}
        {hasVerifiedMatch && product.visual_similarity_score ? (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-medium">
            <Sparkles className="w-2.5 h-2.5 text-purple-400" />
            <span>{product.visual_similarity_score}% Match</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-medium">
            <span>Video Detection</span>
          </div>
        )}
      </div>

      {/* Main Body: Image Thumbnail & Title */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-black/50 border border-white/10 flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
          <img
            src={cardImageSrc}
            alt={product.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_CROP_SVG;
            }}
          />
          {product.crop_image && (
            <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-center text-gray-300 py-0.5">
              Live Crop
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors line-clamp-2 leading-snug">
            {product.title}
          </h4>
          <p className="text-[10px] text-gray-400 mt-0.5 capitalize truncate">
            {product.product_type || product.category}
          </p>
        </div>
      </div>

      {/* Bottom Bar: Price & Action */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-auto">
        <div>
          {hasVerifiedMatch ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-extrabold text-emerald-400 tracking-tight">
                  {priceDisplay}
                </span>
                {primaryStore?.original_price && primaryStore.original_price > (primaryStore.price || 0) && (
                  <span className="text-[10px] text-gray-500 line-through">
                    {product.currency_symbol || '₹'}{primaryStore.original_price.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <span className="text-[9px] text-gray-400 font-medium">
                {primaryStore?.store_name || 'Verified Store'}
              </span>
            </>
          ) : (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-amber-400">
                Visual Detected
              </span>
              <span className="text-[9px] text-gray-400 font-medium">
                Click to search web
              </span>
            </div>
          )}
        </div>

        {/* Action Button: SHOP NOW for Case A, SEARCH THIS PRODUCT for Case B */}
        {hasVerifiedMatch ? (
          <button
            onClick={handleActionClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-glow-sm hover:shadow-glow-md transition-all duration-200 active:scale-95"
          >
            <span>SHOP NOW</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        ) : (
          <button
            onClick={handleActionClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-glow-sm hover:shadow-glow-md transition-all duration-200 active:scale-95"
          >
            <Search className="w-3 h-3" />
            <span>SEARCH</span>
          </button>
        )}
      </div>

      {/* Pulsing indicator dot */}
      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[#0B0F17] animate-ping" />
      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-400 border-2 border-[#0B0F17]" />
    </div>
  );
};

