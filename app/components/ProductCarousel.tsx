'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Flame, Tag, Clock } from 'lucide-react';
import { Product } from '../types';
import { ProductCard } from './ProductCard';

interface ProductCarouselProps {
  products: Product[];
  title: string;
  subtitle?: string;
  type: 'offers' | 'trending' | 'new' | 'featured';
  onAddToCart: (product: Product) => void;
  onProductClick?: (product: Product) => void;
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

const carouselIcons = {
  offers: Tag,
  trending: Flame,
  new: Sparkles,
  featured: Clock
};

const carouselColors = {
  offers: 'from-red-500 to-orange-500',
  trending: 'from-orange-500 to-yellow-500',
  new: 'from-green-500 to-emerald-500',
  featured: 'from-blue-500 to-purple-500'
};

export const ProductCarousel: React.FC<ProductCarouselProps> = ({
  products,
  title,
  subtitle,
  type,
  onAddToCart,
  onProductClick,
  autoPlay = true,
  autoPlayInterval = 4000
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const Icon = carouselIcons[type];

  // Calculate items per view based on screen size
  const getItemsPerView = () => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth < 640) return 2;
    if (window.innerWidth < 768) return 2;
    if (window.innerWidth < 1024) return 3;
    return 4;
  };

  const [itemsPerView, setItemsPerView] = useState(4);

  useEffect(() => {
    const handleResize = () => {
      setItemsPerView(getItemsPerView());
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const maxIndex = Math.max(0, products.length - itemsPerView);

  // Auto-scroll functionality
  useEffect(() => {
    if (!autoPlay || isHovered || products.length <= itemsPerView) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, isHovered, maxIndex, autoPlayInterval, products.length, itemsPerView]);

  const handlePrev = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(maxIndex, prev + 1));
  };

  if (products.length === 0) return null;

  return (
    <div
      className="relative mb-8"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg bg-gradient-to-r ${carouselColors[type]}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
            {subtitle && (
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        {products.length > itemsPerView && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= maxIndex}
              className="p-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Carousel Container */}
      <div className="overflow-hidden" ref={carouselRef}>
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{
            transform: `translateX(-${currentIndex * (100 / itemsPerView)}%)`,
          }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0 px-1.5 sm:px-2"
              style={{ width: `${100 / itemsPerView}%` }}
            >
              <ProductCard
                product={product}
                isAdmin={false}
                onAddToCart={onAddToCart}
                onProductClick={onProductClick}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dots Indicator */}
      {products.length > itemsPerView && (
        <div className="flex justify-center mt-4 space-x-1.5">
          {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? `w-6 bg-gradient-to-r ${carouselColors[type]}`
                  : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
