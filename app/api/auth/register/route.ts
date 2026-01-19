import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { registerSchema, validateData } from '@/lib/validations';
import { sendEmail, sendSMS } from '@/lib/notifications';
import { createToken, setAuthCookie } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting for auth endpoints
  const { success, response } = await rateLimit(request, 'auth');
  if (!success && response) return response;

  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(registerSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    const { name, email, password, phone } = validation.data;

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Check if phone already exists
    const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existingPhone) {
      return NextResponse.json(
        { error: 'User with this phone number already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert new user
    const result = db.prepare(`
      INSERT INTO users (name, email, password, phone, role, address)
      VALUES (?, ?, ?, ?, 'user', '[]')
    `).run(name, email, hashedPassword, phone);

    const userId = String(result.lastInsertRowid);

    // Send welcome email
    const welcomeHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Welcome to FreshMart AI</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome to FreshMart AI! 🎉</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Hi <strong>${name}</strong>,</p>
          <p>Welcome to FreshMart AI - your smart grocery shopping companion!</p>
          <p>Your account has been created successfully. You can now:</p>
          <ul>
            <li>Browse our fresh products</li>
            <li>Get AI-powered recipe suggestions</li>
            <li>Save addresses for quick checkout</li>
            <li>Track your orders in real-time</li>
          </ul>
          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #166534;">Start shopping now and enjoy fresh groceries delivered to your doorstep!</p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Happy Shopping! 🛒</p>
        </div>
      </body>
      </html>
    `;

    await sendEmail(email, 'Welcome to FreshMart AI! 🎉', welcomeHtml);

    // Send welcome SMS
    await sendSMS(phone, `Welcome to FreshMart AI, ${name}! Your account is ready. Start shopping fresh groceries today!`);

    // Create JWT token for auto-login after registration
    const token = await createToken({
      userId,
      email,
      role: 'user',
    });

    const responseData = {
      id: userId,
      name,
      email,
      phone,
      role: 'user',
      addresses: [],
      orders: [],
      token,
    };

    // Set httpOnly cookie with token
    const res = NextResponse.json(responseData);
    return setAuthCookie(res, token);
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
