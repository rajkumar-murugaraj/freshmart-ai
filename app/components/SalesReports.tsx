'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Calendar,
  RefreshCw,
  CreditCard,
  Banknote,
  Smartphone,
  Package,
  Clock,
  X,
  Printer,
  User,
  ShoppingBag,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../lib/api';

interface Sale {
  id: string;
  receipt_no: string;
  total: number;
  payment_method: string;
  cashier_name: string;
  created_at: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
}

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  avgOrderValue: number;
  cashSales: number;
  cardSales: number;
  upiSales: number;
}

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

export const SalesReports: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('day');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: 10, totalCount: 0, totalPages: 0, hasMore: false
  });

  // Custom date range
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [stats, setStats] = useState<SalesStats>({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    avgOrderValue: 0,
    cashSales: 0,
    cardSales: 0,
    upiSales: 0
  });

  const fetchSales = async (pageNum: number = page) => {
    setLoading(true);
    try {
      const options: any = {
        page: pageNum,
        limit: 10,
        period: period === 'custom' ? undefined : period
      };

      // Add date range for custom period
      if (period === 'custom' && startDate && endDate) {
        options.startDate = startDate;
        options.endDate = endDate;
      }

      const data = await api.getSalesPaginated(options);
      setSales(data.sales);
      setPagination(data.pagination);

      // Use stats from API
      const apiStats = data.stats;
      setStats({
        totalSales: apiStats.totalSales,
        totalRevenue: apiStats.totalRevenue,
        totalProfit: Math.round(apiStats.totalRevenue * 0.2), // Estimate 20% profit margin
        avgOrderValue: apiStats.totalSales > 0 ? Math.round(apiStats.totalRevenue / apiStats.totalSales) : 0,
        cashSales: apiStats.cashSales,
        cardSales: apiStats.cardSales,
        upiSales: apiStats.upiSales
      });
    } catch (e) {
      console.error('Failed to fetch sales', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Don't fetch automatically for custom period - wait for date selection
    if (period !== 'custom') {
      setPage(1);
      fetchSales(1);
      setShowDatePicker(false);
    } else {
      setShowDatePicker(true);
      // Set default date range to last 7 days
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      setEndDate(today.toISOString().split('T')[0]);
      setStartDate(weekAgo.toISOString().split('T')[0]);
    }
  }, [period]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchSales(newPage);
  };

  const handleApplyDateRange = () => {
    if (startDate && endDate) {
      setPage(1);
      fetchSales(1);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="h-4 w-4 text-green-600" />;
      case 'card': return <CreditCard className="h-4 w-4 text-blue-600" />;
      case 'upi': return <Smartphone className="h-4 w-4 text-purple-600" />;
      default: return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Period Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">POS Sales Reports</h2>
          <p className="text-sm text-gray-500">Track your point-of-sale transactions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
          <button
            onClick={() => fetchSales(page)}
            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {showDatePicker && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleApplyDateRange}
              disabled={!startDate || !endDate}
              className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply Filter
            </button>
          </div>
          {startDate && endDate && (
            <p className="mt-2 text-xs text-gray-500">
              Showing data from {new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to {new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">Total Sales</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalSales}</p>
            </div>
            <div className="bg-blue-100 p-2 sm:p-3 rounded-lg">
              <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">Revenue</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">₹{stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-green-100 p-2 sm:p-3 rounded-lg">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">Est. Profit</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600">₹{stats.totalProfit.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-100 p-2 sm:p-3 rounded-lg">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">Avg. Order</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600">₹{stats.avgOrderValue}</p>
            </div>
            <div className="bg-purple-100 p-2 sm:p-3 rounded-lg">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4">Payment Methods</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <Banknote className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Cash</p>
            <p className="font-bold text-green-600">₹{stats.cashSales.toLocaleString()}</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <CreditCard className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Card</p>
            <p className="font-bold text-blue-600">₹{stats.cardSales.toLocaleString()}</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <Smartphone className="h-6 w-6 text-purple-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">UPI</p>
            <p className="font-bold text-purple-600">₹{stats.upiSales.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
        </div>

        {sales.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No sales found for this period</p>
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="sm:hidden divide-y divide-gray-100">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={() => setSelectedSale(sale)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">#{sale.receipt_no}</p>
                      <p className="text-xs text-gray-500">{formatDate(sale.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">₹{sale.total}</p>
                      <div className="flex items-center justify-end gap-1 text-xs text-gray-500">
                        {getPaymentIcon(sale.payment_method)}
                        <span className="capitalize">{sale.payment_method}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {sale.items.length} items • Cashier: {sale.cashier_name || 'N/A'}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedSale(sale)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">#{sale.receipt_no}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(sale.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{sale.items.length}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getPaymentIcon(sale.payment_method)}
                          <span className="text-sm capitalize text-gray-600">{sale.payment_method}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{sale.cashier_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-green-600">₹{sale.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalCount > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-gray-500">
                  Showing {((page - 1) * pagination.limit) + 1} - {Math.min(page * pagination.limit, pagination.totalCount)} of {pagination.totalCount} transactions
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
          </>
        )}
      </div>

      {/* Receipt Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-green-600 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Receipt #{selectedSale.receipt_no}</h3>
                <p className="text-green-100 text-sm">{formatDate(selectedSale.created_at)}</p>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-2 hover:bg-green-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* Cashier Info */}
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 pb-3 border-b border-dashed">
                <User className="h-4 w-4" />
                <span>Cashier: {selectedSale.cashier_name || 'N/A'}</span>
              </div>

              {/* Items List */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <ShoppingBag className="h-4 w-4" />
                  <span>Items ({selectedSale.items.length})</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  {selectedSale.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-gray-500 text-xs">
                          {item.quantity} × ₹{item.price}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900">₹{item.subtotal}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex items-center justify-between py-3 border-t border-dashed">
                <span className="text-sm text-gray-600">Payment Method</span>
                <div className="flex items-center gap-2">
                  {getPaymentIcon(selectedSale.payment_method)}
                  <span className="font-medium capitalize">{selectedSale.payment_method}</span>
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between py-3 border-t-2 border-gray-200">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-xl font-bold text-green-600">₹{selectedSale.total}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t flex gap-3">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              <button
                onClick={() => setSelectedSale(null)}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
