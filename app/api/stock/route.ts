import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { stockUpdateSchema, bulkStockUpdateSchema, validateData } from '@/lib/validations';

// GET stock info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const filter = searchParams.get('filter'); // 'low', 'out', 'all'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const historyPage = parseInt(searchParams.get('historyPage') || '1');
    const historyLimit = parseInt(searchParams.get('historyLimit') || '10');

    if (productId) {
      // Get stock for specific product with paginated history
      const product = db.prepare(`
        SELECT id, name, stock, min_stock, unit, category
        FROM products WHERE id = ?
      `).get(productId) as any;

      // Get total history count
      let historyWhereClause = 'WHERE st.product_id = ?';
      const historyParams: any[] = [productId];

      const historyCount = (db.prepare(
        `SELECT COUNT(*) as count FROM stock_transactions st ${historyWhereClause}`
      ).get(...historyParams) as any).count;

      const historyOffset = (historyPage - 1) * historyLimit;
      const history = db.prepare(`
        SELECT st.*, u.name as user_name
        FROM stock_transactions st
        LEFT JOIN users u ON st.created_by = u.id
        ${historyWhereClause}
        ORDER BY st.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...historyParams, historyLimit, historyOffset);

      return NextResponse.json({
        product: product ? { ...product, id: String(product.id) } : null,
        history,
        historyPagination: {
          page: historyPage,
          limit: historyLimit,
          totalCount: historyCount,
          totalPages: Math.ceil(historyCount / historyLimit),
          hasMore: historyPage * historyLimit < historyCount
        }
      });
    }

    // Build base query and count query
    let whereClause = '';
    if (filter === 'low') {
      whereClause = ' WHERE stock <= min_stock AND stock > 0';
    } else if (filter === 'out') {
      whereClause = ' WHERE stock = 0';
    }

    // Get total count for current filter
    const countQuery = `SELECT COUNT(*) as count FROM products${whereClause}`;
    const totalCount = (db.prepare(countQuery).get() as any).count;

    // Get stats for all products (for summary cards)
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as outOfStock,
        SUM(CASE WHEN stock > 0 AND stock <= min_stock THEN 1 ELSE 0 END) as lowStock,
        SUM(CASE WHEN stock > min_stock THEN 1 ELSE 0 END) as inStock
      FROM products
    `).get() as any;

    // Get paginated products
    const offset = (page - 1) * limit;
    const query = `SELECT id, name, stock, min_stock, unit, category, price, cost_price FROM products${whereClause} ORDER BY stock ASC LIMIT ? OFFSET ?`;
    const products = db.prepare(query).all(limit, offset);

    const formattedProducts = products.map((p: any) => ({
      ...p,
      id: String(p.id),
      status: p.stock === 0 ? 'out' : p.stock <= p.min_stock ? 'low' : 'ok'
    }));

    return NextResponse.json({
      products: formattedProducts,
      stats: {
        total: stats.total || 0,
        outOfStock: stats.outOfStock || 0,
        lowStock: stats.lowStock || 0,
        inStock: stats.inStock || 0
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
    console.error('Get stock error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}

// POST - Add/Update stock (auth handled by middleware)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(stockUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    const { productId, type, quantity, reason, userId } = validation.data;

    // Get current stock
    const product = db.prepare('SELECT id, stock FROM products WHERE id = ?').get(productId) as any;
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    const currentStock = product.stock;

    let newStock = currentStock;
    let transactionType = type;

    switch (type) {
      case 'add':
        newStock = currentStock + quantity;
        break;
      case 'remove':
        newStock = Math.max(0, currentStock - quantity);
        break;
      case 'set':
        newStock = quantity;
        transactionType = quantity > currentStock ? 'add' : 'remove';
        break;
      case 'sale':
        newStock = Math.max(0, currentStock - quantity);
        break;
    }

    // Update stock
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, productId);

    // Record transaction
    db.prepare(`
      INSERT INTO stock_transactions (product_id, type, quantity, reason, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      productId,
      transactionType,
      type === 'set' ? Math.abs(newStock - currentStock) : quantity,
      reason || `Stock ${type}`,
      userId || null
    );

    return NextResponse.json({
      success: true,
      productId: String(productId),
      previousStock: currentStock,
      newStock,
      change: newStock - currentStock
    });
  } catch (error) {
    console.error('Update stock error:', error);
    return NextResponse.json(
      { error: 'Failed to update stock' },
      { status: 500 }
    );
  }
}

// PUT - Bulk stock update (auth handled by middleware)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(bulkStockUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    const { updates, userId } = validation.data;
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
