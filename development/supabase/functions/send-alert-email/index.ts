import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { Resend } from 'npm:resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  alert_id: string
  threshold_id?: string
  recipient_emails?: string[]
  recipient_user_ids?: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const { alert_id, threshold_id, recipient_emails, recipient_user_ids } = await req.json() as EmailRequest

    console.log('[send-alert-email] Processing alert:', alert_id)

    // Get the alert details from database
    const alertResponse = await fetch(`${supabaseUrl}/rest/v1/alerts?id=eq.${alert_id}&select=*,devices!alerts_device_id_fkey(name,device_type)`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    })

    const alerts = await alertResponse.json()
    const alert = alerts[0]

    if (!alert) {
      throw new Error('Alert not found')
    }

    const device = alert.devices

    // Collect all recipient emails
    const allEmails: string[] = []

    // Add manual emails
    if (recipient_emails && recipient_emails.length > 0) {
      allEmails.push(...recipient_emails)
    }

    // Fetch emails for user IDs from auth.users using RPC
    if (recipient_user_ids && recipient_user_ids.length > 0) {
      console.log(`[send-alert-email] Fetching emails for ${recipient_user_ids.length} user IDs:`, recipient_user_ids)
      
      const emailsResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_user_emails`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_ids: recipient_user_ids }),
        }
      )
      
      if (emailsResponse.ok) {
        const emailRecords = await emailsResponse.json()
        const fetchedEmails = emailRecords.map((r: any) => r.email).filter(Boolean)
        console.log(`[send-alert-email] Found ${fetchedEmails.length} emails from auth.users:`, fetchedEmails)
        allEmails.push(...fetchedEmails)
      } else {
        const errorText = await emailsResponse.text()
        console.error(`[send-alert-email] Error fetching user emails: ${emailsResponse.status} ${emailsResponse.statusText}`, errorText)
      }
    }

    if (allEmails.length === 0) {
      console.log('[send-alert-email] No recipients found, skipping email')
      return new Response(
        JSON.stringify({ success: true, message: 'No recipients configured', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Remove duplicates
    const uniqueEmails = [...new Set(allEmails)]

    console.log(`[send-alert-email] Sending to ${uniqueEmails.length} recipient(s)`)

    // Determine if this is a test alert
    const isTest = alert.metadata?.is_test || false
    const testPrefix = isTest ? '🧪 TEST: ' : ''
    
    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${alert.severity === 'critical' ? '#dc2626' : alert.severity === 'high' ? '#ea580c' : '#0ea5e9'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
    .alert-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${alert.severity === 'critical' ? '#dc2626' : '#0ea5e9'}; border-radius: 4px; }
    .device-info { background: #e0f2fe; padding: 10px; border-radius: 4px; margin: 10px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
    .test-notice { background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    ${isTest ? `
    <div class="test-notice">
      <strong>⚠️ THIS IS A TEST ALERT</strong><br>
      This email is a test of the alert notification system. No action is required.
    </div>
    ` : ''}
    
    <div class="header">
      <h2>${testPrefix}${alert.title}</h2>
      <div style="margin-top: 10px;">
        <strong>Severity:</strong> ${alert.severity.toUpperCase()}
      </div>
    </div>
    
    <div class="content">
      <div class="device-info">
        <strong>Device:</strong> ${device?.name || 'Unknown'}<br>
        <strong>Type:</strong> ${device?.device_type || 'N/A'}
      </div>
      
      <div class="alert-box">
        <strong>Alert Details:</strong><br>
        ${alert.message.replace(/\n/g, '<br>')}
      </div>
      
      <div style="margin-top: 20px;">
        <strong>Alert ID:</strong> ${alert.id}<br>
        <strong>Time:</strong> ${new Date(alert.created_at).toLocaleString()}
      </div>
      
      ${!isTest ? `
      <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 4px;">
        <a href="https://demo-stage.netneural.ai/dashboard/alerts/" 
           style="display: inline-block; background: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          View Alert in Dashboard
        </a>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      NetNeural IoT Platform - Automated Alert Notification<br>
      <a href="https://demo-stage.netneural.ai">https://demo-stage.netneural.ai</a>
    </div>
  </div>
</body>
</html>
    `

    // Send emails
    const results = []
    for (const email of uniqueEmails) {
      try {
        const { data, error } = await resend.emails.send({
          from: 'NetNeural Alerts <alerts@netneural.ai>',
          to: email,
          subject: `${testPrefix}${alert.severity.toUpperCase()} Alert: ${alert.title}`,
          html: emailHtml,
        })

        if (error) {
          console.error(`[send-alert-email] Error sending to ${email}:`, error)
          results.push({ email, success: false, error: error.message })
        } else {
          console.log(`[send-alert-email] Sent to ${email}, ID: ${data?.id}`)
          results.push({ email, success: true, id: data?.id })
        }
      } catch (error) {
        console.error(`[send-alert-email] Exception sending to ${email}:`, error)
        results.push({ email, success: false, error: String(error) })
      }
    }

    const successCount = results.filter(r => r.success).length

    return new Response(
      JSON.stringify({ success: true, sent: successCount, total: uniqueEmails.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[send-alert-email] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
