'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  Calendar,
  BarChart3,
  PieChart,
  RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';

interface DashboardData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    totalProducts: number;
    totalCustomers: number;
    lowStockCount: number;
    outOfStockCount: number;
    pendingOrders: number;
    completedOrders: number;
  };
  monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>;
  dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  salesByCategory: Array<{ category: string; total: number; count: number }>;
  recentOrders: Array<{ id: string; user_name: string; total: number; status: string; created_at: string }>;
  lowStockItems: Array<{ id: string; name: string; stock: number; min_stock: number }>;
}

type Period = 'day' | 'week' | 'month' | 'year';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [error, setError] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.getDashboard(period);
      setData(result);
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center text-sm">
        {error}
        <button onClick={fetchDashboard} className="ml-4 underline">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const {
    summary,
    monthlyRevenue = [],
    dailyRevenue = [],
    topProducts = [],
    salesByCategory = [],
    recentOrders = [],
    lowStockItems = []
  } = data;

  // Calculate max values for chart scaling
  const maxMonthlyRevenue = monthlyRevenue.length > 0 ? Math.max(...monthlyRevenue.map(m => m.revenue), 1) : 1;
  const maxDailyRevenue = dailyRevenue.length > 0 ? Math.max(...dailyRevenue.map(d => d.revenue), 1) : 1;
  const maxCategoryTotal = salesByCategory.length > 0 ? Math.max(...salesByCategory.map(c => c.total), 1) : 1;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Period Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center">
          <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-green-600" />
          Sales Analytics
        </h2>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Calendar className="h-5 w-5 text-gray-400 hidden sm:block" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <button
            onClick={fetchDashboard}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Total Revenue</p>
              <p className="text-base sm:text-2xl font-bold text-green-600 mt-1 truncate">₹{summary.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="h-8 w-8 sm:h-12 sm:w-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
              <DollarSign className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Total Orders</p>
              <p className="text-base sm:text-2xl font-bold text-blue-600 mt-1">{summary.totalOrders}</p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate hidden sm:block">
                {summary.pendingOrders} pending, {summary.completedOrders} done
              </p>
            </div>
            <div className="h-8 w-8 sm:h-12 sm:w-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
              <ShoppingCart className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Customers</p>
              <p className="text-base sm:text-2xl font-bold text-purple-600 mt-1">{summary.totalCustomers}</p>
            </div>
            <div className="h-8 w-8 sm:h-12 sm:w-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
              <Users className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 text-xs sm:text-sm font-medium">Stock Alerts</p>
              <p className="text-base sm:text-2xl font-bold text-orange-600 mt-1">{summary.lowStockCount + summary.outOfStockCount}</p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate hidden sm:block">
                {summary.lowStockCount} low, {summary.outOfStockCount} out
              </p>
            </div>
            <div className="h-8 w-8 sm:h-12 sm:w-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
              <AlertTriangle className="h-4 w-4 sm:h-6 sm:w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Monthly Revenue Chart */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600" />
            Monthly Revenue
          </h3>
          <div className="space-y-2 sm:space-y-3">
            {monthlyRevenue.length === 0 ? (
              <p className="text-gray-500 text-center py-8 text-sm">No data for selected period</p>
            ) : (
              monthlyRevenue.map((item, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-10 sm:w-16 text-[10px] sm:text-xs text-gray-500 font-medium">{item.month}</div>
                  <div className="flex-1 mx-2 sm:mx-3">
                    <div className="h-4 sm:h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500"
                        style={{ width: `${(item.revenue / maxMonthlyRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 sm:w-24 text-right">
                    <span className="text-[10px] sm:text-sm font-semibold text-gray-900">₹{item.revenue.toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Daily Revenue Chart */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600" />
            <span className="hidden sm:inline">Daily Revenue (Last 7 Days)</span>
            <span className="sm:hidden">Daily Revenue</span>
          </h3>
          <div className="flex items-end justify-between h-32 sm:h-48 px-1 sm:px-2">
            {dailyRevenue.length === 0 ? (
              <p className="w-full text-gray-500 text-center text-sm">No data available</p>
            ) : (
              dailyRevenue.slice(-7).map((item, index) => (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div className="text-[8px] sm:text-xs text-gray-600 mb-1">₹{item.revenue}</div>
                  <div
                    className="w-3 sm:w-8 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all duration-500"
                    style={{
                      height: `${Math.max((item.revenue / maxDailyRevenue) * 100, 4)}px`
                    }}
                  />
                  <div className="text-[8px] sm:text-xs text-gray-500 mt-1 sm:mt-2">
                    {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Top Products */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
            <Package className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-purple-600" />
            Top Selling Products
          </h3>
          <div className="space-y-2 sm:space-y-3">
            {topProducts.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-sm">No sales data</p>
            ) : (
              topProducts.slice(0, 5).map((product, index) => (
                <div key={index} className="flex items-center justify-between py-1.5 sm:py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center min-w-0 flex-1">
                    <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold mr-2 sm:mr-3 flex-shrink-0 ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-900 truncate">{product.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">₹{product.revenue}</div>
                    <div className="text-[10px] sm:text-xs text-gray-400">{product.quantity} sold</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sales by Category */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
            <PieChart className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-orange-600" />
            Sales by Category
          </h3>
          <div className="space-y-2 sm:space-y-3">
            {salesByCategory.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-sm">No category data</p>
            ) : (
              salesByCategory.map((cat, index) => {
                const colors = ['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-yellow-500'];
                return (
                  <div key={index} className="flex items-center">
                    <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${colors[index % colors.length]} mr-2 sm:mr-3 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-gray-700 truncate mr-2">{cat.category}</span>
                        <span className="font-semibold text-gray-900 flex-shrink-0">₹{cat.total.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 sm:h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full ${colors[index % colors.length]} rounded-full`}
                          style={{ width: `${(cat.total / maxCategoryTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm md:col-span-2 lg:col-span-1">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-red-600" />
            Low Stock Alerts
          </h3>
          <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
            {lowStockItems.length === 0 ? (
              <p className="text-gray-500 text-center py-4 text-sm">All items in stock</p>
            ) : (
              lowStockItems.map((item, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 sm:p-3 rounded-lg ${
                    item.stock === 0 ? 'bg-red-50' : 'bg-orange-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Min: {item.min_stock}</p>
                  </div>
                  <span className={`px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold flex-shrink-0 ml-2 ${
                    item.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {item.stock === 0 ? 'OUT' : `${item.stock} left`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 flex items-center">
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600" />
            Recent Orders
          </h3>
        </div>
        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-gray-100">
          {recentOrders.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">No recent orders</div>
          ) : (
            recentOrders.map((order) => (
              <div key={order.id} className="p-3 space-y-1.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-medium text-gray-900">#{order.id}</span>
                    <p className="text-xs text-gray-500">{order.user_name || 'Guest'}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                    order.status === 'completed' ? 'bg-green-100 text-green-800' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-green-600">₹{order.total}</span>
                  <span className="text-[10px] text-gray-400">{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">No recent orders</td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{order.id}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-600">{order.user_name || 'Guest'}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-semibold text-gray-900">₹{order.total}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'completed' ? 'bg-green-100 text-green-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
