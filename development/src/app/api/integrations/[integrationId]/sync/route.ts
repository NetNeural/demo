/**
 * Manual Sync Trigger API (Issue #88)
 * 
 * POST /api/integrations/{integrationId}/sync
 * Manually trigger a sync for an integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IntegrationSyncOrchestrator } from '@/lib/sync/integration-sync-orchestrator';

// For static export: no paths to pre-render (handled by Edge Functions)
export async function generateStaticParams() {
  return [];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await params;
    const { fullSync = false, dryRun = false } = await request.json();
    const supabase = await createClient();

    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from('device_integrations')
      .select('*')
      .eq('id', integrationId)
      .single();
    
    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Get organization separately to avoid type complexity
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', integration.organization_id)
      .single();

    const integrationWithOrg: any = {
      ...integration,
      organization: org
    };

    // Run sync using orchestrator
    const orchestrator = new IntegrationSyncOrchestrator();
    const result = await orchestrator.syncIntegration(
      integrationWithOrg.organization.id,
      integrationId,
      { fullSync, dryRun }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Manual sync error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Sync failed'
      },
      { status: 500 }
    );
  }
}
