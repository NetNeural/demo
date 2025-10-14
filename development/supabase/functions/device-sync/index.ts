import { serve } from 'std/http/server.ts'
import { cors } from 'cors'
import {
  createServiceClient,
  createErrorResponse,
  createSuccessResponse,
  validateEnvironment,
} from '../_shared/database.ts'
import { createGoliothClient } from '../_shared/golioth.ts'

/**
 * Synchronize devices between Golioth and Supabase
 * This function is called periodically to keep devices in sync
 */
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: cors(),
    })
  }

  try {
    // Validate environment variables
    validateEnvironment()

    // Only allow POST requests
    if (req.method !== 'POST') {
      return createErrorResponse('Method not allowed', 405)
    }

    // Parse request body
    const { projectId, organizationId } = await req.json()
    
    if (!projectId || !organizationId) {
      return createErrorResponse(
        'Missing required fields: projectId, organizationId'
      )
    }

    // Initialize clients
    const supabase = createServiceClient()
    const golioth = createGoliothClient()

    // Fetch devices from Golioth
    console.log(`Fetching devices from Golioth project: ${projectId}`)
    const goliothDevices = await golioth.getDevices(projectId)

    // Fetch existing devices from Supabase
    const { data: existingDevices, error: fetchError } = await supabase
      .from('devices')
      .select('*')
      .eq('organization_id', organizationId)

    if (fetchError) {
      console.error('Error fetching devices from Supabase:', fetchError)
      return createErrorResponse('Failed to fetch existing devices')
    }

    // Create a map of existing devices by golioth_id
    const existingDevicesMap = new Map(
      existingDevices?.map((device) => [device.golioth_id, device]) || []
    )

    const syncResults = {
      created: 0,
      updated: 0,
      errors: 0,
    }

    // Sync each Golioth device
    for (const goliothDevice of goliothDevices) {
      try {
        const existingDevice = existingDevicesMap.get(goliothDevice.id)

        if (existingDevice) {
          // Update existing device
          const { error: updateError } = await supabase
            .from('devices')
            .update({
              name: goliothDevice.name,
              status: goliothDevice.status === 'online' ? 'active' : 'inactive',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingDevice.id)

          if (updateError) {
            console.error(`Error updating device ${goliothDevice.id}:`, updateError)
            syncResults.errors++
          } else {
            syncResults.updated++
          }
        } else {
          // Create new device
          const { error: insertError } = await supabase
            .from('devices')
            .insert({
              name: goliothDevice.name,
              golioth_id: goliothDevice.id,
              status: goliothDevice.status === 'online' ? 'active' : 'inactive',
              organization_id: organizationId,
            })

          if (insertError) {
            console.error(`Error creating device ${goliothDevice.id}:`, insertError)
            syncResults.errors++
          } else {
            syncResults.created++
          }
        }
      } catch (error) {
        console.error(`Error syncing device ${goliothDevice.id}:`, error)
        syncResults.errors++
      }
    }

    console.log('Device sync completed:', syncResults)

    return createSuccessResponse({
      message: 'Device synchronization completed',
      results: syncResults,
      deviceCount: goliothDevices.length,
    })

  } catch (error) {
    console.error('Device sync error:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error occurred'
    )
  }
})