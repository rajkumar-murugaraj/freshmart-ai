import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { productSchema, validateData } from '@/lib/validations';

// GET all products - with caching headers
export async function GET(request: NextRequest) {
  const { success, response } = await rateLimit(request, 'general');
  if (!success && response) return response;

  try {
    const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();

    // Convert id to string for frontend compatibility
    const formattedProducts = (products as any[]).map((p: any) => ({
      ...p,
      id: String(p.id)
    }));

    // Add cache headers for better performance
    const res = NextResponse.json(formattedProducts);
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res;
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST new product - Admin only (auth handled by middleware)
export async function POST(request: NextRequest) {
  const { success, response } = await rateLimit(request, 'write');
  if (!success && response) return response;

  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(productSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    const { name, price, category, image, description, unit, stock, min_stock } = validation.data;
    const cost_price = body.cost_price !== undefined ? body.cost_price : Math.round(price * 0.8 * 100) / 100;

    const initialStock = stock !== undefined ? stock : 50;
    const initialMinStock = min_stock !== undefined ? min_stock : 10;
    const variant_group = body.variant_group || null;
    const variant_type = body.variant_type || null;
    const variant_value = body.variant_value || null;

    const result = db.prepare(`
      INSERT INTO products (name, price, cost_price, category, image, description, unit, stock, min_stock, variant_group, variant_type, variant_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      price,
      cost_price,
      category,
      image || 'https://picsum.photos/400/300',
      description || '',
      unit || 'kg',
      initialStock,
      initialMinStock,
      variant_group,
      variant_type,
      variant_value
    );

    const productId = result.lastInsertRowid;

    return NextResponse.json({
      id: String(productId),
      name,
      price,
      cost_price,
      category,
      image: image || 'https://picsum.photos/400/300',
      description: description || '',
      unit: unit || 'kg',
      stock: initialStock,
      min_stock: initialMinStock,
      variant_group,
      variant_type,
      variant_value
    });
  } catch (error) {
    console.error('Add product error:', error);
    return NextResponse.json(
      { error: 'Failed to add product' },
      { status: 500 }
    );
  }
}
