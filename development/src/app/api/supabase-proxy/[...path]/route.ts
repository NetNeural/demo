import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = 'http://127.0.0.1:54321'

// Route segment config - disable for static export
export const dynamic = 'force-dynamic'
export const dynamicParams = true

/**
 * Proxy for Supabase API requests in Codespaces
 * Solves CORS issues when browser tries to reach forwarded port 54321
 * Server-side requests to localhost don't have CORS restrictions
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context, 'GET')
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context, 'POST')
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context, 'PUT')
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context, 'PATCH')
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context, 'DELETE')
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  // Handle CORS preflight
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        request.headers.get('access-control-request-headers') || '*',
      'Access-Control-Max-Age': '86400',
    },
  })
}

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  method: string
) {
  try {
    const params = await context.params
    const path = params.path.join('/')
    const url = new URL(request.url)
    const targetUrl = `${SUPABASE_URL}/${path}${url.search}`

    // Forward headers (filter out host-specific ones)
    const headers = new Headers()
    request.headers.forEach((value, key) => {
      if (
        !['host', 'connection', 'origin', 'referer'].includes(key.toLowerCase())
      ) {
        headers.set(key, value)
      }
    })

    // Get request body if present
    const body =
      method !== 'GET' && method !== 'HEAD' ? await request.text() : undefined

    // Make request to local Supabase
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
    })

    // Get response as text/buffer to avoid encoding issues
    const data = await response.arrayBuffer()

    // Forward response with CORS headers
    const responseHeaders = new Headers(response.headers)
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    )
    responseHeaders.set('Access-Control-Allow-Headers', '*')
    // Remove encoding headers to prevent double-encoding
    responseHeaders.delete('content-encoding')
    responseHeaders.delete('transfer-encoding')

    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Supabase proxy error:', error)
    return NextResponse.json(
      {
        error: 'Proxy request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
