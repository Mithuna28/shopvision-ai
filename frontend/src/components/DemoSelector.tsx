import React from 'react';
import { Play, Sparkles, Footprints, Watch, Headphones, ShoppingBag, Eye } from 'lucide-react';
import { DemoScenario } from '../types';

interface DemoSelectorProps {
  onSelectDemo: (demoId: string) => void;
  isLoading?: boolean;
}

const PRESET_DEMOS: DemoScenario[] = [
  {
    id: 'demo_nike_sneaker',
    title: 'Test 1: Nike Sneaker Walk',
    category: 'Footwear & Movement',
    description: 'Tracks a moving Nike Air Max shoe across dynamic lateral walking frames.',
    duration: '6.0s',
    products_count: 1,
    preview_image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    preset_video_type: 'sneaker'
  },
  {
    id: 'demo_dual_products',
    title: 'Test 2: Dual Products (Watch & Headphones)',
    category: 'Tech & Audio',
    description: 'Simultaneous independent tracking of Apple Watch and Sony Headphones with collision avoidance.',
    duration: '6.0s',
    products_count: 2,
    preview_image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    preset_video_type: 'tech_accessories'
  },
  {
    id: 'demo_streetwear_fit',
    title: 'Test 3: Urban Streetwear (Bag & Shades)',
    category: 'Lifestyle & Apparel',
    description: 'Multi-object outfit tracking with Herschel backpack and Ray-Ban Wayfarer sunglasses.',
    duration: '6.0s',
    products_count: 2,
    preview_image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',
    preset_video_type: 'lifestyle'
  }
];

export const DemoSelector: React.FC<DemoSelectorProps> = ({ onSelectDemo, isLoading }) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-bold text-base sm:text-lg text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Try Ready-to-Test AI Scenarios</span>
          </h3>
          <p className="text-xs text-gray-400">
            Click any test scenario to generate and analyze video instantly in 1-click.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PRESET_DEMOS.map((demo) => (
          <div
            key={demo.id}
            onClick={() => !isLoading && onSelectDemo(demo.id)}
            className="glass-panel glass-card-hover rounded-2xl p-4 flex flex-col justify-between cursor-pointer border border-white/10 group relative overflow-hidden"
          >
            {/* Top Preview Image */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black/40 mb-3 border border-white/5">
              <img
                src={demo.preview_image}
                alt={demo.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-gray-300 border border-white/10">
                {demo.duration}
              </span>

              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-blue-500/80 backdrop-blur-md text-[10px] font-bold text-white flex items-center gap-1">
                <ShoppingBag className="w-2.5 h-2.5" />
                {demo.products_count} {demo.products_count === 1 ? 'Product' : 'Products'}
              </span>
            </div>

            {/* Title & Description */}
            <div className="space-y-1 mb-3">
              <h4 className="font-heading font-bold text-sm text-white group-hover:text-blue-300 transition-colors">
                {demo.title}
              </h4>
              <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                {demo.description}
              </p>
            </div>

            {/* Action Button */}
            <button
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 group-hover:bg-blue-600 border border-white/10 group-hover:border-blue-500 text-xs font-semibold text-gray-300 group-hover:text-white transition-all shadow-sm"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isLoading ? 'Loading...' : 'Run Test Scenario'}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
