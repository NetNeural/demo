/**
 * Resolve Sync Conflict API (Issue #87)
 *
 * POST /api/sync/conflicts/{conflictId}/resolve
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ConflictDetector } from '@/lib/sync/conflict-detector'

// Required for Next.js static export - API routes are only used in dynamic mode
export function generateStaticParams() {
  return []
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conflictId: string }> }
) {
  try {
    const { conflictId } = await params
    const { resolution, customValue, notes } = await request.json()
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve conflict using ConflictDetector
    const detector = new ConflictDetector()
    await detector.manuallyResolveConflict(
      conflictId,
      resolution,
      customValue,
      user.id,
      notes
    )

    return NextResponse.json({
      success: true,
      conflictId,
      resolvedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Conflict resolution error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
