import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Development-only logging for middleware
const isDev = process.env.NODE_ENV === 'development';
const middlewareLog = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login'];

// Routes only for MEMBER role
const MEMBER_ROUTES = ['/me'];

// Routes only for staff (not MEMBER)
const STAFF_ROUTES = ['/dashboard', '/members', '/sessions', '/inventory', '/admin', '/chat', '/staff', '/branches', '/referrals'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  middlewareLog('[Middleware] Path:', pathname);

  // Read auth state from cookie (set by authStore persist)
  // We store a minimal token cookie for SSR-compatible auth check
  const authCookie = request.cookies.get('raho-auth-token')?.value;

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  const isMemberRoute = MEMBER_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
  const isStaffRoute = STAFF_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));

  middlewareLog('[Middleware] isStaffRoute:', isStaffRoute, 'authCookie:', !!authCookie);

  // Not authenticated
  if (!authCookie) {
    if (isPublicRoute) return NextResponse.next();
    // Redirect to login with intended destination
    const loginUrl = new URL('/login', request.url);
    if (!isPublicRoute) {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated — decode role from cookie
  let role: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from(authCookie, 'base64').toString());
    role = payload?.role ?? null;
    middlewareLog('[Middleware] Decoded role:', role);
  } catch {
    // Invalid cookie — clear and redirect
    middlewareLog('[Middleware] Invalid cookie, redirecting to login');
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('raho-auth-token');
    return response;
  }

  // Already logged in → redirect away from login page
  if (isPublicRoute) {
    middlewareLog('[Middleware] Public route, redirecting logged-in user');
    if (role === 'MEMBER') return NextResponse.redirect(new URL('/me/dashboard', request.url));
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // MEMBER trying to access staff routes
  if (role === 'MEMBER' && isStaffRoute) {
    middlewareLog('[Middleware] MEMBER trying to access staff route, redirecting');
    return NextResponse.redirect(new URL('/me/dashboard', request.url));
  }

  // Staff trying to access member-only routes
  if (role !== 'MEMBER' && isMemberRoute) {
    middlewareLog('[Middleware] Staff trying to access member route, redirecting');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  middlewareLog('[Middleware] Allowing access to:', pathname);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api routes
     * - asset folder (public assets like images)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|asset).*)',
  ],
};
