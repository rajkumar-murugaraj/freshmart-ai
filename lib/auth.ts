import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'freshmart-secret-key-change-in-production'
);

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'sales';
  iat?: number;
  exp?: number;
}

// Create JWT token
export async function createToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

// Verify JWT token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// Get current user from request
export async function getCurrentUser(request: NextRequest): Promise<JWTPayload | null> {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Auth middleware helper
export function withAuth(
  handler: (request: NextRequest, user: JWTPayload) => Promise<NextResponse>,
  options?: { roles?: Array<'admin' | 'user' | 'sales'> }
) {
  return async (request: NextRequest) => {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    if (options?.roles && !options.roles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    return handler(request, user);
  };
}

// Set auth cookie
export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  return response;
}

// Clear auth cookie
export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
