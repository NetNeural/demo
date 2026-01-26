/**
 * Sync Conflicts API (Issue #87)
 * 
 * GET /api/sync/conflicts - List unresolved conflicts
 * POST /api/sync/conflicts/{id}/resolve - Resolve a conflict
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const deviceId = searchParams.get('deviceId');

    let query = supabase
      .from('sync_conflicts')
      .select(`
        *,
        device:devices(id, name, device_type)
      `)
      .is('resolved_at', null)
      .order('conflict_detected_at', { ascending: false });

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data: conflicts, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conflicts: conflicts || [],
      total: conflicts?.length || 0
    });
  } catch (error) {
    console.error('Conflicts list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
