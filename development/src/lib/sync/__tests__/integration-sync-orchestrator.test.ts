/**
 * Integration Sync Orchestrator Tests (Issue #88)
 */

// Mock azure-iothub before importing anything else
jest.mock('azure-iothub', () => ({
  Client: {
    fromConnectionString: jest.fn(),
  },
}))

import { IntegrationSyncOrchestrator } from '../integration-sync-orchestrator'
import { IntegrationProviderFactory } from '@/lib/integrations/integration-provider-factory'
import { createClient } from '@/lib/supabase/client'

// Mock dependencies
jest.mock('@/lib/integrations/integration-provider-factory')
jest.mock('@/lib/supabase/client')

describe('IntegrationSyncOrchestrator', () => {
  let orchestrator: IntegrationSyncOrchestrator
  let mockSupabase: any
  let mockProvider: any

  beforeEach(() => {
    orchestrator = new IntegrationSyncOrchestrator()

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    }
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

    // Mock provider
    mockProvider = {
      testConnection: jest.fn(),
      listDevices: jest.fn(),
      getDeviceStatus: jest.fn(),
      getCapabilities: jest.fn(),
    }
    ;(IntegrationProviderFactory.create as jest.Mock).mockReturnValue(
      mockProvider
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('syncIntegration', () => {
    it('should successfully sync devices from provider', async () => {
      // Mock integration fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'int-001',
          organization_id: 'org-001',
          integration_type: 'golioth',
          settings: { apiKey: 'test-key' },
        },
        error: null,
      })

      // Mock existing devices query
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      })

      // Mock provider connection test
      mockProvider.testConnection.mockResolvedValue({
        success: true,
        message: 'Connected',
      })

      // Mock provider list devices
      mockProvider.listDevices.mockResolvedValue({
        success: true,
        devices: [
          {
            id: 'ext-001',
            name: 'GW-001',
            serialNumber: 'SN-001',
            status: 'online',
            firmwareVersion: '1.0.0',
            hardwareIds: ['HW-001'],
            cohortId: 'prod',
          },
        ],
      })

      // Mock device insert
      mockSupabase.insert.mockResolvedValue({
        data: [{ id: 'dev-001' }],
        error: null,
      })

      const result = await orchestrator.syncIntegration('org-001', 'int-001')

      expect(result.success).toBe(true)
      expect(result.devicesProcessed).toBeGreaterThan(0)
    })

    it('should handle connection test failures', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'int-001',
          integration_type: 'golioth',
        },
        error: null,
      })

      mockProvider.testConnection.mockResolvedValue({
        success: false,
        message: 'Connection timeout',
      })

      const result = await orchestrator.syncIntegration('org-001', 'int-001')

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('Connection timeout')
    })

    it('should support dry run mode', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'int-001', integration_type: 'golioth' },
        error: null,
      })

      mockSupabase.single.mockResolvedValueOnce({
        data: [],
        error: null,
      })

      mockProvider.testConnection.mockResolvedValue({
        success: true,
        message: 'Connected',
      })

      mockProvider.listDevices.mockResolvedValue({
        devices: [{ id: 'ext-001', name: 'GW-001', status: 'online' }],
      })

      const result = await orchestrator.syncIntegration('org-001', 'int-001', {
        dryRun: true,
      })

      expect(result.devicesProcessed).toBe(1)
      // Insert should not be called in dry run
      expect(mockSupabase.insert).not.toHaveBeenCalled()
    })
  })
})
