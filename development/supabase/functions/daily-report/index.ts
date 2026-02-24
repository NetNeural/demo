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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const isPreview = url.searchParams.get('preview') === 'true'

    try {
      const body = await req.json()
      if (body.recipients?.length > 0) recipients = body.recipients
      if (body.date) reportDate = body.date
    } catch { /* no body — use defaults */ }

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

    // 8. Recent GitHub accomplishments (closed issues in last 7 days)
    let recentWins: { title: string; number: number; labels: string[]; closed_at: string }[] = []
    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (githubToken) {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const ghResponse = await fetch(
          `https://api.github.com/repos/NetNeural/MonoRepo-Staging/issues?state=closed&since=${sevenDaysAgo}&sort=updated&direction=desc&per_page=50`,
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
          console.warn('[daily-report] GitHub API error:', ghResponse.status, await ghResponse.text())
        }
      } catch (ghErr) {
        console.warn('[daily-report] GitHub fetch failed:', ghErr.message)
      }
    } else {
      console.warn('[daily-report] GITHUB_TOKEN not configured — skipping accomplishments')
    }

    // ─── Per-Organization Breakdown ──────────────────────────────────

    const orgStats: OrgStats[] = (orgs || []).map((org: any) => {
      const orgDevices = (allDevices || []).filter((d: any) => d.organization_id === org.id)
      const orgUnresolved = (unresolvedAlerts || []).filter((a: any) => a.organization_id === org.id)
      const orgNew = (newAlerts || []).filter((a: any) => a.organization_id === org.id)
      const orgResolved = (resolvedAlerts || []).filter((a: any) => a.organization_id === org.id)
      const orgMembers = (members || []).filter((m: any) => m.organization_id === org.id)

      return {
        id: org.id,
        name: org.name,
        totalDevices: orgDevices.length,
        onlineDevices: orgDevices.filter((d: any) => d.status === 'online').length,
        offlineDevices: orgDevices.filter((d: any) => d.status === 'offline').length,
        totalUsers: orgMembers.length,
        activeAlerts: orgUnresolved.length,
        criticalAlerts: orgUnresolved.filter((a: any) => a.severity === 'critical').length,
        highAlerts: orgUnresolved.filter((a: any) => a.severity === 'high').length,
        resolvedLast24h: orgResolved.length,
        newAlertsLast24h: orgNew.length,
      }
    }).filter((o: OrgStats) => o.totalDevices > 0 || o.totalUsers > 0 || o.activeAlerts > 0)

    // ─── Platform Totals ─────────────────────────────────────────────

    const totalDevices = (allDevices || []).length
    const onlineDevices = (allDevices || []).filter((d: any) => d.status === 'online').length
    const offlineDevices = (allDevices || []).filter((d: any) => d.status === 'offline').length
    const totalUnresolved = (unresolvedAlerts || []).length
    const totalCritical = (unresolvedAlerts || []).filter((a: any) => a.severity === 'critical').length
    const totalHigh = (unresolvedAlerts || []).filter((a: any) => a.severity === 'high').length
    const totalNew24h = (newAlerts || []).length
    const totalResolved24h = (resolvedAlerts || []).length
    const prevDayCount = (prevDayAlerts || []).length
    const alertTrend = prevDayCount > 0
      ? (((totalNew24h - prevDayCount) / prevDayCount) * 100).toFixed(0)
      : '0'
    const uptimePct = totalDevices > 0
      ? ((onlineDevices / totalDevices) * 100).toFixed(1)
      : '0.0'

    // Unique user count
    const uniqueUsers = new Set((members || []).map((m: any) => m.user_id)).size

    // System health
    let healthStatus = '🟢 Healthy'
    let healthColor = '#10b981'
    if (totalCritical > 0) { healthStatus = '🔴 Critical'; healthColor = '#ef4444' }
    else if (totalHigh > 3 || offlineDevices > totalDevices * 0.2) { healthStatus = '🟡 Warning'; healthColor = '#f59e0b' }
    else if (offlineDevices > 0) { healthStatus = '🟡 Degraded'; healthColor = '#f59e0b' }

    // ─── Build HTML Email ────────────────────────────────────────────

    const reportDateFormatted = new Date(reportDate + 'T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const orgRowsHtml = orgStats.map(org => `
      <tr>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-weight:500;">${org.name}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${org.totalDevices}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:${org.onlineDevices === org.totalDevices ? '#10b981' : '#f59e0b'};">${org.onlineDevices}/${org.totalDevices}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${org.totalUsers}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:${org.criticalAlerts > 0 ? '#ef4444' : org.activeAlerts > 0 ? '#f59e0b' : '#10b981'}; font-weight:${org.criticalAlerts > 0 ? 'bold' : 'normal'};">${org.activeAlerts}${org.criticalAlerts > 0 ? ` (${org.criticalAlerts} crit)` : ''}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${org.newAlertsLast24h}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">${org.resolvedLast24h}</td>
      </tr>
    `).join('')

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
  .container { max-width: 700px; margin: 0 auto; background: white; }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; }
  .header h1 { margin: 0 0 5px; font-size: 24px; }
  .header p { margin: 0; opacity: 0.8; font-size: 14px; }
  .health-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin-top: 12px; }
  .stats-grid { display: flex; flex-wrap: wrap; padding: 20px; gap: 12px; }
  .stat-card { flex: 1; min-width: 140px; background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #e5e7eb; }
  .stat-value { font-size: 28px; font-weight: 700; color: #1a1a2e; }
  .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .stat-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }
  .section { padding: 0 20px 20px; }
  .section h2 { font-size: 16px; color: #1a1a2e; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin: 20px 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  .trend-up { color: #ef4444; } .trend-down { color: #10b981; } .trend-flat { color: #6b7280; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>NetNeural Daily Platform Report</h1>
    <p>${reportDateFormatted}</p>
    <div class="health-badge" style="background:${healthColor}22; color:${healthColor}; border:1px solid ${healthColor}44;">
      ${healthStatus}
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${totalDevices}</div>
      <div class="stat-label">Total Devices</div>
      <div class="stat-sub">${uptimePct}% uptime</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:${onlineDevices === totalDevices ? '#10b981' : '#f59e0b'}">${onlineDevices}</div>
      <div class="stat-label">Online</div>
      <div class="stat-sub">${offlineDevices} offline</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:${totalUnresolved > 0 ? '#ef4444' : '#10b981'}">${totalUnresolved}</div>
      <div class="stat-label">Active Alerts</div>
      <div class="stat-sub">${totalCritical} critical, ${totalHigh} high</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalNew24h}</div>
      <div class="stat-label">New (24h)</div>
      <div class="stat-sub"><span class="${parseInt(alertTrend) > 0 ? 'trend-up' : parseInt(alertTrend) < 0 ? 'trend-down' : 'trend-flat'}">${parseInt(alertTrend) > 0 ? '↑' : parseInt(alertTrend) < 0 ? '↓' : '→'} ${Math.abs(parseInt(alertTrend))}% vs prev day</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:#10b981">${totalResolved24h}</div>
      <div class="stat-label">Resolved (24h)</div>
      <div class="stat-sub">${uniqueUsers} active users</div>
    </div>
  </div>

  <div class="section">
    <h2>Organization Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Organization</th>
          <th style="text-align:center">Devices</th>
          <th style="text-align:center">Online</th>
          <th style="text-align:center">Users</th>
          <th style="text-align:center">Active Alerts</th>
          <th style="text-align:center">New (24h)</th>
          <th style="text-align:center">Resolved (24h)</th>
        </tr>
      </thead>
      <tbody>
        ${orgRowsHtml}
      </tbody>
    </table>
  </div>

  ${recentWins.length > 0 ? `
  <div class="section">
    <h2>🎯 Recent Wins & Accomplishments (Last 7 Days)</h2>
    <table>
      <thead>
        <tr>
          <th style="width:50px">Ticket</th>
          <th>Accomplishment</th>
          <th style="text-align:center; width:80px">Type</th>
          <th style="text-align:center; width:90px">Closed</th>
        </tr>
      </thead>
      <tbody>
        ${recentWins.slice(0, 15).map(w => {
          const isBug = w.labels.some(l => l.toLowerCase().includes('bug'))
          const isFeature = w.labels.some(l => l.toLowerCase().includes('feature') || l.toLowerCase().includes('enhancement'))
          const typeIcon = isBug ? '🐛 Bug Fix' : isFeature ? '✨ Feature' : '📋 Task'
          const typeColor = isBug ? '#ef4444' : isFeature ? '#8b5cf6' : '#6b7280'
          const closedDate = new Date(w.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return `
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center;"><a href="https://github.com/NetNeural/MonoRepo-Staging/issues/${w.number}" style="color:#2563eb; text-decoration:none; font-weight:600;">#${w.number}</a></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;">${w.title}</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-size:11px; color:${typeColor};">${typeIcon}</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-size:12px; color:#6b7280;">${closedDate}</td>
        </tr>`
        }).join('')}
      </tbody>
    </table>
    <p style="font-size:12px; color:#9ca3af; margin-top:8px;">${recentWins.length} ticket${recentWins.length !== 1 ? 's' : ''} closed this week — <a href="https://github.com/NetNeural/MonoRepo-Staging/issues?q=is%3Aissue+is%3Aclosed+sort%3Aupdated-desc" style="color:#2563eb;">View all on GitHub →</a></p>
  </div>` : ''}

  <div class="section">
    <h2>🏆 Top 10 Key Features — Already Live</h2>
    <table>
      <thead>
        <tr>
          <th style="width:30px">#</th>
          <th>Feature</th>
          <th style="text-align:center">Status</th>
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
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Multi-Org Management & RBAC</strong><br><span style="font-size:11px; color:#6b7280;">Role-based access (super_admin, admin, member), org switching, Row-Level Security</span></td>
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
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>44 Serverless Edge Functions</strong><br><span style="font-size:11px; color:#6b7280;">Deno-based compute for auth, CRUD, analytics, integrations, cron jobs</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">6</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Feedback System with GitHub Sync</strong><br><span style="font-size:11px; color:#6b7280;">User feedback → auto-creates GitHub issues, bidirectional sync, edit/reply</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">7</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Automated Daily Platform Reports</strong><br><span style="font-size:11px; color:#6b7280;">Cron-driven daily email digest to leadership with health, stats, trends</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">8</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Golioth IoT Cloud Integration</strong><br><span style="font-size:11px; color:#6b7280;">Device provisioning, LightDB state/stream, OTA updates, fleet management</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">9</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Device Transfer Between Orgs</strong><br><span style="font-size:11px; color:#6b7280;">Drag-and-drop device reassignment with full audit trail and data migration</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
        <tr>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">10</td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;"><strong>Screenshot Upload & Evidence Capture</strong><br><span style="font-size:11px; color:#6b7280;">Attach screenshots to feedback with Supabase Storage, auto-linked to issues</span></td>
          <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#10b981;">✅ Live</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Quick Links</h2>
    <p style="font-size:14px;">
      <a href="https://demo-stage.netneural.ai/dashboard" style="color:#2563eb; text-decoration:none;">📊 Dashboard</a> &nbsp;|&nbsp;
      <a href="https://demo-stage.netneural.ai/dashboard/alerts" style="color:#2563eb; text-decoration:none;">🔔 Alerts</a> &nbsp;|&nbsp;
      <a href="https://demo-stage.netneural.ai/dashboard/devices" style="color:#2563eb; text-decoration:none;">📱 Devices</a> &nbsp;|&nbsp;
      <a href="https://demo-stage.netneural.ai/dashboard/feedback" style="color:#2563eb; text-decoration:none;">💬 Feedback</a>
    </p>
  </div>

  <div class="footer">
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
        'Authorization': `Bearer ${resendApiKey}`,
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
      throw new Error(`Email send failed: ${emailResult.message || emailResponse.statusText}`)
    }

    const duration = Date.now() - startTime
    console.log(`[daily-report] Report sent in ${duration}ms to ${recipients.length} recipients. Resend ID: ${emailResult.id}`)

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
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
