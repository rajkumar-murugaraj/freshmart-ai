import { RateLimiterMemory } from 'rate-limiter-flexible';
import { NextRequest, NextResponse } from 'next/server';

// Different rate limiters for different endpoints
const rateLimiters = {
  // General API: 100 requests per minute
  general: new RateLimiterMemory({
    points: 100,
    duration: 60,
  }),
  // Auth endpoints: 10 requests per minute (prevent brute force)
  auth: new RateLimiterMemory({
    points: 10,
    duration: 60,
  }),
  // AI endpoints: 20 requests per minute (expensive operations)
  ai: new RateLimiterMemory({
    points: 20,
    duration: 60,
  }),
  // Write operations: 30 requests per minute
  write: new RateLimiterMemory({
    points: 30,
    duration: 60,
  }),
};

type RateLimitType = keyof typeof rateLimiters;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  return 'anonymous';
}

export async function rateLimit(
  request: NextRequest,
  type: RateLimitType = 'general'
): Promise<{ success: boolean; response?: NextResponse }> {
  const ip = getClientIp(request);
  const limiter = rateLimiters[type];

  try {
    await limiter.consume(ip);
    return { success: true };
  } catch (rejRes: any) {
    const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000) || 60;

    const response = NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limiter.points),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Date.now() + rejRes.msBeforeNext),
        }
      }
    );

    return { success: false, response };
  }
}

// Middleware wrapper for rate limiting
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  type: RateLimitType = 'general'
) {
  return async (request: NextRequest) => {
    const { success, response } = await rateLimit(request, type);

    if (!success && response) {
      return response;
    }

    return handler(request);
  };
}
