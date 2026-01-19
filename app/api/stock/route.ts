import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// GET stock info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const filter = searchParams.get('filter'); // 'low', 'out', 'all'

    if (productId) {
      // Get stock for specific product with history
      const product = db.prepare(`
        SELECT id, name, stock, min_stock, unit, category
        FROM products WHERE id = ?
      `).get(productId);

      const history = db.prepare(`
        SELECT st.*, u.name as user_name
        FROM stock_transactions st
        LEFT JOIN users u ON st.created_by = u.id
        WHERE st.product_id = ?
        ORDER BY st.created_at DESC
        LIMIT 50
      `).all(productId);

      return NextResponse.json({ product, history });
    }

    // Get all products with stock info
    let query = 'SELECT id, name, stock, min_stock, unit, category, price FROM products';

    if (filter === 'low') {
      query += ' WHERE stock <= min_stock AND stock > 0';
    } else if (filter === 'out') {
      query += ' WHERE stock = 0';
    }

    query += ' ORDER BY stock ASC';

    const products = db.prepare(query).all();

    return NextResponse.json(products.map((p: any) => ({
      ...p,
      id: String(p.id),
      status: p.stock === 0 ? 'out' : p.stock <= p.min_stock ? 'low' : 'ok'
    })));
  } catch (error) {
    console.error('Get stock error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}

// POST - Add/Update stock
export async function POST(request: NextRequest) {
  try {
    const { productId, type, quantity, reason, userId } = await request.json();

    if (!productId || !type || quantity === undefined) {
      return NextResponse.json(
        { error: 'Product ID, type, and quantity are required' },
        { status: 400 }
      );
    }

    // Get current stock
    const product = db.prepare('SELECT id, stock, name FROM products WHERE id = ?').get(productId) as any;
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    let newStock = product.stock;
    let transactionType = type;

    switch (type) {
      case 'add':
        newStock = product.stock + quantity;
        break;
      case 'remove':
        newStock = Math.max(0, product.stock - quantity);
        break;
      case 'set':
        newStock = quantity;
        transactionType = quantity > product.stock ? 'add' : 'remove';
        break;
      case 'sale':
        newStock = Math.max(0, product.stock - quantity);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid type. Use: add, remove, set, or sale' },
          { status: 400 }
        );
    }

    // Update product stock
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, productId);

    // Record transaction
    db.prepare(`
      INSERT INTO stock_transactions (product_id, type, quantity, reason, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      productId,
      transactionType,
      type === 'set' ? Math.abs(newStock - product.stock) : quantity,
      reason || `Stock ${type}`,
      userId || null
    );

    return NextResponse.json({
      success: true,
      productId: String(productId),
      previousStock: product.stock,
      newStock,
      change: newStock - product.stock
    });
  } catch (error) {
    console.error('Update stock error:', error);
    return NextResponse.json(
      { error: 'Failed to update stock' },
      { status: 500 }
    );
  }
}

// PUT - Bulk stock update
export async function PUT(request: NextRequest) {
  try {
    const { updates, userId } = await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Updates array is required' },
        { status: 400 }
      );
    }

    const results = [];

    for (const update of updates) {
      const { productId, quantity, reason } = update;

      const product = db.prepare('SELECT id, stock FROM products WHERE id = ?').get(productId) as any;
      if (!product) continue;

      const newStock = quantity;
      const change = newStock - product.stock;

      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, productId);

      db.prepare(`
        INSERT INTO stock_transactions (product_id, type, quantity, reason, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        productId,
        change >= 0 ? 'add' : 'remove',
        Math.abs(change),
        reason || 'Bulk stock update',
        userId || null
      );

      results.push({ productId: String(productId), previousStock: product.stock, newStock });
    }

    return NextResponse.json({ success: true, updated: results.length, results });
  } catch (error) {
    console.error('Bulk stock update error:', error);
    return NextResponse.json(
      { error: 'Failed to update stock' },
      { status: 500 }
    );
  }
}
