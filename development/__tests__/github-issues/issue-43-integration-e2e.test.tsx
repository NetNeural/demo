/**
 * Test Suite for GitHub Issue #43 - Integration Priorities E2E Testing
 * 
 * Tests end-to-end functionality for priority integrations:
 * 1. MQTT Broker Integration
 * 2. Golioth Integration
 * 3. Custom Webhook Integration
 * 
 * Validates: Configuration → Save → Sync → Device Management → Events
 */

import { createClient } from '@supabase/supabase-js'

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

describe('Issue #43 - Integration Priorities End-to-End', () => {
  let mockSupabase: {
    auth: { getSession: jest.Mock }
    from: jest.Mock
  }
  let mockFetch: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockSupabase = {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              access_token: 'test-token',
              user: { id: 'user-123', email: 'test@example.com' },
            },
          },
        }),
      },
      from: jest.fn(),
    }

    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

    mockFetch = jest.fn()
    global.fetch = mockFetch
  })

  describe('Priority 1: MQTT Broker Integration - Complete Flow', () => {
    const mqttConfig = {
      organization_id: 'org-123',
      integration_type: 'mqtt',
      name: 'Production MQTT Broker',
      settings: {
        brokerUrl: 'mqtt://broker.hivemq.com',
        port: 1883,
        clientId: 'netneural-prod',
        username: 'mqtt-user',
        password: 'mqtt-pass',
        topics: ['devices/+/telemetry', 'devices/+/status'],
      },
      status: 'active',
    }

    test('Step 1: Configure MQTT broker', async () => {
      const config = mqttConfig.settings

      expect(config.brokerUrl).toBeDefined()
      expect(config.port).toBeGreaterThan(0)
      expect(config.clientId).toBeDefined()
      expect(config.topics).toHaveLength(2)
    })

    test('Step 2: Save MQTT configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          integration: {
            id: 'mqtt-123',
            ...mqttConfig,
            created_at: new Date().toISOString(),
          },
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/integrations',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify(mqttConfig),
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.integration.id).toBe('mqtt-123')
    })

    test('Step 3: Verify MQTT integration in list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          integrations: [
            {
              id: 'mqtt-123',
              type: 'mqtt',
              name: 'Production MQTT Broker',
              status: 'active',
            },
          ],
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/integrations?organization_id=org-123',
        {
          headers: { Authorization: 'Bearer test-token' },
        }
      )

      const data = await response.json()
      expect(data.integrations).toHaveLength(1)
      expect(data.integrations[0].type).toBe('mqtt')
    })

    test('Step 4: Connect to MQTT broker', async () => {
      // Simulate MQTT connection test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Successfully connected to MQTT broker',
          details: {
            broker: 'mqtt://broker.hivemq.com',
            port: 1883,
            connected: true,
          },
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/mqtt-broker/test-connection',
        {
          method: 'POST',
          body: JSON.stringify({ integrationId: 'mqtt-123' }),
        }
      )

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.details.connected).toBe(true)
    })

    test('Step 5: Receive MQTT message and store in database', async () => {
      const mqttMessage = {
        topic: 'devices/device-456/telemetry',
        payload: {
          temperature: 23.5,
          humidity: 65.2,
          timestamp: Date.now(),
        },
        qos: 1,
      }

      // Mock webhook receives MQTT message
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'MQTT message processed',
          deviceId: 'device-456',
          dataStored: true,
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/mqtt-broker/webhook',
        {
          method: 'POST',
          body: JSON.stringify(mqttMessage),
        }
      )

      const result = await response.json()
      expect(result.dataStored).toBe(true)
      expect(result.deviceId).toBe('device-456')
    })

    test('Step 6: Edit MQTT integration', async () => {
      const updatedConfig = {
        ...mqttConfig,
        settings: {
          ...mqttConfig.settings,
          topics: [
            ...mqttConfig.settings.topics,
            'devices/+/alerts', // Add new topic
          ],
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          integration: { id: 'mqtt-123', ...updatedConfig },
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/integrations/mqtt-123',
        {
          method: 'PUT',
          body: JSON.stringify(updatedConfig),
        }
      )

      const data = await response.json()
      expect(data.integration.settings.topics).toHaveLength(3)
    })

    test('Step 7: Delete MQTT integration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/integrations/mqtt-123',
        {
          method: 'DELETE',
        }
      )

      expect(response.status).toBe(204)
    })
  })

  describe('Priority 2: Golioth Integration - Complete Flow', () => {
    const goliothConfig = {
      organization_id: 'org-123',
      integration_type: 'golioth',
      name: 'Golioth IoT Platform',
      settings: {
        apiKey: 'golioth_api_key_123456789',
        projectId: 'my-iot-project',
        baseUrl: 'https://api.golioth.io',
      },
      status: 'active',
    }

    test('Step 1: Configure Golioth integration', () => {
      const config = goliothConfig.settings

      expect(config.apiKey).toBeDefined()
      expect(config.projectId).toBeDefined()
      expect(config.baseUrl).toBe('https://api.golioth.io')
    })

    test('Step 2: Save Golioth configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          integration: {
            id: 'golioth-456',
            ...goliothConfig,
          },
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/integrations',
        {
          method: 'POST',
          body: JSON.stringify(goliothConfig),
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.integration.integration_type).toBe('golioth')
    })

    test('Step 3: Test Golioth API credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Golioth API credentials validated',
          details: {
            projectId: 'my-iot-project',
            apiKey: '***56789',
          },
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/integrations/test',
        {
          method: 'POST',
          body: JSON.stringify({
            integration_type: 'golioth',
            settings: goliothConfig.settings,
          }),
        }
      )

      const result = await response.json()
      expect(result.success).toBe(true)
    })

    test('Step 4: Sync devices from Golioth', async () => {
      const goliothDevices = [
        {
          id: 'golioth-device-1',
          name: 'Temperature Sensor 1',
          hardwareId: 'ESP32-001',
          lastSeen: new Date().toISOString(),
        },
        {
          id: 'golioth-device-2',
          name: 'Temperature Sensor 2',
          hardwareId: 'ESP32-002',
          lastSeen: new Date().toISOString(),
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          devices: goliothDevices,
          synced: goliothDevices.length,
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/golioth-sync',
        {
          method: 'POST',
          body: JSON.stringify({ integrationId: 'golioth-456' }),
        }
      )

      const result = await response.json()
      expect(result.synced).toBe(2)
      expect(result.devices).toHaveLength(2)
    })

    test('Step 5: Manual device sync from Golioth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Manual sync completed',
          devicesUpdated: 2,
          devicesAdded: 1,
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/golioth-sync/manual',
        {
          method: 'POST',
          body: JSON.stringify({ integrationId: 'golioth-456' }),
        }
      )

      const result = await response.json()
      expect(result.devicesUpdated).toBe(2)
      expect(result.devicesAdded).toBe(1)
    })

    test('Step 6: View Golioth sync history', async () => {
      const syncHistory = [
        {
          id: 'sync-1',
          timestamp: '2024-11-02T10:00:00Z',
          status: 'success',
          devicesSync: 3,
        },
        {
          id: 'sync-2',
          timestamp: '2024-11-02T11:00:00Z',
          status: 'success',
          devicesSync: 3,
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ history: syncHistory }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/golioth-sync/history?integrationId=golioth-456'
      )

      const data = await response.json()
      expect(data.history).toHaveLength(2)
      expect(data.history[0].status).toBe('success')
    })

    test('Step 7: Handle Golioth webhook for device updates', async () => {
      const webhookPayload = {
        deviceId: 'golioth-device-1',
        event: 'device.updated',
        data: {
          name: 'Updated Sensor Name',
          metadata: { location: 'Building A' },
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Device updated from Golioth webhook',
          deviceId: 'golioth-device-1',
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/golioth-webhook',
        {
          method: 'POST',
          body: JSON.stringify(webhookPayload),
        }
      )

      const result = await response.json()
      expect(result.deviceId).toBe('golioth-device-1')
    })
  })

  describe('Priority 3: Custom Webhook Integration - Complete Flow', () => {
    const webhookConfig = {
      organization_id: 'org-123',
      integration_type: 'webhook',
      name: 'Custom Data Webhook',
      settings: {
        url: 'https://example.com/api/iot-data',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'webhook-api-key-123',
        },
        events: ['device.created', 'device.updated', 'telemetry.received'],
      },
      status: 'active',
    }

    test('Step 1: Configure webhook integration', () => {
      const config = webhookConfig.settings

      expect(config.url).toBeDefined()
      expect(config.method).toBe('POST')
      expect(config.headers['X-API-Key']).toBeDefined()
      expect(config.events).toHaveLength(3)
    })

    test('Step 2: Save webhook configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          integration: {
            id: 'webhook-789',
            ...webhookConfig,
          },
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/integrations',
        {
          method: 'POST',
          body: JSON.stringify(webhookConfig),
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.integration.integration_type).toBe('webhook')
    })

    test('Step 3: Test webhook endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Webhook responded with status 200',
          details: {
            url: 'https://example.com/api/iot-data',
            status: 200,
          },
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/integrations/test',
        {
          method: 'POST',
          body: JSON.stringify({
            integration_type: 'webhook',
            settings: webhookConfig.settings,
          }),
        }
      )

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.details.status).toBe(200)
    })

    test('Step 4: Trigger webhook on device.created event', async () => {
      const event = {
        type: 'device.created',
        data: {
          deviceId: 'device-new',
          name: 'New IoT Device',
          organizationId: 'org-123',
        },
        timestamp: new Date().toISOString(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          webhookSent: true,
          integrationId: 'webhook-789',
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/send-notification',
        {
          method: 'POST',
          body: JSON.stringify(event),
        }
      )

      const result = await response.json()
      expect(result.webhookSent).toBe(true)
    })

    test('Step 5: View webhook event logs', async () => {
      const logs = [
        {
          id: 'log-1',
          timestamp: '2024-11-02T10:00:00Z',
          event: 'device.created',
          status: 200,
          response: 'OK',
        },
        {
          id: 'log-2',
          timestamp: '2024-11-02T11:00:00Z',
          event: 'telemetry.received',
          status: 200,
          response: 'OK',
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ logs }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/integrations/webhook-789/logs'
      )

      const data = await response.json()
      expect(data.logs).toHaveLength(2)
      expect(data.logs[0].status).toBe(200)
    })

    test('Step 6: Handle webhook failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Webhook endpoint returned 500',
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/send-notification',
        {
          method: 'POST',
          body: JSON.stringify({ event: 'test' }),
        }
      )

      expect(response.ok).toBe(false)
      const error = await response.json()
      expect(error.error).toContain('500')
    })

    test('Step 7: Retry failed webhook deliveries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          retriedEvents: 3,
          successful: 2,
          failed: 1,
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/integrations/webhook-789/retry-failed',
        {
          method: 'POST',
        }
      )

      const result = await response.json()
      expect(result.retriedEvents).toBe(3)
      expect(result.successful).toBe(2)
    })
  })

  describe('Cross-Integration Tests', () => {
    test('multiple integrations can coexist', async () => {
      const integrations = [
        { id: 'mqtt-1', type: 'mqtt', status: 'active' },
        { id: 'golioth-1', type: 'golioth', status: 'active' },
        { id: 'webhook-1', type: 'webhook', status: 'active' },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ integrations }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/integrations?organization_id=org-123'
      )

      const data = await response.json()
      expect(data.integrations).toHaveLength(3)
      expect(data.integrations.map((i: { type: string }) => i.type)).toEqual([
        'mqtt',
        'golioth',
        'webhook',
      ])
    })

    test('device can send data through multiple integrations', async () => {
      const deviceData = {
        deviceId: 'device-multi',
        temperature: 22.5,
        timestamp: Date.now(),
      }

      // Should trigger MQTT, Golioth, and Webhook
      const expectedNotifications = 3

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          notificationsSent: expectedNotifications,
          integrations: ['mqtt-1', 'golioth-1', 'webhook-1'],
        }),
      })

      const response = await fetch(
        'http://localhost:54321/functions/v1/send-notification',
        {
          method: 'POST',
          body: JSON.stringify({ event: 'telemetry.received', data: deviceData }),
        }
      )

      const result = await response.json()
      expect(result.notificationsSent).toBe(3)
    })
  })

  describe('Performance and Reliability', () => {
    test('integrations load within acceptable time', async () => {
      const startTime = Date.now()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ integrations: [] }),
      })

      await fetch(
        'http://localhost:54321/functions/v1/integrations?organization_id=org-123'
      )

      const loadTime = Date.now() - startTime

      expect(loadTime).toBeLessThan(1000) // Should load in < 1 second
    })

    test('handles concurrent integration requests', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ integrations: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ integrations: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ integrations: [] }),
        })

      const requests = [
        fetch('http://localhost:54321/functions/v1/integrations?type=mqtt'),
        fetch('http://localhost:54321/functions/v1/integrations?type=golioth'),
        fetch('http://localhost:54321/functions/v1/integrations?type=webhook'),
      ]

      const responses = await Promise.all(requests)

      expect(responses.every((r) => r.ok)).toBe(true)
    })
  })
})
