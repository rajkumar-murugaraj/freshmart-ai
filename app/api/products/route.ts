import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/auth';
import { productSchema, validateData } from '@/lib/validations';

// GET all products - with caching headers
export async function GET(request: NextRequest) {
  const { success, response } = await rateLimit(request, 'general');
  if (!success && response) return response;

  try {
    const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();

    // Convert id to string for frontend compatibility
    const formattedProducts = products.map((p: any) => ({
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

// POST new product - Admin only
export async function POST(request: NextRequest) {
  const { success, response } = await rateLimit(request, 'write');
  if (!success && response) return response;

  // Check admin authentication
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Unauthorized - Admin access required' },
      { status: 403 }
    );
  }

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

    const initialStock = stock !== undefined ? stock : 50;
    const initialMinStock = min_stock !== undefined ? min_stock : 10;

    const result = db.prepare(`
      INSERT INTO products (name, price, category, image, description, unit, stock, min_stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      price,
      category,
      image || 'https://picsum.photos/400/300',
      description || '',
      unit || 'kg',
      initialStock,
      initialMinStock
    );

    return NextResponse.json({
      id: String(result.lastInsertRowid),
      name,
      price,
      category,
      image: image || 'https://picsum.photos/400/300',
      description: description || '',
      unit: unit || 'kg',
      stock: initialStock,
      min_stock: initialMinStock
    });
  } catch (error) {
    console.error('Add product error:', error);
    return NextResponse.json(
      { error: 'Failed to add product' },
      { status: 500 }
    );
  }
}
