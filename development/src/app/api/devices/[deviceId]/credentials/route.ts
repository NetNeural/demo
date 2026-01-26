/**
 * Device Credentials API - List (Issue #86)
 * 
 * GET /api/devices/{deviceId}/credentials
 * Lists all credentials for a device (encrypted secrets not returned)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const supabase = await createClient();

    // Check if user has access to this device
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, organization_id')
      .eq('id', deviceId)
      .single();

    if (deviceError || !device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    // Get credentials (without decrypted secrets)
    const { data: credentials, error } = await supabase
      .from('device_credentials')
      .select('id, credential_type, identity, created_at, expires_at, last_accessed_at')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      deviceId,
      credentials: credentials || []
    });
  } catch (error) {
    console.error('Credentials list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
