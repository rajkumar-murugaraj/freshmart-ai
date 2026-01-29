import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// GET reviews for a product
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const reviews = db.prepare(`
      SELECT r.*, u.name as user_name
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `).all(productId) as any[];

    // Get aggregate stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COALESCE(AVG(rating), 0) as average,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one
      FROM reviews
      WHERE product_id = ?
    `).get(productId) as any;

    return NextResponse.json({
      reviews: reviews.map((r: any) => ({
        ...r,
        id: String(r.id),
        product_id: String(r.product_id),
        user_id: String(r.user_id),
      })),
      stats: {
        total: stats.total || 0,
        average: Math.round((stats.average || 0) * 10) / 10,
        breakdown: {
          5: stats.five || 0,
          4: stats.four || 0,
          3: stats.three || 0,
          2: stats.two || 0,
          1: stats.one || 0,
        }
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// POST - Create a review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, userId, rating, comment } = body;

    if (!productId || !userId) {
      return NextResponse.json({ error: 'productId and userId are required' }, { status: 400 });
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    // Check if user already reviewed this product
    const existing = db.prepare(
      'SELECT id FROM reviews WHERE product_id = ? AND user_id = ?'
    ).get(productId, userId) as any;

    if (existing) {
      // Update existing review
      db.prepare(
        'UPDATE reviews SET rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(rating, comment || null, existing.id);

      return NextResponse.json({ success: true, updated: true, reviewId: String(existing.id) });
    }

    // Check if user actually purchased this product
    const purchased = db.prepare(`
      SELECT oi.id FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.user_id = ? AND oi.product_id = ? AND o.status IN ('delivered', 'completed')
      LIMIT 1
    `).get(userId, productId) as any;

    if (!purchased) {
      return NextResponse.json(
        { error: 'You can only review products you have purchased' },
        { status: 403 }
      );
    }

    const result = db.prepare(
      'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)'
    ).run(productId, userId, rating, comment || null);

    return NextResponse.json({
      success: true,
      reviewId: String(result.lastInsertRowid)
    });
  } catch (error) {
    console.error('Create review error:', error);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}

// DELETE - Remove a review (user can delete own, admin can delete any)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('id');
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!reviewId) {
      return NextResponse.json({ error: 'Review id is required' }, { status: 400 });
    }

    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId) as any;
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Only allow owner or admin to delete
    if (String(review.user_id) !== userId && userRole !== 'admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    db.prepare('DELETE FROM reviews WHERE id = ?').run(reviewId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete review error:', error);
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }
}
