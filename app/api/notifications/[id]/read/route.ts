import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// PUT mark notification as read
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = db.prepare('SELECT id FROM notifications WHERE id = ?').get(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
