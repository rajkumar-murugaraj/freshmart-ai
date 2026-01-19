import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sendEmail, sendSMS, getOrderStatusEmail, smsTemplates } from '@/lib/notifications';

// PUT update order status
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { status } = await request.json();

    if (!status || !['pending', 'completed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, completed, or cancelled' },
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

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, params.id);

    // Create notification and send email/SMS for user if order has a user_id
    if (existing.user_id) {
      const statusMessages: { [key: string]: string } = {
        completed: `Your order #${params.id} has been delivered! Thank you for shopping with us.`,
        cancelled: `Your order #${params.id} has been cancelled. Contact support for assistance.`,
        pending: `Your order #${params.id} is now being processed.`
      };

      // Create database notification
      db.prepare(`
        INSERT INTO notifications (user_id, is_admin, message, meta)
        VALUES (?, 0, ?, ?)
      `).run(
        existing.user_id,
        statusMessages[status],
        JSON.stringify({ orderId: params.id, status })
      );

      // Get user info for email/SMS
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.user_id) as any;

      if (user) {
        // Parse shipping address to get customer info
        let shippingAddress: any = {};
        try {
          shippingAddress = existing.shipping_address ? JSON.parse(existing.shipping_address) : {};
        } catch (e) {
          shippingAddress = {};
        }

        const customerName = shippingAddress.name || user.name;
        const customerEmail = shippingAddress.email || user.email;
        const customerPhone = shippingAddress.phone || user.phone;

        // Send email notification
        if (customerEmail) {
          const emailHtml = getOrderStatusEmail(params.id, customerName, status);
          await sendEmail(customerEmail, `Order #${params.id} - Status Update`, emailHtml);
        }

        // Send SMS notification
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
