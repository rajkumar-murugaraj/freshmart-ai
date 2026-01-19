import React, { useMemo } from 'react';
import { Product, CATEGORIES } from '../types';
import { ProductCard } from './ProductCard';
import { Filter, SearchX } from 'lucide-react';

interface ShopProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  searchQuery: string;
}

export const Shop: React.FC<ShopProps> = ({ products, onAddToCart, searchQuery }) => {
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [sortBy, setSortBy] = React.useState<'default' | 'priceLow' | 'priceHigh'>('default');

  const filteredProducts = useMemo(() => {
    let result = products;

    // Filter by Category
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Filter by Search
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'priceLow') {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'priceHigh') {
      result = [...result].sort((a, b) => b.price - a.price);
    }

    return result;
  }, [products, selectedCategory, searchQuery, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Filters & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        
        {/* Categories */}
        <div className="flex overflow-x-auto pb-2 md:pb-0 gap-2 w-full md:w-auto scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat 
                  ? 'bg-green-600 text-white shadow-md' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center space-x-2 min-w-max">
          <Filter className="h-5 w-5 text-gray-500" />
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="block w-full pl-3 pr-8 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md bg-white border"
          >
            <option value="default">Sort by: Featured</option>
            <option value="priceLow">Price: Low to High</option>
            <option value="priceHigh">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              isAdmin={false}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-gray-100 p-6 rounded-full mb-4">
              <SearchX className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No products found</h3>
          <p className="text-gray-500 mt-1">Try adjusting your search or filters.</p>
          <button 
            onClick={() => setSelectedCategory('All')}
            className="mt-4 text-green-600 hover:text-green-700 font-medium"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
};