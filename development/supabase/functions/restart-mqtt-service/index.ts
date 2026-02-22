import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface RestartRequest {
  service?: 'mqtt' | 'all'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const { service = 'mqtt' } = await req.json() as RestartRequest

    console.log('🔵 Restart request received:', { service, timestamp: new Date().toISOString() })

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get webhook credentials from environment
    const webhookUrl = Deno.env.get('MQTT_WEBHOOK_URL') || 'http://demo-stage.netneural.ai:9999/restart'
    const restartToken = Deno.env.get('MQTT_RESTART_TOKEN')

    if (!restartToken) {
      console.error('❌ Restart token not configured in environment')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Webhook credentials not configured. Please set MQTT_RESTART_TOKEN secret.',
          message: 'Server configuration required'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔵 Calling restart webhook:', webhookUrl)

    try {
      // Call webhook with timeout (30 seconds)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Restart-Token': restartToken
        },
        body: JSON.stringify({ service }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const responseData = await response.json()

      console.log('✅ Webhook response:', {
        status: response.status,
        data: responseData
      })

      if (response.ok && responseData.success) {
        return new Response(
          JSON.stringify({
            success: true,
            message: `${service === 'all' ? 'All services' : 'MQTT subscriber'} restarted successfully`,
            details: {
              service,
              stdout: responseData.stdout,
              timestamp: responseData.timestamp
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: responseData.error || 'Webhook call failed',
            message: responseData.message || responseData.stderr || 'Unknown error',
            details: { service, status: response.status }
          }),
          { status: response.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('❌ Webhook timeout')
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Webhook request timed out after 30 seconds',
            message: 'Server may be unresponsive'
          }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.error('❌ Webhook call failed:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Webhook call failed',
          message: 'Failed to connect to restart webhook'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Error in restart-mqtt-service:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        message: 'Failed to restart service'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
