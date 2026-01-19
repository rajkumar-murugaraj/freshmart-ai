'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Product, CATEGORIES } from '../types';
import { ProductCard } from './ProductCard';
import { SearchX } from 'lucide-react';
import { SmartSearch, SearchFilters } from './SmartSearch';
import { ProductCarousel } from './ProductCarousel';
import { QuickViewModal } from './QuickViewModal';

interface ShopProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  searchQuery: string;
}

export const Shop: React.FC<ShopProps> = ({ products, onAddToCart, searchQuery: externalSearchQuery }) => {
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

  const filteredProducts = useMemo(() => {
    let result = products;

    // Category filter
    if (filters.category !== 'All') {
      result = result.filter(p => p.category === filters.category);
    }

    // Search query filter
    if (activeSearchQuery && activeSearchQuery.trim() !== '') {
      const q = activeSearchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    // Price range filter
    result = result.filter(p =>
      p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]
    );

    // In stock filter
    if (filters.inStock) {
      result = result.filter(p => (p as any).stock === undefined || (p as any).stock > 0);
    }

    // Sorting
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
        // relevance - keep original order
        break;
    }

    return result;
  }, [products, filters, activeSearchQuery]);

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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Smart Search */}
      <div className="mb-6">
        <SmartSearch
          products={products}
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          onProductSelect={handleProductSelect}
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
            />
          )}

          {trendingProducts.length > 0 && (
            <ProductCarousel
              products={trendingProducts}
              title="Trending Now"
              subtitle="Most popular this week"
              type="trending"
              onAddToCart={onAddToCart}
            />
          )}

          {newArrivals.length > 0 && (
            <ProductCarousel
              products={newArrivals}
              title="New Arrivals"
              subtitle="Fresh additions to our store"
              type="new"
              onAddToCart={onAddToCart}
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
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
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
