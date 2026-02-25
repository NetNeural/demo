// ============================================================================
// MQTT INTEGRATION EDGE FUNCTION - HYBRID BROKER SUPPORT
// ============================================================================
// Supports both hosted WebSocket broker and external customer brokers
// Version: 2.0.0
//
// Environment Variables:
// - MQTT_BROKER_URL: WebSocket URL for hosted broker (default: public test broker)
//   Production: wss://mqtt.yourcompany.com:8084/mqtt
//   Development: wss://broker.emqx.io:8084/mqtt (public test broker)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import mqtt from 'npm:mqtt@5.3.4'

// Get MQTT broker URL from environment
// For hosted mode: Returns HTTP ingestion endpoint (no broker needed)
// For external mode: Customer provides their own MQTT broker URL
const MQTT_BROKER_URL =
  Deno.env.get('SUPABASE_URL') + '/functions/v1/mqtt-ingest'

console.log(`[MQTT Hybrid] Hosted endpoint: ${MQTT_BROKER_URL}`)

interface MqttIntegration {
  id: string
  organization_id: string
  integration_type: 'mqtt_hosted' | 'mqtt_external' | 'mqtt'
  settings: {
    // For hosted broker
    use_hosted?: boolean

    // For external broker
    broker_url?: string
    port?: number
    protocol?: 'mqtt' | 'mqtts' | 'ws' | 'wss'
    username?: string
    password?: string
    use_tls?: boolean
  }
}

interface MqttMessage {
  topic: string
  payload: string | object
  qos?: 0 | 1 | 2
  retain?: boolean
}

interface PublishRequest {
  integration_id: string
  organization_id: string
  messages: MqttMessage[]
}

interface SubscribeRequest {
  integration_id: string
  organization_id: string
  topics: string[]
  callback_url?: string
}

