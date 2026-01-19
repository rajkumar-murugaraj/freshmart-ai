import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// GET user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(params.id) as any;

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse addresses
    let addresses = [];
    try {
      addresses = user.address ? JSON.parse(user.address) : [];
    } catch (e) {
      addresses = [];
    }

    // Get user orders
    const orders = db.prepare(`
      SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
    `).all(params.id);

    const formattedOrders = (orders as any[]).map(order => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      let shippingAddress = {};
      try {
        shippingAddress = order.shipping_address ? JSON.parse(order.shipping_address) : {};
      } catch (e) {
        shippingAddress = {};
      }
      return {
        ...order,
        id: String(order.id),
        items,
        shippingAddress,
        date: order.created_at,
        paymentMethod: order.payment_method
      };
    });

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      ...userWithoutPassword,
      id: String(user.id),
      addresses,
      orders: formattedOrders
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PUT update user (addresses)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { addresses } = await request.json();

    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    db.prepare('UPDATE users SET address = ? WHERE id = ?').run(
      JSON.stringify(addresses || []),
      params.id
    );

    return NextResponse.json({ success: true, addresses });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
