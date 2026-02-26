# NetNeural IoT Platform — Software Assessment & Feature Roadmap

**Date:** February 24, 2026  
**Prepared by:** NetNeural Engineering Team  
**Platform:** demo-stage.netneural.ai

---

## Executive Summary

NetNeural is an enterprise-grade IoT monitoring platform built on Next.js 15 and Supabase. After 843 commits and 231 tracked issues, the platform has a strong technical foundation with deep alerting capabilities. **Overall grade: B- (76/100).** The two critical gaps blocking revenue and enterprise adoption are **(1) no billing infrastructure** and **(2) no security compliance certifications.**

This document provides a full platform assessment, scoring across 10 dimensions, a replacement cost estimate, and a prioritized list of the top 25 features to implement next — ranked by return on investment.

---

## Platform Metrics (as of February 24, 2026)

| Metric                       | Value                       |
| ---------------------------- | --------------------------- |
| TypeScript/TSX Files         | **300**                     |
| Lines of Code (src/)         | **85,396**                  |
| UI Components                | **139**                     |
| Supabase Edge Functions      | **44** (+ 2 shared/archive) |
| Database Migrations          | **120**                     |
| Test Files                   | **64** (~21% coverage)      |
| Total Commits (2025-present) | **843**                     |
| Commits (2026 YTD)           | **723**                     |
| GitHub Issues — Closed       | **109** of 231 (47%)        |
| GitHub Issues — Open         | **110**                     |

---

## Software Grade — 10-Dimension Scoring

| Dimension              | Grade  | Score      | Notes                                                                                                                                             |
| ---------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**       | A-     | 90         | Next.js 15 + Supabase is excellent. RLS, edge functions, real-time, multi-tenant from day 1. Well-structured App Router.                          |
| **Core Functionality** | B+     | 85         | Device management, alerts (with escalation/snooze/timeline), telemetry, orgs, RBAC, feedback, integrations. Solid IoT foundation.                 |
| **Alert System**       | A      | 93         | Post-enhancement: numbering, escalation, timeline, snooze, CSV export, browser notifications, deep links, duplicate prevention. Enterprise-grade. |
| **UI/UX**              | B      | 80         | 139 components, responsive, dark mode, dashboard. Missing i18n, keyboard shortcuts, some display bugs.                                            |
| **Integration Layer**  | B-     | 72         | Golioth, MQTT, Slack, Email, SMS exist. Many not verified end-to-end. Hub architecture designed but incomplete.                                   |
| **Security**           | C+     | 68         | Auth + RLS solid. No MFA, no CSP/HSTS headers, no penetration testing, no SOC 2. Blocks enterprise sales.                                         |
| **Testing**            | D+     | 55         | 64 test files but ~21% coverage. CI has `continue-on-error: true`. Tests don't block deployments.                                                 |
| **Monetization**       | F      | 20         | Zero billing infrastructure. No Stripe, no plans, no invoices. The platform cannot generate revenue today.                                        |
| **DevOps/CI**          | C+     | 68         | GitHub Actions, Supabase CLI, static deploy to GitHub Pages. No staging previews, no quality gates.                                               |
| **Documentation**      | B-     | 72         | Extensive internal markdown. No customer-facing API docs, no onboarding guide, no help center.                                                    |
|                        |        |            |                                                                                                                                                   |
| **Overall**            | **B-** | **76/100** |                                                                                                                                                   |

---

## Estimated Platform Value

| Valuation Method                                                     | Estimate          |
| -------------------------------------------------------------------- | ----------------- |
| **Development Cost** (85K LOC × $15-20/LOC)                          | $1.3M – $1.7M     |
| **Hours Invested** (~4,000-5,500 hrs @ $150/hr avg)                  | $600K – $825K     |
| **SaaS Revenue Potential** (500 devices @ $20/mo = $120K ARR × 5-8x) | $600K – $960K     |
| **Realistic Fair Market Value** (pre-revenue, proven tech)           | **$400K – $700K** |

With billing live and 1,000+ devices onboarded, the platform reaches a **$1M – $2M+ valuation** at standard early-stage SaaS multiples.

---

## Top 25 Features — Ranked by ROI (Bang for Buck)

### Tier 1 — Revenue Enablers (Estimated 2-3 weeks)

| Rank  | Issue | Feature                                                       | Effort   | Business Impact                                                      |
| ----- | ----- | ------------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| **1** | #51   | **Stripe Integration** (checkout, webhooks, portal)           | 3-5 days | Enables ALL revenue. Without it, $0 income forever.                  |
| **2** | #48   | **Billing Plans Table** (tier definitions, resource limits)   | 1 day    | Foundation for pricing tiers. Direct prerequisite for monetization.  |
| **3** | #49   | **Subscriptions & Invoices Tables**                           | 1 day    | DB layer for billing. Can't charge without it.                       |
| **4** | #50   | **Usage Metering System** (multi-tenant quota tracking)       | 2-3 days | Enables pay-per-device pricing. Critical for SaaS unit economics.    |
| **5** | #52   | **Plan Comparison Page** (feature matrix, upgrade flow)       | 2-3 days | Sales conversion page. Users see features → upgrade. Direct revenue. |
| **6** | #53   | **Org Billing Dashboard** (usage meters, subscription status) | 2-3 days | Customer self-service billing reduces support load by ~40%.          |

### Tier 2 — Legal & Bug Fixes (Estimated 1 week)

