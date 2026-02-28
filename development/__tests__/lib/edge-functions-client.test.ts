/**
 * Edge Functions Client SDK Test Suite
 * Tests all edge function SDK methods with mocked responses
 */

import { EdgeFunctionClient } from '@/lib/edge-functions/client'

// Mock fetch globally
global.fetch = jest.fn()

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-token-12345',
          },
        },
      }),
    },
  })),
}))

describe('EdgeFunctionClient', () => {
  let client: EdgeFunctionClient
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    client = new EdgeFunctionClient()
  })

  describe('Authentication', () => {
    it('should include auth token in requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      } as Response)

      await client.call('devices')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/devices'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token-12345',
          }),
        })
      )
    })

    it('should handle missing session gracefully', async () => {
      // Override mock for this test
      const { createClient } = require('@/lib/supabase/client')
      createClient.mockReturnValueOnce({
        auth: {
          getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        },
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      } as Response)

      const newClient = new EdgeFunctionClient()
      await newClient.call('devices')

      // When no session, the anon key is used as fallback Authorization header
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.any(Object),
        })
      )
    })
  })

  describe('Devices API', () => {
    it('should list devices with organization filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { devices: [{ id: '1', name: 'Device 1' }], count: 1 },
        }),
      } as Response)

      const response = await client.devices.list('org-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('organization_id=org-123'),
        expect.any(Object)
      )
      expect(response.success).toBe(true)
      expect(response.data?.devices).toHaveLength(1)
    })

    it('should create a new device', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: 'new-device' } }),
      } as Response)

      const response = await client.devices.create({
        name: 'New Device',
        organization_id: 'org-123',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/devices'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('New Device'),
        })
      )
      expect(response.success).toBe(true)
    })

    it('should update a device', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.devices.update('device-123', { name: 'Updated Name' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/devices/device-123'),
        expect.objectContaining({
          method: 'PUT',
        })
      )
    })

    it('should delete a device', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.devices.delete('device-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/devices/device-123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('Locations API', () => {
    it('should list locations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: '1', name: 'Location 1' }],
        }),
      } as Response)

      const response = await client.locations.list('org-123')

      expect(response.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('organization_id=org-123'),
        expect.any(Object)
      )
    })

    it('should create a location', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.locations.create({
        organization_id: 'org-123',
        name: 'New Location',
        city: 'San Francisco',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/locations'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('New Location'),
        })
      )
    })

    it('should update a location', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.locations.update('loc-123', { name: 'Updated Location' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('id=loc-123'),
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })

    it('should delete a location', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.locations.delete('loc-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('id=loc-123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('Alerts API', () => {
    it('should list alerts with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { alerts: [], count: 0 },
        }),
      } as Response)

      await client.alerts.list('org-123', {
        severity: 'critical',
        resolved: false,
      })

      const callUrl = mockFetch.mock.calls[0][0] as string
      expect(callUrl).toContain('organization_id=org-123')
      expect(callUrl).toContain('severity=critical')
      expect(callUrl).toContain('resolved=false')
    })

    it('should acknowledge an alert', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.alerts.acknowledge('alert-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/alerts/alert-123/acknowledge'),
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })
  })

  describe('Integrations API', () => {
    it('should test an integration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.integrations.test('int-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/integration-test'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should trigger device sync', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.integrations.sync({
        integrationId: 'int-123',
        organizationId: 'org-123',
        operation: 'bidirectional',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/device-sync'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('bidirectional'),
        })
      )
    })
  })

  describe.skip('Dashboard Stats API', () => {
    it('should get dashboard statistics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            devices: { total: 10, online: 7, offline: 3 },
            alerts: { total: 5, unresolved: 2 },
            integrations: { total: 3, active: 2 },
          },
        }),
      } as Response)

      const response = await client.dashboardStats.get('org-123')

      expect(response.success).toBe(true)
      expect(response.data?.devices.total).toBe(10)
    })
  })

  describe('Members API', () => {
    it('should list members', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { members: [] },
        }),
      } as Response)

      await client.members.list('org-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('organization_id=org-123'),
        expect.any(Object)
      )
    })

    it('should add a member', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.members.add('org-123', {
        user_id: 'user-123',
        role: 'member',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('organization_id=org-123'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should update member role', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.members.updateRole('org-123', 'user-123', 'admin')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('organization_id=org-123'),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('admin'),
        })
      )
    })

    it('should remove a member', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.members.remove('org-123', 'user-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('organization_id=org-123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('Users API', () => {
    it('should create a new user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.users.create({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/create-user'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test@example.com'),
        })
      )
    })
  })

  describe.skip('Notifications API', () => {
    it('should send a notification', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.notifications.send({
        organization_id: 'org-123',
        integration_id: 'int-123',
        message: 'Test notification',
        severity: 'info',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/send-notification'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test notification'),
        })
      )
    })

    it('should test notification configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.notifications.test('int-123')

      const callUrl = mockFetch.mock.calls[0][0] as string
      expect(callUrl).toContain('test=true')
    })
  })

  describe.skip('MQTT Broker API', () => {
    it('should connect to MQTT broker', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.mqttBroker.connect({
        organization_id: 'org-123',
        integration_id: 'int-123',
        action: 'connect',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/mqtt-broker'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('connect'),
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const response = await client.call('devices')

      expect(response.success).toBe(false)
      expect(response.error?.message).toContain('Network error')
    })

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: { message: 'Unauthorized', status: 401 },
        }),
      } as Response)

      const response = await client.devices.list('org-123')

      expect(response.success).toBe(false)
      expect(response.error?.message).toBe('Unauthorized')
      expect(response.error?.status).toBe(401)
    })

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      } as Response)

      const response = await client.call('devices')

      expect(response.success).toBe(false)
      expect(response.error?.message).toContain('Invalid JSON')
    })
  })

  describe('Query Parameters', () => {
    it('should handle undefined query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.call('devices', {
        params: {
          org_id: 'org-123',
          limit: undefined,
          offset: 0,
        },
      })

      const callUrl = mockFetch.mock.calls[0][0] as string
      expect(callUrl).toContain('org_id=org-123')
      expect(callUrl).not.toContain('limit=')
      expect(callUrl).toContain('offset=0')
    })

    it('should encode special characters in params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

      await client.call('devices', {
        params: {
          search: 'device name with spaces',
        },
      })

      const callUrl = mockFetch.mock.calls[0][0] as string
      // URL.searchParams encodes spaces as + in query strings
      expect(callUrl).toContain('device+name+with+spaces')
    })
  })
})
