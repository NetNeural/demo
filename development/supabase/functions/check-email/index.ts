// deno-lint-ignore-file
/// <reference lib="deno.window" />
/**
 * Edge Function: check-email
 * Checks whether an email address already exists in the system.
 * Used during signup to determine the correct flow (new user vs cross-org).
 *
 * POST /check-email
 *   body: { email }
 *   returns: { exists: boolean, userId?: string }
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
    const { email } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const db = createServiceClient()

    // Check if user exists in the public users table
    const { data: existingUser } = await db
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({ exists: true, userId: existingUser.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ exists: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('check-email error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
