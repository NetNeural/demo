import { NextResponse } from 'next/server'

export async function middleware() {
  // For static export, we handle auth client-side only
  // Middleware should just pass through all requests
  // Authentication will be handled by the client-side components
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}