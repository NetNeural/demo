// ===========================================================================import { serve } from 'std/http/server.ts'

// Device Sync Edge Function - Production Gradeimport { cors } from 'cors'

// ===========================================================================import {

// Handles bidirectional synchronization between Golioth and NetNeural  createServiceClient,

// Features: Import, Export, Bidirectional, Conflict Detection, Batch Processing  createErrorResponse,

// ===========================================================================  createSuccessResponse,

  validateEnvironment,

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'} from '../_shared/database.ts'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'import { createGoliothClient } from '../_shared/golioth.ts'

import { GoliothClient, GoliothAPIError } from '../_shared/golioth.ts'

import type { SyncOperation, SyncResult, GoliothDevice, LocalDevice, Conflict } from '../_shared/types.ts'/**

 * Synchronize devices between Golioth and Supabase

// CORS headers * This function is called periodically to keep devices in sync

const corsHeaders = { */

  'Access-Control-Allow-Origin': '*',serve(async (req: Request) => {

  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',  // Handle CORS preflight requests

}  if (req.method === 'OPTIONS') {

    return new Response(null, {

serve(async (req) => {      status: 200,

  // Handle CORS preflight      headers: cors(),

  if (req.method === 'OPTIONS') {    })

    return new Response('ok', { headers: corsHeaders })  }

  }

  try {

  try {    // Validate environment variables

    // Parse request    validateEnvironment()

    const { integrationId, organizationId, operation, deviceIds, force }: SyncOperation = await req.json()

    // Only allow POST requests

    // Validate input    if (req.method !== 'POST') {

    if (!integrationId || !organizationId || !operation) {      return createErrorResponse('Method not allowed', 405)

      return new Response(    }

        JSON.stringify({ error: 'Missing required parameters: integrationId, organizationId, operation' }),

        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }    // Parse request body

      )    const { projectId, organizationId } = await req.json()

    }    

    if (!projectId || !organizationId) {

    // Initialize Supabase client      return createErrorResponse(

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!        'Missing required fields: projectId, organizationId'

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!      )

    const supabase = createClient(supabaseUrl, supabaseKey)    }



    // Get integration config    // Initialize clients

    const { data: integration, error: integrationError } = await supabase    const supabase = createServiceClient()

      .from('device_integrations')    const golioth = createGoliothClient()

      .select('*')

      .eq('id', integrationId)    // Fetch devices from Golioth

      .eq('integration_type', 'golioth')    console.log(`Fetching devices from Golioth project: ${projectId}`)

      .single()    const goliothDevices = await golioth.getDevices(projectId)



    if (integrationError || !integration) {    // Fetch existing devices from Supabase

      throw new Error('Integration not found')    const { data: existingDevices, error: fetchError } = await supabase

    }      .from('devices')

      .select('*')

    // Decrypt API key (base64 for now - TODO: use Supabase Vault)      .eq('organization_id', organizationId)

    const apiKey = atob(integration.api_key_encrypted)

    const projectId = integration.project_id    if (fetchError) {

      console.error('Error fetching devices from Supabase:', fetchError)

    // Initialize Golioth client      return createErrorResponse('Failed to fetch existing devices')

    const golioth = new GoliothClient({ apiKey, projectId, baseUrl: integration.base_url })    }



    // Create sync log entry    // Create a map of existing devices by golioth_id

    const { data: syncLog, error: logError } = await supabase    const existingDevicesMap = new Map(

      .from('golioth_sync_log')      existingDevices?.map((device) => [device.golioth_id, device]) || []

      .insert({    )

        organization_id: organizationId,

        integration_id: integrationId,    const syncResults = {

        operation,      created: 0,

        status: 'started',      updated: 0,

        started_at: new Date().toISOString(),      errors: 0,

      })    }

      .select()

      .single()    // Sync each Golioth device

    for (const goliothDevice of goliothDevices) {

    if (logError) throw logError      try {

        const existingDevice = existingDevicesMap.get(goliothDevice.id)

    const startTime = Date.now()

        if (existingDevice) {

    // Perform sync based on operation          // Update existing device

    let result: SyncResult          const { error: updateError } = await supabase

                .from('devices')

    try {            .update({

      switch (operation) {              name: goliothDevice.name,

        case 'import':              status: goliothDevice.status === 'online' ? 'active' : 'inactive',

          result = await performImport(supabase, golioth, organizationId, integrationId, deviceIds, syncLog.id)              updated_at: new Date().toISOString(),

          break            })

        case 'export':            .eq('id', existingDevice.id)

          result = await performExport(supabase, golioth, organizationId, integrationId, deviceIds, syncLog.id)

          break          if (updateError) {

        case 'bidirectional':            console.error(`Error updating device ${goliothDevice.id}:`, updateError)

          result = await performBidirectionalSync(supabase, golioth, organizationId, integrationId, force || false, syncLog.id)            syncResults.errors++

          break          } else {

        default:            syncResults.updated++

          throw new Error(`Unsupported operation: ${operation}`)          }

      }        } else {

          // Create new device

      // Update sync log with success          const { error: insertError } = await supabase

      await supabase            .from('devices')

        .from('golioth_sync_log')            .insert({

        .update({              name: goliothDevice.name,

          status: result.conflictsDetected > 0 ? 'partial' : 'completed',              golioth_id: goliothDevice.id,

          devices_processed: result.devicesProcessed,              status: goliothDevice.status === 'online' ? 'active' : 'inactive',

          devices_succeeded: result.devicesSucceeded,              organization_id: organizationId,

          devices_failed: result.devicesFailed,            })

          conflicts_detected: result.conflictsDetected,

          completed_at: new Date().toISOString(),          if (insertError) {

          duration_ms: Date.now() - startTime,            console.error(`Error creating device ${goliothDevice.id}:`, insertError)

        })            syncResults.errors++

        .eq('id', syncLog.id)          } else {

            syncResults.created++

      // Update integration last sync          }

      await supabase        }

        .from('device_integrations')      } catch (error) {

        .update({        console.error(`Error syncing device ${goliothDevice.id}:`, error)

          last_sync_at: new Date().toISOString(),        syncResults.errors++

          last_sync_status: result.conflictsDetected > 0 ? 'partial' : 'completed',      }

          sync_error: null,    }

        })

        .eq('id', integrationId)    console.log('Device sync completed:', syncResults)



      return new Response(    return createSuccessResponse({

        JSON.stringify({      message: 'Device synchronization completed',

          success: true,      results: syncResults,

          syncLogId: syncLog.id,      deviceCount: goliothDevices.length,

          ...result,    })

        }),

        {   } catch (error) {

          status: 200,    console.error('Device sync error:', error)

          headers: { 'Content-Type': 'application/json', ...corsHeaders }    return createErrorResponse(

        }      error instanceof Error ? error.message : 'Unknown error occurred'

      )    )

  }

    } catch (syncError) {})
      // Update sync log with failure
      await supabase
        .from('golioth_sync_log')
        .update({
          status: 'failed',
          error_message: syncError.message,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        })
        .eq('id', syncLog.id)

      // Update integration error
      await supabase
        .from('device_integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'failed',
          sync_error: syncError.message,
        })
        .eq('id', integrationId)

      throw syncError
    }

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Sync failed',
        details: error instanceof GoliothAPIError ? error.response : null,
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    )
  }
})

