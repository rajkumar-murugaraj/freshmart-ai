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
  Save,
  Trash2,
  PlusCircle,
  Camera,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../lib/api';
import { User, CATEGORIES } from '../types';
import { BillStockUpdate } from './BillStockUpdate';

interface StockItem {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  unit: string;
  category: string;
  price: number;
  cost_price: number;
  status: 'ok' | 'low' | 'out';
  expiry_date?: string;
  manufacturing_date?: string;
  batch_number?: string;
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

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

export const StockManagement: React.FC<StockManagementProps> = ({ currentUser }) => {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'low' | 'out' | 'expiring'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [productHistory, setProductHistory] = useState<StockTransaction[]>([]);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustData, setAdjustData] = useState({ type: 'add' as 'add' | 'remove' | 'set', quantity: 0, reason: '' });
  const [updating, setUpdating] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkUpdates, setBulkUpdates] = useState<Record<string, number>>({});
  const [showMobileDetails, setShowMobileDetails] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: 10, totalCount: 0, totalPages: 0, hasMore: false
  });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState<PaginationInfo>({
    page: 1, limit: 10, totalCount: 0, totalPages: 0, hasMore: false
  });
  const [stats, setStats] = useState({ total: 0, outOfStock: 0, lowStock: 0, inStock: 0 });

  // Add/Edit/Delete product states
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StockItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState<StockItem | null>(null);
  const [showBillScanner, setShowBillScanner] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    price: 0,
    cost_price: 0,
    category: 'Vegetables',
    unit: 'kg',
    stock: 50,
    min_stock: 10,
    image: 'https://picsum.photos/400/300',
    description: ''
  });

  const fetchStock = async (pageNum: number = page) => {
    setLoading(true);
    try {
      const data = await api.getStockPaginated({
        page: pageNum,
        limit: 10,
        filter: (filter === 'all' || filter === 'expiring' ? undefined : filter) as 'low' | 'out' | undefined
      });
      setStockItems(data.products);
      setPagination(data.pagination);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to fetch stock', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
    fetchStock(1);
  }, [filter]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchStock(newPage);
  };

  const fetchProductHistory = async (productId: string, histPage: number = 1) => {
    try {
      const data = await api.getProductStock(productId, histPage, 10);
      setProductHistory(data.history || []);
      if (data.historyPagination) {
        setHistoryPagination(data.historyPagination);
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const handleHistoryPageChange = (newPage: number) => {
    if (!selectedProduct) return;
    setHistoryPage(newPage);
    fetchProductHistory(selectedProduct.id, newPage);
  };

  const handleSelectProduct = async (product: StockItem) => {
    setSelectedProduct(product);
    setHistoryPage(1);
    await fetchProductHistory(product.id, 1);
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

  // Add new product
  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      price: 0,
      cost_price: 0,
      category: 'Vegetables',
      unit: 'kg',
      stock: 50,
      min_stock: 10,
      image: 'https://picsum.photos/400/300',
      description: ''
    });
    setShowProductModal(true);
  };

  // Edit existing product
  const handleEditProduct = (product: StockItem) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      price: product.price,
      cost_price: product.cost_price,
      category: product.category,
      unit: product.unit,
      stock: product.stock,
      min_stock: product.min_stock,
      image: 'https://picsum.photos/400/300',
      description: ''
    });
    setShowProductModal(true);
  };

  // Save product (add or update)
  const handleSaveProduct = async () => {
    if (!productForm.name || productForm.price <= 0) {
      alert('Please fill in required fields');
      return;
    }

    setUpdating(true);
    try {
      if (editingProduct) {
        // Update existing product
        await api.updateProduct({
          id: editingProduct.id,
          name: productForm.name,
          price: productForm.price,
          cost_price: productForm.cost_price || productForm.price * 0.8,
          category: productForm.category,
          unit: productForm.unit,
          image: productForm.image,
          description: productForm.description
        } as any);

        // Also update min_stock through stock API if changed
        if (productForm.min_stock !== editingProduct.min_stock) {
          // The min_stock update would need a separate endpoint, for now we update via stock
        }
      } else {
        // Add new product
        await api.addProduct({
          name: productForm.name,
          price: productForm.price,
          cost_price: productForm.cost_price || productForm.price * 0.8,
          category: productForm.category,
          unit: productForm.unit,
          stock: productForm.stock,
          min_stock: productForm.min_stock,
          image: productForm.image,
          description: productForm.description
        } as any);
      }

      await fetchStock();
      setShowProductModal(false);
      setEditingProduct(null);
    } catch (e: any) {
      alert(e.message || 'Failed to save product');
    }
    setUpdating(false);
  };

  // Delete product
  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    setUpdating(true);
    try {
      await api.deleteProduct(productToDelete.id);
      await fetchStock();
      setShowDeleteConfirm(false);
      setProductToDelete(null);
      if (selectedProduct?.id === productToDelete.id) {
        setSelectedProduct(null);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to delete product');
    }
    setUpdating(false);
  };

  // Confirm delete
  const confirmDelete = (product: StockItem) => {
    setProductToDelete(product);
    setShowDeleteConfirm(true);
  };

  const filteredItems = stockItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    // Client-side expiring filter (supplements server-side filter)
    if (filter === 'expiring') {
      if (!item.expiry_date) return false;
      const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysLeft <= 7;
    }
    return true;
  });

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

          <button
            onClick={() => setShowAdjustModal(true)}
            className="w-full bg-green-600 text-white py-2 sm:py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm sm:text-base"
          >
            Adjust Stock
          </button>
          </div>

          <div className={isMobile ? 'flex-1 overflow-hidden flex flex-col' : ''}>
            <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 flex items-center text-sm sm:text-base">
              <History className="h-4 w-4 mr-2" />
              Stock History
              {historyPagination.totalCount > 0 && (
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  ({historyPagination.totalCount} total)
                </span>
              )}
            </h4>
            <div className={`space-y-2 overflow-y-auto ${isMobile ? 'flex-1' : 'max-h-48'}`}>
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
            {/* History Pagination */}
            {historyPagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleHistoryPageChange(historyPage - 1)}
                  disabled={historyPage <= 1}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-gray-500">
                  {historyPage} / {historyPagination.totalPages}
                </span>
                <button
                  onClick={() => handleHistoryPageChange(historyPage + 1)}
                  disabled={!historyPagination.hasMore}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
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
        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto flex-wrap gap-y-2">
          <button
            onClick={handleAddProduct}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <PlusCircle className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            Add
          </button>
          <button
            onClick={() => setShowBillScanner(true)}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors"
            title="Update stock from bill image"
          >
            <Camera className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            Scan Bill
          </button>
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
            onClick={() => fetchStock(page)}
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
          <p className="text-xl sm:text-2xl font-bold text-green-700">{stats.inStock}</p>
        </div>
        <div className="bg-orange-50 p-3 sm:p-4 rounded-xl border border-orange-200">
          <p className="text-orange-600 text-xs sm:text-sm">Low Stock</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-700">{stats.lowStock}</p>
        </div>
        <div className="bg-red-50 p-3 sm:p-4 rounded-xl border border-red-200">
          <p className="text-red-600 text-xs sm:text-sm">Out of Stock</p>
          <p className="text-xl sm:text-2xl font-bold text-red-700">{stats.outOfStock}</p>
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
            onChange={(e) => setFilter(e.target.value as 'all' | 'low' | 'out' | 'expiring')}
            className="flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2 sm:py-2.5 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
          >
            <option value="all">All Items</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
            <option value="expiring">Expiring Soon</option>
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
                      <p className="text-xs text-gray-500">{item.category} • Cost: ₹{item.cost_price} → Sell: ₹{item.price}/{item.unit}</p>
                      {item.expiry_date && (() => {
                        const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return (
                          <p className={`text-[10px] font-medium mt-0.5 ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 3 ? 'text-red-500' : daysLeft <= 7 ? 'text-orange-500' : 'text-green-600'}`}>
                            {daysLeft < 0 ? 'Expired' : daysLeft <= 7 ? `Expires in ${daysLeft}d` : `Expires: ${new Date(item.expiry_date).toLocaleDateString()}`}
                          </p>
                        );
                      })()}
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
                  {/* Mobile Action Buttons */}
                  {!bulkMode && (
                    <div className="flex items-center justify-end space-x-2 mt-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProduct(item);
                          setShowAdjustModal(true);
                        }}
                        className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded font-medium"
                      >
                        Adjust
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProduct(item);
                        }}
                        className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(item);
                        }}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  )}
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
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Cost</th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Sell</th>
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
                        <div className="text-xs text-gray-500 lg:hidden">₹{item.cost_price} → ₹{item.price}/{item.unit}</div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{item.category}</td>
                      <td className="px-3 sm:px-4 py-3 text-center text-sm text-gray-600 hidden lg:table-cell">₹{item.cost_price}</td>
                      <td className="px-3 sm:px-4 py-3 text-center text-sm font-medium text-green-600 hidden lg:table-cell">₹{item.price}</td>
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
                          <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProduct(item);
                                setShowAdjustModal(true);
                              }}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Adjust Stock"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditProduct(item);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit Product"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDelete(item);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalCount > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                Showing {((page - 1) * pagination.limit) + 1} - {Math.min(page * pagination.limit, pagination.totalCount)} of {pagination.totalCount} products
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={page <= 1}
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-3 py-1 text-sm font-medium text-gray-700">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!pagination.hasMore}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={page >= pagination.totalPages}
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          )}
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

      {/* Add/Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                  placeholder="Enter product name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Unit *</label>
                  <select
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="piece">piece</option>
                    <option value="dozen">dozen</option>
                    <option value="pack">pack</option>
                    <option value="litre">litre</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Cost Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.cost_price}
                    onChange={(e) => setProductForm({ ...productForm, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Sell Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {!editingProduct && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.stock}
                      onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Min Stock Level</label>
                    <input
                      type="number"
                      min="0"
                      value={productForm.min_stock}
                      onChange={(e) => setProductForm({ ...productForm, min_stock: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                      placeholder="10"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="text"
                  value={productForm.image}
                  onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-sm resize-none"
                  placeholder="Product description..."
                />
              </div>

              {productForm.price > 0 && productForm.cost_price > 0 && (
                <div className="bg-green-50 p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm">
                  <p className="text-green-800">
                    Profit Margin: ₹{(productForm.price - productForm.cost_price).toFixed(2)} ({((productForm.price - productForm.cost_price) / productForm.cost_price * 100).toFixed(1)}%)
                  </p>
                </div>
              )}
            </div>

            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex space-x-3 flex-shrink-0">
              <button
                onClick={() => setShowProductModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProduct}
                disabled={updating || !productForm.name || productForm.price <= 0}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
              >
                {updating ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Delete Product</h2>
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <p className="text-center text-gray-600 text-sm sm:text-base mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-center font-semibold text-gray-900 mb-4">
                "{productToDelete.name}"?
              </p>
              <p className="text-center text-xs sm:text-sm text-gray-500">
                This action cannot be undone. All stock history for this product will also be removed.
              </p>
            </div>

            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setProductToDelete(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={updating}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
              >
                {updating ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Scanner Modal */}
      {showBillScanner && (
        <BillStockUpdate
          currentUser={currentUser}
          onClose={() => setShowBillScanner(false)}
          onSuccess={() => {
            fetchStock();
          }}
        />
      )}
    </div>
  );
};
