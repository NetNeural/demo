// deno-lint-ignore-file
/// <reference lib="deno.window" />
/**
 * Edge Function: data-room-expire
 * Checks for expired data room guests and auto-revokes their access.
 * Can be called via Supabase cron (pg_cron) or manually.
 *
 * POST /data-room-expire   (no body required)
 *   returns: { revoked: number, details: [...] }
 */

import { createServiceClient } from '../_shared/auth.ts'
import { makeCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const db = createServiceClient()
    const now = new Date().toISOString()

    // Find active guests whose access has expired
    const { data: expiredGuests, error: fetchError } = await db
      .from('data_room_guests')
      .select('id, email, organization_id, membership_id, expires_at')
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lte('expires_at', now)

    if (fetchError) {
      console.error('[data-room-expire] Failed to fetch expired guests:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to query expired guests' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!expiredGuests || expiredGuests.length === 0) {
      return new Response(
        JSON.stringify({ revoked: 0, message: 'No expired guests found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const details: { id: string; email: string; expired_at: string }[] = []

    for (const guest of expiredGuests) {
      // Remove org membership if it exists
      if (guest.membership_id) {
        await db
          .from('organization_members')
          .delete()
          .eq('id', guest.membership_id)
      }

      // Mark guest as revoked
      await db
        .from('data_room_guests')
        .update({
          status: 'revoked',
          revoked_at: now,
        })
        .eq('id', guest.id)

      details.push({
        id: guest.id,
        email: guest.email,
        expired_at: guest.expires_at,
      })

      console.log(`[data-room-expire] Auto-revoked ${guest.email} (expired ${guest.expires_at})`)
    }

    return new Response(
      JSON.stringify({ revoked: details.length, details }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[data-room-expire] Error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