// Connect to MQTT broker (hosted or external)
async function connectMqttClient(
  integration: MqttIntegration,
  credentials?: {
    username: string
    password: string
    client_id: string
    broker_url: string
  }
): Promise<any> {
  if (integration.integration_type === 'mqtt_hosted' && credentials) {
    // Connect to hosted WebSocket broker
    const client = mqtt.connect(credentials.broker_url, {
      clientId: credentials.client_id,
      username: credentials.username,
      password: credentials.password,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30000,
    })

    return new Promise((resolve, reject) => {
      client.on('connect', () => {
        console.log('Connected to hosted MQTT broker')
        resolve(client)
      })

      client.on('error', (err) => {
        console.error('MQTT connection error:', err)
        reject(err)
      })

      setTimeout(() => reject(new Error('Connection timeout')), 31000)
    })
  } else {
    // Connect to external broker
    const settings = integration.settings
    const protocol = settings.protocol || 'mqtt'
    const port = settings.port || (protocol === 'mqtts' ? 8883 : 1883)
    const url = `${protocol}://${settings.broker_url}:${port}`

    const client = mqtt.connect(url, {
      clientId: `netneural_${Date.now()}`,
      username: settings.username,
      password: settings.password,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30000,
      ...(settings.use_tls && {
        rejectUnauthorized: true,
      }),
    })

    return new Promise((resolve, reject) => {
      client.on('connect', () => {
        console.log('Connected to external MQTT broker')
        resolve(client)
      })

      client.on('error', (err) => {
        console.error('MQTT connection error:', err)
        reject(err)
      })

      setTimeout(() => reject(new Error('Connection timeout')), 31000)
    })
  }
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { pathname } = new URL(req.url)

    // Handle different operations
    if (pathname.endsWith('/publish')) {
      return await handlePublish(req, supabase)
    } else if (pathname.endsWith('/subscribe')) {
      return await handleSubscribe(req, supabase)
    } else if (pathname.endsWith('/test')) {
      return await handleTest(req, supabase)
    } else if (pathname.endsWith('/credentials')) {
      return await handleCredentials(req, supabase)
    } else {
      return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error('MQTT function error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        type: error.name,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function handlePublish(req: Request, supabase: any) {
  const body: PublishRequest = await req.json()
  const { integration_id, organization_id, messages } = body

  // Get integration details
  const { data: integration, error: intError } = await supabase
    .from('device_integrations')
    .select('*')
    .eq('id', integration_id)
    .eq('organization_id', organization_id)
    .single()

  if (intError || !integration) {
    throw new Error('Integration not found')
  }

  let credentials = null

  // Get credentials if using hosted broker
  if (integration.integration_type === 'mqtt_hosted') {
    const { data: creds } = await supabase
      .from('mqtt_credentials')
      .select('username, client_id, broker_url')
      .eq('integration_id', integration_id)
      .single()

    if (!creds) {
      throw new Error(
        'Hosted broker credentials not found. Please generate credentials first.'
      )
    }

    // Get password from integration settings (stored during credential generation)
    const settings = integration.settings || {}
    const password = settings.password || ''

    if (!password) {
      throw new Error(
        'Hosted broker password not found in settings. Please regenerate credentials.'
      )
    }

    credentials = { ...creds, password }
  }

  // Connect to broker
  const client = await connectMqttClient(integration, credentials)

  const results = {
    published: 0,
    failed: 0,
    errors: [] as string[],
  }

  try {
    for (const msg of messages) {
      try {
        const payload =
          typeof msg.payload === 'object'
            ? JSON.stringify(msg.payload)
            : msg.payload

        await new Promise((resolve, reject) => {
          client.publish(
            msg.topic,
            payload,
            { qos: msg.qos || 0, retain: msg.retain || false },
            (err: any) => {
              if (err) reject(err)
              else resolve(true)
            }
          )
        })

        results.published++

        // Log activity
        await supabase.from('integration_activity_log').insert({
          integration_id,
          organization_id,
          activity_type: 'mqtt_publish_success',
          direction: 'outgoing',
          status: 'success',
          message: `Published to ${msg.topic}`,
          metadata: {
            topic: msg.topic,
            integration_type: integration.integration_type,
          },
        })
      } catch (err) {
        results.failed++
        results.errors.push(`${msg.topic}: ${err.message}`)

        await supabase.from('integration_activity_log').insert({
          integration_id,
          organization_id,
          activity_type: 'mqtt_publish_failed',
          direction: 'outgoing',
          status: 'failed',
          message: `Failed to publish to ${msg.topic}`,
          metadata: { topic: msg.topic, error: err.message },
        })
      }
    }
  } finally {
    client.end()
  }

  return new Response(
    JSON.stringify({
      success: results.failed === 0,
      data: {
        results,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

async function handleSubscribe(req: Request, supabase: any) {
  // Subscribe implementation - stores topics to monitor
  const body: SubscribeRequest = await req.json()
  const { integration_id, organization_id, topics, callback_url } = body

  // Store subscription in database
  const { error } = await supabase.from('mqtt_subscriptions').upsert({
    integration_id,
    organization_id,
    topics,
    callback_url,
    active: true,
  })

  if (error) throw error

  // Log activity
  await supabase.from('integration_activity_log').insert({
    integration_id,
    organization_id,
    activity_type: 'mqtt_subscription_created',
    direction: 'incoming',
    status: 'success',
    message: `Subscribed to ${topics.length} topic(s)`,
    metadata: { topics, callback_url, topics_count: topics.length },
  })

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        message: `Subscribed to ${topics.length} topic(s)`,
        topics,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

async function handleTest(req: Request, supabase: any) {
  const body = await req.json()
  const { integration_id, organization_id } = body

  // Get integration
  const { data: integration } = await supabase
    .from('device_integrations')
    .select('*')
    .eq('id', integration_id)
    .single()

  if (!integration) {
    throw new Error('Integration not found')
  }

  let credentials = null
  if (integration.integration_type === 'mqtt_hosted') {
    const { data: creds } = await supabase
      .from('mqtt_credentials')
      .select('*')
      .eq('integration_id', integration_id)
      .single()
    credentials = creds
  }

  // Test connection
  const client = await connectMqttClient(integration, credentials)

  // Test publish
  await new Promise((resolve, reject) => {
    client.publish(
      'test/connection',
      JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
      { qos: 0, retain: false },
      (err: any) => {
        if (err) reject(err)
        else resolve(true)
      }
    )
  })

  client.end()

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        message: 'Connection test successful',
        integration_type: integration.integration_type,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

async function handleCredentials(req: Request, supabase: any) {
  const body = await req.json()
  const { integration_id, organization_id, action } = body

  if (action === 'get') {
    // Get existing credentials (without password)
    const { data, error } = await supabase
      .from('mqtt_credentials')
      .select('username, client_id, broker_url, topic_prefix')
      .eq('integration_id', integration_id)
      .eq('organization_id', organization_id)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          credentials: data || null,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } else if (action === 'generate') {
    // Generate new credentials with environment-configured broker URL
    const { data, error } = await supabase.rpc('generate_mqtt_credentials', {
      p_organization_id: organization_id,
      p_integration_id: integration_id,
    })

    if (error) throw error

    // Override broker_url with environment variable
    const credentials = data[0]
    credentials.broker_url = MQTT_BROKER_URL

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          credentials,
          warning:
            'Save these credentials securely. Password cannot be retrieved again.',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } else if (action === 'revoke') {
    // Revoke credentials
    const { error } = await supabase
      .from('mqtt_credentials')
      .delete()
      .eq('integration_id', integration_id)
      .eq('organization_id', organization_id)

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message: 'Credentials revoked',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  throw new Error('Invalid action')
}
