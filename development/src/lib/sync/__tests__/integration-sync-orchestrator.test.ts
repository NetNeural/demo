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
  let mockProvider: any

  // Helper to create a chainable Supabase mock
  function createSupabaseMock(
    queryResults: Record<string, { data: any; error: any }>
  ) {
    const createChain = (tableName: string) => {
      const result = queryResults[tableName] || { data: null, error: null }
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(result),
        insert: jest.fn().mockResolvedValue({ data: result.data, error: null }),
        update: jest.fn().mockReturnThis(),
        then: (resolve: any) => resolve(result),
      }
      // Make it thenable so `await chain` works
      chain[Symbol.for('jest.asymmetricMatch')] = undefined
      return chain
    }

    return {
      from: jest.fn((table: string) => createChain(table)),
    }
  }

  beforeEach(() => {
    orchestrator = new IntegrationSyncOrchestrator()

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
      // Mock Supabase - provide data for both tables
      const mockSupabase = createSupabaseMock({
        device_integrations: {
          data: {
            id: 'int-001',
            organization_id: 'org-001',
            integration_type: 'golioth',
            settings: { apiKey: 'test-key' },
          },
          error: null,
        },
        devices: {
          data: [],
          error: null,
        },
      })
      ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

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

      // Re-create orchestrator with new mock
      orchestrator = new IntegrationSyncOrchestrator()
      const result = await orchestrator.syncIntegration('org-001', 'int-001')

      expect(result.success).toBe(true)
      expect(result.devicesProcessed).toBeGreaterThan(0)
    })

    it('should handle connection test failures', async () => {
      const mockSupabase = createSupabaseMock({
        device_integrations: {
          data: {
            id: 'int-001',
            integration_type: 'golioth',
            settings: {},
          },
          error: null,
        },
      })
      ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

      mockProvider.testConnection.mockResolvedValue({
        success: false,
        message: 'Connection timeout',
      })

      orchestrator = new IntegrationSyncOrchestrator()
      const result = await orchestrator.syncIntegration('org-001', 'int-001')

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0].error).toContain('Connection')
    })

    it('should support dry run mode', async () => {
      const mockSupabase = createSupabaseMock({
        device_integrations: {
          data: { id: 'int-001', integration_type: 'golioth', settings: {} },
          error: null,
        },
        devices: {
          data: [],
          error: null,
        },
      })
      ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

      mockProvider.testConnection.mockResolvedValue({
        success: true,
        message: 'Connected',
      })

      mockProvider.listDevices.mockResolvedValue({
        devices: [{ id: 'ext-001', name: 'GW-001', status: 'online' }],
      })

      orchestrator = new IntegrationSyncOrchestrator()
      const result = await orchestrator.syncIntegration('org-001', 'int-001', {
        dryRun: true,
      })

      expect(result.devicesProcessed).toBe(1)
    })
  })
})
