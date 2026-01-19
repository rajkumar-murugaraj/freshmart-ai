import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// GET notifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isAdmin = searchParams.get('isAdmin') === 'true';

    let notifications: any[] = [];
    if (isAdmin) {
      // Admin gets admin notifications
      notifications = db.prepare(`
        SELECT * FROM notifications WHERE is_admin = 1 ORDER BY created_at DESC LIMIT 50
      `).all() as any[];
    } else if (userId && userId !== '0' && userId !== '') {
      // User gets their notifications
      notifications = db.prepare(`
        SELECT * FROM notifications WHERE user_id = ? AND is_admin = 0 ORDER BY created_at DESC LIMIT 50
      `).all(userId) as any[];
    }

    const formatted = notifications.map(n => ({
      ...n,
      id: String(n.id)
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// POST new notification
export async function POST(request: NextRequest) {
  try {
    const { user_id, is_admin, message, meta } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const result = db.prepare(`
      INSERT INTO notifications (user_id, is_admin, message, meta)
      VALUES (?, ?, ?, ?)
    `).run(
      user_id || null,
      is_admin ? 1 : 0,
      message,
      meta ? JSON.stringify(meta) : null
    );

    return NextResponse.json({
      id: String(result.lastInsertRowid),
      user_id,
      is_admin: is_admin ? 1 : 0,
      message,
      meta,
      read: 0
    });
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
