import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// DELETE notification
export async function DELETE(
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

    db.prepare('DELETE FROM notifications WHERE id = ?').run(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
