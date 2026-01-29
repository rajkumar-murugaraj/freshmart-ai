import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, revokeRefreshToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  // Get refresh token to revoke it
  const refreshToken = request.cookies.get('refresh_token')?.value;

  // Revoke refresh token from database if exists
  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch (e) {
      console.error('Failed to revoke refresh token:', e);
    }
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  return clearAuthCookies(response);
}
