import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'freshmart-secret-key-change-in-production'
);

interface RouteRule {
  pattern: RegExp;
  methods?: string[]; // If undefined, applies to all methods
  roles?: string[];   // If undefined, any authenticated user. If empty array, public.
}

// Routes that require NO authentication
const publicRoutes: RouteRule[] = [
  { pattern: /^\/api\/auth\//, roles: [] },
  { pattern: /^\/api\/products$/, methods: ['GET'], roles: [] },
  { pattern: /^\/api\/products\/[^/]+$/, methods: ['GET'], roles: [] },
  { pattern: /^\/api\/ai\//, roles: [] },
  { pattern: /^\/api\/reviews$/, methods: ['GET'], roles: [] },
];

// Routes that require specific roles
const protectedRoutes: RouteRule[] = [
  // Admin-only routes
  { pattern: /^\/api\/products$/, methods: ['POST'], roles: ['admin'] },
  { pattern: /^\/api\/products\/variant-group/, methods: ['PUT', 'DELETE'], roles: ['admin'] },
  { pattern: /^\/api\/products\/[^/]+$/, methods: ['PUT', 'DELETE'], roles: ['admin'] },
  { pattern: /^\/api\/orders\/[^/]+\/status/, methods: ['PUT'], roles: ['admin'] },
  { pattern: /^\/api\/dashboard/, roles: ['admin'] },
  { pattern: /^\/api\/upload/, roles: ['admin'] },

  // Admin + Sales
  { pattern: /^\/api\/stock/, roles: ['admin', 'sales'] },
  { pattern: /^\/api\/sales/, roles: ['admin', 'sales'] },

  // Any authenticated user
  { pattern: /^\/api\/orders/ },
  { pattern: /^\/api\/notifications/ },
  { pattern: /^\/api\/users/ },
  { pattern: /^\/api\/payment/ },
  { pattern: /^\/api\/reviews/, methods: ['POST', 'DELETE'] },
  { pattern: /^\/api\/wishlist/ },
];

function findMatchingRule(pathname: string, method: string, rules: RouteRule[]): RouteRule | null {
  for (const rule of rules) {
    if (rule.pattern.test(pathname)) {
      if (!rule.methods || rule.methods.includes(method)) {
        return rule;
      }
    }
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Check if it's a public route first
  const publicRule = findMatchingRule(pathname, method, publicRoutes);
  if (publicRule) {
    return NextResponse.next();
  }

  // Check if it matches a protected route
  const protectedRule = findMatchingRule(pathname, method, protectedRoutes);

  // If no rule matches, allow through (non-API or unmatched routes)
  if (!protectedRule) {
    return NextResponse.next();
  }

  // Verify auth token
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized - Please login', code: 'TOKEN_EXPIRED' },
      { status: 401 }
    );
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userRole = payload.role as string;
    const userId = payload.userId as string;
    const userEmail = payload.email as string;

    // Check role if required
    if (protectedRule.roles && protectedRule.roles.length > 0) {
      if (!protectedRule.roles.includes(userRole)) {
        return NextResponse.json(
          { error: 'Forbidden - Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Inject user info into request headers for downstream route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', userId);
    requestHeaders.set('x-user-role', userRole);
    requestHeaders.set('x-user-email', userEmail);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid or expired token', code: 'TOKEN_EXPIRED' },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};
