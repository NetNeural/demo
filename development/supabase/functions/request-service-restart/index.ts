import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { service = 'mqtt-subscriber' } = await req.json()

    console.log('🔵 Database-based restart request:', {
      service,
      timestamp: new Date().toISOString(),
    })

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Call the database function to create restart request
    const { data, error } = await supabase.rpc('request_service_restart', {
      p_service_name: service,
    })

    if (error) {
      console.error('❌ Failed to create restart request:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          message: 'Failed to create restart request',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('✅ Restart request created:', data)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Restart request created for ${service}. The service will restart within 30 seconds.`,
        details: {
          request_id: data,
          service,
          method: 'database-poll',
          estimated_time: '30-60 seconds',
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Error in request-service-restart:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        message: 'Failed to process restart request',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
