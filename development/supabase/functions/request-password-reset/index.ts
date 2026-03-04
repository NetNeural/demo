// ============================================================================
// REQUEST PASSWORD RESET — bypass Supabase rate-limited SMTP
// ============================================================================
// Public endpoint: accepts { email, redirectTo? } and sends a password-reset
// link via Resend. Uses /auth/v1/admin/generate_link so we never hit the
// Supabase built-in email rate limit.
//
// Always returns 200 to prevent email enumeration.
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  // Always respond 200 — never leak whether an email exists
  const ok = () =>
    new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const { email, redirectTo } = (await req.json()) as {
      email?: string
      redirectTo?: string
    }

    if (!email) return ok()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!supabaseUrl || !serviceKey || !resendApiKey) {
      console.error('[request-password-reset] Missing required env vars')
      return ok()
    }

    // Default redirect: guess site URL from Supabase URL pattern
    // e.g. https://bldojxpockljyivldxwf.supabase.co → sentinel.netneural.ai
    const siteUrl = Deno.env.get('SITE_URL') || redirectTo || ''

    const resetRedirect = redirectTo ||
      (siteUrl ? `${siteUrl}/auth/reset-password` : '')

    // 1. Generate a recovery link via admin API (no SMTP involved)
    // NOTE: GoTrue expects `redirect_to` at the TOP LEVEL of the body,
    //       NOT nested inside `options`. Nesting it causes GoTrue to ignore
    //       the redirect and fall back to site_url (the login page).
    const genRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/generate_link`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'recovery',
          email: email.trim().toLowerCase(),
          ...(resetRedirect ? { redirect_to: resetRedirect } : {}),
        }),
      }
    )

    if (!genRes.ok) {
      const body = await genRes.text()
      console.error(`[request-password-reset] generate_link failed: ${genRes.status} ${body}`)
      // User not found or other error — still return 200
      return ok()
    }

    const genData = await genRes.json()

    // Strategy: instead of using action_link (which hits GoTrue's GET-based
    // /auth/v1/verify endpoint and is vulnerable to email-scanner prefetching),
    // we extract the hashed_token and send the user directly to our app with
    // the token as a query param. The app then calls verifyOtp() via POST,
    // which is immune to email scanners (they only do GET requests).
    const hashedToken: string | undefined = genData?.hashed_token
    const actionLink: string = genData?.action_link || genData?.properties?.action_link

    if (!hashedToken && !actionLink) {
      console.error('[request-password-reset] No hashed_token or action_link in response', JSON.stringify(genData))
      return ok()
    }

    // Build the reset URL: prefer direct token_hash approach (POST-verified,
    // scanner-proof) with trailing slash to match Next.js trailingSlash config
    const baseRedirect = resetRedirect.endsWith('/')
      ? resetRedirect
      : `${resetRedirect}/`

    const resetUrl = hashedToken
      ? `${baseRedirect}?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`
      : actionLink // Fallback to legacy action_link if no hashed_token

    console.log(`[request-password-reset] Sending reset link to ${email} (mode: ${hashedToken ? 'token_hash' : 'action_link'})`)

    // 2. Send via Resend — no Supabase SMTP rate limits
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NetNeural Platform <noreply@netneural.ai>',
        to: [email.trim().toLowerCase()],
        subject: 'Reset Your NetNeural Password',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:8px">
            <div style="text-align:center;margin-bottom:24px">
              <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0">Reset Your Password</h1>
            </div>
            <div style="background:#ffffff;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
              <p style="color:#374151;margin:0 0 16px">You requested a password reset for your NetNeural account.</p>
              <p style="color:#374151;margin:0 0 24px">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
              <div style="text-align:center;margin-bottom:24px">
                <a href="${resetUrl}"
                   style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px">
                  Reset Password
                </a>
              </div>
              <p style="color:#6b7280;font-size:13px;margin:0">If you didn't request this, you can safely ignore this email.</p>
            </div>
            <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:20px">
              NetNeural IoT Platform · <a href="https://sentinel.netneural.ai" style="color:#9ca3af">sentinel.netneural.ai</a>
            </p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const body = await emailRes.text()
      console.error(`[request-password-reset] Resend failed: ${emailRes.status} ${body}`)
    } else {
      console.log(`[request-password-reset] Email sent to ${email}`)
    }
  } catch (err) {
    console.error('[request-password-reset] Unexpected error:', err)
  }

  return ok()
})
