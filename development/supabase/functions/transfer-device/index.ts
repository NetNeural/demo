// ===========================================================================
// Edge Function: transfer-device
// ===========================================================================
// Handles device transfer (move) and copy between organizations.
// Uses service_role client to bypass RLS since cross-org updates are blocked.
//
// Accepts:
//   POST { deviceId, targetOrgId, mode: "move" | "copy", includeTelemetry: boolean }
//
// Validates:
//   - Caller has admin/owner role in BOTH source and target orgs
//   - Device exists and belongs to source org
//   - Target org exists
//
// Issue #33: Fix device transfer between orgs + add Copy option
// ===========================================================================

import {
  createEdgeFunction,
  createSuccessResponse,
  createErrorResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import {
  getUserContext,
  createServiceClient,
  corsHeaders,
} from '../_shared/auth.ts'

interface TransferRequest {
  deviceId: string
  targetOrgId: string
  mode: 'move' | 'copy'
  includeTelemetry: boolean
}

interface TransferResult {
  mode: 'move' | 'copy'
  deviceId: string
  newDeviceId?: string // Only for copy mode
  sourceOrgId: string
  targetOrgId: string
  telemetryRecordsMoved: number
  alertsUpdated: number
  thresholdsHandled: number
}

export default createEdgeFunction(
  async ({ req }) => {
    if (req.method !== 'POST') {
      return createErrorResponse('Only POST method is supported', 405)
    }

    // 1. Authenticate the caller
    const userContext = await getUserContext(req)

    // 2. Parse and validate request body
    const body: TransferRequest = await req.json()
    const { deviceId, targetOrgId, mode, includeTelemetry } = body

    if (!deviceId) throw new DatabaseError('deviceId is required', 400)
    if (!targetOrgId) throw new DatabaseError('targetOrgId is required', 400)
    if (!mode || !['move', 'copy'].includes(mode)) {
      throw new DatabaseError('mode must be "move" or "copy"', 400)
    }

    // 3. Use service_role client to bypass RLS for cross-org operations
    const serviceClient = createServiceClient()

    // 4. Fetch the device and verify it exists
    const { data: device, error: deviceError } = await serviceClient
      .from('devices')
      .select('*, organization_id')
      .eq('id', deviceId)
      .is('deleted_at', null)
      .single()

    if (deviceError || !device) {
      throw new DatabaseError('Device not found', 404)
    }

    const sourceOrgId = device.organization_id

    if (sourceOrgId === targetOrgId) {
      throw new DatabaseError(
        'Source and target organizations are the same',
        400
      )
    }

    // 5. Verify target org exists
    const { data: targetOrg, error: targetOrgError } = await serviceClient
      .from('organizations')
      .select('id, name')
      .eq('id', targetOrgId)
      .single()

    if (targetOrgError || !targetOrg) {
      throw new DatabaseError('Target organization not found', 404)
    }

    // 6. Verify caller has admin/owner role in BOTH orgs
    //    Super admins bypass this check
    if (!userContext.isSuperAdmin) {
      const { data: memberships, error: memberError } = await serviceClient
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', userContext.userId)
        .in('organization_id', [sourceOrgId, targetOrgId])

      if (memberError) {
        throw new DatabaseError('Failed to verify org membership', 500)
      }

      const sourceRole = memberships?.find(
        (m) => m.organization_id === sourceOrgId
      )?.role
      const targetRole = memberships?.find(
        (m) => m.organization_id === targetOrgId
      )?.role

      const adminRoles = ['owner', 'admin', 'org_owner', 'org_admin']

      if (!sourceRole || !adminRoles.includes(sourceRole)) {
        throw new DatabaseError(
          'You must be an admin or owner in the source organization',
          403
        )
      }
      if (!targetRole || !adminRoles.includes(targetRole)) {
        throw new DatabaseError(
          'You must be an admin or owner in the target organization',
          403
        )
      }
    }

    // 7. Execute transfer or copy
    let result: TransferResult

    if (mode === 'move') {
      result = await moveDevice(
        serviceClient,
        device,
        sourceOrgId,
        targetOrgId,
        includeTelemetry,
        userContext.userId
      )
    } else {
      result = await copyDevice(
        serviceClient,
        device,
        sourceOrgId,
        targetOrgId,
        includeTelemetry,
        userContext.userId
      )
    }

    // 8. Log the transfer in audit
    try {
      await serviceClient.from('audit_logs').insert({
        user_id: userContext.userId,
        action: mode === 'move' ? 'device_transferred' : 'device_copied',
        resource_type: 'device',
        resource_id: deviceId,
        details: {
          mode,
          sourceOrgId,
          targetOrgId,
          targetOrgName: targetOrg.name,
          includeTelemetry,
          newDeviceId: result.newDeviceId,
          telemetryRecordsMoved: result.telemetryRecordsMoved,
          alertsUpdated: result.alertsUpdated,
        },
        organization_id: sourceOrgId,
      })
    } catch (auditErr) {
      // Don't fail the transfer if audit logging fails
      console.error('Audit log insert failed:', auditErr)
    }

    return createSuccessResponse({
      transfer: result,
      message:
        mode === 'move'
          ? `Device successfully transferred to ${targetOrg.name}`
          : `Device successfully copied to ${targetOrg.name}`,
    })
  },
  {
    requireAuth: true,
    allowedMethods: ['POST', 'OPTIONS'],
    logActivity: true,
  }
)

// ===========================================================================
// Integration Linking: Ensure target org has a matching integration
// ===========================================================================
// When a device is transferred, its integration_id points to the source org's
// integration record. The target org needs its own integration record (or the
// same integration moved over) so that webhooks/auto-sync continue to work.
//
// Strategy depends on integration type:
//   - External webhook integrations (mqtt_external): MOVE the integration
//     record to the target org. External brokers send webhooks using the
//     integration's UUID — cloning creates a new UUID that the broker
//     doesn't know about, breaking webhook routing.
//   - Platform integrations (golioth, aws_iot, etc.): CLONE is fine because
//     our system initiates sync using the integration record.
//
// For move mode: Move the integration when it's external-webhook-based and
//   no other devices in the source org still reference it.
// For copy mode: Always clone (caller passes mode).
// ===========================================================================

// Integration types where the external system sends webhooks using our
// integration UUID. These must be MOVED, not cloned, to preserve the UUID.
const EXTERNAL_WEBHOOK_TYPES = ['mqtt_external']

async function resolveIntegrationForTargetOrg(
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  sourceIntegrationId: string | null,
  targetOrgId: string,
  transferMode: 'move' | 'copy' = 'copy',
  movingDeviceId?: string
): Promise<string | null> {
  if (!sourceIntegrationId) return null

  // Fetch the source integration
  const { data: sourceIntegration, error: srcError } = await serviceClient
    .from('device_integrations')
    .select('*')
    .eq('id', sourceIntegrationId)
    .single()

  if (srcError || !sourceIntegration) {
    console.log('Source integration not found, clearing integration_id')
    return null
  }

  // Check if target org already has a matching integration type
  const { data: existingIntegration } = await serviceClient
    .from('device_integrations')
    .select('id')
    .eq('organization_id', targetOrgId)
    .eq('integration_type', sourceIntegration.integration_type)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (existingIntegration) {
    console.log(`Target org already has ${sourceIntegration.integration_type} integration: ${existingIntegration.id}`)
    return existingIntegration.id
  }

  // -----------------------------------------------------------------------
  // For external webhook integrations in MOVE mode: move the integration
  // record itself (preserves UUID for external broker webhook routing)
  // -----------------------------------------------------------------------
  const isExternalWebhook = EXTERNAL_WEBHOOK_TYPES.includes(
    sourceIntegration.integration_type
  )

  if (isExternalWebhook && transferMode === 'move') {
    // Check if other devices in the source org still use this integration
    let otherDevicesUsingIntegration = 0
    if (movingDeviceId) {
      const { count } = await serviceClient
        .from('devices')
        .select('id', { count: 'exact', head: true })
        .eq('integration_id', sourceIntegrationId)
        .eq('organization_id', sourceIntegration.organization_id)
        .neq('id', movingDeviceId)
        .is('deleted_at', null)

      otherDevicesUsingIntegration = count ?? 0
    }

    if (otherDevicesUsingIntegration === 0) {
      // Safe to move: no other devices in source org use this integration
      console.log(
        `Moving ${sourceIntegration.integration_type} integration ${sourceIntegrationId} to target org (preserves UUID for external webhooks)`
      )
      const { error: moveError } = await serviceClient
        .from('device_integrations')
        .update({
          organization_id: targetOrgId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sourceIntegrationId)

      if (moveError) {
        console.error('Failed to move integration:', moveError)
        // Fall through to clone as fallback
      } else {
        // Also move auto_sync_schedules
        try {
          await serviceClient
            .from('auto_sync_schedules')
            .update({
              organization_id: targetOrgId,
              updated_at: new Date().toISOString(),
            })
            .eq('integration_id', sourceIntegrationId)
        } catch (err) {
          console.log('Auto-sync schedule move skipped:', err)
        }

        console.log(
          `Integration ${sourceIntegrationId} moved to target org (UUID preserved)`
        )
        return sourceIntegrationId // Same UUID — external broker webhooks keep working
      }
    } else {
      console.log(
        `Cannot move integration ${sourceIntegrationId}: ${otherDevicesUsingIntegration} other device(s) in source org still use it. Will clone instead.`
      )
      // Fall through to clone below
    }
  }

  // -----------------------------------------------------------------------
  // Clone the source integration to target org (default for platform integrations)
  // -----------------------------------------------------------------------
  console.log(`Cloning ${sourceIntegration.integration_type} integration to target org`)
  const {
    id: _id,
    organization_id: _orgId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...integrationFields
  } = sourceIntegration

  const { data: newIntegration, error: cloneError } = await serviceClient
    .from('device_integrations')
    .insert({
      ...integrationFields,
      organization_id: targetOrgId,
      name: `${sourceIntegration.name} (transferred)`,
    })
    .select('id')
    .single()

  if (cloneError || !newIntegration) {
    console.error('Failed to clone integration:', cloneError)
    // Non-fatal: device still transfers, just without integration
    return null
  }

  console.log(`Created integration ${newIntegration.id} in target org`)

  // Also clone auto_sync_schedules if any exist for the source integration
  try {
    const { data: schedules } = await serviceClient
      .from('auto_sync_schedules')
      .select('*')
      .eq('integration_id', sourceIntegrationId)

    if (schedules && schedules.length > 0) {
      for (const schedule of schedules) {
        const {
          id: _sId,
          integration_id: _sIntId,
          organization_id: _sOrgId,
          created_at: _sCreated,
          updated_at: _sUpdated,
          last_run_at: _sLastRun,
          next_run_at: _sNextRun,
          ...scheduleFields
        } = schedule

        await serviceClient.from('auto_sync_schedules').insert({
          ...scheduleFields,
          integration_id: newIntegration.id,
          organization_id: targetOrgId,
          next_run_at: new Date().toISOString(), // Run immediately
        })
      }
      console.log(`Cloned ${schedules.length} auto-sync schedule(s) to target org`)
    }
  } catch (err) {
    console.log('Auto-sync schedule clone skipped:', err)
  }

  return newIntegration.id
}

// ===========================================================================
// Move Device: Update organization_id on device + related records
// ===========================================================================
async function moveDevice(
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  // deno-lint-ignore no-explicit-any
  device: any,
  sourceOrgId: string,
  targetOrgId: string,
  includeTelemetry: boolean,
  _userId: string
): Promise<TransferResult> {
  const deviceId = device.id
  let telemetryCount = 0
  let alertsCount = 0
  let thresholdsCount = 0
  const warnings: string[] = []

  // 1. Move telemetry data FIRST (before device org changes)
  //    We do this first because queries filter on organization_id = sourceOrgId.
  //    If we move the device first, some queries might not find the source records.
  if (includeTelemetry) {
    const { count, error: telemetryError } = await serviceClient
      .from('device_telemetry_history')
      .update({ organization_id: targetOrgId })
      .eq('device_id', deviceId)
      .eq('organization_id', sourceOrgId)
      .select('*', { count: 'exact', head: true })

    if (telemetryError) {
      console.error('Telemetry update failed:', telemetryError)
      warnings.push(`Telemetry update failed: ${telemetryError.message}`)
      // Attempt a second time — this is critical data
      const { count: retryCount, error: retryError } = await serviceClient
        .from('device_telemetry_history')
        .update({ organization_id: targetOrgId })
        .eq('device_id', deviceId)
        .eq('organization_id', sourceOrgId)
        .select('*', { count: 'exact', head: true })

      if (retryError) {
        console.error('Telemetry update RETRY failed:', retryError)
        warnings.push(`Telemetry retry also failed: ${retryError.message}`)
      } else {
        telemetryCount = retryCount ?? 0
        console.log(
          `Telemetry retry succeeded: ${telemetryCount} records moved`
        )
      }
    } else {
      telemetryCount = count ?? 0
      console.log(`Telemetry moved: ${telemetryCount} records`)
    }
  }

  // 2. Move alerts
  const { count: alertCount, error: alertError } = await serviceClient
    .from('alerts')
    .update({ organization_id: targetOrgId })
    .eq('device_id', deviceId)
    .eq('organization_id', sourceOrgId)
    .select('*', { count: 'exact', head: true })

  if (alertError) {
    console.error('Alerts update failed:', alertError)
    warnings.push(`Alerts update failed: ${alertError.message}`)
  } else {
    alertsCount = alertCount ?? 0
    console.log(`Alerts moved: ${alertsCount} records`)
  }

  // 3. Move notifications linked to this device's alerts
  try {
    const { error: notifError } = await serviceClient
      .from('notifications')
      .update({ organization_id: targetOrgId })
      .eq('organization_id', sourceOrgId)
      .in(
        'alert_id',
        serviceClient.from('alerts').select('id').eq('device_id', deviceId)
      )

    if (notifError) {
      console.error('Notifications update failed:', notifError)
      warnings.push(`Notifications update failed: ${notifError.message}`)
    }
  } catch {
    console.log('Notifications update skipped')
  }

  // 4. Resolve integration for target org
  //    If the device has an integration, ensure the target org has one too
  //    For external webhook integrations (mqtt_external), MOVE the integration
  //    record to preserve the UUID that external brokers use for webhooks.
  let targetIntegrationId = device.integration_id
  if (device.integration_id) {
    const resolvedId = await resolveIntegrationForTargetOrg(
      serviceClient,
      device.integration_id,
      targetOrgId,
      'move',
      deviceId
    )
    targetIntegrationId = resolvedId
    console.log(`Integration resolved for target org: ${targetIntegrationId}`)
  }

  // 5. Move the device itself (with updated integration_id)
  const { error: updateError } = await serviceClient
    .from('devices')
    .update({
      organization_id: targetOrgId,
      integration_id: targetIntegrationId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deviceId)

  if (updateError) {
    console.error('Device update failed:', updateError)
    throw new DatabaseError(
      `Failed to transfer device: ${updateError.message}`,
      500
    )
  }

  // 6. Touch sensor thresholds (these reference device_id, not org directly)
  try {
    const { count: thresholdCount, error: thresholdError } = await serviceClient
      .from('sensor_thresholds')
      .update({ updated_at: new Date().toISOString() })
      .eq('device_id', deviceId)
      .select('*', { count: 'exact', head: true })

    if (!thresholdError) {
      thresholdsCount = thresholdCount ?? 0
    }
  } catch {
    console.log('Sensor thresholds update skipped (table may not exist)')
  }

  // 7. Final safety net: ensure all telemetry records match the device's org
  //    This catches any records missed by the targeted update above.
  if (includeTelemetry) {
    try {
      const { count: orphanedCount, error: syncError } = await serviceClient
        .from('device_telemetry_history')
        .update({ organization_id: targetOrgId })
        .eq('device_id', deviceId)
        .neq('organization_id', targetOrgId)
        .select('*', { count: 'exact', head: true })

      if (!syncError && (orphanedCount ?? 0) > 0) {
        console.log(
          `Safety net: synced ${orphanedCount} additional orphaned telemetry records`
        )
        telemetryCount += orphanedCount ?? 0
      }
    } catch {
      console.log('Safety net telemetry sync skipped')
    }
  }

  if (warnings.length > 0) {
    console.warn('Transfer completed with warnings:', warnings)
  }

  return {
    mode: 'move',
    deviceId,
    sourceOrgId,
    targetOrgId,
    telemetryRecordsMoved: telemetryCount,
    alertsUpdated: alertsCount,
    thresholdsHandled: thresholdsCount,
  }
}

// ===========================================================================
// Copy Device: Create a clone in the target org with new UUID
// ===========================================================================
async function copyDevice(
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  // deno-lint-ignore no-explicit-any
  device: any,
  sourceOrgId: string,
  targetOrgId: string,
  includeTelemetry: boolean,
  _userId: string
): Promise<TransferResult> {
  let telemetryCount = 0
  let thresholdsCount = 0

  // Resolve integration for target org (copy mode always clones)
  let targetIntegrationId: string | null = null
  if (device.integration_id) {
    targetIntegrationId = await resolveIntegrationForTargetOrg(
      serviceClient,
      device.integration_id,
      targetOrgId,
      'copy'
    )
    console.log(`Copy: integration resolved for target org: ${targetIntegrationId}`)
  }

  // Build new device record (strip fields that should be unique or auto-generated)
  const {
    id: _oldId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    deleted_at: _deletedAt,
    last_seen: _lastSeen,
    last_seen_online: _lastSeenOnline,
    last_seen_offline: _lastSeenOffline,
    external_device_id: _externalId,
    integration_id: _integrationId,
    locations: _locations,
    departments: _departments,
    device_integrations: _integrations,
    ...deviceFields
  } = device

  const newDevice = {
    ...deviceFields,
    organization_id: targetOrgId,
    integration_id: targetIntegrationId,
    name: `${device.name} (Copy)`,
    status: 'offline', // Reset status for copied device
    // Clear location/department since they belong to source org
    location_id: null,
    department_id: null,
  }

  const { data: createdDevice, error: createError } = await serviceClient
    .from('devices')
    .insert(newDevice)
    .select('id')
    .single()

  if (createError || !createdDevice) {
    console.error('Device copy failed:', createError)
    throw new DatabaseError(
      `Failed to copy device: ${createError?.message}`,
      500
    )
  }

  const newDeviceId = createdDevice.id

  // Copy sensor thresholds
  try {
    const { data: thresholds } = await serviceClient
      .from('sensor_thresholds')
      .select('*')
      .eq('device_id', device.id)

    if (thresholds && thresholds.length > 0) {
      const copiedThresholds = thresholds.map(
        // deno-lint-ignore no-explicit-any
        (t: any) => {
          const {
            id: _tId,
            created_at: _tCreatedAt,
            updated_at: _tUpdatedAt,
            ...fields
          } = t
          return {
            ...fields,
            device_id: newDeviceId,
          }
        }
      )

      const { error: thresholdInsertError } = await serviceClient
        .from('sensor_thresholds')
        .insert(copiedThresholds)

      if (!thresholdInsertError) {
        thresholdsCount = copiedThresholds.length
      }
    }
  } catch {
    console.log('Sensor thresholds copy skipped (table may not exist)')
  }

  // Copy telemetry data if requested
  if (includeTelemetry) {
    // Fetch telemetry in batches to avoid memory issues
    const BATCH_SIZE = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: telemetryBatch, error: fetchError } = await serviceClient
        .from('device_telemetry_history')
        .select('*')
        .eq('device_id', device.id)
        .order('received_at', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1)

      if (fetchError || !telemetryBatch || telemetryBatch.length === 0) {
        hasMore = false
        break
      }

      // Map records to new device/org
      const copiedRecords = telemetryBatch.map(
        // deno-lint-ignore no-explicit-any
        (record: any) => {
          const { id: _rId, created_at: _rCreatedAt, ...fields } = record
          return {
            ...fields,
            device_id: newDeviceId,
            organization_id: targetOrgId,
          }
        }
      )

      const { error: insertError } = await serviceClient
        .from('device_telemetry_history')
        .insert(copiedRecords)

      if (insertError) {
        console.error('Telemetry copy batch failed:', insertError)
        hasMore = false
      } else {
        telemetryCount += copiedRecords.length
        offset += BATCH_SIZE
        if (telemetryBatch.length < BATCH_SIZE) {
          hasMore = false
        }
      }
    }
  }

  return {
    mode: 'copy',
    deviceId: device.id,
    newDeviceId,
    sourceOrgId,
    targetOrgId,
    telemetryRecordsMoved: telemetryCount,
    alertsUpdated: 0, // Alerts are not copied
    thresholdsHandled: thresholdsCount,
  }
}
