'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Product, CATEGORIES } from '../types';
import { ProductCard } from './ProductCard';
import { SearchX } from 'lucide-react';
import { SmartSearch, SearchFilters } from './SmartSearch';
import { ProductCarousel } from './ProductCarousel';
import { QuickViewModal } from './QuickViewModal';
import Fuse from 'fuse.js';

interface ShopProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  searchQuery: string;
  onProductClick?: (product: Product) => void;
}

export const Shop: React.FC<ShopProps> = ({ products, onAddToCart, searchQuery: externalSearchQuery, onProductClick }) => {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    category: 'All',
    priceRange: [0, 10000],
    inStock: false,
    sortBy: 'relevance'
  });
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  // Use internal search query for smart search, fall back to external (navbar) search
  const activeSearchQuery = internalSearchQuery || externalSearchQuery;

  const handleSearch = useCallback((query: string) => {
    setInternalSearchQuery(query);
  }, []);

  const handleFilterChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
  }, []);

  const handleProductSelect = useCallback((product: Product) => {
    // Highlight the selected product and scroll to it
    setHighlightedProductId(product.id);
    setTimeout(() => {
      const element = document.getElementById(`product-${product.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    // Remove highlight after animation
    setTimeout(() => setHighlightedProductId(null), 2000);
  }, []);

  const handleQuickView = useCallback((product: Product) => {
    setQuickViewProduct(product);
    setIsQuickViewOpen(true);
  }, []);

  const handleQuickViewClose = useCallback(() => {
    setIsQuickViewOpen(false);
  }, []);

  // Handle voice shopping - add multiple items to cart
  const handleVoiceAddToCart = useCallback((items: Array<{ product: Product; quantity: number }>) => {
    items.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        onAddToCart(item.product);
      }
    });
  }, [onAddToCart]);

  // Carousel products - only show when not searching/filtering
  const showCarousels = !activeSearchQuery && filters.category === 'All';

  const offerProducts = useMemo(() => {
    // Products under ₹100 as "offers"
    return products.filter(p => p.price < 100).slice(0, 8);
  }, [products]);

  const trendingProducts = useMemo(() => {
    // Random selection for "trending" - in a real app this would be based on sales data
    return [...products].sort(() => Math.random() - 0.5).slice(0, 8);
  }, [products]);

  const newArrivals = useMemo(() => {
    // Latest products (first 8)
    return products.slice(0, 8);
  }, [products]);

  // Initialize Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'category', weight: 0.3 },
        { name: 'description', weight: 0.2 }
      ],
      threshold: 0.4, // Lower = more strict, higher = more fuzzy
      distance: 100,
      minMatchCharLength: 2,
      includeScore: true,
      ignoreLocation: true,
      findAllMatches: true
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products;

    // Category filter
    if (filters.category !== 'All') {
      result = result.filter(p => p.category === filters.category);
    }

    // Search query filter with fuzzy matching
    if (activeSearchQuery && activeSearchQuery.trim() !== '') {
      const query = activeSearchQuery.trim();

      // Use Fuse.js for fuzzy search
      const fuseResults = fuse.search(query);
      const matchedIds = new Set(fuseResults.map(r => r.item.id));

      // Filter to only include fuzzy matched products
      result = result.filter(p => matchedIds.has(p.id));

      // Sort by fuzzy search score (best matches first) if sorting by relevance
      if (filters.sortBy === 'relevance') {
        const scoreMap = new Map(fuseResults.map(r => [r.item.id, r.score || 0]));
        result = [...result].sort((a, b) => {
          const scoreA = scoreMap.get(a.id) ?? 1;
          const scoreB = scoreMap.get(b.id) ?? 1;
          return scoreA - scoreB; // Lower score = better match
        });
      }
    }

    // Price range filter
    result = result.filter(p =>
      p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]
    );

    // In stock filter
    if (filters.inStock) {
      result = result.filter(p => (p as any).stock === undefined || (p as any).stock > 0);
    }

    // Sorting (skip if already sorted by relevance with search)
    if (!(activeSearchQuery && filters.sortBy === 'relevance')) {
      switch (filters.sortBy) {
        case 'price_low':
          result = [...result].sort((a, b) => a.price - b.price);
          break;
        case 'price_high':
          result = [...result].sort((a, b) => b.price - a.price);
          break;
        case 'name':
          result = [...result].sort((a, b) => a.name.localeCompare(b.name));
          break;
        default:
          break;
      }
    }

    return result;
  }, [products, filters, activeSearchQuery, fuse]);

  // Navigate to next/prev product in quick view
  const quickViewIndex = quickViewProduct ? filteredProducts.findIndex(p => p.id === quickViewProduct.id) : -1;

  const handleQuickViewNext = useCallback(() => {
    if (quickViewIndex < filteredProducts.length - 1) {
      setQuickViewProduct(filteredProducts[quickViewIndex + 1]);
    }
  }, [quickViewIndex, filteredProducts]);

  const handleQuickViewPrev = useCallback(() => {
    if (quickViewIndex > 0) {
      setQuickViewProduct(filteredProducts[quickViewIndex - 1]);
    }
  }, [quickViewIndex, filteredProducts]);

  return (
    <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
      {/* Smart Search */}
      <div className="mb-6">
        <SmartSearch
          products={products}
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          onProductSelect={handleProductSelect}
          onVoiceAddToCart={handleVoiceAddToCart}
        />
      </div>

      {/* Quick Category Pills */}
      <div className="flex overflow-x-auto pb-2 gap-1.5 sm:gap-2 mb-4 sm:mb-6 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilters(prev => ({ ...prev, category: cat }))}
            className={`whitespace-nowrap px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${
              filters.category === cat
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Carousels - only show when not filtering/searching */}
      {showCarousels && (
        <>
          {offerProducts.length > 0 && (
            <ProductCarousel
              products={offerProducts}
              title="Today's Offers"
              subtitle="Best deals under ₹100"
              type="offers"
              onAddToCart={onAddToCart}
              onProductClick={onProductClick}
            />
          )}

          {trendingProducts.length > 0 && (
            <ProductCarousel
              products={trendingProducts}
              title="Trending Now"
              subtitle="Most popular this week"
              type="trending"
              onAddToCart={onAddToCart}
              onProductClick={onProductClick}
            />
          )}

          {newArrivals.length > 0 && (
            <ProductCarousel
              products={newArrivals}
              title="New Arrivals"
              subtitle="Fresh additions to our store"
              type="new"
              onAddToCart={onAddToCart}
              onProductClick={onProductClick}
            />
          )}
        </>
      )}

      {/* Results count */}
      {activeSearchQuery && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''} for "{activeSearchQuery}"
        </p>
      )}

      {/* Section title when showing all products */}
      {showCarousels && (
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 mt-2">All Products</h2>
      )}

      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3 lg:gap-4">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              id={`product-${product.id}`}
              className={`transition-all duration-300 ${
                highlightedProductId === product.id
                  ? 'ring-2 ring-green-500 ring-offset-2 rounded-xl scale-[1.02]'
                  : ''
              }`}
            >
              <ProductCard
                product={product}
                isAdmin={false}
                onAddToCart={onAddToCart}
                onQuickView={handleQuickView}
                onProductClick={onProductClick}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4">
          <div className="bg-gray-100 dark:bg-gray-700 p-4 sm:p-6 rounded-full mb-3 sm:mb-4">
            <SearchX className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
          </div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">No products found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Try adjusting your search or filters.</p>
          <button
            onClick={() => {
              setFilters({
                category: 'All',
                priceRange: [0, 10000],
                inStock: false,
                sortBy: 'relevance'
              });
              setInternalSearchQuery('');
            }}
            className="mt-3 sm:mt-4 text-green-600 hover:text-green-700 font-medium text-sm"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        isOpen={isQuickViewOpen}
        onClose={handleQuickViewClose}
        onAddToCart={onAddToCart}
        onNext={handleQuickViewNext}
        onPrev={handleQuickViewPrev}
        hasNext={quickViewIndex < filteredProducts.length - 1}
        hasPrev={quickViewIndex > 0}
      />
    </div>
  );
};
