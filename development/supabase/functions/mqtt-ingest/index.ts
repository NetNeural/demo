// ============================================================================
// MQTT Message Ingestion via PGMQ (Postgres Message Queue)
// ============================================================================
// Accepts MQTT-style messages via HTTP POST
// Enqueues messages to PGMQ for async processing
// Much more reliable than WebSocket or external broker
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface MqttMessage {
  topic: string
  payload: any
  qos?: 0 | 1 | 2
  retain?: boolean
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Client-ID, X-Username',
        },
      })
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          error: 'Method not allowed',
          service: 'MQTT Message Queue Ingestion',
          usage: 'POST messages with topic and payload'
        }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get auth from headers
    const authHeader = req.headers.get('Authorization')
    const clientId = req.headers.get('X-Client-ID')
    const username = req.headers.get('X-Username')

    if (!authHeader || !clientId || !username) {
      return new Response(
        JSON.stringify({ error: 'Missing authentication headers: Authorization, X-Client-ID, X-Username required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Extract password from Bearer token
    const password = authHeader.replace('Bearer ', '')

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify credentials
    const { data: creds, error: credsError } = await supabase
      .from('mqtt_credentials')
      .select('*, device_integrations!inner(organization_id, integration_type, id)')
      .eq('username', username)
      .eq('client_id', clientId)
      .single()

    if (credsError || !creds) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: MqttMessage = await req.json()
    const { topic, payload, qos = 0, retain = false } = body

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Verify topic matches allowed prefix
    if (!topic.startsWith(creds.topic_prefix)) {
      return new Response(
        JSON.stringify({ 
          error: `Topic must start with ${creds.topic_prefix}`,
          allowed_prefix: creds.topic_prefix,
          your_topic: topic
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[MQTT PGMQ] Enqueuing message:', {
      username,
      client_id: clientId,
      topic,
      organization_id: creds.device_integrations.organization_id
    })

    // Enqueue message to PGMQ
    const { error: queueError } = await supabase.rpc('pgmq_send', {
      queue_name: 'mqtt_messages',
      message: {
        organization_id: creds.device_integrations.organization_id,
        integration_id: creds.device_integrations.id,
        topic,
        payload,
        qos,
        retain,
        client_id: clientId,
        username: username,
      }
    })

    if (queueError) {
      console.error('[MQTT PGMQ] Failed to enqueue:', queueError)
      throw queueError
    }

    // Update connection stats
    await supabase
      .from('mqtt_credentials')
      .update({
        last_connected_at: new Date().toISOString(),
        connection_count: creds.connection_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', creds.id)

    // Log activity
    await supabase.from('integration_activity_log').insert({
      integration_id: creds.device_integrations.id,
      organization_id: creds.device_integrations.organization_id,
      activity_type: 'mqtt_message_queued',
      direction: 'incoming',
      status: 'success',
      message: `Message queued on topic: ${topic}`,
      metadata: { 
        topic, 
        payload_size: JSON.stringify(payload).length,
        qos,
        retain,
        client_id: clientId,
        username,
        queue: 'mqtt_messages'
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message enqueued for processing',
        topic,
        qos,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 202, // Accepted (async processing)
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    )

  } catch (error) {
    console.error('[MQTT PGMQ] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    )
  }
})
