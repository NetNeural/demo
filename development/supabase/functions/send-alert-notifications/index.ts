import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { Resend } from 'npm:resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  alert_id: string
  threshold_id?: string
  // Override channels — if not provided, reads from threshold
  channels?: ('email' | 'slack' | 'sms')[]
  // Email recipients
  recipient_emails?: string[]
  recipient_user_ids?: string[]
  // SMS recipients
  recipient_phone_numbers?: string[]
  // Slack override
  slack_webhook_url?: string
}

interface NotificationResult {
  channel: string
  success: boolean
  detail?: string
  error?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────

function supabaseHeaders(serviceKey: string) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }
}

async function fetchAlert(
  supabaseUrl: string,
  serviceKey: string,
  alertId: string
) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/alerts?id=eq.${alertId}&select=*,devices!alerts_device_id_fkey(name,device_type,organization_id,location_id,locations!devices_location_id_fkey(name,address,city,state,country))`,
    { headers: supabaseHeaders(serviceKey) }
  )
  const alerts = await res.json()
  return alerts?.[0] || null
}

async function fetchThreshold(
  supabaseUrl: string,
  serviceKey: string,
  thresholdId: string
) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/sensor_thresholds?id=eq.${thresholdId}&select=*`,
    { headers: supabaseHeaders(serviceKey) }
  )
  const thresholds = await res.json()
  return thresholds?.[0] || null
}

async function fetchOrgSettings(
  supabaseUrl: string,
  serviceKey: string,
  orgId: string
) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/organizations?id=eq.${orgId}&select=settings`,
    { headers: supabaseHeaders(serviceKey) }
  )
  const orgs = await res.json()
  return orgs?.[0]?.settings?.notification_settings || {}
}

async function resolveUserEmails(
  supabaseUrl: string,
  serviceKey: string,
  userIds: string[]
): Promise<string[]> {
  if (!userIds?.length) return []
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_user_emails`, {
    method: 'POST',
    headers: supabaseHeaders(serviceKey),
    body: JSON.stringify({ user_ids: userIds }),
  })
  if (!res.ok) return []
  const records = await res.json()
  return records.map((r: { email: string }) => r.email).filter(Boolean)
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/[\s\-().]/g, '')
}

async function resolveUserPhoneNumbers(
  supabaseUrl: string,
  serviceKey: string,
  userIds: string[]
): Promise<string[]> {
  if (!userIds?.length) return []

  const sanitizedIds = userIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0)

  if (!sanitizedIds.length) return []

  const idFilter = sanitizedIds.join(',')

  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?id=in.(${idFilter})&select=id,phone_number,phone_number_secondary,phone_sms_enabled,phone_secondary_sms_enabled`,
    { headers: supabaseHeaders(serviceKey) }
  )

  if (!res.ok) {
    console.error(
      `[send-alert-notifications] Failed to resolve SMS numbers from users: ${res.status} ${res.statusText}`
    )
    return []
  }

  const users = await res.json()
  const phoneNumbers: string[] = []

  for (const user of users as Array<{
    phone_number?: string | null
    phone_number_secondary?: string | null
    phone_sms_enabled?: boolean | null
    phone_secondary_sms_enabled?: boolean | null
  }>) {
    if (user.phone_sms_enabled && user.phone_number) {
      phoneNumbers.push(normalizePhoneNumber(user.phone_number))
    }

    if (user.phone_secondary_sms_enabled && user.phone_number_secondary) {
      phoneNumbers.push(normalizePhoneNumber(user.phone_number_secondary))
    }
  }

  return phoneNumbers.filter(Boolean)
}

// ─── Email via Resend ─────────────────────────────────────────────────

async function sendEmailNotification(
  alert: Record<string, unknown>,
  recipientEmails: string[],
  recipientUserIds: string[],
  supabaseUrl: string,
  serviceKey: string
): Promise<NotificationResult> {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return {
        channel: 'email',
        success: false,
        error: 'RESEND_API_KEY not configured',
      }
    }

    // Resolve user IDs → emails
    const userEmails = await resolveUserEmails(
      supabaseUrl,
      serviceKey,
      recipientUserIds
    )
    const allEmails = [...new Set([...recipientEmails, ...userEmails])]

    if (allEmails.length === 0) {
      return {
        channel: 'email',
        success: true,
        detail: 'No email recipients configured',
      }
    }

    // Call existing send-alert-email edge function (it has the HTML template)
    const emailRes = await fetch(
      `${supabaseUrl}/functions/v1/send-alert-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          alert_id: (alert as { id: string }).id,
          recipient_emails: allEmails,
          recipient_user_ids: [], // Already resolved above
        }),
      }
    )

    const emailResult = await emailRes.json()
    return {
      channel: 'email',
      success: emailResult.success && emailResult.sent > 0,
      detail: `Sent to ${emailResult.sent || 0}/${emailResult.total || allEmails.length} recipients`,
      error: emailResult.error,
    }
  } catch (err) {
    return {
      channel: 'email',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Slack via Incoming Webhook ───────────────────────────────────────

function buildSlackBlocks(alert: Record<string, unknown>) {
  const device = (
    alert as {
      devices?: {
        name?: string
        device_type?: string
        locations?: { name?: string }
      }
    }
  ).devices
  const isTest =
    (alert as { metadata?: { is_test?: boolean } }).metadata?.is_test || false
  const severity = (alert as { severity: string }).severity
  const title = (alert as { title: string }).title
  const message = (alert as { message: string }).message

  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    warning: '🟡',
    medium: '🟡',
    low: '🟢',
    info: '🔵',
  }

  const emoji = severityEmoji[severity] || '⚪'

  return {
    text: `${isTest ? '🧪 TEST: ' : ''}${emoji} ${title}`,
    blocks: [
      ...(isTest
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '⚠️ *THIS IS A TEST ALERT — No action required*',
              },
            },
          ]
        : []),
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Severity:*\n${severity.toUpperCase()}` },
          { type: 'mrkdwn', text: `*Device:*\n${device?.name || 'Unknown'}` },
          ...(device?.device_type
            ? [{ type: 'mrkdwn', text: `*Type:*\n${device.device_type}` }]
            : []),
          ...(device?.locations?.name
            ? [
                {
                  type: 'mrkdwn',
                  text: `*Location:*\n${device.locations.name}`,
                },
              ]
            : []),
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Details:*\n${message.substring(0, 500)}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Alert ID: \`${(alert as { id: string }).id}\` | ${new Date((alert as { created_at: string }).created_at).toLocaleString()}`,
          },
        ],
      },
      ...(isTest
        ? []
        : [
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '📊 View in Dashboard',
                    emoji: true,
                  },
                  url: `https://demo-stage.netneural.ai/dashboard/alerts?alertId=${(alert as { id: string }).id}`,
                  style: 'primary',
                },
              ],
            },
          ]),
    ],
  }
}

