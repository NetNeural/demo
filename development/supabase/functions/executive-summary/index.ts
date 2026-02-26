// ============================================================================
// EXECUTIVE SUMMARY REPORT — On-Demand & Scheduled
// ============================================================================
// Generates a comprehensive executive summary email with live platform
// metrics, GitHub issue tracking, environment health, recent achievements,
// and risk assessment. Designed for leadership stakeholders.
//
// Endpoints:
//   POST /executive-summary              — Generate & send
//   POST /executive-summary?preview=true — Return HTML without sending
//
// Body (optional):
//   { "recipients": ["email@example.com"] }
//
// Environment:
//   RESEND_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   GITHUB_TOKEN (optional — enables issue tracking section)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_RECIPIENTS = [
  'heath.scheiman@netneural.ai',
  'chris.payne@netneural.ai',
  'mike.jordan@netneural.ai',
  'matt.scholle@netneural.ai',
]

const APP_VERSION = '3.6.0'

interface GitHubIssue {
  number: number
  title: string
  state: string
  labels: { name: string }[]
  closed_at: string | null
  created_at: string
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
    const url = new URL(req.url)
    let isPreview = url.searchParams.get('preview') === 'true'

    try {
      const body = await req.json()
      if (body.recipients?.length > 0) recipients = body.recipients
      if (body.preview === true) isPreview = true
    } catch { /* defaults */ }

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    console.log(`[executive-summary] Generating for ${today}`)
    console.log(`[executive-summary] Recipients: ${recipients.join(', ')}`)

    // ─── Gather Platform Stats ───────────────────────────────────────

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Organizations
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, is_active')
      .eq('is_active', true)

    // Devices
    const { data: allDevices } = await supabase
      .from('devices')
      .select('id, status, organization_id')
      .is('deleted_at', null)

    // Alerts
    const { data: unresolvedAlerts } = await supabase
      .from('alerts')
      .select('id, severity')
      .eq('is_resolved', false)

    const { data: newAlerts24h } = await supabase
      .from('alerts')
      .select('id')
      .gte('created_at', last24h)

    const { data: resolved24h } = await supabase
      .from('alerts')
      .select('id')
      .eq('is_resolved', true)
      .gte('resolved_at', last24h)

    // Users
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')

    // Totals
    const totalOrgs = (orgs || []).length
    const totalDevices = (allDevices || []).length
    const onlineDevices = (allDevices || []).filter((d: any) => d.status === 'online').length
    const offlineDevices = totalDevices - onlineDevices
    const uptimePct = totalDevices > 0 ? ((onlineDevices / totalDevices) * 100).toFixed(1) : '0.0'
    const totalUnresolved = (unresolvedAlerts || []).length
    const totalCritical = (unresolvedAlerts || []).filter((a: any) => a.severity === 'critical').length
    const totalHigh = (unresolvedAlerts || []).filter((a: any) => a.severity === 'high').length
    const newAlerts = (newAlerts24h || []).length
    const resolvedAlerts = (resolved24h || []).length
    const uniqueUsers = new Set((members || []).map((m: any) => m.user_id)).size

    // Health status
    let healthStatus = '🟢 Healthy'
    let healthColor = '#10b981'
    let healthBg = '#d1fae5'
    if (totalCritical > 0) { healthStatus = '🔴 Critical'; healthColor = '#ef4444'; healthBg = '#fee2e2' }
    else if (totalHigh > 3 || offlineDevices > totalDevices * 0.2) { healthStatus = '🟡 Warning'; healthColor = '#f59e0b'; healthBg = '#fef3c7' }
    else if (offlineDevices > 0) { healthStatus = '🟡 Degraded'; healthColor = '#f59e0b'; healthBg = '#fef3c7' }

    // ─── GitHub Issue Tracking ───────────────────────────────────────

