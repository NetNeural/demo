// ============================================================================
// MQTT BROKER INTEGRATION EDGE FUNCTION
// ============================================================================
// Handles pub/sub messaging with MQTT brokers
// Supports device messaging, telemetry ingestion, and command dispatch
//
// Version: 1.0.0
// Date: 2025-10-27
// ============================================================================

import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

interface MqttConfig {
  broker_url: string
  port: number
  protocol: 'mqtt' | 'mqtts' | 'ws' | 'wss'
  username?: string
  password?: string
  client_id?: string
  use_tls?: boolean
  ca_certificate?: string
}

interface MqttMessage {
  topic: string
  payload: string | object
  qos?: 0 | 1 | 2
  retain?: boolean
}

interface PublishOperation {
  organization_id: string
  integration_id: string
  operation: 'publish' | 'subscribe' | 'test'
  messages?: MqttMessage[]
  topics?: string[]
  callback_url?: string
}

interface MqttClient {
  connect: () => Promise<void>
  publish: (topic: string, message: string, options: { qos: number; retain: boolean }) => Promise<void>
  subscribe: (topics: string[], callback: (topic: string, message: string) => void) => Promise<void>
  disconnect: () => Promise<void>
}

// Simple MQTT client implementation using fetch for HTTP-based MQTT bridges
async function createMqttClient(config: MqttConfig): Promise<MqttClient> {
  const { broker_url, port, protocol, username, password, client_id } = config
  
  // Construct the connection URL
  const auth = username && password ? `${username}:${password}@` : ''
  const baseUrl = `${protocol}://${auth}${broker_url}:${port}`
  
  return {
    async connect() {
      // For HTTP-based MQTT, connection is established per-request
      // This is a placeholder - real implementation would use WebSocket or native MQTT
      console.log(`Connecting to MQTT broker: ${baseUrl}`)
    },
    
    async publish(topic: string, message: string, options: { qos: number; retain: boolean }) {
      // Publish message via HTTP bridge
      // Note: This is simplified - production would use proper MQTT client library
      const response = await fetch(`${baseUrl}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(username && password ? {
            'Authorization': `Basic ${btoa(`${username}:${password}`)}`
          } : {}),
        },
        body: JSON.stringify({
          client_id: client_id || `netneural-${Date.now()}`,
          topic,
          payload: message,
          qos: options.qos,
          retain: options.retain,
        }),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`MQTT publish failed (${response.status}): ${errorText}`)
      }
    },
    
    async subscribe(topics: string[], callback: (topic: string, message: string) => void) {
      // Subscribe to topics via HTTP bridge
      // Note: This is simplified - production would use WebSocket for real-time subscriptions
      const response = await fetch(`${baseUrl}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(username && password ? {
            'Authorization': `Basic ${btoa(`${username}:${password}`)}`
          } : {}),
        },
        body: JSON.stringify({
          client_id: client_id || `netneural-${Date.now()}`,
          topics,
        }),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`MQTT subscribe failed (${response.status}): ${errorText}`)
      }
      
      // In a real implementation, this would establish a persistent connection
      // and invoke the callback for each received message
      console.log(`Subscribed to topics: ${topics.join(', ')}`)
    },
    
    async disconnect() {
      // Disconnect from MQTT broker
      console.log('Disconnecting from MQTT broker')
    },
  }
}

async function publishMessages(
  config: MqttConfig,
  messages: MqttMessage[],
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  integrationId: string
) {
  const results = {
    messages_processed: 0,
    messages_succeeded: 0,
    messages_failed: 0,
    errors: [] as string[],
  }
  
  const client = await createMqttClient(config)
  
  try {
    await client.connect()
    
    for (const msg of messages) {
      results.messages_processed++
      
      try {
        const payload = typeof msg.payload === 'object' 
          ? JSON.stringify(msg.payload) 
          : msg.payload
        
        await client.publish(msg.topic, payload, {
          qos: msg.qos || 0,
          retain: msg.retain || false,
        })
        
        results.messages_succeeded++
        
        // Log to activity log
        await supabase.from('integration_activity_log').insert({
          organization_id: organizationId,
          integration_id: integrationId,
          type: 'mqtt_publish',
          direction: 'outgoing',
          status: 'completed',
          message: `Published message to ${msg.topic}`,
          metadata: {
            topic: msg.topic,
            qos: msg.qos || 0,
            retain: msg.retain || false,
            payload_length: payload.length,
          },
        })
        
        // Log message to notification_log
        await supabase.from('notification_log').insert({
          organization_id: organizationId,
          integration_id: integrationId,
          message: `Published to ${msg.topic}`,
          priority: 'normal',
          status: 'sent',
          metadata: {
            topic: msg.topic,
            qos: msg.qos || 0,
            retain: msg.retain || false,
            payload_length: payload.length,
          },
        })
      } catch (error) {
        results.messages_failed++
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(`${msg.topic}: ${errorMsg}`)
        
        // Log to activity log
        await supabase.from('integration_activity_log').insert({
          organization_id: organizationId,
          integration_id: integrationId,
          type: 'mqtt_publish',
          direction: 'outgoing',
          status: 'failed',
          message: `Failed to publish to ${msg.topic}`,
          metadata: {
            topic: msg.topic,
            error: errorMsg,
          },
        })
        
        // Log error
        await supabase.from('notification_log').insert({
          organization_id: organizationId,
          integration_id: integrationId,
          message: `Failed to publish to ${msg.topic}`,
          priority: 'normal',
          status: 'failed',
          metadata: {
            topic: msg.topic,
            error: errorMsg,
          },
        })
      }
    }
  } finally {
    await client.disconnect()
  }
  
  return results
}

