import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const organizationId = url.searchParams.get('organization_id')

    // GET - List locations for organization
    if (req.method === 'GET') {
      if (!organizationId) {
        return new Response(
          JSON.stringify({ error: 'organization_id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: locations, error } = await supabaseClient
        .from('locations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching locations:', error)
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify(locations),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST - Create new location
    if (req.method === 'POST') {
      const body = await req.json()
      const { organization_id, name, description, address, city, state, country, postal_code, latitude, longitude } = body

      if (!organization_id || !name) {
        return new Response(
          JSON.stringify({ error: 'organization_id and name are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
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
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify(location),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PATCH - Update location
    if (req.method === 'PATCH') {
      const locationId = url.searchParams.get('id')
      if (!locationId) {
        return new Response(
          JSON.stringify({ error: 'id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
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
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify(location),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE - Delete location
    if (req.method === 'DELETE') {
      const locationId = url.searchParams.get('id')
      if (!locationId) {
        return new Response(
          JSON.stringify({ error: 'id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabaseClient
        .from('locations')
        .delete()
        .eq('id', locationId)

      if (error) {
        console.error('Error deleting location:', error)
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ message: 'Location deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