// ===========================================================================
// IMPORT: Golioth → NetNeural
// ===========================================================================

async function performImport(
  supabase: any,
  golioth: GoliothClient,
  organizationId: string,
  integrationId: string,
  deviceIds: string[] | undefined,
  syncLogId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    syncLogId,
    devicesProcessed: 0,
    devicesSucceeded: 0,
    devicesFailed: 0,
    conflictsDetected: 0,
    errors: [],
  }

  // Get devices from Golioth
  const goliothDevices = await golioth.getDevices()
  
  // Filter if specific device IDs requested
  const devicesToSync = deviceIds
    ? goliothDevices.filter(d => deviceIds.includes(d.id))
    : goliothDevices

  for (const goliothDevice of devicesToSync) {
    result.devicesProcessed++

    try {
      // Check if device already exists
      const { data: existingDevice } = await supabase
        .from('devices')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('external_device_id', goliothDevice.id)
        .maybeSingle()

      if (existingDevice) {
        // Update existing device
        const { error } = await supabase
          .from('devices')
          .update({
            name: goliothDevice.name,
            status: mapGoliothStatus(goliothDevice.status),
            last_seen: goliothDevice.lastSeen || null,
            metadata: goliothDevice.metadata || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingDevice.id)

        if (error) throw error

        // Update assignment
        await supabase
          .from('device_service_assignments')
          .upsert({
            device_id: existingDevice.id,
            integration_id: integrationId,
            external_device_id: goliothDevice.id,
            sync_status: 'synced',
            last_sync_at: new Date().toISOString(),
            last_sync_log_id: syncLogId,
            sync_error: null,
            sync_retry_count: 0,
          })

      } else {
        // Create new device
        const { data: newDevice, error: createError } = await supabase
          .from('devices')
          .insert({
            organization_id: organizationId,
            integration_id: integrationId,
            external_device_id: goliothDevice.id,
            name: goliothDevice.name,
            device_type: 'sensor',
            status: mapGoliothStatus(goliothDevice.status),
            last_seen: goliothDevice.lastSeen || null,
            metadata: goliothDevice.metadata || {},
          })
          .select()
          .single()

        if (createError) throw createError

        // Create assignment
        await supabase
          .from('device_service_assignments')
          .insert({
            device_id: newDevice.id,
            integration_id: integrationId,
            external_device_id: goliothDevice.id,
            sync_status: 'synced',
            last_sync_at: new Date().toISOString(),
            last_sync_log_id: syncLogId,
          })
      }

      result.devicesSucceeded++

    } catch (error) {
      result.devicesFailed++
      result.errors.push({
        deviceId: goliothDevice.id,
        error: error.message,
      })
    }
  }

  return result
}

