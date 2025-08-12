import { NextRequest, NextResponse } from 'next/server'

// This route is disabled for static export
export const dynamic = 'force-static'
export const revalidate = false

export async function GET(request: NextRequest) {
  // For static deployment, redirect to home
  return NextResponse.redirect(new URL('/', request.url))
}
