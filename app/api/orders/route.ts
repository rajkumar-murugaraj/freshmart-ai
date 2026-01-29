import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { orderSchema, validateData, addressSchema } from '@/lib/validations';
import {
  sendEmail,
  sendSMS,
  getOrderConfirmationEmail,
  getAdminOrderNotificationEmail,
  smsTemplates
} from '@/lib/notifications';

// GET orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isAdmin = searchParams.get('isAdmin') === 'true';

    // Pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Status filter for admin
    const statusFilter = searchParams.get('status');

    let orders: any[] = [];
    let totalCount = 0;

    if (isAdmin) {
      // Build query with optional status filter
      let whereClause = '';
      const params: any[] = [];

      if (statusFilter && statusFilter !== 'all') {
        whereClause = 'WHERE o.status = ?';
        params.push(statusFilter);
      }

      // Get total count for pagination
      const countResult = db.prepare(`
        SELECT COUNT(*) as count FROM orders o ${whereClause}
      `).get(...params) as { count: number };
      totalCount = countResult.count;

      // Admin gets paginated orders with user info
      orders = db.prepare(`
        SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);
    } else if (userId && userId !== '0') {
      // Get total count for user's orders
      const countResult = db.prepare(`
        SELECT COUNT(*) as count FROM orders WHERE user_id = ?
      `).get(userId) as { count: number };
      totalCount = countResult.count;

      // User gets only their orders (paginated)
      orders = db.prepare(`
        SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(userId, limit, offset);
    } else {
      orders = [];
      totalCount = 0;
    }

    // Fetch items for each order
    const formattedOrders = (orders as any[]).map(order => {
      const items = db.prepare(`
        SELECT * FROM order_items WHERE order_id = ?
      `).all(order.id);

      let shippingAddress = {};
      try {
        shippingAddress = order.shipping_address ? JSON.parse(order.shipping_address) : {};
      } catch (e) {
        shippingAddress = {};
      }

      return {
        ...order,
        id: String(order.id),
        items: items.map((item: any) => ({
          ...item,
          id: String(item.id),
          product_id: String(item.product_id)
        })),
        shippingAddress,
        date: order.created_at,
        paymentMethod: order.payment_method
      };
    });

    // Return paginated response with metadata
    return NextResponse.json({
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if user is logged in - REQUIRED
    if (!body.user_id) {
      return NextResponse.json(
        { error: 'Please sign in to place an order' },
        { status: 401 }
      );
    }

    // Validate order data
    const validation = validateData(orderSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    const { user_id, total, items, paymentMethod, shippingAddress } = validation.data;

    // Get user info for notifications
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id) as any;
    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please sign in again.' },
        { status: 401 }
      );
    }

    // Validate shipping address
    const addressValidation = validateData(addressSchema, shippingAddress);
    if (!addressValidation.success) {
      return NextResponse.json(
        { error: addressValidation.errors[0], errors: addressValidation.errors },
        { status: 400 }
      );
    }

    // Insert order
    const orderResult = db.prepare(`
      INSERT INTO orders (user_id, total, status, payment_method, shipping_address)
      VALUES (?, ?, 'pending', ?, ?)
    `).run(
      user_id,
      total,
      paymentMethod,
      JSON.stringify(shippingAddress)
    );

    const orderId = orderResult.lastInsertRowid;

    // Record initial status in history
    db.prepare(`
      INSERT INTO order_status_history (order_id, status, note, created_by)
      VALUES (?, 'pending', 'Order placed', ?)
    `).run(orderId, user_id);

    // Insert order items
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, name, quantity, price)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(orderId, item.id || null, item.name, item.quantity, item.price);
    }

    // Create database notification for admin
    db.prepare(`
      INSERT INTO notifications (user_id, is_admin, message, meta)
      VALUES (NULL, 1, ?, ?)
    `).run(
      `New order #${orderId} placed by ${shippingAddress.name} - ₹${total}`,
      JSON.stringify({ orderId: String(orderId) })
    );

    // Create database notification for user
    db.prepare(`
      INSERT INTO notifications (user_id, is_admin, message, meta)
      VALUES (?, 0, ?, ?)
    `).run(
      user_id,
      `Your order #${orderId} has been placed successfully!`,
      JSON.stringify({ orderId: String(orderId) })
    );

    // Send email to customer
    const customerEmail = shippingAddress.email || user.email;
    if (customerEmail) {
      const emailHtml = getOrderConfirmationEmail(
        String(orderId),
        shippingAddress.name,
        total,
        items
      );
      await sendEmail(customerEmail, `Order Confirmed - #${orderId}`, emailHtml);
    }

    // Send SMS to customer
    const customerPhone = shippingAddress.phone || user.phone;
    if (customerPhone) {
      await sendSMS(customerPhone, smsTemplates.orderConfirmation(String(orderId), total));
    }

    // Send email notification to admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const adminEmailHtml = getAdminOrderNotificationEmail(
        String(orderId),
        shippingAddress.name,
        customerEmail,
        customerPhone,
        total
      );
      await sendEmail(adminEmail, `New Order #${orderId} - ₹${total}`, adminEmailHtml);
    }

    // Send SMS notification to admin
    const adminPhone = process.env.ADMIN_PHONE;
    if (adminPhone) {
      await sendSMS(adminPhone, smsTemplates.adminNewOrder(String(orderId), shippingAddress.name, total));
    }

    // Emit real-time socket notification to admin panel
    try {
      const socketServerUrl = process.env.SOCKET_SERVER_URL || 'http://localhost:3001';
      await fetch(`${socketServerUrl}/api/socket/order-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: String(orderId),
          customerName: shippingAddress.name,
          total,
          userId: user_id
        })
      });
    } catch (socketError) {
      // Don't fail the order if socket notification fails
      console.error('Socket notification error:', socketError);
    }

    return NextResponse.json({
      id: String(orderId),
      total,
      status: 'pending',
      paymentMethod,
      shippingAddress,
      items
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'Failed to create order. Please try again.' },
      { status: 500 }
    );
  }
}
