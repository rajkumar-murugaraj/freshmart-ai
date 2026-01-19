'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  Plus,
  Minus,
  RefreshCw,
  Search,
  Filter,
  History,
  X,
  TrendingUp,
  TrendingDown,
  Edit3,
  Save
} from 'lucide-react';
import { api } from '../lib/api';
import { User } from '../types';

interface StockItem {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  unit: string;
  category: string;
  price: number;
  status: 'ok' | 'low' | 'out';
}

interface StockTransaction {
  id: string;
  type: string;
  quantity: number;
  reason: string;
  user_name: string;
  created_at: string;
}

interface StockManagementProps {
  currentUser: User;
}

export const StockManagement: React.FC<StockManagementProps> = ({ currentUser }) => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [productHistory, setProductHistory] = useState<StockTransaction[]>([]);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustData, setAdjustData] = useState({ type: 'add' as 'add' | 'remove' | 'set', quantity: 0, reason: '' });
  const [updating, setUpdating] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkUpdates, setBulkUpdates] = useState<Record<string, number>>({});
  const [showMobileDetails, setShowMobileDetails] = useState(false);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const data = await api.getStock(filter === 'all' ? undefined : filter);
      setStockItems(data);
    } catch (e) {
      console.error('Failed to fetch stock', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStock();
  }, [filter]);

  const fetchProductHistory = async (productId: string) => {
    try {
      const data = await api.getProductStock(productId);
      setProductHistory(data.history || []);
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const handleSelectProduct = async (product: StockItem) => {
    setSelectedProduct(product);
    await fetchProductHistory(product.id);
    // Show mobile drawer on small screens
    if (window.innerWidth < 1024) {
      setShowMobileDetails(true);
    }
  };

  const handleAdjustStock = async () => {
    if (!selectedProduct || (adjustData.quantity <= 0 && adjustData.type !== 'set')) return;

    setUpdating(true);
    try {
      await api.updateStock(
        selectedProduct.id,
        adjustData.type,
        adjustData.quantity,
        adjustData.reason || `Stock ${adjustData.type}`,
        currentUser.id
      );
      await fetchStock();
      await fetchProductHistory(selectedProduct.id);

      // Update selected product
      const updated = stockItems.find(s => s.id === selectedProduct.id);
      if (updated) {
        setSelectedProduct({ ...updated });
      }

      setShowAdjustModal(false);
      setAdjustData({ type: 'add', quantity: 0, reason: '' });
    } catch (e: any) {
      alert(e.message || 'Failed to update stock');
    }
    setUpdating(false);
  };

  const handleBulkUpdate = async () => {
    const updates = Object.entries(bulkUpdates)
      .filter(([_, qty]) => qty >= 0)
      .map(([productId, quantity]) => ({
        productId,
        quantity,
        reason: 'Bulk stock update'
      }));

    if (updates.length === 0) return;

    setUpdating(true);
    try {
      await api.bulkUpdateStock(updates, currentUser.id);
      await fetchStock();
      setBulkMode(false);
      setBulkUpdates({});
    } catch (e: any) {
      alert(e.message || 'Failed to bulk update');
    }
    setUpdating(false);
  };

  const filteredItems = stockItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: stockItems.length,
    low: stockItems.filter(s => s.status === 'low').length,
    out: stockItems.filter(s => s.status === 'out').length,
    ok: stockItems.filter(s => s.status === 'ok').length
  };

  // Product Details Panel Component (shared between desktop sidebar and mobile drawer)
  const ProductDetailsPanel = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={isMobile ? 'flex flex-col h-full' : ''}>
      {selectedProduct ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate pr-2">{selectedProduct.name}</h3>
            <button
              onClick={() => {
                setSelectedProduct(null);
                if (isMobile) setShowMobileDetails(false);
              }}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
            <div className="flex justify-between items-center p-2.5 sm:p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600 text-sm">Current Stock</span>
              <span className="text-lg sm:text-xl font-bold text-gray-900">{selectedProduct.stock} {selectedProduct.unit}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 sm:p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600 text-sm">Minimum Level</span>
              <span className="font-medium text-gray-900 text-sm sm:text-base">{selectedProduct.min_stock} {selectedProduct.unit}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 sm:p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600 text-sm">Status</span>
              <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${
                selectedProduct.status === 'out' ? 'bg-red-100 text-red-700' :
                selectedProduct.status === 'low' ? 'bg-orange-100 text-orange-700' :
                'bg-green-100 text-green-700'
              }`}>
                {selectedProduct.status === 'out' ? 'Out of Stock' :
                 selectedProduct.status === 'low' ? 'Low Stock' : 'In Stock'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowAdjustModal(true)}
            className="w-full bg-green-600 text-white py-2 sm:py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors mb-4 sm:mb-6 text-sm sm:text-base"
          >
            Adjust Stock
          </button>

          <div className={isMobile ? 'flex-1 overflow-hidden flex flex-col' : ''}>
            <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 flex items-center text-sm sm:text-base">
              <History className="h-4 w-4 mr-2" />
              Stock History
            </h4>
            <div className={`space-y-2 overflow-y-auto ${isMobile ? 'flex-1' : 'max-h-64'}`}>
              {productHistory.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No history available</p>
              ) : (
                productHistory.map((tx, index) => (
                  <div key={index} className="flex items-start p-2 sm:p-3 bg-gray-50 rounded-lg text-xs sm:text-sm">
                    <div className={`p-1 rounded mr-2 sm:mr-3 flex-shrink-0 ${
                      tx.type === 'add' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {tx.type === 'add' || tx.type === 'set' ? (
                        <TrendingUp className={`h-3 w-3 sm:h-4 sm:w-4 ${tx.type === 'add' ? 'text-green-600' : 'text-blue-600'}`} />
                      ) : (
                        <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <span className="font-medium capitalize">{tx.type}</span>
                        <span className={`font-semibold ${
                          tx.type === 'add' ? 'text-green-600' : tx.type === 'remove' || tx.type === 'sale' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {tx.type === 'add' ? '+' : tx.type === 'set' ? '=' : '-'}{tx.quantity}
                        </span>
                      </div>
                      <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5 truncate">{tx.reason}</p>
                      <p className="text-gray-400 text-[10px] sm:text-xs mt-0.5">
                        {tx.user_name || 'System'} • {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm sm:text-base">Select a product to view details</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center">
            <Package className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-green-600" />
            Stock Management
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">Track inventory and manage stock levels</p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
          <button
            onClick={() => setBulkMode(!bulkMode)}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              bulkMode ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Edit3 className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            {bulkMode ? 'Exit' : 'Bulk'}
          </button>
          {bulkMode && Object.keys(bulkUpdates).length > 0 && (
            <button
              onClick={handleBulkUpdate}
              disabled={updating}
              className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Save ({Object.keys(bulkUpdates).length})
            </button>
          )}
          <button
            onClick={fetchStock}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200">
          <p className="text-gray-500 text-xs sm:text-sm">Total Products</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-green-50 p-3 sm:p-4 rounded-xl border border-green-200">
          <p className="text-green-600 text-xs sm:text-sm">In Stock</p>
          <p className="text-xl sm:text-2xl font-bold text-green-700">{stats.ok}</p>
        </div>
        <div className="bg-orange-50 p-3 sm:p-4 rounded-xl border border-orange-200">
          <p className="text-orange-600 text-xs sm:text-sm">Low Stock</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-700">{stats.low}</p>
        </div>
        <div className="bg-red-50 p-3 sm:p-4 rounded-xl border border-red-200">
          <p className="text-red-600 text-xs sm:text-sm">Out of Stock</p>
          <p className="text-xl sm:text-2xl font-bold text-red-700">{stats.out}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hidden sm:block" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'low' | 'out')}
            className="flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2 sm:py-2.5 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
          >
            <option value="all">All Items</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Stock List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Mobile Card View */}
          <div className="sm:hidden divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">No items found</div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 ${selectedProduct?.id === item.id ? 'bg-green-50' : ''}`}
                  onClick={() => !bulkMode && handleSelectProduct(item)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.category} • ₹{item.price}/{item.unit}</p>
                    </div>
                    <div className="flex items-center space-x-2 ml-2">
                      {bulkMode ? (
                        <input
                          type="number"
                          min="0"
                          value={bulkUpdates[item.id] ?? item.stock}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            if (val !== item.stock) {
                              setBulkUpdates(prev => ({ ...prev, [item.id]: val }));
                            } else {
                              setBulkUpdates(prev => {
                                const next = { ...prev };
                                delete next[item.id];
                                return next;
                              });
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-16 px-2 py-1 border rounded text-center text-sm"
                        />
                      ) : (
                        <span className="font-semibold text-gray-900">{item.stock}</span>
                      )}
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        item.status === 'out' ? 'bg-red-100 text-red-700' :
                        item.status === 'low' ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {item.status === 'out' ? 'OUT' : item.status === 'low' ? 'LOW' : 'OK'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Category</th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Min</th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  {!bulkMode && <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">No items found</td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedProduct?.id === item.id ? 'bg-green-50' : ''}`}
                      onClick={() => !bulkMode && handleSelectProduct(item)}
                    >
                      <td className="px-3 sm:px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">₹{item.price}/{item.unit}</div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{item.category}</td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        {bulkMode ? (
                          <input
                            type="number"
                            min="0"
                            value={bulkUpdates[item.id] ?? item.stock}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              if (val !== item.stock) {
                                setBulkUpdates(prev => ({ ...prev, [item.id]: val }));
                              } else {
                                setBulkUpdates(prev => {
                                  const next = { ...prev };
                                  delete next[item.id];
                                  return next;
                                });
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-16 sm:w-20 px-2 py-1 border rounded text-center text-sm"
                          />
                        ) : (
                          <span className="font-semibold text-gray-900">{item.stock}</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center text-sm text-gray-500 hidden md:table-cell">{item.min_stock}</td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'out' ? 'bg-red-100 text-red-700' :
                          item.status === 'low' ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.status === 'out' ? 'OUT' : item.status === 'low' ? 'LOW' : 'OK'}
                        </span>
                      </td>
                      {!bulkMode && (
                        <td className="px-3 sm:px-4 py-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(item);
                              setShowAdjustModal(true);
                            }}
                            className="text-green-600 hover:text-green-800 text-xs sm:text-sm font-medium"
                          >
                            Adjust
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Desktop Product Details / History - Hidden on mobile */}
        <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <ProductDetailsPanel />
        </div>
      </div>

      {/* Mobile Product Details Drawer */}
      {showMobileDetails && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileDetails(false)}
          />
          <div className="mt-auto bg-white rounded-t-2xl max-h-[80vh] flex flex-col relative">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto my-2" />
            <div className="p-4 flex-1 overflow-hidden">
              <ProductDetailsPanel isMobile />
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Adjust Stock</h2>
              <button onClick={() => setShowAdjustModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                <p className="font-medium text-gray-900 text-sm sm:text-base">{selectedProduct.name}</p>
                <p className="text-xs sm:text-sm text-gray-500">Current stock: {selectedProduct.stock} {selectedProduct.unit}</p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Adjustment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, type: 'add' })}
                    className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium border transition-colors ${
                      adjustData.type === 'add' ? 'bg-green-100 border-green-500 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, type: 'remove' })}
                    className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium border transition-colors ${
                      adjustData.type === 'remove' ? 'bg-red-100 border-red-500 text-red-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Minus className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, type: 'set' })}
                    className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium border transition-colors ${
                      adjustData.type === 'set' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Set To
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                  placeholder="Enter quantity"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Reason (Optional)</label>
                <input
                  type="text"
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                  placeholder="e.g., New shipment, Damaged goods"
                />
              </div>

              <div className="bg-blue-50 p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm">
                <p className="text-blue-800">
                  {adjustData.type === 'add' && `New stock will be: ${selectedProduct.stock + adjustData.quantity}`}
                  {adjustData.type === 'remove' && `New stock will be: ${Math.max(0, selectedProduct.stock - adjustData.quantity)}`}
                  {adjustData.type === 'set' && `Stock will be set to: ${adjustData.quantity}`}
                </p>
              </div>

              <button
                onClick={handleAdjustStock}
                disabled={updating || (adjustData.quantity <= 0 && adjustData.type !== 'set')}
                className="w-full bg-green-600 text-white py-2 sm:py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-sm sm:text-base"
              >
                {updating ? 'Updating...' : 'Update Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