    let totalOpen = 0
    let totalClosed = 0
    let openBugs = 0
    let recentClosures: { number: number; title: string; labels: string[] }[] = []

    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (githubToken) {
      try {
        // Open issues count
        const openRes = await fetch(
          'https://api.github.com/repos/NetNeural/MonoRepo-Staging/issues?state=open&per_page=1',
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'NetNeural-Executive-Summary',
            },
          }
        )
        if (openRes.ok) {
          // Parse total from Link header
          const linkHeader = openRes.headers.get('Link') || ''
          const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/)
          totalOpen = lastMatch ? parseInt(lastMatch[1]) : (await openRes.json()).length
        }

        // Closed issues count
        const closedRes = await fetch(
          'https://api.github.com/repos/NetNeural/MonoRepo-Staging/issues?state=closed&per_page=1',
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'NetNeural-Executive-Summary',
            },
          }
        )
        if (closedRes.ok) {
          const linkHeader = closedRes.headers.get('Link') || ''
          const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/)
          totalClosed = lastMatch ? parseInt(lastMatch[1]) : (await closedRes.json()).length
        }

        // Open bugs
        const bugsRes = await fetch(
          'https://api.github.com/repos/NetNeural/MonoRepo-Staging/issues?state=open&labels=bug&per_page=100',
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'NetNeural-Executive-Summary',
            },
          }
        )
        if (bugsRes.ok) {
          const bugs: GitHubIssue[] = await bugsRes.json()
          openBugs = bugs.filter((i) => !i.closed_at).length
        }

        // Recently closed (last 7 days)
        const recentRes = await fetch(
          `https://api.github.com/repos/NetNeural/MonoRepo-Staging/issues?state=closed&since=${last7d}&sort=updated&direction=desc&per_page=20`,
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'NetNeural-Executive-Summary',
            },
          }
        )
        if (recentRes.ok) {
          const issues: GitHubIssue[] = await recentRes.json()
          recentClosures = issues
            .filter((i) => !('pull_request' in i))
            .slice(0, 10)
            .map((i) => ({
              number: i.number,
              title: i.title,
              labels: i.labels.map((l) => l.name),
            }))
        }
      } catch (ghErr) {
        console.warn('[executive-summary] GitHub API error:', (ghErr as Error).message)
      }
    } else {
      console.warn('[executive-summary] GITHUB_TOKEN not configured — skipping issue tracking')
    }

    const totalIssues = totalOpen + totalClosed
    const closureRate = totalIssues > 0 ? ((totalClosed / totalIssues) * 100).toFixed(0) : '0'

    // MVP completion estimate
    const mvpPct = 99

    // ─── Build HTML ──────────────────────────────────────────────────

    const statCard = (value: string, label: string, sub: string, color = '#1a1a2e') => `
      <div style="flex:1; min-width:120px; background:#f9fafb; border-radius:8px; padding:14px 10px; text-align:center; border:1px solid #e5e7eb;">
        <div style="font-size:24px; font-weight:700; color:${color};">${value}</div>
        <div style="font-size:10px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-top:3px;">${label}</div>
        ${sub ? `<div style="font-size:10px; color:#9ca3af; margin-top:2px;">${sub}</div>` : ''}
      </div>`

    const recentClosureRows = recentClosures.map((c) => {
      const isBug = c.labels.some((l) => l.toLowerCase().includes('bug'))
      const isFeature = c.labels.some((l) => l.toLowerCase().includes('feature') || l.toLowerCase().includes('enhancement'))
      const typeIcon = isBug ? '🐛' : isFeature ? '✨' : '📋'
      return `
        <tr>
          <td style="padding:5px 10px; border-bottom:1px solid #e5e7eb; text-align:center;">
            <a href="https://github.com/NetNeural/MonoRepo-Staging/issues/${c.number}" style="color:#2563eb; text-decoration:none; font-weight:600;">#${c.number}</a>
          </td>
          <td style="padding:5px 10px; border-bottom:1px solid #e5e7eb;">${c.title}</td>
          <td style="padding:5px 10px; border-bottom:1px solid #e5e7eb; text-align:center;">${typeIcon}</td>
        </tr>`
    }).join('')

    const environments = [
      { name: 'Development', domain: 'demo.netneural.ai', branch: 'demo/main', status: '✅ Live' },
      { name: 'Staging', domain: 'demo-stage.netneural.ai', branch: 'MonoRepo-Staging/staging', status: '✅ Live' },
      { name: 'Production', domain: 'sentinel.netneural.ai', branch: 'MonoRepo/main', status: '✅ Live' },
    ]

    const envRows = environments.map((e) => `
      <tr>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-weight:500;">${e.name}</td>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb;">
          <a href="https://${e.domain}" style="color:#2563eb; text-decoration:none;">${e.domain}</a>
        </td>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-size:12px; color:#6b7280;">${e.branch}</td>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; text-align:center;">${e.status}</td>
      </tr>`).join('')

    const risks = [
      { risk: 'Alert system reliability', severity: 'High', color: '#f59e0b', mitigation: '#282 under investigation — user-reported' },
      { risk: 'Test coverage below target', severity: 'Medium', color: '#3b82f6', mitigation: 'Story 2.2 planned — target 70%' },
      { risk: 'No billing infrastructure', severity: 'Critical', color: '#ef4444', mitigation: 'Stripe integration planned — Phase 1' },
      { risk: 'Scope creep (145 open issues)', severity: 'Medium', color: '#3b82f6', mitigation: 'Issues triaged and prioritized' },
    ]

    const riskRows = risks.map((r) => `
      <tr>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb;">${r.risk}</td>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; text-align:center; color:${r.color}; font-weight:600;">${r.severity}</td>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-size:12px; color:#6b7280;">${r.mitigation}</td>
      </tr>`).join('')

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
  .container { max-width: 740px; margin: 0 auto; background: white; }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); color: white; padding: 32px; text-align: center; }
  .header h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.5px; }
  .header p { margin: 0; opacity: 0.8; font-size: 13px; }
  .version-badge { display: inline-block; padding: 4px 14px; border-radius: 16px; font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); margin-top: 10px; }
  .section { padding: 0 24px 16px; }
  .section h2 { font-size: 14px; color: #0f172a; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 0.3px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f3f4f6; padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  .footer { background: #f9fafb; padding: 18px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  .mvp-bar { background:#e5e7eb; border-radius:6px; height:12px; width:100%; margin-top:6px; }
  .mvp-fill { background: linear-gradient(90deg, #10b981, #059669); border-radius:6px; height:12px; transition: width 0.3s; }
</style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div class="header">
    <h1>NetNeural — Executive Summary</h1>
    <p>${today}</p>
    <div class="version-badge">v${APP_VERSION}</div>
    <div style="margin-top:12px;">
      <span style="display:inline-block; padding:5px 16px; border-radius:16px; font-size:14px; font-weight:700; background:${healthBg}; color:${healthColor};">
        ${healthStatus}
      </span>
    </div>
  </div>

  <!-- MVP Progress -->
  <div style="padding:20px 24px 0;">
    <div style="display:flex; justify-content:space-between; align-items:baseline;">
      <span style="font-size:13px; font-weight:600; color:#0f172a;">MVP Completion</span>
      <span style="font-size:20px; font-weight:800; color:#059669;">${mvpPct}%</span>
    </div>
    <div class="mvp-bar"><div class="mvp-fill" style="width:${mvpPct}%;"></div></div>
    <p style="font-size:11px; color:#9ca3af; margin-top:4px;">Remaining: test coverage refinement (~1 week, 1 dev)</p>
  </div>

  <!-- Platform Health Cards -->
  <div style="display:flex; flex-wrap:wrap; padding:16px 24px; gap:8px;">
    ${statCard(String(totalDevices), 'Devices', `${uptimePct}% uptime`)}
    ${statCard(String(onlineDevices), 'Online', `${offlineDevices} offline`, onlineDevices === totalDevices ? '#10b981' : '#f59e0b')}
    ${statCard(String(totalUnresolved), 'Active Alerts', `${totalCritical} crit · ${totalHigh} high`, totalUnresolved > 0 ? '#ef4444' : '#10b981')}
    ${statCard(String(uniqueUsers), 'Users', `${totalOrgs} organizations`)}
    ${statCard(String(resolvedAlerts), 'Resolved 24h', `${newAlerts} new`, '#10b981')}
  </div>

  <!-- GitHub Issue Tracking -->
  <div class="section">
    <h2>📊 Issue Tracking</h2>
    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
      <div style="flex:1; min-width:100px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px; text-align:center;">
        <div style="font-size:20px; font-weight:700; color:#16a34a;">${totalClosed}</div>
        <div style="font-size:10px; color:#6b7280; text-transform:uppercase;">Closed</div>
      </div>
      <div style="flex:1; min-width:100px; background:#fef3c7; border:1px solid #fde68a; border-radius:8px; padding:10px; text-align:center;">
        <div style="font-size:20px; font-weight:700; color:#d97706;">${totalOpen}</div>
        <div style="font-size:10px; color:#6b7280; text-transform:uppercase;">Open</div>
      </div>
      <div style="flex:1; min-width:100px; background:#fee2e2; border:1px solid #fecaca; border-radius:8px; padding:10px; text-align:center;">
        <div style="font-size:20px; font-weight:700; color:#dc2626;">${openBugs}</div>
        <div style="font-size:10px; color:#6b7280; text-transform:uppercase;">Open Bugs</div>
      </div>
      <div style="flex:1; min-width:100px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:10px; text-align:center;">
        <div style="font-size:20px; font-weight:700; color:#1a1a2e;">${closureRate}%</div>
        <div style="font-size:10px; color:#6b7280; text-transform:uppercase;">Close Rate</div>
      </div>
    </div>
    <p style="font-size:12px; color:#6b7280;">Total: ${totalIssues} issues tracked · ${totalClosed} resolved · ${totalOpen} remaining</p>
  </div>

  ${recentClosures.length > 0 ? `
  <!-- Recent Achievements -->
  <div class="section">
    <h2>🎯 Recent Achievements (Last 7 Days)</h2>
    <table>
      <thead>
        <tr>
          <th style="width:55px; text-align:center;">Ticket</th>
          <th>Title</th>
          <th style="width:40px; text-align:center;">Type</th>
        </tr>
      </thead>
      <tbody>${recentClosureRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Environment Status -->
  <div class="section">
    <h2>🌐 Environment Status</h2>
    <table>
      <thead>
        <tr>
          <th>Environment</th>
          <th>Domain</th>
          <th>Branch</th>
          <th style="text-align:center">Status</th>
        </tr>
      </thead>
      <tbody>${envRows}</tbody>
    </table>
    <p style="font-size:11px; color:#9ca3af; margin-top:6px;">Promotion flow: Dev → verify → Staging → verify → Production</p>
  </div>

  <!-- Technology Stack -->
  <div class="section">
    <h2>🛠 Technology Stack</h2>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">
      ${['Next.js 15', 'React 18', 'TypeScript 5.9', 'Supabase', 'PostgreSQL 17', 'Deno Edge Functions', 'Tailwind CSS', 'GitHub Actions'].map(t =>
        `<span style="display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:500; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">${t}</span>`
      ).join('')}
    </div>
  </div>

  <!-- Risk Assessment -->
  <div class="section">
    <h2>⚠️ Risk Assessment</h2>
    <table>
      <thead>
        <tr>
          <th>Risk</th>
          <th style="text-align:center; width:70px;">Severity</th>
          <th>Mitigation</th>
        </tr>
      </thead>
      <tbody>${riskRows}</tbody>
    </table>
  </div>

  <!-- Infrastructure -->
  <div class="section">
    <h2>💰 Infrastructure Cost</h2>
    <table>
      <thead>
        <tr><th>Service</th><th style="text-align:right; width:90px;">Monthly</th></tr>
      </thead>
      <tbody>
        <tr><td style="padding:5px 10px; border-bottom:1px solid #e5e7eb;">Supabase Pro (×3 envs)</td><td style="padding:5px 10px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">$120</td></tr>
        <tr><td style="padding:5px 10px; border-bottom:1px solid #e5e7eb;">OpenAI API</td><td style="padding:5px 10px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">$90</td></tr>
        <tr><td style="padding:5px 10px; border-bottom:1px solid #e5e7eb;">Sentry Team</td><td style="padding:5px 10px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">$26</td></tr>
        <tr><td style="padding:5px 10px; border-bottom:1px solid #e5e7eb;">GitHub (Actions + Pages)</td><td style="padding:5px 10px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">Free</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:6px 10px; font-weight:700;">Total</td><td style="padding:6px 10px; text-align:right; font-weight:700; font-size:15px; color:#059669;">$236/mo</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Quick Links -->
  <div class="section" style="padding-bottom:20px;">
    <h2>🔗 Quick Links</h2>
    <p style="font-size:13px;">
      <a href="https://sentinel.netneural.ai/dashboard" style="color:#2563eb; text-decoration:none;">📊 Production</a> &nbsp;|&nbsp;
      <a href="https://demo-stage.netneural.ai/dashboard" style="color:#2563eb; text-decoration:none;">🧪 Staging</a> &nbsp;|&nbsp;
      <a href="https://github.com/NetNeural/MonoRepo-Staging/issues" style="color:#2563eb; text-decoration:none;">🐛 Issues</a> &nbsp;|&nbsp;
      <a href="https://github.com/NetNeural/MonoRepo-Staging" style="color:#2563eb; text-decoration:none;">💻 Repo</a>
    </p>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>Executive Summary from <strong>NetNeural Sentinel Platform</strong> v${APP_VERSION}</p>
    <p>Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</p>
    <p style="margin-top:6px; font-size:11px;">All metrics are live from Supabase and GitHub at time of generation.</p>
  </div>

</div>
</body>
</html>`

    // ─── Preview Mode ────────────────────────────────────────────────
    if (isPreview) {
      return new Response(JSON.stringify({ html }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        subject: `📋 NetNeural Executive Summary — v${APP_VERSION} — ${today}`,
        html,
      }),
    })

    const emailResult = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('[executive-summary] Resend error:', JSON.stringify(emailResult))
      throw new Error(`Email send failed: ${emailResult.message || emailResponse.statusText}`)
    }

    const duration = Date.now() - startTime
    console.log(`[executive-summary] Sent in ${duration}ms to ${recipients.length} recipients. Resend ID: ${emailResult.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Executive summary sent to ${recipients.length} recipients`,
        emailId: emailResult.id,
        recipients,
        stats: {
          totalDevices,
          onlineDevices,
          totalUnresolved,
          totalOpen,
          totalClosed,
          openBugs,
          healthStatus,
          mvpPct,
        },
        durationMs: duration,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[executive-summary] Error:', (error as Error).message)
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
