import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import db from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'freshmart-secret-key-change-in-production'
);

const REFRESH_SECRET = new TextEncoder().encode(
  process.env.REFRESH_SECRET || 'freshmart-refresh-secret-change-in-production'
);

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '15m';  // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d';  // 7 days
const ACCESS_TOKEN_MAX_AGE = 15 * 60;  // 15 minutes in seconds
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;  // 7 days in seconds

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'sales';
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;  // Access token expiry in seconds
  refreshExpiresIn: number;  // Refresh token expiry in seconds
}

// Create access token (short-lived)
export async function createAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' } as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

// Create refresh token (long-lived)
export async function createRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh' } as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(REFRESH_SECRET);
}

// Create both tokens
export async function createTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'>): Promise<TokenPair> {
  const accessToken = await createAccessToken(payload);
  const refreshToken = await createRefreshToken(payload);

  // Store refresh token in database
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000).toISOString();

  // Delete old refresh tokens for this user
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(payload.userId);

  // Insert new refresh token
  db.prepare(`
    INSERT INTO refresh_tokens (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `).run(payload.userId, refreshToken, expiresAt);

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_MAX_AGE,
    refreshExpiresIn: REFRESH_TOKEN_MAX_AGE
  };
}

// Legacy function for backward compatibility
export async function createToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return createAccessToken(payload);
}

// Verify access token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// Verify refresh token
export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET);

    // Check if token exists in database and is not expired
    const storedToken = db.prepare(`
      SELECT * FROM refresh_tokens
      WHERE token = ? AND expires_at > datetime('now')
    `).get(token) as any;

    if (!storedToken) {
      return null;
    }

    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// Refresh tokens - returns new token pair if refresh token is valid
export async function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const payload = await verifyRefreshToken(refreshToken);

  if (!payload) {
    return null;
  }

  // Verify user still exists
  const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(payload.userId) as any;
  if (!user) {
    // Revoke token if user doesn't exist
    await revokeRefreshToken(refreshToken);
    return null;
  }

  // Create new token pair (this also revokes old refresh token)
  return createTokenPair({
    userId: String(user.id),
    email: user.email,
    role: user.role
  });
}

// Revoke refresh token
export async function revokeRefreshToken(token: string): Promise<void> {
  db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);
}

// Revoke all refresh tokens for a user (e.g., on password change)
export async function revokeAllUserTokens(userId: string): Promise<void> {
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
}

// Get current user from request
export async function getCurrentUser(request: NextRequest): Promise<JWTPayload | null> {
  // Try cookie first
  const cookieToken = request.cookies.get('auth_token')?.value;
  if (cookieToken) {
    const payload = await verifyToken(cookieToken);
    if (payload) return payload;
  }

  // Try Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return verifyToken(token);
  }

  return null;
}

// Check if token is about to expire (within 5 minutes)
export function isTokenExpiringSoon(payload: JWTPayload): boolean {
  if (!payload.exp) return true;
  const expiresAt = payload.exp * 1000;
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
  return expiresAt < fiveMinutesFromNow;
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
        { error: 'Unauthorized - Please login', code: 'TOKEN_EXPIRED' },
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

// Set auth cookies (both access and refresh)
export function setAuthCookies(response: NextResponse, tokens: TokenPair): NextResponse {
  // Access token cookie
  response.cookies.set('auth_token', tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: tokens.expiresIn,
    path: '/',
  });

  // Refresh token cookie
  response.cookies.set('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: tokens.refreshExpiresIn,
    path: '/',
  });

  return response;
}

// Legacy function for backward compatibility
export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: '/',
  });
  return response;
}

// Clear auth cookies
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}

// Legacy alias
export const clearAuthCookie = clearAuthCookies;

// Initialize refresh tokens table
export function initRefreshTokensTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)
  `);
}

// Initialize table on module load
try {
  initRefreshTokensTable();
} catch (e) {
  console.error('Failed to initialize refresh_tokens table:', e);
}
