/**
 * Unified Device Status API (Issue #89)
 *
 * Returns device status in a provider-agnostic format
 * Works with Golioth, AWS IoT, Azure IoT, MQTT, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { IntegrationProviderFactory } from '@/lib/integrations/integration-provider-factory'
import { OrganizationIntegration } from '@/lib/integrations/organization-integrations'
import { DeviceStatus } from '@/lib/integrations/base-integration-provider'

// Required for Next.js static export - API routes are only used in dynamic mode
export function generateStaticParams() {
  return []
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params
    const supabase = await createClient()

    // 1. Get device with integration info
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select(
        `
        *,
        integration:device_integrations(*)
      `
      )
      .eq('id', deviceId)
      .single()

    if (deviceError || !device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // 2. Create provider (works for ANY integration type)
    const typedIntegration =
      device.integration as unknown as OrganizationIntegration
    const provider = IntegrationProviderFactory.create(typedIntegration)

    // 3. Fetch real-time status from provider
    const externalId = device.external_device_id || ''
    const [providerStatus, connectionInfo] = await Promise.all([
      provider.getDeviceStatus(externalId).catch(() => null),
      provider.getDeviceStatus(externalId).catch(() => null),
    ])

    // 4. Build unified response
    return NextResponse.json({
      device: {
        id: device.id,
        name: device.name,
        deviceType: device.device_type,
        serialNumber: device.serial_number,
      },
      status: providerStatus?.connectionState || device.status || 'unknown',
      statusReason:
        (providerStatus as DeviceStatus & { statusReason?: string | null })
          ?.statusReason ?? null,
      connection: {
        isConnected: providerStatus?.connectionState === 'online',
        lastSeenOnline: device.last_seen_online || providerStatus?.lastActivity,
        lastSeenOffline: device.last_seen_offline,
        uptime: connectionInfo?.uptime,
      },
      firmware: {
        version: device.firmware_version || providerStatus?.firmware?.version,
        updateAvailable: providerStatus?.firmware?.updateAvailable || false,
        updateInProgress: false,
      },
      telemetry: providerStatus?.telemetry || {},
      integration: {
        type: typedIntegration.integration_type,
        name: typedIntegration.name,
        capabilities: provider.getCapabilities(),
      },
      lastSyncedAt: device.updated_at,
    })
  } catch (error) {
    console.error('Device status API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
