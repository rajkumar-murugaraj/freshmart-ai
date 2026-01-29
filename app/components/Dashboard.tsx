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
  PieChart as PieChartIcon,
  RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

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
        <RefreshCw className="h-8 w-8 animate-spin text-green-600 dark:text-green-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg text-center text-sm">
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

  // Calculate max values for chart scaling (for fallback simple charts)
  const maxMonthlyRevenue = monthlyRevenue.length > 0 ? Math.max(...monthlyRevenue.map(m => m.revenue), 1) : 1;
  const maxDailyRevenue = dailyRevenue.length > 0 ? Math.max(...dailyRevenue.map(d => d.revenue), 1) : 1;
  const maxCategoryTotal = salesByCategory.length > 0 ? Math.max(...salesByCategory.map(c => c.total), 1) : 1;

  // Chart colors
  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f43f5e'];

  // Format currency for tooltips
  const formatCurrency = (value: number) => `₹${value.toLocaleString()}`;

  // Custom tooltip component with dark mode support
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('Revenue') || entry.name.includes('Total') ? formatCurrency(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Prepare pie chart data for categories
  const categoryPieData = salesByCategory.map((cat, index) => ({
    name: cat.category,
    value: cat.total,
    count: cat.count,
    fill: COLORS[index % COLORS.length]
  }));

  // Prepare pie chart data for top products
  const topProductsPieData = topProducts.slice(0, 5).map((product, index) => ({
    name: product.name,
    value: product.revenue,
    quantity: product.quantity,
    fill: COLORS[index % COLORS.length]
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Period Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center">
          <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-green-600 dark:text-green-400" />
          Sales Analytics
        </h2>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Calendar className="h-5 w-5 text-gray-400 dark:text-gray-500 hidden sm:block" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="flex-1 sm:flex-none border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <button
            onClick={fetchDashboard}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">Total Revenue</p>
              <p className="text-base sm:text-2xl font-bold text-green-600 dark:text-green-400 mt-1 truncate">₹{summary.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="h-8 w-8 sm:h-12 sm:w-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
              <DollarSign className="h-4 w-4 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">Total Orders</p>
              <p className="text-base sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{summary.totalOrders}</p>
              <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-1 truncate hidden sm:block">
                {summary.pendingOrders} pending, {summary.completedOrders} done
              </p>
            </div>
            <div className="h-8 w-8 sm:h-12 sm:w-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
              <ShoppingCart className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">Customers</p>
              <p className="text-base sm:text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{summary.totalCustomers}</p>
            </div>
            <div className="h-8 w-8 sm:h-12 sm:w-12 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
              <Users className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">Stock Alerts</p>
              <p className="text-base sm:text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{summary.lowStockCount + summary.outOfStockCount}</p>
              <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-1 truncate hidden sm:block">
                {summary.lowStockCount} low, {summary.outOfStockCount} out
              </p>
            </div>
            <div className="h-8 w-8 sm:h-12 sm:w-12 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
              <AlertTriangle className="h-4 w-4 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Monthly Revenue Area Chart */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 dark:text-green-400" />
            Revenue Trend
          </h3>
          <div className="h-48 sm:h-64">
            {monthlyRevenue.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8 text-sm">No data for selected period</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-700" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    axisLine={{ stroke: 'currentColor' }}
                    tickLine={{ stroke: 'currentColor' }}
                    className="text-gray-500 dark:text-gray-400"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={{ stroke: 'currentColor' }}
                    tickLine={{ stroke: 'currentColor' }}
                    tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                    className="text-gray-500 dark:text-gray-400"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name="Orders"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily Revenue Bar Chart */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:inline">Daily Revenue (Last 7 Days)</span>
            <span className="sm:hidden">Daily Revenue</span>
          </h3>
          <div className="h-48 sm:h-64">
            {dailyRevenue.length === 0 ? (
              <p className="w-full text-gray-500 dark:text-gray-400 text-center py-8 text-sm">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyRevenue.slice(-7).map(item => ({
                    ...item,
                    day: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })
                  }))}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-200 dark:text-gray-700" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11 }}
                    axisLine={{ stroke: 'currentColor' }}
                    tickLine={{ stroke: 'currentColor' }}
                    className="text-gray-500 dark:text-gray-400"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={{ stroke: 'currentColor' }}
                    tickLine={{ stroke: 'currentColor' }}
                    tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                    className="text-gray-500 dark:text-gray-400"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  >
                    {dailyRevenue.slice(-7).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index === dailyRevenue.slice(-7).length - 1 ? '#10b981' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Top Products Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
            <Package className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-purple-600 dark:text-purple-400" />
            Top Selling Products
          </h3>
          {topProducts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8 text-sm">No sales data</p>
          ) : (
            <div className="flex flex-col items-center">
              <div className="h-36 sm:h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topProductsPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {topProductsPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm">
                              <p className="font-medium text-gray-900 dark:text-white">{data.name}</p>
                              <p className="text-green-600 dark:text-green-400">₹{data.value.toLocaleString()}</p>
                              <p className="text-gray-500 dark:text-gray-400">{data.quantity} sold</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full mt-2 space-y-1.5">
                {topProductsPieData.map((product, index) => (
                  <div key={index} className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center min-w-0 flex-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
                        style={{ backgroundColor: product.fill }}
                      />
                      <span className="truncate text-gray-700 dark:text-gray-300">{product.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white ml-2">₹{product.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sales by Category Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
            <PieChartIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-orange-600 dark:text-orange-400" />
            Sales by Category
          </h3>
          {salesByCategory.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8 text-sm">No category data</p>
          ) : (
            <div className="flex flex-col items-center">
              <div className="h-36 sm:h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                      label={({ name, percent }) => `${(name || '').slice(0, 8)}${(name || '').length > 8 ? '..' : ''} ${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {categoryPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm">
                              <p className="font-medium text-gray-900 dark:text-white">{data.name}</p>
                              <p className="text-green-600 dark:text-green-400">₹{data.value.toLocaleString()}</p>
                              <p className="text-gray-500 dark:text-gray-400">{data.count} orders</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full mt-2 space-y-1.5">
                {categoryPieData.map((cat, index) => (
                  <div key={index} className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center min-w-0 flex-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
                        style={{ backgroundColor: cat.fill }}
                      />
                      <span className="truncate text-gray-700 dark:text-gray-300">{cat.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white ml-2">₹{cat.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm md:col-span-2 lg:col-span-1">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-red-600 dark:text-red-400" />
            Low Stock Alerts
          </h3>
          <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
            {lowStockItems.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm">All items in stock</p>
            ) : (
              lowStockItems.map((item, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 sm:p-3 rounded-lg ${
                    item.stock === 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-orange-50 dark:bg-orange-900/30'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Min: {item.min_stock}</p>
                  </div>
                  <span className={`px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold flex-shrink-0 ml-2 ${
                    item.stock === 0 ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 dark:text-green-400" />
            Recent Orders
          </h3>
        </div>
        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
          {recentOrders.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">No recent orders</div>
          ) : (
            recentOrders.map((order) => (
              <div key={order.id} className="p-3 space-y-1.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">#{order.id}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{order.user_name || 'Guest'}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                    order.status === 'completed' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                    order.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' :
                    'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">₹{order.total}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order ID</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">No recent orders</td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">#{order.id}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{order.user_name || 'Guest'}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">₹{order.total}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'completed' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                        order.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' :
                        'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
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
