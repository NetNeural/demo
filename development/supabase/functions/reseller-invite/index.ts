// ============================================================
// Edge Function: reseller-invite
// Story: #337 – Reseller Onboarding & Invitation Flow
//
// POST /reseller-invite { action: 'create', inviter_org_id, invitee_email }
//   → Creates invitation, sends email
//
// POST /reseller-invite { action: 'accept', token, org_name, user_id }
//   → Accepts invite, sets parent_organization_id on new org
//
// POST /reseller-invite { action: 'revoke', invitation_id, inviter_org_id }
//   → Revokes pending invitation
//
// GET /reseller-invite?inviter_org_id=xxx
//   → Lists invitations for org
//
// GET /reseller-invite?token=xxx
//   → Get invitation details (for invite landing page)
// ============================================================

import { createServiceClient } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

const MAX_PENDING_INVITATIONS = 50

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createServiceClient()
    const url = new URL(req.url)

    // ─── GET: list or lookup ─────────────────────────────────────────────────
    if (req.method === 'GET') {
      const inviterOrgId = url.searchParams.get('inviter_org_id')
      const token        = url.searchParams.get('token')

      if (token) {
        // Lookup invitation by token (for invite acceptance page)
        const { data: invite, error } = await supabase
          .from('reseller_invitations')
          .select(`
            id, inviter_org_id, invitee_email, status, expires_at, created_at,
            inviter_org:organizations!inviter_org_id (id, name, slug, is_reseller)
          `)
          .eq('token', token)
          .eq('status', 'pending')
          .single()

        if (error || !invite) {
          return new Response(
            JSON.stringify({ error: 'Invitation not found or already used' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check expiry
        if (new Date(invite.expires_at) < new Date()) {
          await supabase.from('reseller_invitations')
            .update({ status: 'expired' })
            .eq('id', invite.id)

          return new Response(
            JSON.stringify({ error: 'This invitation has expired' }),
            { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, data: invite }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (inviterOrgId) {
        const { data: invites, error } = await supabase
          .from('reseller_invitations')
          .select('id, invitee_email, status, expires_at, created_at, accepted_at, accepted_org_id')
          .eq('inviter_org_id', inviterOrgId)
          .order('created_at', { ascending: false })
          .limit(100)

        return new Response(
          JSON.stringify({ success: true, data: invites ?? [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ error: 'Provide token or inviter_org_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─── POST actions ────────────────────────────────────────────────────────
    const body = await req.json()
    const { action } = body

    // ── CREATE invitation ────────────────────────────────────────────────────
    if (action === 'create') {
      const { inviter_org_id, invitee_email, invited_by_user } = body

      if (!inviter_org_id || !invitee_email) {
        return new Response(
          JSON.stringify({ error: 'inviter_org_id and invitee_email are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate inviter is a reseller
      const { data: inviterOrg } = await supabase
        .from('organizations')
        .select('id, name, is_reseller, is_active')
        .eq('id', inviter_org_id)
        .single()

      if (!inviterOrg?.is_reseller) {
        return new Response(
          JSON.stringify({ error: 'Organization is not a reseller' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Rate limit: max 50 pending invitations
      const { count } = await supabase
        .from('reseller_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('inviter_org_id', inviter_org_id)
        .eq('status', 'pending')

      if ((count ?? 0) >= MAX_PENDING_INVITATIONS) {
        return new Response(
          JSON.stringify({ error: `Maximum ${MAX_PENDING_INVITATIONS} pending invitations reached` }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if email already has a pending invite from this org
      const { data: existing } = await supabase
        .from('reseller_invitations')
        .select('id')
        .eq('inviter_org_id', inviter_org_id)
        .eq('invitee_email', invitee_email.toLowerCase())
        .eq('status', 'pending')
        .single()

      if (existing) {
        return new Response(
          JSON.stringify({ error: 'A pending invitation already exists for this email' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: invitation, error: insertErr } = await supabase
        .from('reseller_invitations')
        .insert({
          inviter_org_id,
          invitee_email: invitee_email.toLowerCase(),
          invited_by_user,
        })
        .select()
        .single()

      if (insertErr || !invitation) {
        throw new Error(`Failed to create invitation: ${insertErr?.message}`)
      }

      // Send invite email via send-email edge function
      const appUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'https://sentinel.netneural.ai'
      const inviteUrl = `${appUrl}/auth/signup?invite=${invitation.token}&org=${inviterOrg.name.toLowerCase().replace(/\s+/g, '-')}`

      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: invitee_email,
            subject: `You've been invited to join ${inviterOrg.name} on NetNeural`,
            html: `
              <h2>You've been invited!</h2>
              <p>${inviterOrg.name} has invited you to join their reseller network on NetNeural.</p>
              <p><a href="${inviteUrl}" style="background:#06b6d4;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Accept Invitation</a></p>
              <p>This invitation expires in 14 days.</p>
            `,
          }),
        })
      } catch (emailErr) {
        console.error('Failed to send invite email:', emailErr)
        // Non-fatal — invitation still created
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            invitation_id: invitation.id,
            token:         invitation.token,
            invite_url:    inviteUrl,
            expires_at:    invitation.expires_at,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── ACCEPT invitation ────────────────────────────────────────────────────
    if (action === 'accept') {
      const { token, new_org_id, accepted_by_user } = body

      if (!token || !new_org_id) {
        return new Response(
          JSON.stringify({ error: 'token and new_org_id are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: invite } = await supabase
        .from('reseller_invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single()

      if (!invite) {
        return new Response(
          JSON.stringify({ error: 'Invalid or already used invitation' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (new Date(invite.expires_at) < new Date()) {
        await supabase.from('reseller_invitations').update({ status: 'expired' }).eq('id', invite.id)
        return new Response(
          JSON.stringify({ error: 'This invitation has expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Circular reference guard: check new org isn't already an ancestor
      const { data: tree } = await supabase
        .rpc('get_reseller_tree', { root_org_id: new_org_id })
      const descendantIds = (tree ?? []).map((n: { id: string }) => n.id)

      if (descendantIds.includes(invite.inviter_org_id)) {
        return new Response(
          JSON.stringify({ error: 'Circular reseller reference detected' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Set parent on new org
      await supabase.from('organizations')
        .update({ parent_organization_id: invite.inviter_org_id })
        .eq('id', new_org_id)

      // Mark invitation accepted
      await supabase.from('reseller_invitations').update({
        status:          'accepted',
        accepted_org_id: new_org_id,
        accepted_by_user,
        accepted_at:     new Date().toISOString(),
      }).eq('id', invite.id)

      // Notify inviter
      await supabase.from('reseller_grace_notifications').insert({
        organization_id:   invite.inviter_org_id,
        notification_type: 'new_sub_reseller_joined',
      })

      return new Response(
        JSON.stringify({ success: true, message: 'Invitation accepted', parent_org_id: invite.inviter_org_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── REVOKE invitation ────────────────────────────────────────────────────
    if (action === 'revoke') {
      const { invitation_id, inviter_org_id } = body

      await supabase.from('reseller_invitations')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('id', invitation_id)
        .eq('inviter_org_id', inviter_org_id)
        .eq('status', 'pending')

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('reseller-invite error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
