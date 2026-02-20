/**
 * Integration Tests: ConflictDetector
 * Tests Issue #87 with real database
 */

import { ConflictDetector } from '@/lib/sync/conflict-detector'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

describe('ConflictDetector - Integration Tests', () => {
  let supabase: any
  let detector: ConflictDetector
  let testOrgId: string
  let testDeviceId: string

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    detector = new ConflictDetector()

    // Create test organization
    const { data: org } = await supabase
      .from('organizations')
      .insert({ name: 'Conflict Test Org' })
      .select()
      .single()
    testOrgId = org.id

    // Create test device
    const { data: device } = await supabase
      .from('devices')
      .insert({
        organization_id: testOrgId,
        name: 'Conflict Test Device',
        device_type: 'sensor',
        serial_number: 'CONFLICT-SN-001',
        status: 'online',
        battery_level: 80,
        metadata: { key1: 'value1' },
      })
      .select()
      .single()
    testDeviceId = device.id
  })

  afterAll(async () => {
    // Cleanup
    await supabase.from('devices').delete().eq('id', testDeviceId)
    await supabase.from('organizations').delete().eq('id', testOrgId)
  })

  describe('detectConflicts', () => {
    test('should detect field-level conflicts', () => {
      const localDevice = {
        name: 'Local Name',
        status: 'online',
        battery_level: 80,
        metadata: { key1: 'local_value' },
      }

      const remoteDevice = {
        name: 'Remote Name',
        status: 'offline',
        battery_level: 75,
        metadata: { key1: 'remote_value' },
      }

      const conflicts = detector.detectConflicts(localDevice, remoteDevice)

      expect(conflicts.length).toBeGreaterThan(0)

      // name conflict (prefer_local strategy)
      const nameConflict = conflicts.find((c) => c.field === 'name')
      expect(nameConflict).toBeDefined()
      expect(nameConflict?.recommendedStrategy).toBe('prefer_local')

      // status conflict (prefer_remote strategy)
      const statusConflict = conflicts.find((c) => c.field === 'status')
      expect(statusConflict).toBeDefined()
      expect(statusConflict?.recommendedStrategy).toBe('prefer_remote')

      // metadata conflict (manual strategy)
      const metadataConflict = conflicts.find((c) => c.field === 'metadata')
      expect(metadataConflict).toBeDefined()
      expect(metadataConflict?.recommendedStrategy).toBe('manual')
    })
  })

  describe('resolveConflicts', () => {
    test('should auto-resolve safe conflicts', async () => {
      const conflicts = [
        {
          field: 'status',
          localValue: 'online',
          remoteValue: 'offline',
          recommendedStrategy: 'prefer_remote',
        },
        {
          field: 'battery_level',
          localValue: 80,
          remoteValue: 75,
          recommendedStrategy: 'prefer_remote',
        },
      ]

      const resolution = await detector.resolveConflicts(
        testDeviceId,
        conflicts
      )

      expect(resolution).toHaveProperty('autoResolved')
      expect(resolution).toHaveProperty('manualRequired')
      expect(resolution.autoResolved.length).toBe(2)
      expect(resolution.manualRequired.length).toBe(0)
    })

    test('should queue manual conflicts to database', async () => {
      const conflicts = [
        {
          field: 'metadata',
          localValue: { key1: 'local' },
          remoteValue: { key1: 'remote' },
          recommendedStrategy: 'manual',
        },
      ]

      const resolution = await detector.resolveConflicts(
        testDeviceId,
        conflicts
      )

      expect(resolution.manualRequired.length).toBe(1)

      // Verify conflict was saved to database
      const { data: dbConflicts } = await supabase
        .from('sync_conflicts')
        .select('*')
        .eq('device_id', testDeviceId)
        .is('resolved_at', null)

      expect(dbConflicts.length).toBeGreaterThan(0)
      const metadataConflict = dbConflicts.find(
        (c) => c.field_name === 'metadata'
      )
      expect(metadataConflict).toBeDefined()
      expect(metadataConflict.resolution_strategy).toBe('manual')

      // Cleanup
      await supabase
        .from('sync_conflicts')
        .delete()
        .eq('device_id', testDeviceId)
    })

    test('should merge arrays correctly', () => {
      const localDevice = {
        tags: ['local-tag-1', 'local-tag-2'],
      }

      const remoteDevice = {
        tags: ['remote-tag-1', 'local-tag-1'], // Overlapping tag
      }

      const conflicts = detector.detectConflicts(localDevice, remoteDevice)
      const tagsConflict = conflicts.find((c) => c.field === 'tags')

      expect(tagsConflict).toBeDefined()
      expect(tagsConflict?.recommendedStrategy).toBe('merge')

      // Expected merged result: ['local-tag-1', 'local-tag-2', 'remote-tag-1']
    })
  })

  describe('conflict resolution workflow', () => {
    test('should handle full conflict resolution cycle', async () => {
      // Step 1: Detect conflicts
      const localDevice = {
        name: 'Local Device',
        status: 'online',
        metadata: { sensor_type: 'temperature' },
      }

      const remoteDevice = {
        name: 'Local Device', // Same
        status: 'offline', // Different (prefer_remote)
        metadata: { sensor_type: 'humidity' }, // Different (manual)
      }

      const conflicts = detector.detectConflicts(localDevice, remoteDevice)
      expect(conflicts.length).toBe(2) // status + metadata

      // Step 2: Resolve conflicts
      const resolution = await detector.resolveConflicts(
        testDeviceId,
        conflicts
      )
      expect(resolution.autoResolved.length).toBe(1) // status
      expect(resolution.manualRequired.length).toBe(1) // metadata

      // Step 3: Verify manual conflict in database
      const { data: manualConflicts } = await supabase
        .from('sync_conflicts')
        .select('*')
        .eq('device_id', testDeviceId)
        .is('resolved_at', null)

      expect(manualConflicts.length).toBe(1)
      const conflict = manualConflicts[0]

      // Step 4: Manually resolve conflict
      await supabase
        .from('sync_conflicts')
        .update({
          resolved_at: new Date().toISOString(),
          resolution_notes: 'Keeping remote value',
        })
        .eq('id', conflict.id)

      // Step 5: Verify resolution
      const { data: resolvedConflict } = await supabase
        .from('sync_conflicts')
        .select('*')
        .eq('id', conflict.id)
        .single()

      expect(resolvedConflict.resolved_at).toBeTruthy()
      expect(resolvedConflict.resolution_notes).toBe('Keeping remote value')

      // Cleanup
      await supabase
        .from('sync_conflicts')
        .delete()
        .eq('device_id', testDeviceId)
    })
  })
})
