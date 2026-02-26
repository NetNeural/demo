// ===========================================================================
// Edge Function: org-branding
// ===========================================================================
// Public (no auth required) endpoint to fetch organization branding by slug.
// Used by the login page to show org-specific logo, colors, and name.
//
// GET /org-branding?slug=v-mark
//
// Returns: { name, slug, logoUrl, primaryColor, secondaryColor, accentColor }
// ===========================================================================

import { createServiceClient } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Only GET method is supported' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')?.trim().toLowerCase()

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'slug parameter is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const serviceClient = createServiceClient()

    const { data: org, error } = await serviceClient
      .from('organizations')
      .select('name, slug, settings')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const settings = (org.settings || {}) as Record<string, unknown>
    const branding = (settings.branding || {}) as Record<string, string>
    const loginPage = (settings.login_page || {}) as Record<string, unknown>

    // Only expose safe branding info — no secrets, no internal settings
    const response = {
      name: org.name,
      slug: org.slug,
      logoUrl: branding.logo_url || null,
      primaryColor: branding.primary_color || null,
      secondaryColor: branding.secondary_color || null,
      accentColor: branding.accent_color || null,
      loginPage: {
        backgroundUrl: loginPage.background_url || null,
        backgroundColor: loginPage.background_color || null,
        backgroundFit: loginPage.background_fit || 'cover',
        backgroundPosition: loginPage.background_position || { x: 50, y: 50 },
        backgroundPositionMobile: loginPage.background_position_mobile ||
          loginPage.background_position || { x: 50, y: 50 },
        headline: loginPage.headline || null,
        subtitle: loginPage.subtitle || null,
        cardOpacity: loginPage.card_opacity ?? null,
        showLogo: loginPage.show_logo ?? true,
        enhanceBg: loginPage.enhance_bg ?? false,
        showAnimatedBg: loginPage.show_animated_bg ?? true,
      },
    }

    return new Response(JSON.stringify({ success: true, data: response }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
      },
    })
  } catch (err) {
    console.error('org-branding error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
