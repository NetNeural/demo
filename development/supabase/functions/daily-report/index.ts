// ============================================================================
// DAILY PLATFORM REPORT — Automated via pg_cron
// ============================================================================
// Gathers platform-wide statistics and sends a daily summary email
// to the configured leadership distribution list.
//
// Triggered by pg_cron at 7:00 AM ET daily.
// Can also be invoked manually via POST with optional overrides.
//
// Endpoints:
//   POST /daily-report              — Generate & send the daily report
//   POST /daily-report?preview=true — Return HTML without sending
//
// Body (optional):
//   { "recipients": ["email@example.com"], "date": "2026-02-24" }
//
// Environment:
//   RESEND_API_KEY          — Resend email API key
//   SUPABASE_URL            — Project URL
//   SUPABASE_SERVICE_ROLE_KEY — Service role key
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Default recipients — leadership distribution list
const DEFAULT_RECIPIENTS = [
  'heath.scheiman@netneural.ai',
  'chris.payne@netneural.ai',
  'mike.jordan@netneural.ai',
  'matt.scholle@netneural.ai',
]

interface OrgStats {
  id: string
  name: string
  totalDevices: number
  onlineDevices: number
  offlineDevices: number
  totalUsers: number
  activeAlerts: number
  criticalAlerts: number
  highAlerts: number
  resolvedLast24h: number
  newAlertsLast24h: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Parse optional overrides
    let recipients = DEFAULT_RECIPIENTS
    let reportDate = new Date().toISOString().split('T')[0]
    const url = new URL(req.url)
    let isPreview = url.searchParams.get('preview') === 'true'
    let passthroughHtml: string | null = null
    let passthroughSubject: string | null = null

    try {
      const body = await req.json()
      if (body.recipients?.length > 0) recipients = body.recipients
      if (body.date) reportDate = body.date
      if (body.preview === true) isPreview = true
      // Pass-through mode: caller provides pre-built HTML + subject
      if (typeof body.html === 'string' && body.html.length > 0) {
        passthroughHtml = body.html
        passthroughSubject = body.subject || 'NetNeural Report'
      }
    } catch {
      /* no body — use defaults */
    }

