/**
 * Firmware Deployment API (Issue #85)
 * 
 * POST /api/devices/{deviceId}/deploy-firmware
 * Deploys firmware to a device via the integration provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IntegrationProviderFactory } from '@/lib/integrations/integration-provider-factory';

// Route segment config - disable for static export
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const { artifactId, componentType } = await request.json();
    const supabase = await createClient();

    // Get device with integration
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select(`
        *,
        integration:organization_integrations(*)
      `)
      .eq('id', deviceId)
      .single();

    if (deviceError || !device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    // Get firmware artifact details
    const { data: artifact, error: artifactError } = await supabase
      .from('firmware_artifacts')
      .select('*')
      .eq('id', artifactId)
      .single();

    if (artifactError || !artifact) {
      return NextResponse.json(
        { error: 'Firmware artifact not found' },
        { status: 404 }
      );
    }

    // Create provider
    const provider = IntegrationProviderFactory.create(device.integration as any);

    // Check if provider supports firmware management
    const capabilities = provider.getCapabilities();
    if (!capabilities.supportsFirmwareManagement) {
      return NextResponse.json(
        { error: 'Provider does not support firmware management' },
        { status: 400 }
      );
    }

    // Deploy firmware via provider
    let deploymentResult;
    try {
      // Check if provider has deployFirmware method
      if (typeof (provider as any).deployFirmware === 'function') {
        deploymentResult = await (provider as any).deployFirmware(
          device.external_device_id,
          {
            artifactId,
            version: artifact.version,
            packageName: artifact.package_name,
            componentType: componentType || artifact.component_type,
            checksum: artifact.checksum_sha256
          }
        );
      } else {
        // Provider doesn't support firmware deployment yet
        deploymentResult = {
          deploymentId: `dep-${Date.now()}`,
          status: 'queued',
          message: 'Provider does not implement deployFirmware method yet'
        };
      }
    } catch (error) {
      console.error('Firmware deployment error:', error);
      deploymentResult = {
        deploymentId: `dep-${Date.now()}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Deployment failed'
      };
    }

    // Log deployment to firmware history
    await supabase
      .from('device_firmware_history')
      .insert({
        device_id: deviceId,
        firmware_version: artifact.version,
        component_type: componentType || artifact.component_type,
        source: 'ota_update',
        metadata: {
          artifact_id: artifactId,
          package_name: artifact.package_name,
          deployment_id: deploymentResult.deploymentId,
          initiated_at: new Date().toISOString(),
          provider_response: deploymentResult
        }
      });

    return NextResponse.json({
      deploymentId: deploymentResult.deploymentId,
      status: deploymentResult.status,
      artifactId,
      version: artifact.version,
      componentType: componentType || artifact.component_type,
      queuedAt: new Date().toISOString(),
      message: deploymentResult.message || 'Firmware deployment initiated',
      details: deploymentResult
    });
  } catch (error) {
    console.error('Firmware deployment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
