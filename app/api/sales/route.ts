import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// GET sales history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'day';
    const limit = parseInt(searchParams.get('limit') || '50');

    let dateFilter = '';
    const now = new Date();

    switch (period) {
      case 'day':
        dateFilter = `AND date(s.created_at) = date('now')`;
        break;
      case 'week':
        dateFilter = `AND s.created_at >= datetime('now', '-7 days')`;
        break;
      case 'month':
        dateFilter = `AND s.created_at >= datetime('now', '-30 days')`;
        break;
      case 'year':
        dateFilter = `AND s.created_at >= datetime('now', '-365 days')`;
        break;
    }

    const sales = db.prepare(`
      SELECT s.*, u.name as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE 1=1 ${dateFilter}
      ORDER BY s.created_at DESC
      LIMIT ?
    `).all(limit);

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

    return NextResponse.json(formattedSales);
  } catch (error) {
    console.error('Get sales error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    );
  }
}

// POST - Create new sale (POS transaction)
export async function POST(request: NextRequest) {
  try {
    const { items, total, paymentMethod, customerId, cashierId } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      );
    }

    // Calculate total if not provided
    const calculatedTotal = total || items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    // Generate receipt number
    const receiptNo = `RCP${Date.now()}`;

    // Insert sale record
    const saleResult = db.prepare(`
      INSERT INTO sales (receipt_no, total, payment_method, customer_id, cashier_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      receiptNo,
      calculatedTotal,
      paymentMethod || 'cash',
      customerId || null,
      cashierId || null
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
      insertItem.run(saleId, item.id || null, item.name, item.quantity, item.price, subtotal);

      if (item.id) {
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
    }

    return NextResponse.json({
      success: true,
      sale: {
        id: String(saleId),
        receiptNo,
        total: calculatedTotal,
        paymentMethod: paymentMethod || 'cash',
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