// ===========================================================================
// EXPORT: NetNeural → Golioth
// ===========================================================================

async function performExport(
  supabase: any,
  golioth: GoliothClient,
  organizationId: string,
  integrationId: string,
  deviceIds: string[] | undefined,
  syncLogId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    syncLogId,
    devicesProcessed: 0,
    devicesSucceeded: 0,
    devicesFailed: 0,
    conflictsDetected: 0,
    errors: [],
  }

  // Get local devices
  let query = supabase
    .from('devices')
    .select('*')
    .eq('organization_id', organizationId)

  if (deviceIds) {
    query = query.in('id', deviceIds)
  }

  const { data: localDevices, error } = await query

  if (error) throw error

  for (const localDevice of localDevices || []) {
    result.devicesProcessed++

    try {
      if (localDevice.external_device_id) {
        // Update existing Golioth device
        await golioth.updateDevice(localDevice.external_device_id, {
          name: localDevice.name,
          metadata: localDevice.metadata,
        })
      } else {
        // Create new Golioth device
        const goliothDevice = await golioth.createDevice({
          name: localDevice.name,
          hardwareId: localDevice.id,
          metadata: localDevice.metadata,
        })

        // Update local device with external ID
        await supabase
          .from('devices')
          .update({ external_device_id: goliothDevice.id })
          .eq('id', localDevice.id)

        // Create assignment
        await supabase
          .from('device_service_assignments')
          .upsert({
            device_id: localDevice.id,
            integration_id: integrationId,
            external_device_id: goliothDevice.id,
            sync_status: 'synced',
            last_sync_at: new Date().toISOString(),
            last_sync_log_id: syncLogId,
          })
      }

      result.devicesSucceeded++

    } catch (error) {
      result.devicesFailed++
      result.errors.push({
        deviceId: localDevice.id,
        error: error.message,
      })
    }
  }

  return result
}

// ===========================================================================
// BIDIRECTIONAL SYNC with Conflict Detection
// ===========================================================================

