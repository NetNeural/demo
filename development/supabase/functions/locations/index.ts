import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export default createEdgeFunction(async ({ req }) => {
  // Create Supabase client with user's auth
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  )

  // Verify authentication
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) {
    throw new DatabaseError('Unauthorized', 401)
  }

  const url = new URL(req.url)
  const organizationId = url.searchParams.get('organization_id')

  // GET - List locations for organization
  if (req.method === 'GET') {
    if (!organizationId) {
      throw new Error('organization_id parameter required')
    }

    const { data: locations, error } = await supabaseClient
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
    const { organization_id, name, description, address, city, state, country, postal_code, latitude, longitude } = body

    if (!organization_id || !name) {
      throw new Error('organization_id and name are required')
    }

    const { data: location, error } = await supabaseClient
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

    const body = await req.json()
    const { name, description, address, city, state, country, postal_code, latitude, longitude } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (address !== undefined) updates.address = address
    if (city !== undefined) updates.city = city
    if (state !== undefined) updates.state = state
    if (country !== undefined) updates.country = country
    if (postal_code !== undefined) updates.postal_code = postal_code
    if (latitude !== undefined) updates.latitude = latitude
    if (longitude !== undefined) updates.longitude = longitude

    const { data: location, error } = await supabaseClient
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

    const { error } = await supabaseClient
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
}, {
  allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE']
})
