import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';

function getUserFromRequest(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET || 'freshmart-secret-key-2024') as any; } catch { return null; }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const messages = db.prepare('SELECT m.*, u.name as sender_name FROM chat_messages m JOIN users u ON u.id = m.sender_id WHERE m.conversation_id = ? ORDER BY m.created_at ASC').all(params.id);
    const markRole = user.role === 'admin' ? 'user' : 'admin';
    db.prepare('UPDATE chat_messages SET read = 1 WHERE conversation_id = ? AND sender_role = ? AND read = 0').run(params.id, markRole);
    return NextResponse.json(messages);
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { message } = await request.json();
    if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    const senderRole = user.role === 'admin' ? 'admin' : 'user';
    const result = db.prepare('INSERT INTO chat_messages (conversation_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?)').run(params.id, user.userId, senderRole, message.trim());
    if (user.role === 'admin') {
      db.prepare('UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP, admin_id = COALESCE(admin_id, ?) WHERE id = ?').run(user.userId, params.id);
    } else {
      db.prepare('UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(params.id);
    }
    const userName = db.prepare('SELECT name FROM users WHERE id = ?').get(user.userId) as any;
    return NextResponse.json({ id: String(result.lastInsertRowid), conversation_id: params.id, sender_id: user.userId, sender_role: senderRole, sender_name: userName?.name || 'Unknown', message: message.trim(), read: 0, created_at: new Date().toISOString() });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
