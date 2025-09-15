import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// This middleware enforces that API requests under /api have a valid userId in the JWT.
// If token is missing or userId absent (token expired per custom logic), respond 401 early
// so route handlers don't attempt Prisma queries with null userId.
// Static assets and other routes are skipped.

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  // Allow NextAuth internal auth endpoints to pass (sign-in, callbacks) without userId
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }
  try {
    const token = await getToken({ req });
    if (!token || !(token as any).userId) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*']
};
