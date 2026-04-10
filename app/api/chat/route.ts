import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';

function getUserFromRequest(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET || 'freshmart-secret-key-2024') as any; } catch { return null; }
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    let conversations;
    if (user.role === 'admin') {
      conversations = db.prepare(`
        SELECT c.*, u.name as user_name, u.email as user_email,
          (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id AND m.read = 0 AND m.sender_role = 'user') as unread_count,
          (SELECT message FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at
        FROM chat_conversations c JOIN users u ON u.id = c.user_id ORDER BY c.updated_at DESC
      `).all();
    } else {
      conversations = db.prepare(`
        SELECT c.*,
          (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id AND m.read = 0 AND m.sender_role = 'admin') as unread_count,
          (SELECT message FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at
        FROM chat_conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC
      `).all(user.userId);
    }
    return NextResponse.json(conversations);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { subject, order_id, message } = await request.json();
    const result = db.prepare('INSERT INTO chat_conversations (user_id, subject, order_id) VALUES (?, ?, ?)').run(user.userId, subject || 'General Inquiry', order_id || null);
    const conversationId = result.lastInsertRowid;
    if (message) {
      db.prepare('INSERT INTO chat_messages (conversation_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?)').run(conversationId, user.userId, user.role === 'admin' ? 'admin' : 'user', message);
    }
    return NextResponse.json({ id: String(conversationId), user_id: user.userId, subject: subject || 'General Inquiry', order_id: order_id || null, status: 'open', created_at: new Date().toISOString() });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, status } = await request.json();
    db.prepare('UPDATE chat_conversations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
