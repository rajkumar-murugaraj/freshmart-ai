import { NextRequest, NextResponse } from 'next/server';
import { refreshTokens, setAuthCookies, clearAuthCookies } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie or body
    let refreshToken = request.cookies.get('refresh_token')?.value;

    // If not in cookie, try request body
    if (!refreshToken) {
      try {
        const body = await request.json();
        refreshToken = body.refreshToken;
      } catch {
        // No body provided
      }
    }

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token not provided', code: 'NO_REFRESH_TOKEN' },
        { status: 401 }
      );
    }

    // Attempt to refresh tokens
    const tokens = await refreshTokens(refreshToken);

    if (!tokens) {
      // Clear cookies on invalid refresh token
      const res = NextResponse.json(
        { error: 'Invalid or expired refresh token', code: 'INVALID_REFRESH_TOKEN' },
        { status: 401 }
      );
      return clearAuthCookies(res);
    }

    // Return new tokens
    const res = NextResponse.json({
      success: true,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      refreshExpiresIn: tokens.refreshExpiresIn
    });

    // Set new cookies
    return setAuthCookies(res, tokens);
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for checking token status
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('auth_token')?.value;
    const refreshToken = request.cookies.get('refresh_token')?.value;

    return NextResponse.json({
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