async function subscribeToTopics(
  config: MqttConfig,
  topics: string[],
  callbackUrl: string | undefined,
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  integrationId: string
) {
  const results = {
    topics_processed: topics.length,
    topics_succeeded: 0,
    topics_failed: 0,
    errors: [] as string[],
  }
  
  const client = await createMqttClient(config)
  
  try {
    await client.connect()
    
    await client.subscribe(topics, async (topic: string, message: string) => {
      // Handle incoming message
      console.log(`Received message on ${topic}:`, message)
      
      try {
        // Parse message
        let parsedMessage
        try {
          parsedMessage = JSON.parse(message)
        } catch {
          parsedMessage = { raw: message }
        }
        
        // Store message in database
        await supabase.from('mqtt_messages').insert({
          organization_id: organizationId,
          integration_id: integrationId,
          topic,
          payload: parsedMessage,
          received_at: new Date().toISOString(),
        })
        
        // If callback URL provided, forward message
        if (callbackUrl) {
          await fetch(callbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic,
              message: parsedMessage,
              timestamp: new Date().toISOString(),
            }),
          })
        }
        
        // Log receipt to activity log
        await supabase.from('integration_activity_log').insert({
          organization_id: organizationId,
          integration_id: integrationId,
          type: 'mqtt_message',
          direction: 'incoming',
          status: 'completed',
          message: `Received message on ${topic}`,
          metadata: {
            topic,
            payload_length: message.length,
            payload_preview: message.substring(0, 100),
          },
        })
        
        // Log receipt
        await supabase.from('notification_log').insert({
          organization_id: organizationId,
          integration_id: integrationId,
          message: `Received message on ${topic}`,
          priority: 'low',
          status: 'sent',
          metadata: {
            topic,
            payload_length: message.length,
          },
        })
      } catch (error) {
        console.error('Error handling MQTT message:', error)
      }
    })
    
    results.topics_succeeded = topics.length
    
    // Log to activity log
    await supabase.from('integration_activity_log').insert({
      organization_id: organizationId,
      integration_id: integrationId,
      activity_type: 'mqtt_subscription_created',
      direction: 'incoming',
      status: 'success',
      message: `Subscribed to ${topics.length} topic(s)`,
      metadata: {
        topics,
        topics_count: topics.length,
      },
    })
    
    // Log subscription
    await supabase.from('notification_log').insert({
      organization_id: organizationId,
      integration_id: integrationId,
      message: `Subscribed to ${topics.length} topic(s)`,
      priority: 'normal',
      status: 'sent',
      metadata: {
        topics,
        callback_url: callbackUrl,
      },
    })
  } catch (error) {
    results.topics_failed = topics.length
    results.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }
  
  return results
}

async function testConnection(
  config: MqttConfig,
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  integrationId: string
) {
  const client = await createMqttClient(config)
  
  try {
    await client.connect()
    
    // Publish test message
    const testTopic = `netneural/test/${Date.now()}`
    await client.publish(testTopic, JSON.stringify({
      test: true,
      timestamp: new Date().toISOString(),
      message: 'NetNeural MQTT integration test',
    }), { qos: 0, retain: false })
    
    await client.disconnect()
    
    // Log test
    await supabase.from('notification_log').insert({
      organization_id: organizationId,
      integration_id: integrationId,
      message: 'MQTT connection test successful',
      priority: 'low',
      status: 'sent',
      metadata: {
        test_topic: testTopic,
      },
    })
    
    return {
      success: true,
      message: 'MQTT connection test successful',
      test_topic: testTopic,
    }
  } catch (error) {
    // Log error
    await supabase.from('notification_log').insert({
      organization_id: organizationId,
      integration_id: integrationId,
      message: 'MQTT connection test failed',
      priority: 'normal',
      status: 'failed',
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    
    throw error
  }
}

export default createEdgeFunction(async ({ req }) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new DatabaseError('Missing authorization header', 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new DatabaseError('Unauthorized', 401)
  }

  const payload: PublishOperation = await req.json()
  const { organization_id, integration_id, operation, messages, topics, callback_url } = payload

  if (!organization_id || !integration_id || !operation) {
    throw new Error('Missing required fields')
  }

  // Get MQTT integration config
  const { data: integration, error: intError } = await supabase
    .from('device_integrations')
    .select('*')
    .eq('id', integration_id)
    .eq('integration_type', 'mqtt')
    .single()

  if (intError || !integration) {
    throw new DatabaseError('MQTT integration not found', 404)
  }

  const mqttConfig: MqttConfig = JSON.parse(integration.api_key_encrypted || '{}')

  let results
  const startTime = Date.now()

  switch (operation) {
    case 'publish':
      if (!messages || messages.length === 0) {
        throw new Error('No messages provided')
      }
      results = await publishMessages(mqttConfig, messages, supabase, organization_id, integration_id)
      break
    
    case 'subscribe':
      if (!topics || topics.length === 0) {
        throw new Error('No topics provided')
      }
      results = await subscribeToTopics(mqttConfig, topics, callback_url, supabase, organization_id, integration_id)
      break
    
    case 'test':
      results = await testConnection(mqttConfig, supabase, organization_id, integration_id)
      break
    
    default:
      throw new Error('Invalid operation')
  }

  const duration = Date.now() - startTime

  return createSuccessResponse({ success: true, results, duration_ms: duration })
}, {
  allowedMethods: ['POST']
})
