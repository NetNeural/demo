import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AutoSyncSchedule {
  id: string
  integration_id: string
  organization_id: string
  enabled: boolean
  frequency_minutes: number
  direction: 'import' | 'export' | 'bidirectional'
  conflict_resolution: 'newest_wins' | 'local_wins' | 'remote_wins' | 'manual'
  only_online: boolean
  time_window_enabled: boolean
  time_window_start?: string
  time_window_end?: string
  device_filter: 'all' | 'tagged'
  device_tags?: string[]
  next_run_at: string
}

interface SyncResult {
  success: boolean
  summary: {
    synced: number
    created: number
    updated: number
    skipped: number
    errors: number
  }
  details?: any[]
  errors?: any[]
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all enabled schedules that are due to run
    const { data: schedules, error: schedulesError } = await supabase
      .from('auto_sync_schedules')
      .select(`
        *,
        integration:device_integrations (
          id,
          type,
          config,
          organization_id
        )
      `)
      .eq('enabled', true)
      .lte('next_run_at', new Date().toISOString())

    if (schedulesError) {
      throw schedulesError
    }

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No schedules due to run', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const results = []

    // Process each schedule
    for (const schedule of schedules as any[]) {
      try {
        // Check if we're within time window (if enabled)
        if (schedule.time_window_enabled) {
          const now = new Date()
          const currentTime = now.toTimeString().slice(0, 5) // HH:MM
          
          if (
            currentTime < schedule.time_window_start ||
            currentTime > schedule.time_window_end
          ) {
            console.log(`Skipping schedule ${schedule.id} - outside time window`)
            continue
          }
        }

        // Execute the sync
        const syncResult = await executeSync(supabase, schedule)

        // Update schedule with results
        const { error: updateError } = await supabase
          .from('auto_sync_schedules')
          .update({
            last_run_at: new Date().toISOString(),
            last_run_status: syncResult.success
              ? syncResult.summary.errors > 0
                ? 'partial'
                : 'success'
              : 'failed',
            last_run_summary: syncResult.summary,
            // next_run_at is auto-calculated by trigger
          })
          .eq('id', schedule.id)

        if (updateError) {
          console.error(`Failed to update schedule ${schedule.id}:`, updateError)
        }

        results.push({
          schedule_id: schedule.id,
          integration_id: schedule.integration_id,
          status: syncResult.success ? 'success' : 'failed',
          summary: syncResult.summary,
        })

        // Log to integration_activity_log
        await supabase.from('integration_activity_log').insert({
          integration_id: schedule.integration_id,
          organization_id: schedule.organization_id,
          type: 'device_sync',
          status: syncResult.success ? 'success' : 'error',
          message: `Auto-sync completed: ${syncResult.summary.synced} device(s) synced`,
          metadata: {
            trigger: 'auto_sync',
            schedule_id: schedule.id,
            direction: schedule.direction,
            summary: syncResult.summary,
          },
        })
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error)
        results.push({
          schedule_id: schedule.id,
          integration_id: schedule.integration_id,
          status: 'error',
          error: error.message,
        })
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} schedule(s)`,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Auto-sync cron error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function executeSync(
  supabase: any,
  schedule: AutoSyncSchedule & { integration: any }
): Promise<SyncResult> {
  const { integration } = schedule

  // Build sync request
  const syncRequest = {
    direction: schedule.direction,
    dryRun: false,
    options: {
      createMissing: true,
      updateExisting: true,
      conflictResolution: schedule.conflict_resolution,
      onlyOnline: schedule.only_online,
      deviceFilter: schedule.device_filter === 'tagged' ? {
        tags: schedule.device_tags || [],
      } : undefined,
    },
  }

  // Call the device-sync function
  const syncUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/device-sync`
  const response = await fetch(syncUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      integration_id: integration.id,
      organization_id: integration.organization_id,
      ...syncRequest,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Sync failed: ${response.statusText} - ${errorText}`)
  }

  const result = await response.json()

  return {
    success: result.success || false,
    summary: result.summary || {
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    },
    details: result.details,
    errors: result.errors,
  }
}
