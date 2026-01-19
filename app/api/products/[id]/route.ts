import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// GET single product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(params.id) as any;

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...product,
      id: String(product.id)
    });
  } catch (error) {
    console.error('Get product error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT update product
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { name, price, category, image, description, unit } = await request.json();

    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    db.prepare(`
      UPDATE products
      SET name = ?, price = ?, category = ?, image = ?, description = ?, unit = ?
      WHERE id = ?
    `).run(name, price, category, image, description, unit, params.id);

    return NextResponse.json({
      id: params.id,
      name,
      price,
      category,
      image,
      description,
      unit
    });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
