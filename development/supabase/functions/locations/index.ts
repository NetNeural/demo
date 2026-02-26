import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getUserContext } from '../_shared/auth.ts'

// ─── Org Membership Check ────────────────────────────────────────────
// Verifies the user belongs to the target organization (or is super_admin).
async function verifyOrgAccess(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string,
  isSuperAdmin: boolean
): Promise<void> {
  if (isSuperAdmin) return

  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    throw new DatabaseError('You do not have access to this organization', 403)
  }
}

export default createEdgeFunction(
  async ({ req }) => {
    // Authenticate user via JWT
    const userContext = await getUserContext(req)

    // Service-role client bypasses RLS — authorization enforced in function logic
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const url = new URL(req.url)
    const organizationId = url.searchParams.get('organization_id')

    // GET - List locations for organization
    if (req.method === 'GET') {
      if (!organizationId) {
        throw new Error('organization_id parameter required')
      }

      await verifyOrgAccess(supabaseAdmin, userContext.userId, organizationId, userContext.isSuperAdmin)

      const { data: locations, error } = await supabaseAdmin
        .from('locations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching locations:', error)
        throw new DatabaseError(error.message)
      }

      return createSuccessResponse(locations)
    }

    // POST - Create new location
    if (req.method === 'POST') {
      const body = await req.json()
      const {
        organization_id,
        name,
        description,
        address,
        city,
        state,
        country,
        postal_code,
        latitude,
        longitude,
      } = body

      if (!organization_id || !name) {
        throw new Error('organization_id and name are required')
      }

      await verifyOrgAccess(supabaseAdmin, userContext.userId, organization_id, userContext.isSuperAdmin)

      const { data: location, error } = await supabaseAdmin
        .from('locations')
        .insert({
          organization_id,
          name,
          description,
          address,
          city,
          state,
          country,
          postal_code,
          latitude,
          longitude,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating location:', error)
        throw new DatabaseError(error.message)
      }

      return createSuccessResponse(location, { status: 201 })
    }

    // PATCH - Update location
    if (req.method === 'PATCH') {
      const locationId = url.searchParams.get('id')
      if (!locationId) {
        throw new Error('id parameter required')
      }

      // Fetch the location to verify org access
      const { data: existing } = await supabaseAdmin
        .from('locations')
        .select('organization_id')
        .eq('id', locationId)
        .single()

      if (!existing) {
        throw new DatabaseError('Location not found', 404)
      }

      await verifyOrgAccess(supabaseAdmin, userContext.userId, existing.organization_id, userContext.isSuperAdmin)

      const body = await req.json()
      const {
        name,
        description,
        address,
        city,
        state,
        country,
        postal_code,
        latitude,
        longitude,
      } = body

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (name !== undefined) updates.name = name
      if (description !== undefined) updates.description = description
      if (address !== undefined) updates.address = address
      if (city !== undefined) updates.city = city
      if (state !== undefined) updates.state = state
      if (country !== undefined) updates.country = country
      if (postal_code !== undefined) updates.postal_code = postal_code
      if (latitude !== undefined) updates.latitude = latitude
      if (longitude !== undefined) updates.longitude = longitude

      const { data: location, error } = await supabaseAdmin
        .from('locations')
        .update(updates)
        .eq('id', locationId)
        .select()
        .single()

      if (error) {
        console.error('Error updating location:', error)
        throw new DatabaseError(error.message)
      }

      return createSuccessResponse(location)
    }

    // DELETE - Delete location
    if (req.method === 'DELETE') {
      const locationId = url.searchParams.get('id')
      if (!locationId) {
        throw new Error('id parameter required')
      }

      // Fetch the location to verify org access
      const { data: existing } = await supabaseAdmin
        .from('locations')
        .select('organization_id')
        .eq('id', locationId)
        .single()

      if (!existing) {
        throw new DatabaseError('Location not found', 404)
      }

      await verifyOrgAccess(supabaseAdmin, userContext.userId, existing.organization_id, userContext.isSuperAdmin)

      const { error } = await supabaseAdmin
        .from('locations')
        .delete()
        .eq('id', locationId)

      if (error) {
        console.error('Error deleting location:', error)
        throw new DatabaseError(error.message)
      }

      return createSuccessResponse({ message: 'Location deleted successfully' })
    }

    throw new Error('Method not allowed')
  },
  {
    allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
  }
)
