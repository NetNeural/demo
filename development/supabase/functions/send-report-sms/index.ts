// ============================================================================
// SEND REPORT SMS
// ============================================================================
// Sends a text-only report summary via Twilio SMS
// Used by the SendReportDialog component when SMS channel is selected
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface SMSRequest {
  organization_id: string
  phone_numbers: string[]
  message: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const { organization_id, phone_numbers, message } =
      (await req.json()) as SMSRequest

    if (!organization_id) throw new Error('organization_id is required')
    if (!phone_numbers || phone_numbers.length === 0) {
      throw new Error('No phone numbers provided')
    }
    if (!message) throw new Error('Message is required')

    // Truncate message to SMS-friendly length (~450 chars to leave room for encoding)
    const truncatedMessage =
      message.length > 450 ? message.substring(0, 447) + '...' : message

    // Get Twilio config — first try org notification settings, then env vars
    let accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
    let authToken = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
    let fromNumber = Deno.env.get('TWILIO_FROM_NUMBER') || ''

    // Try org-specific settings
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data: org } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', organization_id)
        .maybeSingle()

      const notifSettings = org?.settings?.notification_settings
      if (notifSettings?.twilio_account_sid) {
        accountSid = notifSettings.twilio_account_sid
        authToken = notifSettings.twilio_auth_token || authToken
        fromNumber = notifSettings.twilio_from_number || fromNumber
      }
    }

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error(
        'Twilio not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER'
      )
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const authHeader = 'Basic ' + btoa(`${accountSid}:${authToken}`)

    let sentCount = 0
    const errors: string[] = []

    for (const phone of phone_numbers) {
      try {
        const params = new URLSearchParams({
          To: phone,
          From: fromNumber,
          Body: truncatedMessage,
        })

        const res = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        })

        if (res.ok) {
          sentCount++
          console.log(`[send-report-sms] SMS sent to ${phone}`)
        } else {
          const errBody = await res.json()
          errors.push(`${phone}: ${errBody.message || res.statusText}`)
          console.error(`[send-report-sms] SMS to ${phone} failed:`, errBody)
        }
      } catch (smsErr) {
        errors.push(
          `${phone}: ${smsErr instanceof Error ? smsErr.message : String(smsErr)}`
        )
      }
    }

    console.log(
      `[send-report-sms] Sent ${sentCount}/${phone_numbers.length} SMS messages`
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: `SMS sent to ${sentCount} of ${phone_numbers.length} numbers`,
        sent: sentCount,
        total: phone_numbers.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[send-report-sms] Error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
