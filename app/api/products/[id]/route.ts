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

// PUT update product - Admin only (auth handled by middleware)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, price, cost_price, category, image, description, unit } = body;

    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(params.id) as any;
    if (!existing) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // If cost_price not provided, calculate default as 80% of price
    const finalCostPrice = cost_price !== undefined ? cost_price : Math.round(price * 0.8 * 100) / 100;
    const variant_group = body.variant_group !== undefined ? (body.variant_group || null) : existing.variant_group;
    const variant_type = body.variant_type !== undefined ? (body.variant_type || null) : existing.variant_type;
    const variant_value = body.variant_value !== undefined ? (body.variant_value || null) : existing.variant_value;
    const expiry_date = body.expiry_date !== undefined ? (body.expiry_date || null) : existing.expiry_date;
    const manufacturing_date = body.manufacturing_date !== undefined ? (body.manufacturing_date || null) : existing.manufacturing_date;
    const batch_number = body.batch_number !== undefined ? (body.batch_number || null) : existing.batch_number;

    db.prepare(`
      UPDATE products
      SET name = ?, price = ?, cost_price = ?, category = ?, image = ?, description = ?, unit = ?, variant_group = ?, variant_type = ?, variant_value = ?, expiry_date = ?, manufacturing_date = ?, batch_number = ?
      WHERE id = ?
    `).run(name, price, finalCostPrice, category, image, description, unit, variant_group, variant_type, variant_value, expiry_date, manufacturing_date, batch_number, params.id);

    return NextResponse.json({
      id: params.id,
      name,
      price,
      cost_price: finalCostPrice,
      category,
      image,
      description,
      unit,
      variant_group,
      variant_type,
      variant_value,
      expiry_date,
      manufacturing_date,
      batch_number
    });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE product - Admin only (auth handled by middleware)
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
