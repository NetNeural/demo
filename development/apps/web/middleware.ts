import { createClient } from './src/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  try {
    // This `try/catch` block is only here for the interactive tutorial.
    // Feel free to remove once you have Supabase connected.
    const { supabase, response } = createClient(request)

    // Refresh session if expired - required for Server Components
    await supabase.auth.getSession()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // If user is signed in and the current path is / redirect the user to /dashboard
    if (user && request.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // If user is not signed in and the current path is not / redirect the user to /
    if (!user && request.nextUrl.pathname !== '/') {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return response
  } catch (e) {
    // If you are here, a Supabase client could not be created!
    // This is likely because you have not set up environment variables.
    // Check out http://localhost:3000 for Next Steps.
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
