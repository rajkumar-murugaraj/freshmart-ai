'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, Filter, ChevronDown, Clock, TrendingUp, Mic, MicOff, Loader2, ShoppingCart, CheckCircle } from 'lucide-react';
import { Product, CATEGORIES } from '../types';
import Fuse from 'fuse.js';

// Voice recognition types
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface VoiceParsedItem {
  product: Product;
  quantity: number;
  unit?: string;
  confidence: number;
}

interface SmartSearchProps {
  products: Product[];
  onSearch: (query: string) => void;
  onFilterChange: (filters: SearchFilters) => void;
  onProductSelect: (product: Product) => void;
  onVoiceAddToCart?: (items: Array<{ product: Product; quantity: number }>) => void;
}

export interface SearchFilters {
  category: string;
  priceRange: [number, number];
  inStock: boolean;
  sortBy: 'relevance' | 'price_low' | 'price_high' | 'name';
}

const defaultFilters: SearchFilters = {
  category: 'All',
  priceRange: [0, 10000],
  inStock: false,
  sortBy: 'relevance'
};

// Popular/trending searches
const trendingSearches = ['Fresh Vegetables', 'Organic', 'Milk', 'Bread', 'Fruits', 'Snacks'];

export const SmartSearch: React.FC<SmartSearchProps> = ({
  products,
  onSearch,
  onFilterChange,
  onProductSelect,
  onVoiceAddToCart
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice recognition state
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [parsedItems, setParsedItems] = useState<VoiceParsedItem[]>([]);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showVoiceResults, setShowVoiceResults] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('freshmart_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check for voice recognition support and initialize
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError(null);
      setVoiceTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setVoiceTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        processVoiceCommand(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        setVoiceError('No speech detected. Please try again.');
      } else if (event.error === 'audio-capture') {
        setVoiceError('No microphone found. Please check your device.');
      } else if (event.error === 'not-allowed') {
        setVoiceError('Microphone access denied. Please allow microphone access.');
      } else {
        setVoiceError('Voice recognition error. Please try again.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Process voice command with AI
  const processVoiceCommand = useCallback(async (transcript: string) => {
    setIsProcessingVoice(true);
    setShowVoiceResults(true);
    setVoiceError(null);

    try {
      const response = await fetch('/api/ai/voice-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, products })
      });

      const data = await response.json();

      if (data.success && data.items?.length > 0) {
        setParsedItems(data.items);
      } else if (!data.understood) {
        setVoiceError(data.message || 'Could not understand the command. Please try again.');
        setParsedItems([]);
      } else {
        setVoiceError('No matching products found. Please try again.');
        setParsedItems([]);
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      setVoiceError('Failed to process voice command. Please try again.');
      setParsedItems([]);
    } finally {
      setIsProcessingVoice(false);
    }
  }, [products]);

  // Start voice recognition
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setParsedItems([]);
      setVoiceError(null);
      setShowVoiceResults(true);
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start recognition:', error);
      }
    }
  }, [isListening]);

  // Stop voice recognition
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // Add all parsed items to cart
  const addAllToCart = useCallback(() => {
    if (onVoiceAddToCart && parsedItems.length > 0) {
      onVoiceAddToCart(parsedItems.map(item => ({
        product: item.product,
        quantity: item.quantity
      })));
      setShowVoiceResults(false);
      setParsedItems([]);
      setVoiceTranscript('');
    }
  }, [onVoiceAddToCart, parsedItems]);

  // Close voice results
  const closeVoiceResults = useCallback(() => {
    setShowVoiceResults(false);
    setParsedItems([]);
    setVoiceTranscript('');
    setVoiceError(null);
  }, []);

  // Initialize Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'category', weight: 0.3 },
        { name: 'description', weight: 0.2 }
      ],
      threshold: 0.4, // Lower = more strict, higher = more fuzzy (0.0 - 1.0)
      distance: 100, // How far to search for a match
      minMatchCharLength: 2,
      includeScore: true,
      ignoreLocation: true, // Search entire string, not just beginning
      findAllMatches: true
    });
  }, [products]);

  // Get autocomplete suggestions with fuzzy matching
  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];

    // Use Fuse.js for fuzzy search
    const results = fuse.search(query, { limit: 6 });

    return results.map(result => result.item);
  }, [query, fuse]);

  // Handle search submission
  const handleSearch = (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    // Save to recent searches
    const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('freshmart_recent_searches', JSON.stringify(updated));

    onSearch(trimmed);
    setIsFocused(false);
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFilterChange(updated);
  };

  // Clear search
  const clearSearch = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('freshmart_recent_searches');
  };

  // Reset filters
  const resetFilters = () => {
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  const hasActiveFilters = filters.category !== 'All' || filters.inStock || filters.sortBy !== 'relevance' || filters.priceRange[0] > 0 || filters.priceRange[1] < 10000;

  return (
    <div ref={searchRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search products, categories..."
          className="w-full pl-10 pr-20 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm sm:text-base"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearch(e.target.value);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch(query);
            }
            if (e.key === 'Escape') {
              setIsFocused(false);
            }
          }}
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
          {query && (
            <button
              onClick={clearSearch}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {voiceSupported && (
            <button
              onClick={isListening ? stopListening : startListening}
              className={`p-1.5 rounded-full transition-colors ${
                isListening
                  ? 'bg-red-100 dark:bg-red-900/50 text-red-600 animate-pulse'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'
              }`}
              title={isListening ? 'Stop listening' : 'Voice search'}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded-full transition-colors ${
              hasActiveFilters
                ? 'bg-green-100 dark:bg-green-900/50 text-green-600'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'
            }`}
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 max-h-[400px] overflow-y-auto">
          {/* Autocomplete Results */}
          {suggestions.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">Products</p>
              {suggestions.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    onProductSelect(product);
                    setQuery(product.name);
                    setIsFocused(false);
                  }}
                  className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {product.category} • ₹{product.price}/{product.unit}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {query.length >= 2 && suggestions.length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <p className="text-sm">No products found for "{query}"</p>
            </div>
          )}

          {/* Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Recent Searches
                </p>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {recentSearches.map((search, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(search);
                      handleSearch(search);
                    }}
                    className="px-3 py-1.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trending Searches */}
          {!query && (
            <div className="p-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1 flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                Trending
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {trendingSearches.map((search, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(search);
                      handleSearch(search);
                    }}
                    className="px-3 py-1.5 text-xs rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-green-600 hover:text-green-700"
              >
                Reset All
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Category
              </label>
              <div className="relative">
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange({ category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Sort By
              </label>
              <div className="relative">
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange({ sortBy: e.target.value as SearchFilters['sortBy'] })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="name">Name A-Z</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Price Range */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Price Range: ₹{filters.priceRange[0]} - ₹{filters.priceRange[1]}
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={filters.priceRange[0]}
                  onChange={(e) => handleFilterChange({ priceRange: [Number(e.target.value), filters.priceRange[1]] })}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={filters.priceRange[1]}
                  onChange={(e) => handleFilterChange({ priceRange: [filters.priceRange[0], Number(e.target.value)] })}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
              </div>
            </div>

            {/* In Stock Only */}
            <div className="sm:col-span-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.inStock}
                  onChange={(e) => handleFilterChange({ inStock: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Only show in-stock items</span>
              </label>
            </div>
          </div>

          <button
            onClick={() => setShowFilters(false)}
            className="w-full mt-4 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
          >
            Apply Filters
          </button>
        </div>
      )}

      {/* Voice Results Panel */}
      {showVoiceResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
              {isListening ? (
                <>
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2" />
                  Listening...
                </>
              ) : isProcessingVoice ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Voice Shopping
                </>
              )}
            </h3>
            <button
              onClick={closeVoiceResults}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Transcript Display */}
          {voiceTranscript && (
            <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium">You said:</span> "{voiceTranscript}"
              </p>
            </div>
          )}

          {/* Error Display */}
          {voiceError && (
            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{voiceError}</p>
            </div>
          )}

          {/* Listening State */}
          {isListening && (
            <div className="text-center py-6">
              <div className="flex justify-center space-x-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-green-500 rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 20 + 10}px`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Try saying: "Add 1kg onions and a pack of bread"
              </p>
            </div>
          )}

          {/* Processing State */}
          {isProcessingVoice && (
            <div className="text-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Understanding your request...
              </p>
            </div>
          )}

          {/* Parsed Items */}
          {!isListening && !isProcessingVoice && parsedItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Items to add ({parsedItems.length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {parsedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center space-x-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Qty: {item.quantity} {item.unit || item.product.unit} • ₹{(item.product.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                        {Math.round(item.confidence * 100)}% match
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex space-x-2 mt-4">
                <button
                  onClick={closeVoiceResults}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addAllToCart}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Add All to Cart
                </button>
              </div>
            </div>
          )}

          {/* No Results State */}
          {!isListening && !isProcessingVoice && parsedItems.length === 0 && !voiceError && voiceTranscript && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No items found. Try speaking again.
              </p>
              <button
                onClick={startListening}
                className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
