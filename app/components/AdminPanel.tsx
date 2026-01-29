'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Product, ProductGroup, CATEGORIES, Order, User } from '../types';
import { ProductCard } from './ProductCard';
import { Plus, X, Wand2, Package, LayoutGrid, Phone, Bell, BarChart3, Boxes, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Filter, ShoppingCart, Receipt } from 'lucide-react';
import { api } from '../lib/api';
import { Dashboard } from './Dashboard';
import { StockManagement } from './StockManagement';
import { SalesPOS } from './SalesPOS';
import { SalesReports } from './SalesReports';
import { io, Socket } from 'socket.io-client';

interface VariantRow {
  id?: string;
  value: string;
  price: number;
  cost_price: number;
  stock: number;
}

interface AdminPanelProps {
  products: Product[];
  onAddProduct: (product: Product) => Promise<void>;
  onAddProducts: (products: Partial<Product>[]) => Promise<void>;
  onUpdateProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onRefreshProducts: () => Promise<void>;
  currentUser: User;
}

function groupProducts(products: Product[]): ProductGroup[] {
  const groupMap = new Map<string, Product[]>();
  const standalone: Product[] = [];

  for (const p of products) {
    if (p.variant_group) {
      const existing = groupMap.get(p.variant_group) || [];
      existing.push(p);
      groupMap.set(p.variant_group, existing);
    } else {
      standalone.push(p);
    }
  }

  const groups: ProductGroup[] = [];

  groupMap.forEach((variants: Product[], groupKey: string) => {
    const sorted = variants.sort((a: Product, b: Product) => a.price - b.price);
    groups.push({
      groupKey,
      isVariantGroup: variants.length > 1,
      variantType: sorted[0].variant_type || null,
      displayProduct: sorted[0],
      variants: sorted,
    });
  });

  for (const p of standalone) {
    groups.push({
      groupKey: p.id,
      isVariantGroup: false,
      variantType: null,
      displayProduct: p,
      variants: [p],
    });
  }

  return groups;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  products,
  onAddProduct,
  onAddProducts,
  onUpdateProduct,
  onDeleteProduct,
  onRefreshProducts,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders' | 'stock' | 'pos' | 'reports'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; orderId: string | undefined; time: string; read: boolean }>>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; id?: string }>({ visible: false, message: '' });
  const seenOrderIds = useRef(new Set<string>());
  const initializedSeen = useRef(false);
  const lastNotifIds = useRef(new Set<string>());
  const socketRef = useRef<Socket | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [ordersPerPage, setOrdersPerPage] = useState(20);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Socket.IO connection for real-time notifications
  useEffect(() => {
    // Connect to socket server
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Admin connected to socket server');
    });

    socket.on('new_order', (data: { orderId: string; customerName: string; total: number; timestamp: string }) => {
      console.log('Real-time new order:', data);
      const msg = `New order #${data.orderId} from ${data.customerName} — ₹${data.total}`;
      const notif = {
        id: `socket-${Date.now()}-${data.orderId}`,
        message: msg,
        orderId: data.orderId,
        time: data.timestamp,
        read: false
      };
      setNotifications(prev => [notif, ...prev].slice(0, 50));
      setToast({ visible: true, message: msg, id: notif.id });
      setTimeout(() => setToast(t => t.id === notif.id ? { visible: false, message: '', id: undefined } : t), 5000);
      // Refresh orders list
      fetchOrders();
    });

    socket.on('notification', (data: any) => {
      console.log('Socket notification:', data);
      if (data.type === 'new_order' && data.orderId) {
        // Already handled by new_order event
        return;
      }
      // Generic notification
      const notif = {
        id: `notif-${Date.now()}`,
        message: data.message || 'New notification',
        orderId: data.orderId,
        time: data.timestamp || new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [notif, ...prev].slice(0, 50));
    });

    socket.on('disconnect', () => {
      console.log('Admin disconnected from socket server');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasVariants, setHasVariants] = useState(false);
  const [variantType, setVariantType] = useState('');
  const [variantRows, setVariantRows] = useState<VariantRow[]>([{ value: '', price: 0, cost_price: 0, stock: 50 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null);
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const productGroups = useMemo(() => groupProducts(products), [products]);

  const initialFormState = {
    name: '',
    price: 0,
    cost_price: 0,
    category: 'Vegetables',
    image: 'https://picsum.photos/400/300',
    description: '',
    unit: 'kg',
    stock: 50,
    min_stock: 10,
    variant_group: '',
    variant_type: '',
    variant_value: ''
  };

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders(1, statusFilter);
    }
  }, [activeTab]);

  useEffect(() => {
    let mounted = true;

    const checkForNew = async () => {
      try {
        const data = await api.getOrders('0', true);
        if (!mounted) return;
        setOrders(data);

        for (const o of data) {
          const oid = String(o.id);
          if (!seenOrderIds.current.has(oid)) {
            if (!initializedSeen.current) {
              seenOrderIds.current.add(oid);
            } else {
              seenOrderIds.current.add(oid);
              const msg = `New order #${o.id} placed by ${o.user_name || 'Guest'} — ₹${o.total}`;
              const notif = { id: `${Date.now()}-${oid}`, message: msg, orderId: oid, time: new Date().toISOString(), read: false };
              setNotifications(prev => [notif, ...prev].slice(0, 50));
              setToast({ visible: true, message: msg, id: notif.id });
              setTimeout(() => setToast(t => t.id === notif.id ? { visible: false, message: '', id: undefined } : t), 5000);
            }
          }
        }

        initializedSeen.current = true;
      } catch (e) {
        console.error('Failed to poll orders for notifications', e);
      }
    };

    checkForNew();
    const id = setInterval(checkForNew, 8000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchServerNotifications = async () => {
      try {
        const rows = await api.getNotifications('0', true);
        if (!mounted) return;

        const mapped: Array<{ id: string; message: string; orderId: string | undefined; time: string; read: boolean }> = (rows || []).map((r: any) => {
          let orderId: string | undefined = undefined;
          try {
            const m = r.meta ? JSON.parse(r.meta) : null;
            if (m && m.orderId) orderId = String(m.orderId);
          } catch (e) { }
          return { id: String(r.id), message: String(r.message || ''), orderId, time: String(r.created_at || r.createdAt || new Date().toISOString()), read: !!r.read };
        });

        const newNotifs = mapped.filter((m) => !lastNotifIds.current.has(m.id));
        lastNotifIds.current = new Set(mapped.map((m) => m.id));

        setNotifications(prev => {
          const combined = mapped.concat(prev.filter(p => !mapped.some((m) => m.id === p.id)));
          return combined.slice(0, 50);
        });

        if (initializedSeen.current) {
          for (const n of newNotifs) {
            setToast({ visible: true, message: n.message, id: n.id });
            setTimeout(() => setToast(t => t.id === n.id ? { visible: false, message: '', id: undefined } : t), 5000);
          }
        }
      } catch (e) {
        console.error('Failed to fetch server notifications', e);
      }
    };

    fetchServerNotifications();
    const id = setInterval(fetchServerNotifications, 8000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const fetchOrders = useCallback(async (page: number = currentPage, status: string = statusFilter) => {
    setIsLoadingOrders(true);
    try {
      const data = await api.getOrdersPaginated({
        page,
        limit: ordersPerPage,
        status: status === 'all' ? undefined : status,
        isAdmin: true
      });
      setOrders(data.orders);
      setTotalPages(data.pagination.totalPages);
      setTotalOrders(data.pagination.totalCount);
      setCurrentPage(data.pagination.page);
    } catch (e) {
      console.error("Failed to fetch orders", e);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [currentPage, statusFilter, ordersPerPage]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchOrders(newPage, statusFilter);
    }
  };

  // Handle status filter change
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
    fetchOrders(1, status);
  };

  const handleEditGroup = (group: ProductGroup) => {
    const base = group.displayProduct;

    if (group.isVariantGroup || base.variant_group) {
      // Editing a variant group — strip variant suffix from name to get base name
      const baseName = base.name.replace(/ - [^-]+$/, '');
      setCurrentProduct({
        name: baseName,
        category: base.category,
        image: base.image,
        description: base.description,
        unit: base.unit,
        min_stock: base.min_stock,
      });
      setHasVariants(true);
      setVariantType(group.variantType || base.variant_type || '');
      setVariantRows(group.variants.map(v => ({
        id: v.id,
        value: v.variant_value || '',
        price: v.price,
        cost_price: v.cost_price || 0,
        stock: v.stock || 0,
      })));
    } else {
      // Non-variant product
      setCurrentProduct(base);
      setHasVariants(false);
      setVariantType('');
      setVariantRows([{ value: '', price: 0, cost_price: 0, stock: 50 }]);
    }

    setEditingGroup(group);
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setCurrentProduct(initialFormState);
    setHasVariants(false);
    setVariantType('');
    setVariantRows([{ value: '', price: 0, cost_price: 0, stock: 50 }]);
    setEditingGroup(null);
    setIsEditing(true);
  };

  const handleDeleteGroup = async (group: ProductGroup) => {
    const count = group.variants.length;
    const msg = count > 1
      ? `Delete all ${count} variants in this group?`
      : `Delete this product?`;
    if (!confirm(msg)) return;

    try {
      if (group.isVariantGroup && group.displayProduct.variant_group) {
        await api.deleteVariantGroup(group.displayProduct.variant_group);
        await onRefreshProducts();
      } else {
        await onDeleteProduct(group.displayProduct.id);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete');
    }
  };

  const addVariantRow = () => {
    setVariantRows(prev => [...prev, { value: '', price: 0, cost_price: 0, stock: 50 }]);
  };

  const removeVariantRow = (index: number) => {
    setVariantRows(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariantRow = (index: number, field: keyof VariantRow, value: string | number) => {
    setVariantRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingGroup && hasVariants) {
        // --- Editing or converting to variant group ---
        const validRows = variantRows.filter(row => row.value.trim());
        if (validRows.length === 0) {
          alert('Please add at least one variant with a value.');
          setIsSubmitting(false);
          return;
        }
        const invalidRow = validRows.find(r => !r.price || r.price <= 0);
        if (invalidRow) {
          alert(`Please enter a valid price for variant "${invalidRow.value || 'unnamed'}".`);
          setIsSubmitting(false);
          return;
        }

        const baseName = currentProduct.name || 'product';
        const groupId = editingGroup.displayProduct.variant_group
          || baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

        const sharedFields = {
          category: currentProduct.category,
          image: currentProduct.image,
          description: currentProduct.description,
          unit: currentProduct.unit,
          min_stock: currentProduct.min_stock,
        };

        const existingRows = validRows.filter(r => r.id);
        const newRows = validRows.filter(r => !r.id);

        // Find which original variants were removed
        const existingIds = new Set(existingRows.map(r => r.id));
        const deletedIds = editingGroup.variants
          .map(v => v.id)
          .filter(id => !existingIds.has(id));

        await api.updateVariantGroup({
          groupId,
          variantType,
          sharedFields,
          updates: existingRows.map(r => ({
            id: r.id!,
            name: `${baseName} - ${r.value}`,
            variant_value: r.value,
            price: r.price,
            cost_price: r.cost_price || Math.round(r.price * 0.8 * 100) / 100,
            stock: r.stock,
          })),
          creates: newRows.map(r => ({
            name: `${baseName} - ${r.value}`,
            price: r.price,
            cost_price: r.cost_price || Math.round(r.price * 0.8 * 100) / 100,
            variant_value: r.value,
            stock: r.stock || 50,
          })),
          deletes: deletedIds,
        });

        await onRefreshProducts();
      } else if (editingGroup && !hasVariants) {
        // --- Editing non-variant product (no conversion) ---
        await onUpdateProduct(currentProduct as Product);
      } else if (!editingGroup && hasVariants && variantType && variantRows.length > 0) {
        // --- Creating NEW product with variants ---
        const validRows = variantRows.filter(row => row.value.trim());
        if (validRows.length === 0) {
          alert('Please add at least one variant with a value.');
          setIsSubmitting(false);
          return;
        }
        const invalidRow = validRows.find(r => !r.price || r.price <= 0);
        if (invalidRow) {
          alert(`Please enter a valid price for variant "${invalidRow.value || 'unnamed'}".`);
          setIsSubmitting(false);
          return;
        }

        const groupId = (currentProduct.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
        const productsToCreate: Partial<Product>[] = validRows.map(row => ({
          name: `${currentProduct.name} - ${row.value}`,
          price: row.price,
          cost_price: row.cost_price || Math.round(row.price * 0.8 * 100) / 100,
          category: currentProduct.category,
          image: currentProduct.image,
          description: currentProduct.description,
          unit: currentProduct.unit,
          stock: row.stock || 50,
          min_stock: currentProduct.min_stock,
          variant_group: groupId,
          variant_type: variantType,
          variant_value: row.value,
        }));

        await onAddProducts(productsToCreate);
      } else {
        // --- Creating single product without variants ---
        await onAddProduct(currentProduct as Product);
      }
      setIsEditing(false);
      setEditingGroup(null);
    } catch (err: any) {
      console.error('Failed to save product:', err);
      alert(err?.message || 'Failed to save product. Please check the form and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!currentProduct.name || !currentProduct.category) return;
    setIsGenerating(true);
    const desc = await api.generateProductDescription(currentProduct.name, currentProduct.category);
    setCurrentProduct(prev => ({ ...prev, description: desc }));
    setIsGenerating(false);
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await api.updateOrderStatus(id, status);
    fetchOrders();
  };

  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sm:mb-8 gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">Manage products and view orders</p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto w-full md:w-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <BarChart3 className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Dashboard</span>
            <span className="sm:hidden">Stats</span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'products' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <LayoutGrid className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'orders' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <Package className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Orders
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'stock' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <Boxes className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Stock
          </button>
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'pos' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <ShoppingCart className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            POS
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'reports' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <Receipt className="inline h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Sales Reports</span>
            <span className="sm:hidden">Reports</span>
          </button>
          <div className="relative flex items-center">
            <button onClick={() => setShowNotifDropdown(s => !s)} className="p-1.5 sm:p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
            </button>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs font-bold leading-none text-white bg-red-600 rounded-full">{notifications.filter(n => !n.read).length}</span>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <Dashboard />
      )}

      {activeTab === 'stock' && (
        <StockManagement currentUser={currentUser} />
      )}

      {activeTab === 'pos' && (
        <div className="-mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 -mb-4 sm:-mb-6">
          <SalesPOS currentUser={currentUser} onLogout={() => setActiveTab('dashboard')} />
        </div>
      )}

      {activeTab === 'reports' && (
        <SalesReports />
      )}

      {activeTab === 'products' && (
        <>
          <div className="flex justify-end mb-4 sm:mb-6">
            <button
              onClick={handleAddNew}
              className="flex items-center space-x-2 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm sm:text-base"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Add Product</span>
            </button>
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
            {productGroups.map(group => (
              <ProductCard
                key={group.groupKey}
                product={group.displayProduct}
                isAdmin={true}
                onEdit={() => handleEditGroup(group)}
                onDelete={() => handleDeleteGroup(group)}
                variantCount={group.variants.length > 1 ? group.variants.length : undefined}
              />
            ))}
          </div>
        </>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-6">
            <div className="bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">Revenue</p>
              <p className="text-lg sm:text-3xl font-bold text-green-600 dark:text-green-400">₹{totalSales}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">Total Orders</p>
              <p className="text-lg sm:text-3xl font-bold text-gray-900 dark:text-white">{totalOrders}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">On Page</p>
              <p className="text-lg sm:text-3xl font-bold text-blue-500 dark:text-blue-400">{orders.length}</p>
            </div>
          </div>

          {/* Filter & Pagination Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 sm:gap-3">
              <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-green-500 focus:border-green-500 py-1.5 px-3"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={ordersPerPage}
                onChange={(e) => {
                  setOrdersPerPage(Number(e.target.value));
                  setCurrentPage(1);
                  fetchOrders(1, statusFilter);
                }}
                className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-green-500 focus:border-green-500 py-1.5 px-3"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>

            {/* Pagination */}
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mr-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1 || isLoadingOrders}
                className="p-1.5 sm:p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoadingOrders}
                className="p-1.5 sm:p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Page numbers - show max 5 */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      disabled={isLoadingOrders}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-green-600 text-white'
                          : 'border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoadingOrders}
                className="p-1.5 sm:p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages || isLoadingOrders}
                className="p-1.5 sm:p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Loading State */}
          {isLoadingOrders && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-green-600 dark:text-green-400" />
              <span className="ml-2 text-gray-500 dark:text-gray-400">Loading orders...</span>
            </div>
          )}

          {/* Mobile Card View */}
          {!isLoadingOrders && (
            <div className="sm:hidden space-y-3">
              {orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No orders found{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}
                </div>
              ) : orders.map((order) => (
                <div key={order.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">#{order.id}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{order.user_name || 'Guest'}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full capitalize ${
                        order.status === 'delivered' || order.status === 'completed' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                        order.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' :
                        order.status === 'shipped' || order.status === 'out_for_delivery' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' :
                        'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
                      }`}>
                      {order.status === 'out_for_delivery' ? 'Out for Delivery' : order.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">₹{order.total}</p>
                    <select
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded text-xs focus:ring-green-500 focus:border-green-500 py-1"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Desktop Table View */}
          {!isLoadingOrders && (
            <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {orders.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No orders found{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order ID</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Contact</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {orders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">#{order.id}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{order.user_name || 'Guest'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{order.user_email}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <Phone className="h-3 w-3 mr-1" /> {order.user_phone || 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">₹{order.total}</td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                                order.status === 'delivered' || order.status === 'completed' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                                order.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' :
                                order.status === 'shipped' || order.status === 'out_for_delivery' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' :
                                'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
                              }`}>
                              {order.status === 'out_for_delivery' ? 'Out for Delivery' : order.status}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium">
                            <select
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:ring-green-500 focus:border-green-500"
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="processing">Processing</option>
                              <option value="shipped">Shipped</option>
                              <option value="out_for_delivery">Out for Delivery</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showNotifDropdown && (
        <div className="fixed inset-x-3 sm:inset-x-auto sm:right-6 top-16 sm:top-20 sm:w-80 md:w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Notifications</div>
            <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{notifications.length} total</div>
          </div>
          <div className="max-h-60 sm:max-h-80 overflow-auto">
            {notifications.length === 0 && <div className="p-4 text-gray-500 dark:text-gray-400 text-sm">No notifications</div>}
            {notifications.map(n => (
              <div key={n.id} className={`px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-start ${n.read ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-xs sm:text-sm text-gray-900 dark:text-white">{n.message}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(n.time).toLocaleString()}</div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <button
                    onClick={async () => {
                      // Update local state immediately
                      setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, read: true } : p));
                      // Also update on server if it's a server notification (numeric id)
                      if (!isNaN(Number(n.id))) {
                        try {
                          await api.markNotificationRead(n.id);
                        } catch (e) {
                          console.error('Failed to mark notification as read on server', e);
                        }
                      }
                    }}
                    className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 mb-1 sm:mb-2"
                  >
                    Mark read
                  </button>
                  <button
                    onClick={async () => {
                      // Update local state immediately
                      setNotifications(prev => prev.filter(p => p.id !== n.id));
                      // Also delete on server if it's a server notification
                      if (!isNaN(Number(n.id))) {
                        try {
                          await api.deleteNotification(n.id);
                        } catch (e) {
                          console.error('Failed to delete notification on server', e);
                        }
                      }
                    }}
                    className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <button
              onClick={async () => {
                // Delete all server notifications
                const serverNotifs = notifications.filter(n => !isNaN(Number(n.id)));
                for (const n of serverNotifs) {
                  try {
                    await api.deleteNotification(n.id);
                  } catch (e) {
                    console.error('Failed to delete notification', e);
                  }
                }
                setNotifications([]);
              }}
              className="text-xs sm:text-sm text-red-600 dark:text-red-400"
            >
              Clear All
            </button>
            <button
              onClick={async () => {
                // Mark all as read on server
                const unreadServerNotifs = notifications.filter(n => !n.read && !isNaN(Number(n.id)));
                for (const n of unreadServerNotifs) {
                  try {
                    await api.markNotificationRead(n.id);
                  } catch (e) {
                    console.error('Failed to mark notification as read', e);
                  }
                }
                setNotifications(prev => prev.map(p => ({ ...p, read: true })));
                setShowNotifDropdown(false);
              }}
              className="text-xs sm:text-sm text-gray-600 dark:text-gray-400"
            >
              Mark all read
            </button>
          </div>
        </div>
      )}

      {toast.visible && (
        <div className="fixed right-6 bottom-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-4 py-3 z-50">
          <div className="text-sm text-gray-900 dark:text-white">{toast.message}</div>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {editingGroup
                  ? (editingGroup.isVariantGroup ? 'Edit Variant Group' : 'Edit Product')
                  : 'New Product'}
              </h2>
              <button onClick={() => { setIsEditing(false); setEditingGroup(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={currentProduct.name || ''}
                  onChange={e => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  placeholder={hasVariants ? 'Base name (e.g., Amul Milk)' : 'Product name'}
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select
                    value={currentProduct.category || CATEGORIES[1]}
                    onChange={e => setCurrentProduct({ ...currentProduct, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                  <input
                    type="text"
                    required
                    value={currentProduct.unit || ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="kg, pc, pack"
                  />
                </div>
              </div>

              {/* Price & Stock - only show when NOT in variant mode */}
              {!hasVariants && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Price (₹)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={currentProduct.cost_price || ''}
                        onChange={e => setCurrentProduct({ ...currentProduct, cost_price: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                        placeholder="Buy price"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Selling Price (₹)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={currentProduct.price || ''}
                        onChange={e => setCurrentProduct({ ...currentProduct, price: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                        placeholder="Sell price"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={currentProduct.stock ?? 50}
                        onChange={e => setCurrentProduct({ ...currentProduct, stock: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Profit margin indicator */}
                  {currentProduct.cost_price && currentProduct.price && currentProduct.cost_price > 0 && (
                    <div className={`text-sm px-3 py-2 rounded-lg ${
                      currentProduct.price >= currentProduct.cost_price
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      Profit: ₹{(currentProduct.price - currentProduct.cost_price).toFixed(2)}
                      ({((currentProduct.price - currentProduct.cost_price) / currentProduct.cost_price * 100).toFixed(1)}% margin)
                      {currentProduct.price < currentProduct.cost_price && ' ⚠ Selling below cost!'}
                    </div>
                  )}
                </>
              )}

              {/* Min Stock & Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Stock Level</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={currentProduct.min_stock ?? 10}
                  onChange={e => setCurrentProduct({ ...currentProduct, min_stock: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Image</label>
                {/* Mode tabs */}
                <div className="flex mb-2 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setImageMode('url')}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                      imageMode === 'url'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    Paste URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('upload')}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                      imageMode === 'upload'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    Upload Image
                  </button>
                </div>

                {imageMode === 'url' ? (
                  <input
                    type="text"
                    value={currentProduct.image || ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, image: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                    placeholder="https://example.com/image.jpg"
                  />
                ) : (
                  <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={async e => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files[0];
                      if (!file || !file.type.startsWith('image/')) return;
                      setIsUploading(true);
                      try {
                        const url = await api.uploadImage(file);
                        setCurrentProduct({ ...currentProduct, image: url });
                      } catch (err: any) {
                        alert(err.message || 'Upload failed');
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                    className={`w-full border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                      isUploading
                        ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/10'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploading(true);
                        try {
                          const url = await api.uploadImage(file);
                          setCurrentProduct({ ...currentProduct, image: url });
                        } catch (err: any) {
                          alert(err.message || 'Upload failed');
                        } finally {
                          setIsUploading(false);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }
                      }}
                    />
                    {isUploading ? (
                      <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm font-medium">Uploading...</span>
                      </div>
                    ) : (
                      <div className="text-gray-500 dark:text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-medium">Click or drag & drop</p>
                        <p className="text-xs mt-0.5">JPG, PNG, WebP, GIF (max 5MB)</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Image preview */}
                {currentProduct.image && (
                  <div className="mt-2 relative">
                    <img
                      src={currentProduct.image}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setCurrentProduct({ ...currentProduct, image: '' })}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Variants Section */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                {/* Toggle — show for new products AND non-variant edits (allows conversion) */}
                {(!editingGroup || (editingGroup && !editingGroup.isVariantGroup && !editingGroup.displayProduct.variant_group)) && (
                  <button
                    type="button"
                    onClick={() => {
                      const newVal = !hasVariants;
                      setHasVariants(newVal);
                      // When converting existing product to variants, pre-fill first row from product data
                      if (newVal && editingGroup && !editingGroup.isVariantGroup) {
                        const p = editingGroup.displayProduct;
                        setVariantRows([{
                          id: p.id,
                          value: p.variant_value || '',
                          price: p.price,
                          cost_price: p.cost_price || 0,
                          stock: p.stock || 0,
                        }]);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                      hasVariants
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-sm font-semibold">This product has variants (Size, Color, Weight, etc.)</span>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${hasVariants ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-500'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hasVariants ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </button>
                )}

                {/* Variant group header for editing existing variant group */}
                {editingGroup && editingGroup.isVariantGroup && (
                  <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                    <p className="text-sm font-semibold">
                      Variant Group: <span className="font-bold">{editingGroup.displayProduct.variant_group}</span>
                      <span className="ml-2 text-purple-500 dark:text-purple-400">({editingGroup.variants.length} variants)</span>
                    </p>
                  </div>
                )}

                {/* Variant fields — unified for both new and edit */}
                {hasVariants && (
                  <div className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-600">
                    {/* Variant Type selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Variant Type</label>
                      <select
                        value={variantType}
                        onChange={e => setVariantType(e.target.value)}
                        required={hasVariants}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                      >
                        <option value="">Select type...</option>
                        <option value="Weight">Weight (1kg, 2kg, 5kg)</option>
                        <option value="Size">Size (S, M, L, XL)</option>
                        <option value="Volume">Volume (200ml, 500ml, 1L)</option>
                        <option value="Color">Color (Red, Blue, Black)</option>
                        <option value="Pack">Pack (1 strip, 2 strips)</option>
                      </select>
                    </div>

                    {/* Variant Rows */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Variants ({variantRows.length})
                        </label>
                        <button
                          type="button"
                          onClick={addVariantRow}
                          className="flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Add Variant
                        </button>
                      </div>

                      {/* Header row */}
                      <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 mb-2 px-1">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Value</span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cost (₹)</span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Price (₹)</span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Stock</span>
                        <span className="w-8" />
                      </div>

                      <div className="space-y-2.5">
                        {variantRows.map((row, index) => (
                          <div key={row.id || index} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 items-center">
                            <input
                              type="text"
                              required={hasVariants}
                              placeholder={variantType === 'Weight' ? '1kg' : variantType === 'Size' ? 'M' : variantType === 'Volume' ? '500ml' : variantType === 'Color' ? 'Blue' : 'Value'}
                              value={row.value}
                              onChange={e => updateVariantRow(index, 'value', e.target.value)}
                              className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                            />
                            <input
                              type="number"
                              required={hasVariants}
                              min="0"
                              placeholder="80"
                              value={row.cost_price || ''}
                              onChange={e => updateVariantRow(index, 'cost_price', Number(e.target.value))}
                              className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                            />
                            <input
                              type="number"
                              required={hasVariants}
                              min="0"
                              placeholder="100"
                              value={row.price || ''}
                              onChange={e => updateVariantRow(index, 'price', Number(e.target.value))}
                              className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                            />
                            <input
                              type="number"
                              required={hasVariants}
                              min="0"
                              placeholder="50"
                              value={row.stock || ''}
                              onChange={e => updateVariantRow(index, 'stock', Number(e.target.value))}
                              className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => removeVariantRow(index)}
                              disabled={variantRows.length <= 1}
                              className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                        Each variant has its own price, cost, and stock. They will be linked together on the product page.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={!currentProduct.name || isGenerating}
                    className="text-xs flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-50"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    {isGenerating ? 'Generating...' : 'Auto-Generate'}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={currentProduct.description || ''}
                  onChange={e => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-70 disabled:cursor-wait"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingGroup
                      ? (hasVariants
                        ? `Save ${variantRows.filter(r => r.value.trim()).length} Variant${variantRows.filter(r => r.value.trim()).length !== 1 ? 's' : ''}`
                        : 'Update Product')
                      : (hasVariants
                        ? `Create ${variantRows.filter(r => r.value.trim()).length} Variant${variantRows.filter(r => r.value.trim()).length !== 1 ? 's' : ''}`
                        : 'Create Product')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
