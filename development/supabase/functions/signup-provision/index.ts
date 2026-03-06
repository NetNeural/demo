// deno-lint-ignore-file
/// <reference lib="deno.window" />
/**
 * Edge Function: signup-provision
 * Provisions an organization for a newly-registered user during signup.
 * Called from the signup page BEFORE email confirmation, so there is no
 * user session — authentication is via the anon key, and the function
 * uses the service role internally to bypass RLS.
 *
 * POST /signup-provision
 *   body: { userId, organizationName, organizationSlug, subscriptionTier,
 *           parentOrganizationId? }
 *   returns: { data: { id, name, slug } }
 */

import { createServiceClient } from '../_shared/auth.ts'
import { makeCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const {
      userId,
      organizationName,
      organizationSlug,
      subscriptionTier = 'starter',
      parentOrganizationId,
    } = body

    // Validate required fields
    if (!userId || !organizationName || !organizationSlug) {
      return new Response(
        JSON.stringify({ error: 'userId, organizationName, and organizationSlug are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const db = createServiceClient()

    // Verify the user actually exists in auth.users
    const { data: authUser, error: authError } = await db.auth.admin.getUserById(userId)
    if (authError || !authUser?.user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitize slug
    const slug = organizationSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-|-$/g, '')

    // Check for duplicate slug
    const { data: existing } = await db
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    // If slug exists, append a random suffix
    const finalSlug = existing
      ? `${slug}-${Date.now().toString(36).slice(-4)}`
      : slug

    // Validate parent org if provided
    if (parentOrganizationId) {
      const { data: parentOrg } = await db
        .from('organizations')
        .select('id, subscription_tier')
        .eq('id', parentOrganizationId)
        .single()

      if (!parentOrg) {
        return new Response(
          JSON.stringify({ error: 'Parent organization not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create org
    const { data: newOrg, error: orgError } = await db
      .from('organizations')
      .insert({
        name: organizationName.trim(),
        slug: finalSlug,
        subscription_tier: subscriptionTier,
        is_active: true,
        settings: {},
        created_by: userId,
        ...(parentOrganizationId ? { parent_organization_id: parentOrganizationId } : {}),
      })
      .select('id, name, slug, subscription_tier')
      .single()

    if (orgError || !newOrg) {
      console.error('Failed to create organization:', orgError)
      return new Response(
        JSON.stringify({ error: `Failed to create organization: ${orgError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Organization created:', newOrg.id, newOrg.name)

    // Update user's primary organization_id if not already set
    const { data: existingUser } = await db
      .from('users')
      .select('id, organization_id')
      .eq('id', userId)
      .maybeSingle()

    if (existingUser && !existingUser.organization_id) {
      await db
        .from('users')
        .update({ organization_id: newOrg.id, updated_at: new Date().toISOString() })
        .eq('id', userId)
    } else if (!existingUser) {
      // User profile not created yet (trigger may not have fired), create it
      await db
        .from('users')
        .insert({
          id: userId,
          email: authUser.user.email,
          full_name: authUser.user.user_metadata?.full_name || null,
          role: 'user',
          organization_id: newOrg.id,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .single()
    }

    // Add user as org owner
    const { error: memberError } = await db
      .from('organization_members')
      .upsert(
        {
          organization_id: newOrg.id,
          user_id: userId,
          role: 'owner',
          joined_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,user_id' }
      )

    if (memberError) {
      console.error('Failed to add owner membership:', memberError)
    }

    console.log('Signup provisioning complete for user', userId, '→ org', newOrg.id)

    return new Response(
      JSON.stringify({ data: { id: newOrg.id, name: newOrg.name, slug: newOrg.slug } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('signup-provision error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
