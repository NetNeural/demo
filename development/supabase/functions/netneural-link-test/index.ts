// ===========================================================================
// NetNeural-Link Edge Functions - Simple Telemetry Test
// ===========================================================================
// Simple test endpoint for NetNeural device telemetry without authentication
// ===========================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { makeCorsHeaders } from '../_shared/cors.ts'

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = makeCorsHeaders(req)
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Only POST method allowed for telemetry ingestion',
      }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    const url = new URL(req.url)
    console.log(
      `[NetNeural-Link Test] Received request: ${req.method} ${url.pathname}`
    )

    // Extract device ID from various sources
    let deviceId = url.searchParams.get('device_id')
    if (!deviceId) {
      deviceId = req.headers.get('x-device-id')
    }
    if (!deviceId) {
      const pathMatch = url.pathname.match(/\/devices\/([^\/]+)/)
      deviceId = pathMatch?.[1] || null
    }

    // Parse request body
    let body: any = {}
    const contentType = req.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      body = await req.json()
    }

    // Extract device ID from body if not found elsewhere
    if (!deviceId && body.device_id) {
      deviceId = body.device_id
    }

    console.log(`[NetNeural-Link Test] Device ID: ${deviceId}`)
    console.log(`[NetNeural-Link Test] Body:`, body)

    if (!deviceId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Device ID not found in request (URL param, header, or path)',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // For testing, just return success without database operations
    const response = {
      success: true,
      message: 'NetNeural-Link telemetry test received',
      data: {
        device_id: deviceId,
        protocol: 'https',
        telemetry: body,
        timestamp: new Date().toISOString(),
      },
    }

    console.log(`[NetNeural-Link Test] ✅ Success for device ${deviceId}`)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[NetNeural-Link Test] Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
