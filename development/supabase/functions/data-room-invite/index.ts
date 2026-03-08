// ============================================================================
// DATA ROOM INVITE — Create guest accounts with Data Room-only access
// ============================================================================
// Authenticated endpoint: accepts { email, organizationId }
// - Creates or reuses an auth user for the guest
// - Adds them as 'viewer' org member (Data Room scope)
// - Creates data_room_guests record
// - Sends invitation email via Resend
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const siteUrl = Deno.env.get('SITE_URL') || ''

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)
    const supabaseUser = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Get the calling user
    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !caller) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json() as {
      email?: string
      organizationId?: string
      action?: 'invite' | 'revoke'
      guestId?: string
      accessDuration?: '24' | '48' | '72' | 'unlimited'
    }

    const { email, organizationId, action, guestId, accessDuration = 'unlimited' } = body

    if (!organizationId) {
      return jsonResponse({ error: 'organizationId is required' }, 400)
    }

    // Verify caller is admin/owner of this org
    const { data: callerMembership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', caller.id)
      .single()

    // Also check super_admin
    const { data: callerUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', caller.id)
      .single()

    const isSuperAdmin = callerUser?.role === 'super_admin'
    const isOrgAdmin = callerMembership?.role === 'owner' || callerMembership?.role === 'admin'

    if (!isSuperAdmin && !isOrgAdmin) {
      return jsonResponse({ error: 'Forbidden: admin access required' }, 403)
    }

    // ── REVOKE action ───────────────────────────────────────────────────
    if (action === 'revoke') {
      if (!email && !guestId) {
        return jsonResponse({ error: 'email or guestId required for revoke' }, 400)
      }

      // Find the guest record
      let guestQuery = supabaseAdmin
        .from('data_room_guests')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'active')

      if (guestId) {
        guestQuery = guestQuery.eq('id', guestId)
      } else if (email) {
        guestQuery = guestQuery.eq('email', email.trim().toLowerCase())
      }

      const { data: guest, error: guestError } = await guestQuery.single()
      if (guestError || !guest) {
        return jsonResponse({ error: 'Guest not found or already revoked' }, 404)
      }

      // Remove org membership
      if (guest.membership_id) {
        await supabaseAdmin
          .from('organization_members')
          .delete()
          .eq('id', guest.membership_id)
      }

      // Mark guest as revoked
      await supabaseAdmin
        .from('data_room_guests')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_by: caller.id,
        })
        .eq('id', guest.id)

      return jsonResponse({ success: true, message: 'Guest access revoked' })
    }

    // ── INVITE action (default) ─────────────────────────────────────────
    if (!email) {
      return jsonResponse({ error: 'email is required' }, 400)
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check if already invited
    const { data: existingGuest } = await supabaseAdmin
      .from('data_room_guests')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('email', normalizedEmail)
      .single()

    if (existingGuest && existingGuest.status === 'active') {
      return jsonResponse({ error: 'This email already has active access' }, 409)
    }

    // Check if user already exists in auth
    const { data: { users: existingUsers } } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingUsers?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    )

    let guestUserId: string
    let tempPassword: string | null = null

    if (existingAuthUser) {
      guestUserId = existingAuthUser.id
    } else {
      // Create a new auth user with a temporary password
      // They'll be sent a "set password" email
      tempPassword = crypto.randomUUID().slice(0, 16)
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true, // auto-confirm so they can log in
        user_metadata: { data_room_guest: true },
      })

      if (createError || !newUser?.user) {
        console.error('[data-room-invite] Failed to create user:', createError)
        return jsonResponse({ error: 'Failed to create guest account' }, 500)
      }

      guestUserId = newUser.user.id

      // Create a users table entry
      await supabaseAdmin.from('users').upsert({
        id: guestUserId,
        email: normalizedEmail,
        full_name: normalizedEmail.split('@')[0],
        role: 'viewer', // data room guests get viewer platform role; matches org membership role
      }, { onConflict: 'id' })
    }

    // Check if user already has a membership in this org (e.g. they're an owner/admin)
    const { data: existingMembership } = await supabaseAdmin
      .from('organization_members')
      .select('id, role')
      .eq('organization_id', organizationId)
      .eq('user_id', guestUserId)
      .maybeSingle()

    let membershipId: string | null = null

    if (existingMembership) {
      // User is already a member — reuse their existing membership, don't downgrade their role
      console.log(`[data-room-invite] User already a ${existingMembership.role} member, reusing membership ${existingMembership.id}`)
      membershipId = existingMembership.id
    } else {
      // Add as org member with 'viewer' role
      const { data: membership, error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: guestUserId,
          role: 'viewer',
          invited_by: caller.id,
          permissions: JSON.stringify(['data_room_only']),
        })
        .select('id')
        .single()

      if (memberError) {
        console.error('[data-room-invite] Failed to create membership:', memberError)
        return jsonResponse({ error: 'Failed to create membership' }, 500)
      }
      membershipId = membership?.id || null
    }

    // Calculate expiry
    const now = new Date()
    let expiresAt: string | null = null
    if (accessDuration !== 'unlimited') {
      const hours = parseInt(accessDuration, 10)
      expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString()
    }

    // Create or update data_room_guests record
    if (existingGuest && existingGuest.status === 'revoked') {
      // Re-invite a previously revoked guest
      await supabaseAdmin
        .from('data_room_guests')
        .update({
          status: 'active',
          user_id: guestUserId,
          invited_by: caller.id,
          membership_id: membershipId,
          activated_at: now.toISOString(),
          revoked_at: null,
          revoked_by: null,
          token: crypto.randomUUID(),
          access_duration: accessDuration,
          expires_at: expiresAt,
        })
        .eq('id', existingGuest.id)
    } else {
      // New invitation
      await supabaseAdmin
        .from('data_room_guests')
        .insert({
          organization_id: organizationId,
          email: normalizedEmail,
          user_id: guestUserId,
          invited_by: caller.id,
          status: 'active',
          membership_id: membershipId,
          activated_at: now.toISOString(),
          access_duration: accessDuration,
          expires_at: expiresAt,
        })
    }

    // Get org name for the email
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    const orgName = org?.name || 'an organization'

    // Send invitation email via Resend
    if (resendApiKey) {
      // Link directly to the data room — if user is not logged in,
      // UserProvider will redirect to login with a return URL param
      const accessUrl = siteUrl ? `${siteUrl}/dashboard/organizations/?tab=documents` : ''

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Data Room Access Granted</h2>
          <p>You've been invited to access the <strong>${orgName}</strong> Data Room on the NetNeural Sentinel platform.</p>
          ${tempPassword
            ? `<div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 8px 0; font-weight: 600;">Your temporary login credentials:</p>
                <p style="margin: 0;">Email: <strong>${normalizedEmail}</strong></p>
                <p style="margin: 0;">Password: <strong>${tempPassword}</strong></p>
                <p style="margin: 8px 0 0 0; font-size: 13px; color: #666;">Please change your password after first login.</p>
              </div>`
            : `<p>Log in with your existing account (<strong>${normalizedEmail}</strong>) to access the Data Room.</p>`
          }
          ${accessUrl
            ? `<a href="${accessUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; margin-top: 8px;">Access Data Room</a>`
            : ''
          }
          <p style="margin-top: 24px; font-size: 13px; color: #888;">This invitation was sent by ${orgName}. If you didn't expect this, you can ignore this email.</p>
        </div>
      `

      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'NetNeural Sentinel <noreply@netneural.ai>',
            to: [normalizedEmail],
            subject: `Data Room Access: ${orgName}`,
            html: emailHtml,
          }),
        })

        if (!resendRes.ok) {
          const errBody = await resendRes.text()
          console.error('[data-room-invite] Resend error:', errBody)
        }
      } catch (emailErr) {
        console.error('[data-room-invite] Email send failed:', emailErr)
        // Don't fail the invite if email fails — access is already granted
      }
    }

    return jsonResponse({
      success: true,
      message: `Guest access granted to ${normalizedEmail}`,
      isNewUser: !existingAuthUser,
    })
  } catch (err) {
    console.error('[data-room-invite] Unexpected error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