    // ─── Pass-Through Mode ───────────────────────────────────────────
    // If the caller provides pre-built HTML, skip report generation and
    // send it directly via Resend. Used by Platform Feature Report, etc.
    if (passthroughHtml) {
      console.log(`[daily-report] Pass-through mode: sending caller-provided HTML to ${recipients.length} recipients`)

      if (isPreview) {
        return new Response(passthroughHtml, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        })
      }

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NetNeural Reports <noreply@netneural.ai>',
          to: recipients,
          subject: passthroughSubject,
          html: passthroughHtml,
        }),
      })

      const emailResult = await emailResponse.json()
      if (!emailResponse.ok) {
        console.error('[daily-report] Resend error:', JSON.stringify(emailResult))
        throw new Error(`Email send failed: ${emailResult.message || emailResponse.statusText}`)
      }

      const duration = Date.now() - startTime
      console.log(`[daily-report] Pass-through email sent in ${duration}ms. Resend ID: ${emailResult.id}`)

      try {
        await supabase.from('report_runs').insert({
          report_type: 'platform-feature-report',
          status: 'success',
          triggered_by: 'system',
          recipients,
          duration_ms: duration,
          summary: passthroughSubject,
        })
      } catch (logErr) {
        console.warn('[daily-report] Failed to log report_run:', (logErr as Error).message)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Report sent to ${recipients.length} recipients`,
          emailId: emailResult.id,
          recipients,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[daily-report] Generating report for ${reportDate}`)
    console.log(`[daily-report] Recipients: ${recipients.join(', ')}`)

    // ─── Gather Platform-Wide Stats ──────────────────────────────────

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const last48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    // 1. All organizations
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('name')

    // 2. All devices (non-deleted)
    const { data: allDevices } = await supabase
      .from('devices')
      .select('id, status, organization_id, last_seen')
      .is('deleted_at', null)

    // 3. All unresolved alerts
    const { data: unresolvedAlerts } = await supabase
      .from('alerts')
      .select('id, severity, organization_id, created_at')
      .eq('is_resolved', false)

    // 4. Alerts created in last 24h
    const { data: newAlerts } = await supabase
      .from('alerts')
      .select('id, severity, organization_id')
      .gte('created_at', last24h)

    // 5. Alerts resolved in last 24h
    const { data: resolvedAlerts } = await supabase
      .from('alerts')
      .select('id, organization_id')
      .eq('is_resolved', true)
      .gte('resolved_at', last24h)

    // 6. All users
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, organization_id')

    // 7. Previous day alerts for comparison (24-48h ago)
    const { data: prevDayAlerts } = await supabase
      .from('alerts')
      .select('id')
      .gte('created_at', last48h)
      .lt('created_at', last24h)

    // 8. Billing / subscription stats
    let billingPlanCount = 0
    let activeSubCount = 0
    let hasStripePriceIds = false
    try {
      const { count: planCount } = await supabase
        .from('billing_plans')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
      billingPlanCount = planCount || 0

      const { count: subCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
      activeSubCount = subCount || 0

      const { data: stripePlans } = await supabase
        .from('billing_plans')
        .select('stripe_price_id_monthly')
        .not('stripe_price_id_monthly', 'is', null)
        .limit(1)
      hasStripePriceIds = (stripePlans || []).length > 0
    } catch { /* billing tables may not exist */ }

    // 9. Recent GitHub accomplishments (closed issues in last 7 days)
    let recentWins: {
      title: string
      number: number
      labels: string[]
      closed_at: string
    }[] = []
    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (githubToken) {
      try {
        const sevenDaysAgo = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString()
        // Fetch up to 100 recently closed issues (handles high-velocity weeks)
        const ghResponse = await fetch(
          `https://api.github.com/repos/NetNeural/MonoRepo-Staging/issues?state=closed&since=${sevenDaysAgo}&sort=updated&direction=desc&per_page=100`,
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'NetNeural-Daily-Report',
            },
          }
        )
        if (ghResponse.ok) {
          const ghIssues = await ghResponse.json()
          recentWins = ghIssues
            .filter((i: any) => !i.pull_request) // exclude PRs
            .map((i: any) => ({
              title: i.title,
              number: i.number,
              labels: (i.labels || []).map((l: any) => l.name),
              closed_at: i.closed_at,
            }))
        } else {
          console.warn(
            '[daily-report] GitHub API error:',
            ghResponse.status,
            await ghResponse.text()
          )
        }
      } catch (ghErr) {
        console.warn('[daily-report] GitHub fetch failed:', ghErr.message)
      }
    } else {
      console.warn(
        '[daily-report] GITHUB_TOKEN not configured — skipping accomplishments'
      )
    }

    // ─── Per-Organization Breakdown ──────────────────────────────────

    const orgStats: OrgStats[] = (orgs || [])
      .map((org: any) => {
        const orgDevices = (allDevices || []).filter(
          (d: any) => d.organization_id === org.id
        )
        const orgUnresolved = (unresolvedAlerts || []).filter(
          (a: any) => a.organization_id === org.id
        )
        const orgNew = (newAlerts || []).filter(
          (a: any) => a.organization_id === org.id
        )
        const orgResolved = (resolvedAlerts || []).filter(
          (a: any) => a.organization_id === org.id
        )
        const orgMembers = (members || []).filter(
          (m: any) => m.organization_id === org.id
        )

        return {
          id: org.id,
          name: org.name,
          totalDevices: orgDevices.length,
          onlineDevices: orgDevices.filter((d: any) => d.status === 'online')
            .length,
          offlineDevices: orgDevices.filter((d: any) => d.status === 'offline')
            .length,
          totalUsers: orgMembers.length,
          activeAlerts: orgUnresolved.length,
          criticalAlerts: orgUnresolved.filter(
            (a: any) => a.severity === 'critical'
          ).length,
          highAlerts: orgUnresolved.filter((a: any) => a.severity === 'high')
            .length,
          resolvedLast24h: orgResolved.length,
          newAlertsLast24h: orgNew.length,
        }
      })
      .filter(
        (o: OrgStats) =>
          o.totalDevices > 0 || o.totalUsers > 0 || o.activeAlerts > 0
      )

    // ─── Platform Totals ─────────────────────────────────────────────

    const totalDevices = (allDevices || []).length
    const onlineDevices = (allDevices || []).filter(
      (d: any) => d.status === 'online'
    ).length
    const offlineDevices = (allDevices || []).filter(
      (d: any) => d.status === 'offline'
    ).length
    const totalUnresolved = (unresolvedAlerts || []).length
    const totalCritical = (unresolvedAlerts || []).filter(
      (a: any) => a.severity === 'critical'
    ).length
    const totalHigh = (unresolvedAlerts || []).filter(
      (a: any) => a.severity === 'high'
    ).length
    const totalNew24h = (newAlerts || []).length
    const totalResolved24h = (resolvedAlerts || []).length
    const prevDayCount = (prevDayAlerts || []).length
    const alertTrend =
      prevDayCount > 0
        ? (((totalNew24h - prevDayCount) / prevDayCount) * 100).toFixed(0)
        : '0'
    const uptimePct =
      totalDevices > 0
        ? ((onlineDevices / totalDevices) * 100).toFixed(1)
        : '0.0'

    // Unique user count
    const uniqueUsers = new Set((members || []).map((m: any) => m.user_id)).size

    // System health
    let healthStatus = '🟢 Healthy'
    let healthColor = '#10b981'
    if (totalCritical > 0) {
      healthStatus = '🔴 Critical'
      healthColor = '#ef4444'
    } else if (totalHigh > 3 || offlineDevices > totalDevices * 0.2) {
      healthStatus = '🟡 Warning'
      healthColor = '#f59e0b'
    } else if (offlineDevices > 0) {
      healthStatus = '🟡 Degraded'
      healthColor = '#f59e0b'
    }

    // ─── Build HTML Email ────────────────────────────────────────────

    const reportDateFormatted = new Date(
      reportDate + 'T12:00:00Z'
    ).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const orgRowsHtml = orgStats
      .map(
        (org) => `
      <tr>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-weight:500;">${org.name}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${org.totalDevices}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:${org.onlineDevices === org.totalDevices ? '#10b981' : '#f59e0b'};">${org.onlineDevices}/${org.totalDevices}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${org.totalUsers}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:${org.criticalAlerts > 0 ? '#ef4444' : org.activeAlerts > 0 ? '#f59e0b' : '#10b981'}; font-weight:${org.criticalAlerts > 0 ? 'bold' : 'normal'};">${org.activeAlerts}${org.criticalAlerts > 0 ? ` (${org.criticalAlerts} crit)` : ''}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${org.newAlertsLast24h}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">${org.resolvedLast24h}</td>
      </tr>
    `
      )
      .join('')

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; line-height:1.5; color:#1f2937; margin:0; padding:0; background:#f3f4f6;">
<div style="max-width:700px; margin:0 auto; background:white;">
  <div style="background-color:#1a1a2e; color:white; padding:30px; text-align:center;">
    <h1 style="margin:0 0 5px; font-size:24px; color:white;">NetNeural Daily Platform Report</h1>
    <p style="margin:0; opacity:0.8; font-size:14px;">${reportDateFormatted}</p>
    <div style="display:inline-block; padding:6px 16px; border-radius:20px; font-weight:600; font-size:14px; margin-top:12px; background-color:#f3f4f6; color:${healthColor}; border:1px solid ${healthColor};">
      ${healthStatus}
    </div>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:20px;">
    <tr>
      <td width="20%" style="padding:6px; vertical-align:top;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
          <tr><td style="padding:16px; text-align:center;">
            <div style="font-size:28px; font-weight:700; color:#1a1a2e;">${totalDevices}</div>
            <div style="font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">Total Devices</div>
            <div style="font-size:11px; color:#9ca3af; margin-top:2px;">${uptimePct}% uptime</div>
          </td></tr>
        </table>
      </td>
      <td width="20%" style="padding:6px; vertical-align:top;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
          <tr><td style="padding:16px; text-align:center;">
            <div style="font-size:28px; font-weight:700; color:${onlineDevices === totalDevices ? '#10b981' : '#f59e0b'};">${onlineDevices}</div>
            <div style="font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">Online</div>
            <div style="font-size:11px; color:#9ca3af; margin-top:2px;">${offlineDevices} offline</div>
          </td></tr>
        </table>
      </td>
      <td width="20%" style="padding:6px; vertical-align:top;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
          <tr><td style="padding:16px; text-align:center;">
            <div style="font-size:28px; font-weight:700; color:${totalUnresolved > 0 ? '#ef4444' : '#10b981'};">${totalUnresolved}</div>
            <div style="font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">Active Alerts</div>
            <div style="font-size:11px; color:#9ca3af; margin-top:2px;">${totalCritical} critical, ${totalHigh} high</div>
          </td></tr>
        </table>
      </td>
      <td width="20%" style="padding:6px; vertical-align:top;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
          <tr><td style="padding:16px; text-align:center;">
            <div style="font-size:28px; font-weight:700; color:#1a1a2e;">${totalNew24h}</div>
            <div style="font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">New (24h)</div>
            <div style="font-size:11px; color:#9ca3af; margin-top:2px;"><span style="color:${parseInt(alertTrend) > 0 ? '#ef4444' : parseInt(alertTrend) < 0 ? '#10b981' : '#6b7280'};">${parseInt(alertTrend) > 0 ? '↑' : parseInt(alertTrend) < 0 ? '↓' : '→'} ${Math.abs(parseInt(alertTrend))}% vs prev day</span></div>
          </td></tr>
        </table>
      </td>
      <td width="20%" style="padding:6px; vertical-align:top;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
          <tr><td style="padding:16px; text-align:center;">
            <div style="font-size:28px; font-weight:700; color:#10b981;">${totalResolved24h}</div>
            <div style="font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">Resolved (24h)</div>
            <div style="font-size:11px; color:#9ca3af; margin-top:2px;">${uniqueUsers} active users</div>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>

  <div style="padding:0 20px 20px;">
    <h2 style="font-size:16px; color:#1a1a2e; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin:20px 0 12px;">Organization Breakdown</h2>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <thead>
        <tr>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Organization</th>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Devices</th>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Online</th>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Users</th>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Active Alerts</th>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">New (24h)</th>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Resolved (24h)</th>
        </tr>
      </thead>
      <tbody>
        ${orgRowsHtml}
      </tbody>
    </table>
  </div>

  ${
    recentWins.length > 0
      ? `
  <div style="padding:0 20px 20px;">
    <h2 style="font-size:16px; color:#1a1a2e; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin:20px 0 12px;">🎯 Recent Wins & Accomplishments (Last 7 Days)</h2>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <thead>
        <tr>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb; width:50px;">Ticket</th>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Accomplishment</th>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb; width:80px;">Type</th>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb; width:90px;">Closed</th>
        </tr>
      </thead>
      <tbody>
        ${recentWins
          .slice(0, 15)
          .map((w) => {
            const isBug = w.labels.some((l) => l.toLowerCase().includes('bug'))
            const isFeature = w.labels.some(
              (l) =>
                l.toLowerCase().includes('feature') ||
                l.toLowerCase().includes('enhancement')
            )
            const typeIcon = isBug
              ? '🐛 Bug Fix'
              : isFeature
                ? '✨ Feature'
                : '📋 Task'
            const typeColor = isBug
              ? '#ef4444'
              : isFeature
                ? '#8b5cf6'
                : '#6b7280'
            const closedDate = new Date(w.closed_at).toLocaleDateString(
              'en-US',
              { month: 'short', day: 'numeric' }
            )
            return `
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center;"><a href="https://github.com/NetNeural/MonoRepo-Staging/issues/${w.number}" style="color:#2563eb; text-decoration:none; font-weight:600;">#${w.number}</a></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;">${w.title}</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-size:11px; color:${typeColor};">${typeIcon}</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-size:12px; color:#6b7280;">${closedDate}</td>
        </tr>`
          })
          .join('')}
      </tbody>
    </table>
    <p style="font-size:12px; color:#9ca3af; margin-top:8px;">${recentWins.length} ticket${recentWins.length !== 1 ? 's' : ''} closed this week — <a href="https://github.com/NetNeural/MonoRepo-Staging/issues?q=is%3Aissue+is%3Aclosed+sort%3Aupdated-desc" style="color:#2563eb;">View all on GitHub →</a></p>
  </div>`
      : ''
  }

  <div style="padding:0 20px 20px;">
    <h2 style="font-size:16px; color:#1a1a2e; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin:20px 0 12px;">🏆 Top 12 Key Features — Already Live</h2>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <thead>
        <tr>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb; width:30px;">#</th>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Feature</th>
          <th style="background:#f3f4f6; padding:10px 12px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">1</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Real-Time IoT Device Monitoring</strong><br><span style="font-size:11px; color:#6b7280;">Live status, telemetry streaming, last-seen tracking across all organizations</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">2</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Multi-Org Management &amp; RBAC</strong><br><span style="font-size:11px; color:#6b7280;">Role-based access (super_admin, admin, member), org switching, Row-Level Security</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">3</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Smart Alert System with Escalation</strong><br><span style="font-size:11px; color:#6b7280;">Threshold-based alerts, severity tiers, escalation rules, timeline tracking, snooze</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">4</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Multi-Channel Notifications</strong><br><span style="font-size:11px; color:#6b7280;">Email, SMS (Twilio), Slack alerts with deep links directly to alert detail</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">5</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>56 Serverless Edge Functions</strong><br><span style="font-size:11px; color:#6b7280;">Deno-based compute for auth, CRUD, analytics, billing, integrations, cron jobs</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">6</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Stripe Billing &amp; Subscriptions</strong><br><span style="font-size:11px; color:#6b7280;">3-tier pricing (Monitor/Protect/Command), Stripe Checkout, webhooks, customer portal, usage metering</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">7</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Feedback System with GitHub Sync</strong><br><span style="font-size:11px; color:#6b7280;">User feedback → auto-creates GitHub issues, bidirectional sync, edit/reply</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">8</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Automated Daily Platform Reports</strong><br><span style="font-size:11px; color:#6b7280;">Cron-driven daily email digest to leadership with health, stats, trends</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">9</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Golioth IoT Cloud Integration</strong><br><span style="font-size:11px; color:#6b7280;">Device provisioning, LightDB state/stream, OTA updates, fleet management</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">10</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Device Transfer Between Orgs</strong><br><span style="font-size:11px; color:#6b7280;">Drag-and-drop device reassignment with full audit trail and data migration</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">11</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Screenshot Upload &amp; Evidence Capture</strong><br><span style="font-size:11px; color:#6b7280;">Attach screenshots to feedback with Supabase Storage, auto-linked to issues</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">12</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>3-Environment Deployment Pipeline</strong><br><span style="font-size:11px; color:#6b7280;">Dev → Staging → Production with GitHub Actions, branch protection, 22 managed secrets</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Billing & Revenue -->
  <div style="padding:0 20px 20px;">
    <h2 style="font-size:16px; color:#1a1a2e; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin:20px 0 12px;">💰 Billing & Revenue</h2>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <tr>
        <td style="padding:8px 12px; text-align:center; width:33%;">
          <div style="font-size:22px; font-weight:700; color:${hasStripePriceIds ? '#10b981' : '#f59e0b'};">${hasStripePriceIds ? '✅ Live' : '⏳ Pending'}</div>
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase; margin-top:4px;">Stripe</div>
        </td>
        <td style="padding:8px 12px; text-align:center; width:33%;">
          <div style="font-size:22px; font-weight:700; color:#1a1a2e;">${billingPlanCount}</div>
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase; margin-top:4px;">Active Plans</div>
        </td>
        <td style="padding:8px 12px; text-align:center; width:33%;">
          <div style="font-size:22px; font-weight:700; color:${activeSubCount > 0 ? '#10b981' : '#1a1a2e'};">${activeSubCount}</div>
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase; margin-top:4px;">Subscriptions</div>
        </td>
      </tr>
    </table>
  </div>

  <div style="padding:0 20px 20px;">
    <h2 style="font-size:16px; color:#1a1a2e; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin:20px 0 12px;">Quick Links</h2>
    <p style="font-size:14px;">
      <a href="https://demo-stage.netneural.ai/dashboard" style="color:#2563eb; text-decoration:none;">📊 Dashboard</a> &nbsp;|&nbsp;
      <a href="https://demo-stage.netneural.ai/dashboard/alerts" style="color:#2563eb; text-decoration:none;">🔔 Alerts</a> &nbsp;|&nbsp;
      <a href="https://demo-stage.netneural.ai/dashboard/devices" style="color:#2563eb; text-decoration:none;">📱 Devices</a> &nbsp;|&nbsp;
      <a href="https://demo-stage.netneural.ai/dashboard/feedback" style="color:#2563eb; text-decoration:none;">💬 Feedback</a>
    </p>
  </div>

  <div style="background:#f9fafb; padding:20px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb;">
    <p>Automated daily report from <strong>NetNeural Sentinel Platform</strong></p>
    <p>Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</p>
    <p style="margin-top:8px; font-size:11px;">To modify recipients or schedule, update the <code>daily-report</code> edge function configuration.</p>
  </div>