async function sendSlackNotification(
  alert: Record<string, unknown>,
  webhookUrl: string
): Promise<NotificationResult> {
  try {
    if (!webhookUrl) {
      return {
        channel: 'slack',
        success: false,
        error: 'No Slack webhook URL configured',
      }
    }

    const payload = buildSlackBlocks(alert)
    console.log('[send-alert-notifications] Posting to Slack webhook')

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return {
        channel: 'slack',
        success: false,
        error: `Slack webhook returned ${res.status}: ${errorText}`,
      }
    }

    return {
      channel: 'slack',
      success: true,
      detail: 'Message posted to Slack',
    }
  } catch (err) {
    return {
      channel: 'slack',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── SMS via Twilio ───────────────────────────────────────────────────

async function sendSmsNotification(
  alert: Record<string, unknown>,
  phoneNumbers: string[],
  twilioConfig: { account_sid: string; auth_token: string; from_number: string }
): Promise<NotificationResult> {
  try {
    const { account_sid, auth_token, from_number } = twilioConfig

    if (!account_sid || !auth_token || !from_number) {
      return {
        channel: 'sms',
        success: false,
        error:
          'Twilio not configured — set account_sid, auth_token, from_number in org notification settings',
      }
    }

    if (!phoneNumbers?.length) {
      return {
        channel: 'sms',
        success: true,
        detail: 'No SMS recipients configured',
      }
    }

    const isTest =
      (alert as { metadata?: { is_test?: boolean } }).metadata?.is_test || false
    const severity = (alert as { severity: string }).severity
    const title = (alert as { title: string }).title
    const device = (alert as { devices?: { name?: string } }).devices

    const alertId = (alert as { id: string }).id
    const smsBody = [
      isTest ? '🧪 TEST ALERT' : `⚠️ ${severity.toUpperCase()} ALERT`,
      title,
      device?.name ? `Device: ${device.name}` : '',
      '',
      `View: https://demo-stage.netneural.ai/dashboard/alerts?alertId=${alertId}`,
    ]
      .filter(Boolean)
      .join('\n')

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`
    const authHeader = 'Basic ' + btoa(`${account_sid}:${auth_token}`)

    let sentCount = 0
    const errors: string[] = []

    for (const phone of phoneNumbers) {
      try {
        const params = new URLSearchParams({
          To: phone,
          From: from_number,
          Body: smsBody,
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
          console.log(`[send-alert-notifications] SMS sent to ${phone}`)
        } else {
          const errBody = await res.json()
          errors.push(`${phone}: ${errBody.message || res.statusText}`)
          console.error(
            `[send-alert-notifications] SMS to ${phone} failed:`,
            errBody
          )
        }
      } catch (smsErr) {
        errors.push(
          `${phone}: ${smsErr instanceof Error ? smsErr.message : String(smsErr)}`
        )
      }
    }

    return {
      channel: 'sms',
      success: sentCount > 0,
      detail: `Sent ${sentCount}/${phoneNumbers.length} SMS`,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    }
  } catch (err) {
    return {
      channel: 'sms',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const body: NotificationRequest = await req.json()
    const { alert_id, threshold_id, channels: overrideChannels } = body

    if (!alert_id) {
      return new Response(JSON.stringify({ error: 'alert_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(
      `[send-alert-notifications] Processing alert=${alert_id}, threshold=${threshold_id}`
    )

    // 1. Fetch alert details (including device + location)
    const alert = await fetchAlert(supabaseUrl, serviceKey, alert_id)
    if (!alert) {
      return new Response(JSON.stringify({ error: 'Alert not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Determine organization
    const orgId = alert.organization_id || alert.devices?.organization_id
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'Cannot determine organization for alert' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 3. Fetch threshold (for notification_channels, recipients)
    let threshold: Record<string, unknown> | null = null
    if (threshold_id) {
      threshold = await fetchThreshold(supabaseUrl, serviceKey, threshold_id)
    }

    // 4. Fetch org notification settings (Slack webhook, Twilio creds)
    const orgNotifSettings = await fetchOrgSettings(
      supabaseUrl,
      serviceKey,
      orgId
    )

    // 5. Determine which channels to use
    const channels: string[] = overrideChannels ||
      (threshold?.notification_channels as string[]) || ['email'] // Default to email only

    console.log(`[send-alert-notifications] Channels: ${channels.join(', ')}`)

    // 6. Collect recipients from request + threshold
    const recipientEmails: string[] = [
      ...(body.recipient_emails || []),
      ...((threshold?.notify_emails as string[]) || []),
    ]
    const recipientUserIds: string[] = [
      ...(body.recipient_user_ids || []),
      ...((threshold?.notify_user_ids as string[]) || []),
    ]
    const recipientPhones: string[] = [
      ...(body.recipient_phone_numbers || []),
      ...((threshold?.notify_phone_numbers as string[]) || []),
    ].map(normalizePhoneNumber)

    // Deduplicate first (before resolving phone numbers from user IDs)
    const uniqueEmails = [...new Set(recipientEmails)]
    const uniqueUserIds = [...new Set(recipientUserIds)]

    // Resolve user IDs → phone numbers (must come after uniqueUserIds is declared)
    const recipientPhonesFromUsers = await resolveUserPhoneNumbers(
      supabaseUrl,
      serviceKey,
      uniqueUserIds
    )

    const uniquePhones = [
      ...new Set([...recipientPhones, ...recipientPhonesFromUsers]),
    ]

    // 7. Dispatch to each channel
    const results: NotificationResult[] = []

    if (channels.includes('email')) {
      const emailResult = await sendEmailNotification(
        alert,
        uniqueEmails,
        uniqueUserIds,
        supabaseUrl,
        serviceKey
      )
      results.push(emailResult)
      console.log(`[send-alert-notifications] Email result:`, emailResult)
    }

    if (channels.includes('slack')) {
      const slackUrl =
        body.slack_webhook_url || orgNotifSettings.slack_webhook_url
      const slackResult = await sendSlackNotification(alert, slackUrl)
      results.push(slackResult)
      console.log(`[send-alert-notifications] Slack result:`, slackResult)
    }

    if (channels.includes('sms')) {
      const twilioConfig = {
        account_sid:
          orgNotifSettings.twilio_account_sid ||
          orgNotifSettings.twilioAccountSid ||
          Deno.env.get('TWILIO_ACCOUNT_SID') ||
          '',
        auth_token:
          orgNotifSettings.twilio_auth_token ||
          orgNotifSettings.twilioAuthToken ||
          Deno.env.get('TWILIO_AUTH_TOKEN') ||
          '',
        from_number:
          orgNotifSettings.twilio_from_number ||
          orgNotifSettings.twilioFromNumber ||
          Deno.env.get('TWILIO_FROM_NUMBER') ||
          '',
      }
      const smsResult = await sendSmsNotification(
        alert,
        uniquePhones,
        twilioConfig
      )
      results.push(smsResult)
      console.log(`[send-alert-notifications] SMS result:`, smsResult)
    }

    // 8. Summary
    const successCount = results.filter((r) => r.success).length
    const totalChannels = results.length

    return new Response(
      JSON.stringify({
        success: true,
        channels_dispatched: totalChannels,
        channels_succeeded: successCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[send-alert-notifications] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