async function performBidirectionalSync(
  supabase: any,
  golioth: GoliothClient,
  organizationId: string,
  integrationId: string,
  force: boolean,
  syncLogId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    syncLogId,
    devicesProcessed: 0,
    devicesSucceeded: 0,
    devicesFailed: 0,
    conflictsDetected: 0,
    errors: [],
  }

  // Get conflict resolution strategy
  const { data: integration } = await supabase
    .from('device_integrations')
    .select('conflict_resolution')
    .eq('id', integrationId)
    .single()

  const conflictStrategy = integration?.conflict_resolution || 'manual'

  // Get all devices from both systems
  const [goliothDevices, { data: localDevices }] = await Promise.all([
    golioth.getDevices(),
    supabase
      .from('devices')
      .select('*')
      .eq('organization_id', organizationId),
  ])

  // Create lookup maps
  const goliothMap = new Map(goliothDevices.map(d => [d.id, d]))
  const localMap = new Map(
    (localDevices || [])
      .filter((d: any) => d.external_device_id)
      .map((d: any) => [d.external_device_id, d])
  )

  // Process each device
  const allExternalIds = new Set([...goliothMap.keys(), ...localMap.keys()])

  for (const externalId of allExternalIds) {
    result.devicesProcessed++

    const goliothDevice = goliothMap.get(externalId)
    const localDevice = localMap.get(externalId)

    try {
      if (goliothDevice && localDevice) {
        // Both exist - check for conflicts
        const conflicts = detectConflicts(localDevice, goliothDevice)

        if (conflicts.length > 0 && !force) {
          // Create conflict records
          for (const conflict of conflicts) {
            await supabase.from('device_conflicts').insert({
              device_id: localDevice.id,
              sync_log_id: syncLogId,
              conflict_type: 'concurrent_modification',
              field_name: conflict.fieldName,
              local_value: conflict.localValue,
              remote_value: conflict.remoteValue,
              local_updated_at: localDevice.updated_at,
              remote_updated_at: goliothDevice.updatedAt,
            })
          }
          result.conflictsDetected += conflicts.length

          // Apply auto-resolution if configured
          if (conflictStrategy !== 'manual') {
            await resolveConflictAuto(supabase, golioth, localDevice, goliothDevice, conflictStrategy, syncLogId)
            result.devicesSucceeded++
          }
        } else {
          // No conflicts or force sync - use newest data
          const localTime = new Date(localDevice.updated_at).getTime()
          const remoteTime = new Date(goliothDevice.updatedAt).getTime()

          if (remoteTime > localTime) {
            // Update local with remote
            await supabase
              .from('devices')
              .update({
                name: goliothDevice.name,
                status: mapGoliothStatus(goliothDevice.status),
                last_seen: goliothDevice.lastSeen,
                metadata: goliothDevice.metadata,
                updated_at: new Date().toISOString(),
              })
              .eq('id', localDevice.id)
          } else {
            // Update remote with local
            await golioth.updateDevice(externalId, {
              name: localDevice.name,
              metadata: localDevice.metadata,
            })
          }
          result.devicesSucceeded++
        }
      } else if (goliothDevice) {
        // Only in Golioth - import
        const importResult = await performImport(supabase, golioth, organizationId, integrationId, [externalId], syncLogId)
        result.devicesSucceeded += importResult.devicesSucceeded
        result.devicesFailed += importResult.devicesFailed
      } else if (localDevice) {
        // Only local - export
        const exportResult = await performExport(supabase, golioth, organizationId, integrationId, [localDevice.id], syncLogId)
        result.devicesSucceeded += exportResult.devicesSucceeded
        result.devicesFailed += exportResult.devicesFailed
      }

    } catch (error) {
      result.devicesFailed++
      result.errors.push({
        deviceId: externalId,
        error: error.message,
      })
    }
  }

  return result
}

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

function detectConflicts(local: any, remote: GoliothDevice): Conflict[] {
  const conflicts: Conflict[] = []

  // Check name
  if (local.name !== remote.name) {
    conflicts.push({
      deviceId: local.id,
      fieldName: 'name',
      localValue: local.name,
      remoteValue: remote.name,
      localUpdatedAt: local.updated_at,
      remoteUpdatedAt: remote.updatedAt,
    })
  }

  // Check status
  const mappedStatus = mapGoliothStatus(remote.status)
  if (local.status !== mappedStatus) {
    conflicts.push({
      deviceId: local.id,
      fieldName: 'status',
      localValue: local.status,
      remoteValue: mappedStatus,
      localUpdatedAt: local.updated_at,
      remoteUpdatedAt: remote.updatedAt,
    })
  }

  return conflicts
}

async function resolveConflictAuto(
  supabase: any,
  golioth: GoliothClient,
  local: any,
  remote: GoliothDevice,
  strategy: string,
  syncLogId: string
) {
  if (strategy === 'local_wins') {
    await golioth.updateDevice(remote.id, {
      name: local.name,
      metadata: local.metadata,
    })
  } else if (strategy === 'remote_wins') {
    await supabase
      .from('devices')
      .update({
        name: remote.name,
        status: mapGoliothStatus(remote.status),
        last_seen: remote.lastSeen,
        metadata: remote.metadata,
      })
      .eq('id', local.id)
  } else if (strategy === 'newest_wins') {
    const localTime = new Date(local.updated_at).getTime()
    const remoteTime = new Date(remote.updatedAt).getTime()

    if (remoteTime > localTime) {
      await supabase
        .from('devices')
        .update({
          name: remote.name,
          status: mapGoliothStatus(remote.status),
          last_seen: remote.lastSeen,
          metadata: remote.metadata,
        })
        .eq('id', local.id)
    } else {
      await golioth.updateDevice(remote.id, {
        name: local.name,
        metadata: local.metadata,
      })
    }
  }

  // Mark conflicts as auto-resolved
  await supabase
    .from('device_conflicts')
    .update({
      resolution_status: 'auto_resolved',
      resolution_strategy: strategy,
      resolved_at: new Date().toISOString(),
      auto_resolve_reason: `Auto-resolved using ${strategy} strategy`,
    })
    .eq('sync_log_id', syncLogId)
}

function mapGoliothStatus(status: string): 'online' | 'offline' | 'warning' | 'error' {
  switch (status.toLowerCase()) {
    case 'online':
      return 'online'
    case 'offline':
      return 'offline'
    case 'maintenance':
      return 'warning'
    default:
      return 'error'
  }
}