</div>
</body>
</html>`

    // ─── Preview Mode ────────────────────────────────────────────────
    if (isPreview) {
      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      })
    }

    // ─── Send via Resend ─────────────────────────────────────────────

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NetNeural Reports <noreply@netneural.ai>',
        to: recipients,
        subject: `${healthStatus} NetNeural Daily Report — ${reportDateFormatted}`,
        html,
      }),
    })

    const emailResult = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('[daily-report] Resend error:', JSON.stringify(emailResult))
      throw new Error(
        `Email send failed: ${emailResult.message || emailResponse.statusText}`
      )
    }

    const duration = Date.now() - startTime
    console.log(
      `[daily-report] Report sent in ${duration}ms to ${recipients.length} recipients. Resend ID: ${emailResult.id}`
    )

    // Log to report_runs for history tracking
    try {
      await supabase.from('report_runs').insert({
        report_type: 'daily-report',
        status: 'success',
        triggered_by: 'system',
        recipients,
        duration_ms: duration,
        summary: `${healthStatus} — ${totalDevices} devices (${uptimePct}% uptime), ${totalUnresolved} active alerts (${totalCritical} critical), ${totalResolved24h} resolved in 24h`,
        details: {
          totalDevices,
          onlineDevices,
          offlineDevices,
          totalUnresolved,
          totalCritical,
          totalNew24h,
          totalResolved24h,
          organizationCount: orgStats.length,
          healthStatus,
          uniqueUsers,
          billingPlanCount,
          activeSubCount,
          recentWinsCount: recentWins.length,
        },
      })
    } catch (logErr) {
      console.warn('[daily-report] Failed to log report_run:', (logErr as Error).message)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily report sent to ${recipients.length} recipients`,
        emailId: emailResult.id,
        recipients,
        stats: {
          totalDevices,
          onlineDevices,
          totalUnresolved,
          totalCritical,
          totalNew24h,
          totalResolved24h,
          organizationCount: orgStats.length,
          healthStatus,
        },
        durationMs: duration,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[daily-report] Error:', error.message)

    // Log failure to report_runs
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && serviceKey) {
        const sb = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        await sb.from('report_runs').insert({
          report_type: 'daily-report',
          status: 'error',
          triggered_by: 'system',
          error_message: error.message,
          duration_ms: Date.now() - startTime,
        })
      }
    } catch { /* best effort */ }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
