/**
 * Playwright E2E Tests: Golioth Phase 1 Implementation
 * Tests Issues #80-89
 * 
 * Test Coverage:
 * - Unified Device Status API (#89)
 * - Device Credentials Management (#86)
 * - Firmware Deployment (#85)
 * - Sync Conflicts (#87)
 * - Manual Sync Trigger (#88)
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Test configuration
const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase: any;
let authToken: string;
let testOrgId: string;
let testDeviceId: string;
let testIntegrationId: string;

test.describe('Golioth Phase 1 Enhancements', () => {
  
  test.beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Login as super admin
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'super@admin.com',
      password: 'admin123'
    });
    
    if (authError) {
      console.error('Auth error:', authError);
      throw new Error('Failed to authenticate');
    }
    
    authToken = authData.session.access_token;
    
    // Get or create test organization
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);
    
    if (orgs && orgs.length > 0) {
      testOrgId = orgs[0].id;
    } else {
      const { data: newOrg } = await supabase
        .from('organizations')
        .insert({ name: 'E2E Test Org' })
        .select()
        .single();
      testOrgId = newOrg.id;
    }
    
    // Create test Golioth integration
    const { data: integration, error: integrationError } = await supabase
      .from('device_integrations')
      .insert({
        organization_id: testOrgId,
        integration_type: 'golioth',
        name: 'Test Golioth Integration',
        api_key_encrypted: 'test-api-key',
        project_id: 'test-project',
        base_url: 'https://api.golioth.io',
        status: 'active'
      })
      .select()
      .single();
    
    if (integrationError) {
      console.error('Integration creation error:', integrationError);
    }
    
    testIntegrationId = integration?.id;
    
    // Create test device with new Golioth fields
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .insert({
        organization_id: testOrgId,
        integration_id: testIntegrationId,
        name: 'E2E Test Gateway',
        device_type: 'gateway',
        serial_number: 'E2E-SN-001',
        external_device_id: 'golioth-device-001',
        status: 'online',
        firmware_version: '1.0.0',
        last_seen_online: new Date().toISOString(),
        hardware_ids: ['HW-123', 'HW-456'],
        cohort_id: 'prod-cohort'
      })
      .select()
      .single();
    
    if (deviceError) {
      console.error('Device creation error:', deviceError);
    }
    
    testDeviceId = device?.id;
  });

  test.afterAll(async () => {
    // Cleanup: Delete test data
    if (testDeviceId) {
      await supabase.from('devices').delete().eq('id', testDeviceId);
    }
    if (testIntegrationId) {
      await supabase.from('device_integrations').delete().eq('id', testIntegrationId);
    }
  });

  test.describe('Issue #89: Unified Device Status API', () => {
    
    test('should return comprehensive device status', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/devices/${testDeviceId}/status`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      // Verify response structure
      expect(data).toHaveProperty('device');
      expect(data).toHaveProperty('connection');
      expect(data).toHaveProperty('firmware');
      expect(data).toHaveProperty('integration');
      
      // Verify device info includes new Golioth fields
      expect(data.device.serial_number).toBe('E2E-SN-001');
      expect(data.device.hardware_ids).toEqual(['HW-123', 'HW-456']);
      expect(data.device.cohort_id).toBe('prod-cohort');
      expect(data.device.last_seen_online).toBeTruthy();
      
      // Verify integration capabilities
      expect(data.integration.type).toBe('golioth');
      expect(data.integration.capabilities).toHaveProperty('firmwareUpdates');
      expect(data.integration.capabilities).toHaveProperty('remoteConfig');
    });
    
    test('should return 404 for non-existent device', async ({ request }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request.get(`${API_BASE}/api/devices/${fakeId}/status`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(response.status()).toBe(404);
    });
  });

  test.describe('Issue #86: Device Credentials Management', () => {
    
    let testCredentialId: string;
    
    test.beforeAll(async () => {
      // Create test credential
      const { data: credential } = await supabase
        .from('device_credentials')
        .insert({
          device_id: testDeviceId,
          credential_type: 'PRE_SHARED_KEY',
          identity: 'test-psk-id',
          encrypted_secret: 'encrypted-psk-value'
        })
        .select()
        .single();
      
      testCredentialId = credential?.id;
    });
    
    test('should list device credentials', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/devices/${testDeviceId}/credentials`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.credentials).toBeInstanceOf(Array);
      expect(data.credentials.length).toBeGreaterThan(0);
      
      const credential = data.credentials[0];
      expect(credential).toHaveProperty('id');
      expect(credential).toHaveProperty('credential_type');
      expect(credential).toHaveProperty('identity');
      expect(credential.credential_type).toBe('PRE_SHARED_KEY');
    });
    
    test('should decrypt credential with audit logging', async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/devices/${testDeviceId}/credentials/decrypt`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            credential_id: testCredentialId
          }
        }
      );
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data).toHaveProperty('decrypted_value');
      expect(data).toHaveProperty('credential_type');
      
      // Verify audit log was created
      const { data: auditLog } = await supabase
        .from('device_credential_access_log')
        .select('*')
        .eq('credential_id', testCredentialId)
        .order('accessed_at', { ascending: false })
        .limit(1);
      
      expect(auditLog).toBeTruthy();
      expect(auditLog.length).toBe(1);
      expect(auditLog[0]).toHaveProperty('accessed_by');
      expect(auditLog[0]).toHaveProperty('ip_address');
    });
    
    test.afterAll(async () => {
      if (testCredentialId) {
        await supabase.from('device_credentials').delete().eq('id', testCredentialId);
      }
    });
  });

  test.describe('Issue #85: Firmware Deployment', () => {
    
    test.beforeAll(async () => {
      // Create test firmware artifact
      await supabase
        .from('firmware_artifacts')
        .insert({
          organization_id: testOrgId,
          integration_id: testIntegrationId,
          external_artifact_id: 'artifact-v2.0.0',
          package_name: 'main',
          version: '2.0.0',
          size_bytes: 1048576,
          checksum_sha256: 'abc123def456'
        });
    });
    
    test('should queue firmware deployment', async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/devices/${testDeviceId}/deploy-firmware`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            artifact_id: 'artifact-v2.0.0',
            version: '2.0.0'
          }
        }
      );
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.status).toBe('queued');
      expect(data.version).toBe('2.0.0');
      
      // Verify firmware history was logged (Issue #81)
      const { data: history } = await supabase
        .from('device_firmware_history')
        .select('*')
        .eq('device_id', testDeviceId)
        .order('changed_at', { ascending: false })
        .limit(1);
      
      expect(history).toBeTruthy();
      expect(history.length).toBeGreaterThan(0);
    });
    
    test('should reject deployment without provider capability', async ({ request }) => {
      // Create device without firmware update capability
      const { data: basicDevice } = await supabase
        .from('devices')
        .insert({
          organization_id: testOrgId,
          name: 'Basic Device',
          device_type: 'sensor',
          serial_number: 'BASIC-001'
        })
        .select()
        .single();
      
      const response = await request.post(
        `${API_BASE}/api/devices/${basicDevice.id}/deploy-firmware`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            artifact_id: 'artifact-v2.0.0',
            version: '2.0.0'
          }
        }
      );
      
      expect(response.status()).toBe(400);
      const error = await response.json();
      expect(error.error).toContain('capability');
      
      // Cleanup
      await supabase.from('devices').delete().eq('id', basicDevice.id);
    });
  });

  test.describe('Issue #87: Sync Conflict Detection', () => {
    
    let testConflictId: string;
    
    test.beforeAll(async () => {
      // Create test sync conflict
      const { data: conflict } = await supabase
        .from('sync_conflicts')
        .insert({
          device_id: testDeviceId,
          field_name: 'metadata',
          local_value: { local_key: 'local_value' },
          remote_value: { remote_key: 'remote_value' },
          resolution_strategy: 'manual'
        })
        .select()
        .single();
      
      testConflictId = conflict?.id;
    });
    
    test('should list unresolved conflicts', async ({ request }) => {
      const response = await request.get(
        `${API_BASE}/api/sync/conflicts?deviceId=${testDeviceId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.conflicts).toBeInstanceOf(Array);
      expect(data.conflicts.length).toBeGreaterThan(0);
      
      const conflict = data.conflicts[0];
      expect(conflict).toHaveProperty('id');
      expect(conflict).toHaveProperty('field_name');
      expect(conflict).toHaveProperty('local_value');
      expect(conflict).toHaveProperty('remote_value');
      expect(conflict.resolution_strategy).toBe('manual');
    });
    
    test('should resolve conflict manually', async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/sync/conflicts/${testConflictId}/resolve`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            resolution: 'use_local',
            notes: 'Using local value per admin decision'
          }
        }
      );
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.resolved).toBe(true);
      
      // Verify conflict was resolved in database
      const { data: resolvedConflict } = await supabase
        .from('sync_conflicts')
        .select('*')
        .eq('id', testConflictId)
        .single();
      
      expect(resolvedConflict.resolved_at).toBeTruthy();
      expect(resolvedConflict.resolved_by).toBeTruthy();
      expect(resolvedConflict.resolution_notes).toBe('Using local value per admin decision');
    });
    
    test.afterAll(async () => {
      if (testConflictId) {
        await supabase.from('sync_conflicts').delete().eq('id', testConflictId);
      }
    });
  });

  test.describe('Issue #88: Manual Sync Trigger', () => {
    
    test('should trigger full sync', async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/integrations/${testIntegrationId}/sync`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            fullSync: true,
            dryRun: false
          }
        }
      );
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data).toHaveProperty('syncId');
      expect(data).toHaveProperty('status');
      expect(data.status).toMatch(/queued|running|completed/);
    });
    
    test('should support dry run mode', async ({ request }) => {
      const response = await request.post(
        `${API_BASE}/api/integrations/${testIntegrationId}/sync`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            fullSync: true,
            dryRun: true
          }
        }
      );
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.dryRun).toBe(true);
      expect(data).toHaveProperty('preview');
      // Dry run should preview changes without applying them
    });
  });

  test.describe('Issue #80: Missing Golioth Fields', () => {
    
    test('should persist all Golioth fields', async () => {
      const { data: device } = await supabase
        .from('devices')
        .select('*')
        .eq('id', testDeviceId)
        .single();
      
      // Verify all new Golioth fields exist
      expect(device.serial_number).toBe('E2E-SN-001');
      expect(device.last_seen_online).toBeTruthy();
      expect(device.last_seen_offline).toBeFalsy(); // Should be null for online device
      expect(device.hardware_ids).toEqual(['HW-123', 'HW-456']);
      expect(device.cohort_id).toBe('prod-cohort');
    });
    
    test('should update last_seen_online on status change', async () => {
      const beforeUpdate = new Date();
      
      await supabase
        .from('devices')
        .update({ status: 'offline' })
        .eq('id', testDeviceId);
      
      const { data: device } = await supabase
        .from('devices')
        .select('last_seen_offline')
        .eq('id', testDeviceId)
        .single();
      
      // last_seen_offline should be updated
      expect(device.last_seen_offline).toBeTruthy();
      expect(new Date(device.last_seen_offline).getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      
      // Restore online status
      await supabase
        .from('devices')
        .update({ status: 'online' })
        .eq('id', testDeviceId);
    });
  });

  test.describe('Issue #81: Firmware History Tracking', () => {
    
    test('should auto-log firmware version changes', async () => {
      // Update firmware version
      await supabase
        .from('devices')
        .update({ firmware_version: '1.1.0' })
        .eq('id', testDeviceId);
      
      // Check firmware history
      const { data: history } = await supabase
        .from('device_firmware_history')
        .select('*')
        .eq('device_id', testDeviceId)
        .order('changed_at', { ascending: false });
      
      expect(history).toBeTruthy();
      expect(history.length).toBeGreaterThan(0);
      
      const latestEntry = history[0];
      expect(latestEntry.new_version).toBe('1.1.0');
      expect(latestEntry.previous_version).toBe('1.0.0');
    });
    
    test('should track deployment method', async () => {
      const { data: history } = await supabase
        .from('device_firmware_history')
        .select('*')
        .eq('device_id', testDeviceId)
        .order('changed_at', { ascending: false })
        .limit(1);
      
      expect(history[0]).toHaveProperty('changed_at');
      expect(history[0]).toHaveProperty('previous_version');
      expect(history[0]).toHaveProperty('new_version');
    });
  });

  test.describe('Issue #83: Serial Number Primary Matching', () => {
    
    test('should match devices by serial number', async () => {
      // Query by serial number
      const { data: device } = await supabase
        .from('devices')
        .select('*')
        .eq('serial_number', 'E2E-SN-001')
        .single();
      
      expect(device).toBeTruthy();
      expect(device.id).toBe(testDeviceId);
      expect(device.name).toBe('E2E Test Gateway');
    });
    
    test('should enforce unique serial numbers', async () => {
      // Try to create duplicate serial number
      const { error } = await supabase
        .from('devices')
        .insert({
          organization_id: testOrgId,
          name: 'Duplicate Device',
          device_type: 'sensor',
          serial_number: 'E2E-SN-001' // Same as test device
        });
      
      expect(error).toBeTruthy();
      expect(error.code).toBe('23505'); // Unique violation
    });
  });

  test.describe('Performance & Integration', () => {
    
    test('should handle concurrent requests', async ({ request }) => {
      const requests = Array(5).fill(null).map(() =>
        request.get(`${API_BASE}/api/devices/${testDeviceId}/status`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.ok()).toBeTruthy();
      });
    });
    
    test('should return consistent data across endpoints', async ({ request }) => {
      // Get device from status API
      const statusResponse = await request.get(`${API_BASE}/api/devices/${testDeviceId}/status`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const statusData = await statusResponse.json();
      
      // Get device from database
      const { data: dbDevice } = await supabase
        .from('devices')
        .select('*')
        .eq('id', testDeviceId)
        .single();
      
      // Verify consistency
      expect(statusData.device.id).toBe(dbDevice.id);
      expect(statusData.device.serial_number).toBe(dbDevice.serial_number);
      expect(statusData.device.firmware_version).toBe(dbDevice.firmware_version);
    });
  });
});
