import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const expiringProducts = db.prepare(`
      SELECT id, name, price, category, unit, stock, min_stock, expiry_date, manufacturing_date, batch_number, image
      FROM products WHERE expiry_date IS NOT NULL AND expiry_date != '' AND stock > 0 AND date(expiry_date) <= date('now', '+' || ? || ' days')
      ORDER BY expiry_date ASC
    `).all(days) as any[];
    const expiredProducts = db.prepare(`
      SELECT id, name, price, category, unit, stock, expiry_date FROM products
      WHERE expiry_date IS NOT NULL AND expiry_date != '' AND stock > 0 AND date(expiry_date) < date('now') ORDER BY expiry_date ASC
    `).all() as any[];
    return NextResponse.json({ expiring: expiringProducts, expired: expiredProducts, expiringCount: expiringProducts.length, expiredCount: expiredProducts.length });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
