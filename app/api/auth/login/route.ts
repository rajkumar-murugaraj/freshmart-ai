import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { loginSchema, validateData } from '@/lib/validations';
import { createTokenPair, setAuthCookies } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting for auth endpoints
  const { success, response } = await rateLimit(request, 'auth');
  if (!success && response) return response;

  try {
    const body = await request.json();

    // Validate input
    const validation = validateData(loginSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    const { email, password, role } = validation.data;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email address' },
        { status: 404 }
      );
    }

    // Verify password
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Incorrect password. Please try again.' },
        { status: 401 }
      );
    }

    // If role is specified, check it matches. Otherwise, allow any role (auto-detect)
    if (role && user.role !== role) {
      return NextResponse.json(
        { error: `Access denied. ${role === 'admin' ? 'Admin' : 'User'} credentials required.` },
        { status: 403 }
      );
    }

    // Parse addresses
    let addresses = [];
    try {
      addresses = user.address ? JSON.parse(user.address) : [];
    } catch (e) {
      addresses = [];
    }

    // Create JWT token pair (access + refresh)
    const tokens = await createTokenPair({
      userId: String(user.id),
      email: user.email,
      role: user.role,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    const responseData = {
      ...userWithoutPassword,
      id: String(user.id),
      addresses,
      orders: [],
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      refreshExpiresIn: tokens.refreshExpiresIn,
    };

    // Set httpOnly cookies with tokens
    const res = NextResponse.json(responseData);
    return setAuthCookies(res, tokens);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
