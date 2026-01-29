import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// GET - Get user's wishlist with price drop detection
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const items = db.prepare(`
      SELECT w.id, w.product_id, w.added_price, w.created_at,
             p.name, p.price as current_price, p.image, p.category, p.unit, p.stock,
             p.description, p.variant_group, p.variant_type, p.variant_value,
             p.min_stock, p.cost_price
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `).all(userId) as any[];

    const formattedItems = items.map((item: any) => ({
      id: String(item.id),
      product_id: String(item.product_id),
      added_price: item.added_price,
      current_price: item.current_price,
      price_dropped: item.current_price < item.added_price,
      price_drop_amount: item.added_price > item.current_price
        ? Math.round((item.added_price - item.current_price) * 100) / 100
        : 0,
      created_at: item.created_at,
      product: {
        id: String(item.product_id),
        name: item.name,
        price: item.current_price,
        image: item.image,
        category: item.category,
        unit: item.unit,
        stock: item.stock,
        description: item.description,
        variant_group: item.variant_group,
        variant_type: item.variant_type,
        variant_value: item.variant_value,
        min_stock: item.min_stock,
        cost_price: item.cost_price,
      }
    }));

    const priceDropCount = formattedItems.filter((i: any) => i.price_dropped).length;

    return NextResponse.json({
      items: formattedItems,
      totalCount: formattedItems.length,
      priceDropCount,
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
  }
}

// POST - Add item to wishlist
export async function POST(request: NextRequest) {
  try {
    const { userId, productId } = await request.json();

    if (!userId || !productId) {
      return NextResponse.json({ error: 'userId and productId are required' }, { status: 400 });
    }

    // Get current product price
    const product = db.prepare('SELECT id, price FROM products WHERE id = ?').get(productId) as any;
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Insert or ignore if already exists
    try {
      db.prepare(
        'INSERT INTO wishlists (user_id, product_id, added_price) VALUES (?, ?, ?)'
      ).run(userId, productId, product.price);
    } catch (e: any) {
      if (e.message?.includes('UNIQUE constraint')) {
        return NextResponse.json({ success: true, message: 'Already in wishlist' });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500 });
  }
}

// DELETE - Remove item from wishlist
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const productId = searchParams.get('productId');

    if (!userId || !productId) {
      return NextResponse.json({ error: 'userId and productId are required' }, { status: 400 });
    }

    db.prepare(
      'DELETE FROM wishlists WHERE user_id = ? AND product_id = ?'
    ).run(userId, productId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    return NextResponse.json({ error: 'Failed to remove from wishlist' }, { status: 500 });
  }
}
