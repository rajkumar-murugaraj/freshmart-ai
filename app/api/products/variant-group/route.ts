import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// PUT - Update a variant group atomically (auth handled by middleware)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, variantType, sharedFields, updates, creates, deletes } = body;

    if (!groupId || !variantType) {
      return NextResponse.json({ error: 'groupId and variantType are required' }, { status: 400 });
    }

    const updateStmt = db.prepare(`
      UPDATE products
      SET name = ?, price = ?, cost_price = ?, category = ?, image = ?, description = ?, unit = ?,
          min_stock = ?, variant_group = ?, variant_type = ?, variant_value = ?, stock = ?
      WHERE id = ?
    `);

    const insertStmt = db.prepare(`
      INSERT INTO products (name, price, cost_price, category, image, description, unit,
          stock, min_stock, variant_group, variant_type, variant_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const deleteStmt = db.prepare('DELETE FROM products WHERE id = ?');

    const transaction = db.transaction(() => {
      // Update existing variants
      if (updates && Array.isArray(updates)) {
        for (const u of updates) {
          updateStmt.run(
            u.name, u.price, u.cost_price,
            sharedFields.category, sharedFields.image, sharedFields.description,
            sharedFields.unit, sharedFields.min_stock,
            groupId, variantType, u.variant_value, u.stock, u.id
          );
        }
      }

      // Create new variants
      if (creates && Array.isArray(creates)) {
        for (const c of creates) {
          insertStmt.run(
            c.name, c.price, c.cost_price,
            sharedFields.category, sharedFields.image, sharedFields.description,
            sharedFields.unit, c.stock, sharedFields.min_stock,
            groupId, variantType, c.variant_value
          );
        }
      }

      // Delete removed variants
      if (deletes && Array.isArray(deletes)) {
        for (const id of deletes) {
          deleteStmt.run(id);
        }
      }
    });

    transaction();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update variant group error:', error);
    return NextResponse.json({ error: 'Failed to update variant group' }, { status: 500 });
  }
}

// DELETE - Delete entire variant group (auth handled by middleware)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
    }

    db.prepare('DELETE FROM products WHERE variant_group = ?').run(groupId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete variant group error:', error);
    return NextResponse.json({ error: 'Failed to delete variant group' }, { status: 500 });
  }
}
