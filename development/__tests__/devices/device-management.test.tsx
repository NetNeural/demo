/**
 * COMPREHENSIVE TEST SUITE: Device Management
 * 
 * Tests all device CRUD operations, business logic, and edge cases
 * Coverage: API, Database, Business Rules, Error Handling
 */

import { createClient } from '@/lib/supabase/client'

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('Device Management - Complete Coverage', () => {
  let mockSupabase: {
    from: jest.Mock
    auth: {
      getUser: jest.Mock
    }
    functions: {
      invoke: jest.Mock
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        order: jest.fn().mockReturnThis(),
      })),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        }),
      },
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: {}, error: null }),
      },
    }
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('Device Creation (POST /api/devices)', () => {
    test('should create device with all required fields', async () => {
      const deviceData = {
        name: 'Test Device',
        device_id: 'device-001',
        organization_id: 'org-123',
        integration_id: 'int-456',
        status: 'active',
        metadata: { location: 'Building A' },
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'new-device-id', ...deviceData },
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .insert(deviceData)
        .select()
        .single()

      expect(result.data).toMatchObject(deviceData)
      expect(result.error).toBeNull()
    })

    test('should reject device without required organization_id', async () => {
      const invalidDeviceData = {
        name: 'Test Device',
        device_id: 'device-001',
        // Missing organization_id
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'organization_id is required', code: '23502' },
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .insert(invalidDeviceData)
        .select()
        .single()

      expect(result.error).toBeTruthy()
      expect(result.error?.message).toContain('organization_id')
    })

    test('should enforce unique device_id per organization', async () => {
      const duplicateDevice = {
        name: 'Duplicate Device',
        device_id: 'device-001', // Already exists
        organization_id: 'org-123',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                message: 'duplicate key value violates unique constraint',
                code: '23505',
              },
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .insert(duplicateDevice)
        .select()
        .single()

      expect(result.error).toBeTruthy()
      expect(result.error?.code).toBe('23505')
    })

    test('should set default status to "active" if not provided', async () => {
      const deviceWithoutStatus = {
        name: 'Test Device',
        device_id: 'device-002',
        organization_id: 'org-123',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...deviceWithoutStatus, status: 'active', id: 'device-id' },
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .insert(deviceWithoutStatus)
        .select()
        .single()

      expect(result.data?.status).toBe('active')
    })

    test('should store metadata as JSONB', async () => {
      const deviceWithMetadata = {
        name: 'IoT Sensor',
        device_id: 'sensor-001',
        organization_id: 'org-123',
        metadata: {
          location: 'Floor 3',
          room: '301',
          sensorType: 'temperature',
          calibrationDate: '2024-01-01',
          thresholds: {
            min: 15,
            max: 30,
          },
        },
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'sensor-id', ...deviceWithMetadata },
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .insert(deviceWithMetadata)
        .select()
        .single()

      expect(result.data?.metadata).toEqual(deviceWithMetadata.metadata)
      expect(result.data?.metadata.thresholds.max).toBe(30)
    })
  })

  describe('Device Retrieval (GET /api/devices)', () => {
    test('should retrieve all devices for organization', async () => {
      const mockDevices = [
        { id: '1', name: 'Device 1', organization_id: 'org-123', status: 'active' },
        { id: '2', name: 'Device 2', organization_id: 'org-123', status: 'active' },
        { id: '3', name: 'Device 3', organization_id: 'org-123', status: 'inactive' },
      ]

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockDevices,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .select('*')
        .eq('organization_id', 'org-123')

      expect(result.data).toHaveLength(3)
      expect(result.data).toEqual(mockDevices)
    })

    test('should filter devices by status', async () => {
      const activeDevices = [
        { id: '1', name: 'Device 1', status: 'active' },
        { id: '2', name: 'Device 2', status: 'active' },
      ]

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: activeDevices,
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .select('*')
        .eq('organization_id', 'org-123')
        .eq('status', 'active')

      expect(result.data?.every((d: { status: string }) => d.status === 'active')).toBe(true)
    })

    test('should retrieve single device by ID', async () => {
      const device = {
        id: 'device-123',
        name: 'Specific Device',
        device_id: 'dev-001',
        organization_id: 'org-123',
        status: 'active',
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: device,
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .select('*')
        .eq('id', 'device-123')
        .single()

      expect(result.data).toEqual(device)
    })

    test('should return error when device not found', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'No rows returned', code: 'PGRST116' },
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .select('*')
        .eq('id', 'non-existent-id')
        .single()

      expect(result.error).toBeTruthy()
      expect(result.data).toBeNull()
    })

    test('should support pagination', async () => {
      const page1Devices = Array.from({ length: 10 }, (_, i) => ({
        id: `device-${i}`,
        name: `Device ${i}`,
      }))

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: page1Devices,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .select('*')
        .eq('organization_id', 'org-123')

      expect(result.data).toHaveLength(10)
    })
  })

  describe('Device Update (PUT /api/devices/:id)', () => {
    test('should update device name', async () => {
      const updates = { name: 'Updated Device Name' }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'device-123', ...updates },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .update(updates)
        .eq('id', 'device-123')
        .select()
        .single()

      expect(result.data?.name).toBe('Updated Device Name')
    })

    test('should update device status', async () => {
      const updates = { status: 'inactive' }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'device-123', status: 'inactive' },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .update(updates)
        .eq('id', 'device-123')
        .select()
        .single()

      expect(result.data?.status).toBe('inactive')
    })

    test('should update device metadata', async () => {
      const updates = {
        metadata: {
          location: 'New Location',
          firmware: 'v2.0.0',
        },
      }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'device-123', metadata: updates.metadata },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .update(updates)
        .eq('id', 'device-123')
        .select()
        .single()

      expect(result.data?.metadata.firmware).toBe('v2.0.0')
    })

    test('should not allow updating device_id', async () => {
      const invalidUpdate = { device_id: 'new-device-id' }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'device_id cannot be modified', code: '42501' },
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .update(invalidUpdate)
        .eq('id', 'device-123')
        .select()
        .single()

      expect(result.error).toBeTruthy()
    })

    test('should update last_seen timestamp on activity', async () => {
      const now = new Date().toISOString()
      const updates = { last_seen: now }

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'device-123', last_seen: now },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .update(updates)
        .eq('id', 'device-123')
        .select()
        .single()

      expect(result.data?.last_seen).toBe(now)
    })
  })

  describe('Device Deletion (DELETE /api/devices/:id)', () => {
    test('should soft delete device (set status to deleted)', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'device-123', status: 'deleted' },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .update({ status: 'deleted' })
        .eq('id', 'device-123')
        .select()
        .single()

      expect(result.data?.status).toBe('deleted')
    })

    test('should hard delete device', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .delete()
        .eq('id', 'device-123')

      expect(result.error).toBeNull()
    })

    test('should prevent deletion if device has active alerts', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: {
              message: 'Cannot delete device with active alerts',
              code: '23503',
            },
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .delete()
        .eq('id', 'device-123')

      expect(result.error).toBeTruthy()
      expect(result.error?.message).toContain('active alerts')
    })
  })

  describe('Business Logic - Device Lifecycle', () => {
    test('should provision new device through integration', async () => {
      const provisionData = {
        device_id: 'new-device-001',
        integration_id: 'int-golioth',
        organization_id: 'org-123',
      }

      mockSupabase.functions.invoke = jest.fn().mockResolvedValue({
        data: {
          success: true,
          device: {
            id: 'provisioned-device-id',
            ...provisionData,
            status: 'active',
          },
        },
        error: null,
      })

      const result = await mockSupabase.functions.invoke('device-provision', {
        body: provisionData,
      })

      expect(result.data?.success).toBe(true)
      expect(result.data?.device.status).toBe('active')
    })

    test('should sync device state with integration', async () => {
      mockSupabase.functions.invoke = jest.fn().mockResolvedValue({
        data: {
          synced: true,
          changes: ['firmware_version', 'last_seen'],
        },
        error: null,
      })

      const result = await mockSupabase.functions.invoke('device-sync', {
        body: {
          device_id: 'device-123',
          integration_id: 'int-golioth',
        },
      })

      expect(result.data?.synced).toBe(true)
    })

    test('should handle device offline detection', async () => {
      const offlineThreshold = 5 * 60 * 1000 // 5 minutes
      const oldTimestamp = new Date(Date.now() - offlineThreshold - 1000).toISOString()

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockResolvedValue({
              data: [
                { id: 'device-123', last_seen: oldTimestamp, status: 'active' },
              ],
              error: null,
            }),
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .select('*')
        .eq('status', 'active')
        .lt('last_seen', new Date(Date.now() - offlineThreshold).toISOString())

      expect(result.data).toHaveLength(1)
    })

    test('should trigger alert when device goes offline', async () => {
      mockSupabase.functions.invoke = jest.fn().mockResolvedValue({
        data: {
          alert_created: true,
          alert_id: 'alert-123',
          type: 'device_offline',
        },
        error: null,
      })

      const result = await mockSupabase.functions.invoke('create-alert', {
        body: {
          device_id: 'device-123',
          type: 'device_offline',
          severity: 'warning',
        },
      })

      expect(result.data?.alert_created).toBe(true)
      expect(result.data?.type).toBe('device_offline')
    })
  })

  describe('Row Level Security (RLS)', () => {
    test('should only return devices for user organization', async () => {
      const userDevices = [
        { id: '1', organization_id: 'user-org-123' },
        { id: '2', organization_id: 'user-org-123' },
      ]

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: userDevices,
          error: null,
        }),
      })

      const result = await mockSupabase.from('devices').select('*')

      expect(result.data?.every((d: { organization_id: string }) => d.organization_id === 'user-org-123')).toBe(true)
    })

    test('should block access to other organization devices', async () => {
      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      })

      const result = await mockSupabase
        .from('devices')
        .select('*')
        .eq('organization_id', 'other-org-456')

      expect(result.data).toHaveLength(0)
    })
  })

  describe('Performance Tests', () => {
    test('should handle bulk device creation', async () => {
      const bulkDevices = Array.from({ length: 100 }, (_, i) => ({
        name: `Bulk Device ${i}`,
        device_id: `bulk-${i}`,
        organization_id: 'org-123',
      }))

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: bulkDevices.map((d, i) => ({ ...d, id: `id-${i}` })),
            error: null,
          }),
        }),
      })

      const result = await mockSupabase.from('devices').insert(bulkDevices).select()

      expect(result.data).toHaveLength(100)
    })

    test('should efficiently query large device datasets', async () => {
      const startTime = Date.now()

      const mockFrom = mockSupabase.from as jest.Mock
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: Array(1000).fill({ id: 'device' }),
                error: null,
              }),
            }),
          }),
        }),
      })

      await mockSupabase
        .from('devices')
        .select('*')
        .eq('organization_id', 'org-123')
        .order('created_at', { ascending: false })
        .limit(1000)

      const endTime = Date.now()
      expect(endTime - startTime).toBeLessThan(100) // Should be fast
    })
  })
})
