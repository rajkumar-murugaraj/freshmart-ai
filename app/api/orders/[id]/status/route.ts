import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sendEmail, sendSMS, getOrderStatusEmail, smsTemplates } from '@/lib/notifications';

const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

const STATUS_MESSAGES: { [key: string]: (id: string) => string } = {
  confirmed: (id) => `Your order #${id} has been confirmed!`,
  processing: (id) => `Your order #${id} is being prepared.`,
  shipped: (id) => `Your order #${id} has been shipped!`,
  out_for_delivery: (id) => `Your order #${id} is out for delivery!`,
  delivered: (id) => `Your order #${id} has been delivered! Thank you for shopping with us.`,
  cancelled: (id) => `Your order #${id} has been cancelled. Contact support for assistance.`,
  pending: (id) => `Your order #${id} is now being processed.`,
};

// PUT update order status
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { status, note } = await request.json();

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(params.id) as any;
    if (!existing) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Don't update if status is the same
    if (existing.status === status) {
      return NextResponse.json({ success: true, status });
    }

    // Update order status
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, params.id);

    // Record status change in history
    const adminId = request.headers.get('x-user-id');
    db.prepare(`
      INSERT INTO order_status_history (order_id, status, note, created_by)
      VALUES (?, ?, ?, ?)
    `).run(params.id, status, note || null, adminId || null);

    // Emit real-time socket event for order status change
    try {
      const socketServerUrl = process.env.SOCKET_SERVER_URL || 'http://localhost:3001';
      await fetch(`${socketServerUrl}/api/socket/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'order_status_update',
          data: { orderId: params.id, status, note, timestamp: new Date().toISOString() }
        })
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    // Create notification and send email/SMS for user if order has a user_id
    if (existing.user_id) {
      const getMessage = STATUS_MESSAGES[status];
      const message = getMessage ? getMessage(params.id) : `Your order #${params.id} status changed to ${status}.`;

      // Create database notification
      db.prepare(`
        INSERT INTO notifications (user_id, is_admin, message, meta)
        VALUES (?, 0, ?, ?)
      `).run(
        existing.user_id,
        message,
        JSON.stringify({ orderId: params.id, status })
      );

      // Get user info for email/SMS
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.user_id) as any;

      if (user) {
        let shippingAddress: any = {};
        try {
          shippingAddress = existing.shipping_address ? JSON.parse(existing.shipping_address) : {};
        } catch (e) {
          shippingAddress = {};
        }

        const customerName = shippingAddress.name || user.name;
        const customerEmail = shippingAddress.email || user.email;
        const customerPhone = shippingAddress.phone || user.phone;

        if (customerEmail) {
          const emailHtml = getOrderStatusEmail(params.id, customerName, status);
          await sendEmail(customerEmail, `Order #${params.id} - Status Update`, emailHtml);
        }

        if (customerPhone) {
          await sendSMS(customerPhone, smsTemplates.orderStatusUpdate(params.id, status));
        }
      }
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Update order status error:', error);
    return NextResponse.json(
      { error: 'Failed to update order status' },
      { status: 500 }
    );
  }
}

// GET order status history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = db.prepare('SELECT id, status, created_at FROM orders WHERE id = ?').get(params.id) as any;
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const history = db.prepare(`
      SELECT osh.*, u.name as created_by_name
      FROM order_status_history osh
      LEFT JOIN users u ON osh.created_by = u.id
      WHERE osh.order_id = ?
      ORDER BY osh.created_at ASC
    `).all(params.id) as any[];

    // If no history exists, create initial entry from order creation
    if (history.length === 0) {
      return NextResponse.json({
        orderId: String(order.id),
        currentStatus: order.status,
        history: [{
          id: '0',
          status: 'pending',
          note: 'Order placed',
          created_at: order.created_at,
        }]
      });
    }

    return NextResponse.json({
      orderId: String(order.id),
      currentStatus: order.status,
      history: history.map((h: any) => ({
        ...h,
        id: String(h.id),
      }))
    });
  } catch (error) {
    console.error('Get order status history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order status history' },
      { status: 500 }
    );
  }
}
