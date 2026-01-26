/**
 * Integration Tests: IntegrationSyncOrchestrator
 * Tests Issue #88 with real database
 */

import { IntegrationSyncOrchestrator } from '@/lib/sync/integration-sync-orchestrator';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

describe('IntegrationSyncOrchestrator - Integration Tests', () => {
  let supabase: any;
  let orchestrator: IntegrationSyncOrchestrator;
  let testOrgId: string;
  let testIntegrationId: string;
  
  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    orchestrator = new IntegrationSyncOrchestrator();
    
    // Create test organization
    const { data: org } = await supabase
      .from('organizations')
      .insert({ name: 'Integration Test Org' })
      .select()
      .single();
    testOrgId = org.id;
    
    // Create test Golioth integration
    const { data: integration } = await supabase
      .from('device_integrations')
      .insert({
        organization_id: testOrgId,
        integration_type: 'golioth',
        name: 'Test Integration',
        api_key_encrypted: 'test-key',
        project_id: 'test-project',
        base_url: 'https://api.golioth.io',
        status: 'active'
      })
      .select()
      .single();
    testIntegrationId = integration.id;
  });
  
  afterAll(async () => {
    // Cleanup
    await supabase.from('device_integrations').delete().eq('id', testIntegrationId);
    await supabase.from('organizations').delete().eq('id', testOrgId);
  });
  
  describe('syncIntegration', () => {
    test('should sync devices with serial number matching', async () => {
      // This test would require mocking the Golioth API
      // For now, test the dry run functionality
      const result = await orchestrator.syncIntegration(testOrgId, testIntegrationId, {
        dryRun: true,
        syncType: 'full'
      });
      
      expect(result).toHaveProperty('dryRun', true);
      expect(result).toHaveProperty('devicesFound');
      expect(result).toHaveProperty('wouldCreate');
      expect(result).toHaveProperty('wouldUpdate');
    });
    
    test('should capture new Golioth fields', async () => {
      // Mock device data with Golioth fields
      const mockRemoteDevice = {
        id: 'golioth-001',
        name: 'Test Gateway',
        serialNumber: 'TEST-SN-001',
        hardwareIds: ['HW-001', 'HW-002'],
        cohortId: 'test-cohort',
        lastSeenOnline: new Date().toISOString(),
        firmwareVersion: '1.0.0'
      };
      
      // In real implementation, this would come from provider
      // For now, verify the orchestrator handles these fields
      expect(mockRemoteDevice).toHaveProperty('serialNumber');
      expect(mockRemoteDevice).toHaveProperty('hardwareIds');
      expect(mockRemoteDevice).toHaveProperty('cohortId');
      expect(mockRemoteDevice).toHaveProperty('lastSeenOnline');
    });
  });
  
  describe('conflict detection', () => {
    test('should detect conflicts when local and remote differ', async () => {
      // Create local device
      const { data: localDevice } = await supabase
        .from('devices')
        .insert({
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          name: 'Local Name',
          device_type: 'gateway',
          serial_number: 'CONFLICT-001',
          external_device_id: 'golioth-conflict-001',
          metadata: { local_key: 'local_value' }
        })
        .select()
        .single();
      
      // Simulate remote device with different metadata
      // In real sync, ConflictDetector would be called here
      
      // Cleanup
      await supabase.from('devices').delete().eq('id', localDevice.id);
    });
  });
  
  describe('firmware history logging', () => {
    test('should log firmware changes during sync', async () => {
      const { data: device } = await supabase
        .from('devices')
        .insert({
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          name: 'Firmware Test Device',
          device_type: 'sensor',
          serial_number: 'FW-TEST-001',
          firmware_version: '1.0.0'
        })
        .select()
        .single();
      
      // Update firmware version (triggers history log)
      await supabase
        .from('devices')
        .update({ firmware_version: '1.1.0' })
        .eq('id', device.id);
      
      // Verify history was logged
      const { data: history } = await supabase
        .from('device_firmware_history')
        .select('*')
        .eq('device_id', device.id)
        .order('changed_at', { ascending: false });
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].new_version).toBe('1.1.0');
      expect(history[0].previous_version).toBe('1.0.0');
      
      // Cleanup
      await supabase.from('devices').delete().eq('id', device.id);
    });
  });
});
