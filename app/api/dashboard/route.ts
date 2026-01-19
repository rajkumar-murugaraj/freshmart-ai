import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // 'today', 'week', 'month', 'year', 'all'

    // Get date filters
    let dateFilter = '';

    switch (period) {
      case 'day':
      case 'today':
        dateFilter = `AND date(created_at) = date('now', 'localtime')`;
        break;
      case 'week':
        dateFilter = `AND created_at >= datetime('now', '-7 days', 'localtime')`;
        break;
      case 'month':
        dateFilter = `AND created_at >= datetime('now', '-30 days', 'localtime')`;
        break;
      case 'year':
        dateFilter = `AND created_at >= datetime('now', '-365 days', 'localtime')`;
        break;
      default:
        dateFilter = '';
    }

    // Total Revenue
    const totalRevenue = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'cancelled' ${dateFilter}
    `).get() as { revenue: number };

    // Total Orders
    const totalOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE 1=1 ${dateFilter}
    `).get() as { count: number };

    // Completed Orders
    const completedOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE status = 'completed' ${dateFilter}
    `).get() as { count: number };

    // Pending Orders
    const pendingOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE status = 'pending' ${dateFilter}
    `).get() as { count: number };

    // Total Products
    const totalProducts = db.prepare(`SELECT COUNT(*) as count FROM products`).get() as { count: number };

    // Low Stock Products
    const lowStockProducts = db.prepare(`
      SELECT COUNT(*) as count FROM products WHERE stock <= min_stock
    `).get() as { count: number };

    // Out of Stock Products
    const outOfStockProducts = db.prepare(`
      SELECT COUNT(*) as count FROM products WHERE stock = 0
    `).get() as { count: number };

    // Total Customers
    const totalCustomers = db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE role = 'user'
    `).get() as { count: number };

    // Monthly Revenue (last 12 months)
    const monthlyRevenue = db.prepare(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        SUM(total) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE status != 'cancelled'
        AND created_at >= datetime('now', '-12 months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month ASC
    `).all() as Array<{ month: string; revenue: number; orders: number }>;

    // Daily Revenue (last 30 days)
    const dailyRevenue = db.prepare(`
      SELECT
        date(created_at) as date,
        SUM(total) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE status != 'cancelled'
        AND created_at >= datetime('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all() as Array<{ date: string; revenue: number; orders: number }>;

    // Top Selling Products
    const topProducts = db.prepare(`
      SELECT
        oi.name,
        SUM(oi.quantity) as total_qty,
        SUM(oi.price * oi.quantity) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled' ${dateFilter.replace('created_at', 'o.created_at')}
      GROUP BY oi.name
      ORDER BY total_qty DESC
      LIMIT 10
    `).all() as Array<{ name: string; total_qty: number; total_revenue: number }>;

    // Sales by Category
    const salesByCategory = db.prepare(`
      SELECT
        p.category,
        SUM(oi.quantity) as total_qty,
        SUM(oi.price * oi.quantity) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.status != 'cancelled' ${dateFilter.replace('created_at', 'o.created_at')}
      GROUP BY p.category
      ORDER BY total_revenue DESC
    `).all() as Array<{ category: string; total_qty: number; total_revenue: number }>;

    // Recent Orders (filtered by period)
    const recentOrders = db.prepare(`
      SELECT
        o.*,
        u.name as customer_name,
        u.email as customer_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE 1=1 ${dateFilter.replace('created_at', 'o.created_at')}
      ORDER BY o.created_at DESC
      LIMIT 10
    `).all() as any[];

    // Low Stock Items
    const lowStockItems = db.prepare(`
      SELECT id, name, stock, min_stock, unit, category
      FROM products
      WHERE stock <= min_stock
      ORDER BY stock ASC
      LIMIT 10
    `).all() as Array<{ id: number; name: string; stock: number; min_stock: number; unit: string; category: string }>;

    return NextResponse.json({
      summary: {
        totalRevenue: totalRevenue.revenue || 0,
        totalOrders: totalOrders.count,
        completedOrders: completedOrders.count,
        pendingOrders: pendingOrders.count,
        totalProducts: totalProducts.count,
        lowStockCount: lowStockProducts.count,
        outOfStockCount: outOfStockProducts.count,
        totalCustomers: totalCustomers.count,
        averageOrderValue: totalOrders.count > 0 ? (totalRevenue.revenue / totalOrders.count) : 0
      },
      monthlyRevenue,
      dailyRevenue,
      salesByCategory: salesByCategory.map(c => ({
        category: c.category || 'Uncategorized',
        total: c.total_revenue,
        count: c.total_qty
      })),
      topProducts: topProducts.map(p => ({
        name: p.name,
        quantity: p.total_qty,
        revenue: p.total_revenue
      })),
      recentOrders: recentOrders.map(o => ({
        id: String(o.id),
        user_name: o.customer_name || 'Guest',
        total: o.total,
        status: o.status,
        created_at: o.created_at
      })),
      lowStockItems: lowStockItems.map(item => ({ ...item, id: String(item.id) }))
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