| Rank   | Issue | Feature                                                | Effort  | Business Impact                                                               |
| ------ | ----- | ------------------------------------------------------ | ------- | ----------------------------------------------------------------------------- |
| **7**  | #222  | **Fix Dashboard Display Bug**                          | 0.5 day | First thing users see. Broken dashboard kills trust instantly.                |
| **8**  | #221  | **Fix Acknowledging Alerts Bug**                       | 0.5 day | Core workflow. If users can't ack alerts, the platform fails its primary job. |
| **9**  | #76   | **Privacy Policy & Consent Checkbox**                  | 0.5 day | Legal requirement. Can't onboard real customers without it.                   |
| **10** | #87   | **Cookie Consent Banner (GDPR)**                       | 0.5 day | Legal requirement for EU. 2-hour implementation.                              |
| **11** | #83   | **Strengthen Password Policy** (12+ chars, complexity) | 0.5 day | 30-minute change. Required for any compliance checklist.                      |
| **12** | #89   | **Security Headers** (CSP, HSTS, X-Frame-Options)      | 1 day   | Trivial to add, blocks every security audit without it.                       |
| **13** | #78   | **Remove continue-on-error from CI**                   | 0.5 day | Stop shipping broken code. Quality multiplier for everything else.            |

### Tier 3 — Enterprise Readiness (Estimated 2-3 weeks)

| Rank   | Issue | Feature                                   | Effort   | Business Impact                                                                  |
| ------ | ----- | ----------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| **14** | #88   | **MFA Enforcement**                       | 2-3 days | Table stakes for enterprise/government. Unlocks contracts worth $50K+.           |
| **15** | #141  | **PDF Report Export**                     | 2-3 days | Managers live on reports. "Can I get a PDF?" is always the first enterprise ask. |
| **16** | #82   | **Zod Validation Across Edge Functions**  | 2-3 days | Prevents data corruption, hardens API. Security + reliability.                   |
| **17** | #182  | **Edit User Accounts** (Admin capability) | 1-2 days | Basic admin feature. Orgs can't manage their people without it.                  |
| **18** | #79   | **Incident Response Plan**                | 1-2 days | Documentation only. Required for SOC 2, shows maturity to enterprise buyers.     |
| **19** | #151  | **Quick Win: Copy Device ID**             | 2 hrs    | Constant developer friction. One button saves hundreds of support tickets.       |

### Tier 4 — AI Differentiation (Estimated 3-4 weeks)

| Rank   | Issue | Feature                             | Effort   | Business Impact                                                              |
| ------ | ----- | ----------------------------------- | -------- | ---------------------------------------------------------------------------- |
| **20** | #142  | **Smart Threshold Adjustment (AI)** | 3-5 days | Major differentiator. Reduces alert fatigue — the #1 pain in IoT monitoring. |
| **21** | #144  | **Predictive Maintenance AI**       | 5-7 days | Premium feature. "Your pump will fail in 72 hrs" is worth $$$$ to customers. |
| **22** | #146  | **Anomaly Detection Upgrade**       | 3-5 days | Proactive alerts before thresholds are even set. Competitive differentiator. |

### Tier 5 — Quality of Life (Estimated 1-2 weeks)

| Rank   | Issue    | Feature                                           | Effort   | Business Impact                                                          |
| ------ | -------- | ------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| **23** | #152     | **Quick Win: Export This View** (all tables)      | 0.5 day  | Users expect CSV/Excel export everywhere. Tiny effort, big satisfaction. |
| **24** | #154     | **Quick Win: Keyboard Shortcuts**                 | 1 day    | Power users love it. `/` to search, `Cmd+K` for command palette. Polish. |
| **25** | #171-172 | **Assign Devices to Orgs** (device inventory tab) | 2-3 days | Core multi-tenant workflow. Orgs need a device inventory management tab. |

---

## Strategic Execution Plan

### Phase 1 — Revenue Unlock (Weeks 1-3)

Implement issues #48, #49, #50, #51, #52, #53 (the full billing stack). This is the **$0 → $10K+ MRR unlock.** Every day without billing is revenue left on the table.

### Phase 2 — Legal & Trust (Week 4)

Implement #76, #87, #83, #89, #78, #222, #221. Removes all legal blockers, visible bugs, and basic compliance gaps. Makes the platform presentable to real enterprise prospects.

### Phase 3 — Enterprise Readiness (Weeks 5-7)

Implement #88, #82, #79, #141, #182. Gets the platform past the standard enterprise security/compliance checklist and enables admin self-service.

### Phase 4 — AI Differentiation (Weeks 8-11)

Implement #142, #144, #146. AI-powered features command **premium pricing** ($30-50/device vs $10-15 commodity). This is the long-term moat.

---

## Key Risks

| Risk                       | Severity     | Mitigation                                                        |
| -------------------------- | ------------ | ----------------------------------------------------------------- |
| No revenue (no billing)    | **Critical** | Phase 1 is urgent — Stripe integration first                      |
| Test coverage at 21%       | **High**     | Phase 2: remove `continue-on-error`, incremental coverage to 50%+ |
| No SOC 2/compliance        | **High**     | Phase 3 MFA + security headers + IRP get you audit-ready          |
| Production sync incomplete | **Medium**   | Issues #71, #120-128 — schedule a dedicated sync sprint           |
| i18n not started           | **Medium**   | Issues #108-116 — defer until revenue is flowing                  |

---

## Conclusion

NetNeural has a solid technical foundation worth an estimated **$400K-$700K in its current state**, with potential to reach **$1M-$2M+** once billing is live and customers are onboarded. The single most impactful investment is the **Stripe billing integration** — it converts the platform from a cost center into a revenue-generating product. Everything else builds on that.

---

_Generated February 24, 2026 | NetNeural Engineering_
