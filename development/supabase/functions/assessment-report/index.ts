// ============================================================================
// ASSESSMENT REPORT — Daily Software Assessment Email
// ============================================================================
// Sends the NetNeural Software Assessment & Feature Roadmap to leadership
// as a beautifully formatted HTML email. Scheduled via pg_cron alongside
// the daily platform report at 7:00 AM ET.
//
// Endpoints:
//   POST /assessment-report              — Generate & send
//   POST /assessment-report?preview=true — Return HTML without sending
//
// Body (optional):
//   { "recipients": ["email@example.com"] }
//
// Environment:
//   RESEND_API_KEY
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured')

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

    // ─── Score Data ────────────────────────────────────────────────
    const dimensions = [
      { name: 'Architecture', grade: 'A-', score: 90, notes: 'Next.js 15 + Supabase. RLS, edge functions, real-time, multi-tenant.' },
      { name: 'Core Functionality', grade: 'B+', score: 85, notes: 'Devices, alerts (escalation/snooze/timeline), telemetry, orgs, RBAC, feedback.' },
      { name: 'Alert System', grade: 'A', score: 93, notes: 'Numbering, escalation, timeline, snooze, CSV, browser notifications, deep links.' },
      { name: 'UI/UX', grade: 'B', score: 80, notes: '139 components, responsive, dark mode. Missing i18n, keyboard shortcuts.' },
      { name: 'Integration Layer', grade: 'B-', score: 72, notes: 'Golioth, MQTT, Slack, Email, SMS. Hub architecture designed but incomplete.' },
      { name: 'Security', grade: 'C+', score: 68, notes: 'Auth + RLS solid. No MFA, no CSP/HSTS, no SOC 2.' },
      { name: 'Testing', grade: 'D+', score: 55, notes: '64 test files, ~21% coverage. CI has continue-on-error.' },
      { name: 'Monetization', grade: 'F', score: 20, notes: 'Zero billing infrastructure. No Stripe, no plans.' },
      { name: 'DevOps/CI', grade: 'C+', score: 68, notes: 'GitHub Actions, static deploy. No staging previews.' },
      { name: 'Documentation', grade: 'B-', score: 72, notes: 'Extensive internal MD. No customer-facing API docs.' },
    ]

    const overallScore = 76
    const overallGrade = 'B-'

    const metrics = [
      { label: 'TypeScript/TSX Files', value: '300' },
      { label: 'Lines of Code', value: '85,396' },
      { label: 'UI Components', value: '139' },
      { label: 'Edge Functions', value: '44+' },
      { label: 'Database Migrations', value: '120+' },
      { label: 'Test Files', value: '64' },
      { label: 'Total Commits', value: '843+' },
      { label: 'GitHub Issues Closed', value: '109+' },
    ]

    const valuation = [
      { method: 'Development Cost (85K LOC × $15-20/LOC)', low: '$1.3M', high: '$1.7M' },
      { method: 'Hours Invested (~4,000-5,500 hrs @ $150/hr)', low: '$600K', high: '$825K' },
      { method: 'SaaS Revenue Potential (500 devices)', low: '$600K', high: '$960K' },
      { method: 'Realistic Fair Market Value (pre-revenue)', low: '$400K', high: '$700K' },
    ]

    const topFeatures = [
      { rank: 1, issue: '#51', name: 'Stripe Integration', effort: '3-5 days', impact: 'Enables ALL revenue.' },
      { rank: 2, issue: '#48', name: 'Billing Plans Table', effort: '1 day', impact: 'Foundation for pricing tiers.' },
      { rank: 3, issue: '#49', name: 'Subscriptions & Invoices Tables', effort: '1 day', impact: 'DB layer for billing.' },
      { rank: 4, issue: '#50', name: 'Usage Metering System', effort: '2-3 days', impact: 'Pay-per-device pricing.' },
      { rank: 5, issue: '#52', name: 'Plan Comparison Page', effort: '2-3 days', impact: 'Sales conversion page.' },
      { rank: 6, issue: '#53', name: 'Org Billing Dashboard', effort: '2-3 days', impact: 'Self-service billing (-40% support).' },
      { rank: 7, issue: '#222', name: 'Fix Dashboard Display Bug', effort: '0.5 day', impact: 'Broken dashboard kills trust.' },
      { rank: 8, issue: '#221', name: 'Fix Acknowledging Alerts Bug', effort: '0.5 day', impact: 'Core workflow must work.' },
      { rank: 9, issue: '#76', name: 'Privacy Policy & Consent', effort: '0.5 day', impact: 'Legal requirement.' },
      { rank: 10, issue: '#87', name: 'Cookie Consent (GDPR)', effort: '0.5 day', impact: 'Legal EU requirement.' },
      { rank: 11, issue: '#83', name: 'Strengthen Password Policy', effort: '0.5 day', impact: 'Compliance checklist item.' },
      { rank: 12, issue: '#89', name: 'Security Headers', effort: '1 day', impact: 'Blocks every security audit.' },
      { rank: 13, issue: '#78', name: 'Remove continue-on-error CI', effort: '0.5 day', impact: 'Stop shipping broken code.' },
      { rank: 14, issue: '#88', name: 'MFA Enforcement', effort: '2-3 days', impact: 'Unlocks enterprise contracts.' },
      { rank: 15, issue: '#141', name: 'PDF Report Export', effort: '2-3 days', impact: 'Enterprise managers need PDFs.' },
      { rank: 16, issue: '#82', name: 'Zod Validation', effort: '2-3 days', impact: 'Prevents data corruption.' },
      { rank: 17, issue: '#182', name: 'Edit User Accounts', effort: '1-2 days', impact: 'Basic admin capability.' },
      { rank: 18, issue: '#79', name: 'Incident Response Plan', effort: '1-2 days', impact: 'SOC 2 requirement.' },
      { rank: 19, issue: '#151', name: 'Copy Device ID', effort: '2 hrs', impact: 'Reduces support tickets.' },
      { rank: 20, issue: '#142', name: 'Smart Threshold AI', effort: '3-5 days', impact: 'Reduces alert fatigue.' },
      { rank: 21, issue: '#144', name: 'Predictive Maintenance AI', effort: '5-7 days', impact: 'Premium feature worth $$$$.' },
      { rank: 22, issue: '#146', name: 'Anomaly Detection Upgrade', effort: '3-5 days', impact: 'Competitive differentiator.' },
      { rank: 23, issue: '#152', name: 'Export This View', effort: '0.5 day', impact: 'CSV/Excel export everywhere.' },
      { rank: 24, issue: '#154', name: 'Keyboard Shortcuts', effort: '1 day', impact: 'Power user polish.' },
      { rank: 25, issue: '#171-172', name: 'Assign Devices to Orgs', effort: '2-3 days', impact: 'Core multi-tenant workflow.' },
    ]

    // ─── Grade Color Helper ──────────────────────────────────────────
    function gradeColor(grade: string): string {
      if (grade.startsWith('A')) return '#10b981'
      if (grade.startsWith('B')) return '#3b82f6'
      if (grade.startsWith('C')) return '#f59e0b'
      if (grade.startsWith('D')) return '#f97316'
      return '#ef4444'
    }

    function scoreBar(score: number): string {
      const pct = score
      const color = score >= 85 ? '#10b981' : score >= 70 ? '#3b82f6' : score >= 55 ? '#f59e0b' : '#ef4444'
      return `<div style="background:#e5e7eb; border-radius:4px; height:8px; width:100%;"><div style="background:${color}; border-radius:4px; height:8px; width:${pct}%;"></div></div>`
    }

    function tierColor(rank: number): string {
      if (rank <= 6) return '#ef4444'   // Tier 1 — Revenue
      if (rank <= 13) return '#f59e0b'  // Tier 2 — Legal/Bugs
      if (rank <= 19) return '#3b82f6'  // Tier 3 — Enterprise
      if (rank <= 22) return '#8b5cf6'  // Tier 4 — AI
      return '#6b7280'                  // Tier 5 — QoL
    }

    function tierLabel(rank: number): string {
      if (rank <= 6) return '💰 Revenue'
      if (rank <= 13) return '⚖️ Legal/Bug'
      if (rank <= 19) return '🏢 Enterprise'
      if (rank <= 22) return '🤖 AI'
      return '✨ QoL'
    }

    // ─── Build HTML ──────────────────────────────────────────────────
    const dimensionRows = dimensions.map(d => `
      <tr>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-weight:500;">${d.name}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">
          <span style="display:inline-block; padding:2px 10px; border-radius:12px; font-weight:700; font-size:13px; color:white; background:${gradeColor(d.grade)};">${d.grade}</span>
        </td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600;">${d.score}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; width:120px;">${scoreBar(d.score)}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-size:12px; color:#6b7280;">${d.notes}</td>
      </tr>
    `).join('')

    const metricCards = metrics.map(m => `
      <td style="padding:5px; vertical-align:top;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
          <tr><td style="padding:12px; text-align:center;">
            <div style="font-size:22px; font-weight:700; color:#1a1a2e;">${m.value}</div>
            <div style="font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">${m.label}</div>
          </td></tr>
        </table>
      </td>
    `).join('')

    const valuationRows = valuation.map(v => `
      <tr>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">${v.method}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:600; color:#1a1a2e;">${v.low} – ${v.high}</td>
      </tr>
    `).join('')

    const featureRows = topFeatures.map(f => `
      <tr>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:700; color:#1a1a2e;">${f.rank}</td>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; text-align:center;">
          <a href="https://github.com/NetNeural/MonoRepo-Staging/issues/${f.issue.replace(/[^0-9]/g, '')}" style="color:#2563eb; text-decoration:none; font-weight:600;">${f.issue}</a>
        </td>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-weight:500;">${f.name}</td>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; text-align:center; font-size:12px; color:#6b7280;">${f.effort}</td>
        <td style="padding:6px 10px; border-bottom:1px solid #e5e7eb; font-size:12px;">
          <span style="display:inline-block; padding:1px 8px; border-radius:10px; font-size:10px; font-weight:600; color:${tierColor(f.rank)}; background:${tierColor(f.rank)}15; border:1px solid ${tierColor(f.rank)}33; margin-right:4px;">${tierLabel(f.rank)}</span>
          ${f.impact}
        </td>
      </tr>
    `).join('')

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; line-height:1.5; color:#1f2937; margin:0; padding:0; background:#f3f4f6;">
<div style="max-width:780px; margin:0 auto; background:white;">
  <div style="background-color:#1a1a2e; color:white; padding:35px; text-align:center;">
    <h1 style="margin:0 0 5px; font-size:22px; letter-spacing:-0.5px; color:white;">NetNeural Software Assessment & Roadmap</h1>
    <p style="margin:0; opacity:0.8; font-size:13px;">Daily Executive Summary — ${today}</p>
    <div style="display:inline-block; width:80px; height:80px; border-radius:50%; background-color:#2a2a4e; border:3px solid #4a4a6e; line-height:80px; font-size:32px; font-weight:800; margin:15px 0 5px; letter-spacing:-1px;">${overallGrade}</div>
    <p style="font-size:16px; font-weight:600; margin-top:4px;">${overallScore}/100</p>
    <p style="opacity:0.7; font-size:12px; margin-top:2px;">Estimated Value: $400K – $700K</p>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:20px 24px;">
    <tr>
      ${metricCards}
    </tr>
  </table>

  <div style="padding:0 24px 20px;">
    <h2 style="font-size:15px; color:#1a1a2e; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin:24px 0 12px;">📊 10-Dimension Software Grade</h2>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <thead>
        <tr>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Dimension</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:center; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Grade</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:center; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Score</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:center; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb; width:120px;">Progress</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${dimensionRows}
        <tr style="background:#f9fafb;">
          <td style="padding:10px 12px; font-weight:700;">Overall</td>
          <td style="padding:10px 12px; text-align:center;">
            <span style="display:inline-block; padding:2px 10px; border-radius:12px; font-weight:700; font-size:13px; color:white; background:${gradeColor(overallGrade)};">${overallGrade}</span>
          </td>
          <td style="padding:10px 12px; text-align:center; font-weight:700; font-size:16px;">${overallScore}</td>
          <td style="padding:10px 12px;">${scoreBar(overallScore)}</td>
          <td style="padding:10px 12px; font-size:12px; color:#6b7280;">Strong foundation, needs billing + security</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="padding:0 24px 20px;">
    <h2 style="font-size:15px; color:#1a1a2e; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin:24px 0 12px;">💰 Platform Valuation</h2>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <thead>
        <tr>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Valuation Method</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:center; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Estimate</th>
        </tr>
      </thead>
      <tbody>
        ${valuationRows}
      </tbody>
    </table>
    <div style="background:#d1fae5; border-left:4px solid #10b981; padding:12px 16px; border-radius:0 8px 8px 0; margin:16px 0; font-size:13px;">
      <strong>With billing live + 1,000 devices:</strong> Platform reaches <strong>$1M – $2M+</strong> valuation at standard early-stage SaaS multiples.
    </div>
  </div>

  <div style="padding:0 24px 20px;">
    <h2 style="font-size:15px; color:#1a1a2e; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin:24px 0 12px;">🚀 Top 25 Features — Ranked by ROI</h2>
    <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:12px 16px; border-radius:0 8px 8px 0; margin:16px 0; font-size:13px;">
      <strong>⚡ #1 Priority:</strong> Stripe Integration (#51) — enables ALL revenue. Without it, $0 income. Every day without billing is revenue left on the table.
    </div>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <thead>
        <tr>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:center; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb; width:35px;">#</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:center; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb; width:55px;">Issue</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Feature</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:center; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb; width:70px;">Effort</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Impact / Tier</th>
        </tr>
      </thead>
      <tbody>
        ${featureRows}
      </tbody>
    </table>
  </div>

  <div style="padding:0 24px 20px;">
    <h2 style="font-size:15px; color:#1a1a2e; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin:24px 0 12px;">📅 Strategic Execution Plan</h2>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <thead>
        <tr>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Phase</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Timeline</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Focus</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Outcome</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-weight:700; color:#ef4444;">Phase 1</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Weeks 1-3</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Revenue Unlock (Stripe + Billing)</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-weight:600;">$0 → $10K+ MRR</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-weight:700; color:#f59e0b;">Phase 2</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Week 4</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Legal & Trust (Privacy, GDPR, Bugs)</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-weight:600;">Enterprise-presentable</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-weight:700; color:#3b82f6;">Phase 3</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Weeks 5-7</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Enterprise Readiness (MFA, Validation)</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-weight:600;">Compliance-ready</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-weight:700; color:#8b5cf6;">Phase 4</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Weeks 8-11</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">AI Differentiation (Smart Thresholds, Predictive)</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; font-weight:600;">Premium pricing ($30-50/device)</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="padding:0 24px 20px;">
    <h2 style="font-size:15px; color:#1a1a2e; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin:24px 0 12px;">⚠️ Key Risks</h2>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <thead>
        <tr>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Risk</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:center; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Severity</th>
          <th style="background:#f3f4f6; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; color:#6b7280; border-bottom:2px solid #e5e7eb;">Mitigation</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">No revenue (no billing)</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#ef4444; font-weight:700;">Critical</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Stripe integration is Phase 1 — urgent</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Test coverage at 21%</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#f59e0b; font-weight:600;">High</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Remove continue-on-error, push to 50%+</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">No SOC 2/compliance</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#f59e0b; font-weight:600;">High</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">MFA + security headers + IRP → audit-ready</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Production sync incomplete</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb; text-align:center; color:#3b82f6; font-weight:600;">Medium</td>
          <td style="padding:8px 12px; border-bottom:1px solid #e5e7eb;">Schedule a dedicated sync sprint</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="padding:0 24px 20px; padding-bottom:24px;">
    <h2 style="font-size:15px; color:#1a1a2e; border-bottom:2px solid #e5e7eb; padding-bottom:8px; margin:24px 0 12px;">🔗 Quick Links</h2>
    <p style="font-size:14px;">
      <a href="https://demo-stage.netneural.ai/dashboard" style="color:#2563eb; text-decoration:none;">📊 Dashboard</a> &nbsp;|&nbsp;
      <a href="https://github.com/NetNeural/MonoRepo-Staging/issues" style="color:#2563eb; text-decoration:none;">🐛 Issues</a> &nbsp;|&nbsp;
      <a href="https://github.com/NetNeural/MonoRepo-Staging" style="color:#2563eb; text-decoration:none;">💻 Repository</a> &nbsp;|&nbsp;
      <a href="https://demo-stage.netneural.ai/dashboard/feedback" style="color:#2563eb; text-decoration:none;">💬 Feedback</a>
    </p>
  </div>

  <div style="background:#f9fafb; padding:20px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb;">
    <p>Automated daily assessment from <strong>NetNeural Sentinel Platform</strong></p>
    <p>Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</p>
    <p style="margin-top:8px; font-size:11px;">This report updates as features are completed. Overall grade and scores are recalculated periodically.</p>
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
        subject: `📋 NetNeural Software Assessment — ${overallGrade} (${overallScore}/100) — ${today}`,
        html,
      }),
    })

    const emailResult = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('[assessment-report] Resend error:', JSON.stringify(emailResult))
      throw new Error(`Email send failed: ${emailResult.message || emailResponse.statusText}`)
    }

    console.log(`[assessment-report] Sent to ${recipients.length} recipients. Resend ID: ${emailResult.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Assessment report sent to ${recipients.length} recipients`,
        emailId: emailResult.id,
        recipients,
        overallGrade,
        overallScore,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[assessment-report] Error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
