import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { saleSchema, validateData } from '@/lib/validations';

// GET sales history (auth handled by middleware)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'day';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Use parameterized queries to prevent SQL injection
    let dateCondition = '';
    const dateParams: any[] = [];

    if (startDate && endDate) {
      dateCondition = `AND date(s.created_at) >= date(?) AND date(s.created_at) <= date(?)`;
      dateParams.push(startDate, endDate);
    } else {
      switch (period) {
        case 'day':
          dateCondition = `AND date(s.created_at) = date('now')`;
          break;
        case 'week':
          dateCondition = `AND s.created_at >= datetime('now', '-7 days')`;
          break;
        case 'month':
          dateCondition = `AND s.created_at >= datetime('now', '-30 days')`;
          break;
        case 'year':
          dateCondition = `AND s.created_at >= datetime('now', '-365 days')`;
          break;
      }
    }

    // Get total count for pagination
    const countResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM sales s
      WHERE 1=1 ${dateCondition}
    `).get(...dateParams) as any;
    const totalCount = countResult.count;

    // Get total stats for the period (for summary cards)
    const statsResult = db.prepare(`
      SELECT
        COUNT(*) as totalSales,
        COALESCE(SUM(total), 0) as totalRevenue,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cashSales,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as cardSales,
        COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN total ELSE 0 END), 0) as upiSales
      FROM sales s
      WHERE 1=1 ${dateCondition}
    `).get(...dateParams) as any;

    // Get paginated sales
    const offset = (page - 1) * limit;
    const sales = db.prepare(`
      SELECT s.*, COALESCE(s.cashier_name, u.name) as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE 1=1 ${dateCondition}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...dateParams, limit, offset);

    // Get items for each sale
    const formattedSales = (sales as any[]).map(sale => {
      const items = db.prepare(`
        SELECT * FROM sale_items WHERE sale_id = ?
      `).all(sale.id);

      return {
        ...sale,
        id: String(sale.id),
        items: items.map((item: any) => ({
          ...item,
          id: String(item.id),
          product_id: String(item.product_id)
        }))
      };
    });

    return NextResponse.json({
      sales: formattedSales,
      stats: {
        totalSales: statsResult.totalSales,
        totalRevenue: statsResult.totalRevenue,
        cashSales: statsResult.cashSales,
        cardSales: statsResult.cardSales,
        upiSales: statsResult.upiSales
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount
      }
    });
  } catch (error) {
    console.error('Get sales error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    );
  }
}

// POST - Create new sale (POS transaction) (auth handled by middleware)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(saleSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    const { items, total, paymentMethod, customerId, cashierId, cashierName } = validation.data;

    // Calculate total if not provided
    const calculatedTotal = total || items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Generate receipt number
    const receiptNo = `RCP${Date.now()}`;

    // Insert sale record
    const saleResult = db.prepare(`
      INSERT INTO sales (receipt_no, total, payment_method, customer_id, cashier_id, cashier_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      receiptNo,
      calculatedTotal,
      paymentMethod,
      customerId || null,
      cashierId || null,
      cashierName || null
    );

    const saleId = saleResult.lastInsertRowid;

    // Insert sale items and update stock
    const insertItem = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, name, quantity, price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare(`
      UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?
    `);

    const insertStockTx = db.prepare(`
      INSERT INTO stock_transactions (product_id, type, quantity, reason, reference_id, created_by)
      VALUES (?, 'sale', ?, ?, ?, ?)
    `);

    for (const item of items) {
      const subtotal = item.price * item.quantity;
      insertItem.run(saleId, item.id, item.name, item.quantity, item.price, subtotal);

      // Update product stock
      updateStock.run(item.quantity, item.id);

      // Record stock transaction
      insertStockTx.run(
        item.id,
        item.quantity,
        `Sale - Receipt #${receiptNo}`,
        String(saleId),
        cashierId || null
      );
    }

    return NextResponse.json({
      success: true,
      sale: {
        id: String(saleId),
        receiptNo,
        total: calculatedTotal,
        paymentMethod,
        items,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Create sale error:', error);
    return NextResponse.json(
      { error: 'Failed to create sale' },
      { status: 500 }
    );
  }
}
