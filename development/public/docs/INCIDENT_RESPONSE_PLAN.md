# Incident Response Plan (IRP)

## NetNeural IoT Platform — Sentinel

| Field | Value |
|-------|-------|
| **Document Owner** | Heath Scheiman, CTO |
| **Version** | 1.0 |
| **Effective Date** | March 1, 2026 |
| **Last Reviewed** | March 1, 2026 |
| **Next Review** | June 1, 2026 (quarterly) |
| **Classification** | Internal — Confidential |
| **Compliance Frameworks** | SOC 2 Type II (CC7.x), FISMA (IR-1 through IR-8), NIST SP 800-61r2 |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Definitions](#3-definitions)
4. [Roles & Responsibilities](#4-roles--responsibilities)
5. [Incident Classification](#5-incident-classification)
6. [Response Procedures](#6-response-procedures)
7. [Communication Plan](#7-communication-plan)
8. [Recovery Procedures](#8-recovery-procedures)
9. [Post-Incident Review](#9-post-incident-review)
10. [Training & Testing](#10-training--testing)
11. [Plan Maintenance](#11-plan-maintenance)
12. [Appendix A — Contact Directory](#appendix-a--contact-directory)
13. [Appendix B — Incident Log Template](#appendix-b--incident-log-template)
14. [Appendix C — Post-Mortem Template](#appendix-c--post-mortem-template)
15. [Appendix D — Customer Notification Templates](#appendix-d--customer-notification-templates)
16. [Appendix E — Supabase-Specific Procedures](#appendix-e--supabase-specific-procedures)
17. [Appendix F — Regulatory References](#appendix-f--regulatory-references)

---

## 1. Purpose

This Incident Response Plan (IRP) establishes a structured, repeatable process for identifying, managing, and recovering from security incidents and service disruptions affecting the NetNeural IoT Platform ("Sentinel"). It ensures:

- **Rapid detection and containment** of security threats and outages
- **Minimized business impact** through defined escalation paths and SLAs
- **Regulatory compliance** with SOC 2 Type II (CC7.3, CC7.4, CC7.5), FISMA IR controls, and NIST SP 800-61r2 guidelines
- **Continuous improvement** via post-incident reviews and lessons learned
- **Clear communication** to internal stakeholders, customers, and (where required) regulators

This document satisfies SOC 2 audit finding **IR-1** ("No documented Incident Response Plan") and FISMA controls IR-1 through IR-8.

---

## 2. Scope

### 2.1 In Scope

| Asset | Description | Environment |
|-------|-------------|-------------|
| **Web Application** | Next.js 15 static frontend on GitHub Pages | Production, Staging, Dev |
| **Supabase Backend** | PostgreSQL 17, Auth, Edge Functions (Deno), Realtime, Storage | Production (`bldojxpockljyivldxwf`), Staging (`atgbmxicqikmapfqouco`), Dev (`tsomafkalaoarnuwgdyu`) |
| **Domains** | sentinel.netneural.ai (prod), demo-stage.netneural.ai (staging), demo.netneural.ai (dev) | All |
| **CI/CD Pipelines** | GitHub Actions (3 repos: MonoRepo, MonoRepo-Staging, demo) | All |
| **Secrets & Credentials** | GitHub Secrets (22 total), Supabase service role keys, API keys | All |
| **IoT Device Data** | Telemetry, device metadata, alert rules, Golioth integrations | All |
| **User Data** | Authentication credentials, organization data, audit logs | All |
| **Third-Party Integrations** | Golioth, Sentry, SendGrid, Supabase, GitHub | All |

### 2.2 Out of Scope

- Physical infrastructure (managed by Supabase/AWS and GitHub/Azure)
- End-user device hardware and firmware
- Customer on-premises networks
- Third-party vendor internal incidents (unless they impact our platform)

---

## 3. Definitions

| Term | Definition |
|------|------------|
| **Incident** | Any event that compromises the confidentiality, integrity, or availability of NetNeural systems, data, or services |
| **Security Incident** | An incident involving unauthorized access, data breach, credential compromise, or malicious activity |
| **Service Disruption** | An incident causing degraded performance or full/partial outage of platform services |
| **Incident Commander (IC)** | The individual responsible for coordinating the overall incident response |
| **Containment** | Actions taken to limit the impact and spread of an incident |
| **Eradication** | Eliminating the root cause of an incident |
| **RTO** | Recovery Time Objective — maximum acceptable downtime (target: 4 hours for P1) |
| **RPO** | Recovery Point Objective — maximum acceptable data loss (target: 24 hours) |
| **Post-Mortem** | Blameless retrospective conducted after incident resolution |

---

## 4. Roles & Responsibilities

### 4.1 Incident Response Team (IRT)

| Role | Primary | Backup | Responsibilities |
|------|---------|--------|------------------|
| **Incident Commander** | Heath Scheiman | Chris Payne | Overall coordination, decision authority, escalation, status updates to leadership |
| **Technical Lead** | Chris Payne | Matt Scholle | Root cause analysis, containment actions, technical remediation, system recovery |
| **Communications Lead** | Heath Scheiman | Mike Jordan | Customer notifications, status page updates, regulatory notifications |
| **Database/Backend Lead** | Matt Scholle | Chris Payne | Supabase investigation, database recovery, RLS policy verification, migration rollback |
| **DevOps/Infrastructure** | Mike Jordan | Matt Scholle | CI/CD pipeline, GitHub Pages, DNS, Edge Function deployment, secrets rotation |

### 4.2 Escalation Authority

| Decision | Authority |
|----------|-----------|
| Declare a P1/P2 incident | Any IRT member |
| Authorize emergency change (skip PR review) | Incident Commander |
| Approve customer notification | Incident Commander + Communications Lead |
| Engage Supabase support | Technical Lead or Incident Commander |
| Engage legal counsel | Incident Commander (data breach only) |
| Shut down production services | Incident Commander only |

### 4.3 RACI Matrix

| Activity | IC | Tech Lead | Comms Lead | DB Lead | DevOps |
|----------|:--:|:---------:|:----------:|:-------:|:------:|
| Incident detection | I | R | I | R | R |
| Initial triage | A | R | I | C | C |
| Severity classification | A/R | C | I | C | C |
| Containment actions | A | R | I | R | R |
| Customer communication | A | C | R | I | I |
| Root cause analysis | I | A/R | I | R | R |
| Recovery execution | A | R | I | R | R |
| Post-mortem facilitation | R | C | C | C | C |

*R = Responsible, A = Accountable, C = Consulted, I = Informed*

---

## 5. Incident Classification

### 5.1 Severity Levels

| Severity | Name | Description | Examples |
|:--------:|------|-------------|----------|
| **P1** | **Critical** | Complete service outage, confirmed data breach, or active security compromise affecting production | Data breach / unauthorized data access; Full production outage (sentinel.netneural.ai); Compromised service role key or admin credentials; Ransomware or destructive malware; RLS policy bypass (data leaking between orgs) |
| **P2** | **High** | Partial service degradation, confirmed security vulnerability, or imminent threat to data integrity | Partial outage (e.g., Edge Functions down, auth failing); Exploitable security vulnerability discovered; Unauthorized access attempt (brute force, credential stuffing); Database performance critical degradation; Supabase project approaching resource limits |
| **P3** | **Medium** | Non-critical service issue, minor security concern, or degraded non-essential functionality | Elevated error rates in Sentry (>5% of requests); Non-critical Edge Function failures; Monitoring/alerting system failure; Failed deployments requiring rollback; Third-party integration disruption (Golioth, SendGrid) |
| **P4** | **Low** | Minor issue, informational security event, or cosmetic problem | Isolated user-reported bug; Dependabot security advisory (low/moderate); Scheduled maintenance communication; Documentation gap identified; Non-production environment issues |

### 5.2 Response SLAs

| Severity | Acknowledge | Triage Complete | Containment | Resolution Target | Status Updates |
|:--------:|:-----------:|:---------------:|:-----------:|:-----------------:|:--------------:|
| **P1** | **15 minutes** | 30 minutes | 1 hour | 4 hours | Every 30 minutes |
| **P2** | **1 hour** | 2 hours | 4 hours | 24 hours | Every 2 hours |
| **P3** | **4 hours** | 8 hours | 24 hours | 72 hours | Daily |
| **P4** | **24 hours** | 48 hours | Best effort | 1 week | As needed |

### 5.3 Automatic P1 Triggers

The following conditions automatically classify as P1:
- Sentry alert: >50% error rate sustained for 5+ minutes
- Any confirmed unauthorized data access
- Production database unreachable for >5 minutes
- GitHub secret exposure in public context
- Supabase service role key compromised
- RLS policy failure allowing cross-organization data access

---

## 6. Response Procedures

### 6.1 Phase 1 — Detection & Identification

**Objective:** Determine that an incident has occurred and assess initial scope.

**Detection Sources:**
| Source | Monitoring Tool | Alert Mechanism |
|--------|----------------|-----------------|
| Application errors | Sentry | Email, Slack webhook |
| Failed authentication | Supabase Auth logs | Supabase Dashboard |
| Database anomalies | Supabase Dashboard | Manual review |
| Uptime monitoring | External monitor (planned) | Email, SMS |
| User reports | Support channels | Email, in-app |
| Vulnerability disclosures | Dependabot, security@netneural.ai | GitHub notifications |
| CI/CD failures | GitHub Actions | Email notifications |

**Actions:**
1. Confirm the event is a genuine incident (not a false positive)
2. Record the incident in the Incident Log (Appendix B)
3. Assign initial severity using the classification matrix (§5.1)
4. Notify the Incident Commander immediately for P1/P2
5. For P1: begin assembling the IRT within 15 minutes

### 6.2 Phase 2 — Triage & Classification

**Objective:** Understand the incident scope, impact, and assign final severity.

**Triage Checklist:**
- [ ] What systems/services are affected?
- [ ] Is customer data at risk?
- [ ] How many users/organizations are impacted?
- [ ] Is the incident ongoing or contained?
- [ ] What is the blast radius (prod only? staging? all envs)?
- [ ] Are there regulatory notification requirements?

**Actions:**
1. IC confirms or adjusts severity classification
2. IC assigns team members to roles per §4.1
3. Open a dedicated communication channel (e.g., Slack #incident-YYYY-MM-DD)
4. Begin timeline documentation (who, what, when)
5. Determine if external support is needed (Supabase, GitHub, legal)

### 6.3 Phase 3 — Containment

**Objective:** Limit the blast radius and prevent further damage.

**Short-Term Containment (immediate):**

| Incident Type | Containment Actions |
|---------------|-------------------|
| **Data breach** | Revoke compromised credentials; rotate Supabase service role key; enable stricter RLS; block suspicious IPs if possible |
| **Full outage** | Identify failing component; check Supabase status (status.supabase.com); check GitHub Pages status; check DNS |
| **Credential compromise** | Rotate ALL GitHub Secrets (22); rotate Supabase API keys via dashboard; invalidate active sessions (`auth.sessions` table); force password resets |
| **Malicious code** | Revert to last known good commit; disable affected Edge Functions; block compromised deploy pipeline |
| **DDoS / abuse** | Enable Supabase rate limiting; contact Supabase support; consider DNS-level blocking |

**Long-Term Containment:**
1. Apply patches/fixes to staging first, verify, then promote to production
2. Implement additional monitoring for the attack vector
3. Update RLS policies if data isolation was compromised
4. Enable enhanced logging for affected systems

### 6.4 Phase 4 — Eradication

**Objective:** Remove the root cause completely.

**Actions:**
1. Identify and document root cause
2. Remove malicious artifacts (compromised code, unauthorized accounts)
3. Patch vulnerable code or configuration
4. Verify fix in staging (`demo-stage.netneural.ai`)
5. Apply fix to production via standard deployment process:
   ```bash
   # Standard 3-repo deployment
   git push origin staging        # staging
   git push demo staging:main     # dev
   git push monorepo staging:main # production
   ```
6. Rotate any credentials that may have been exposed
7. Verify RLS policies are intact across all 18+ tables
8. Run database integrity checks

### 6.5 Phase 5 — Recovery

**Objective:** Restore full service and verify normal operations.

See §8 (Recovery Procedures) for detailed steps.

### 6.6 Phase 6 — Post-Incident Review

**Objective:** Learn from the incident to prevent recurrence.

See §9 (Post-Incident Review) for detailed process.

---

## 7. Communication Plan

### 7.1 Internal Communication

| Audience | P1 | P2 | P3 | P4 | Channel |
|----------|:--:|:--:|:--:|:--:|---------|
| IRT Members | Immediate | Within 1 hour | Within 4 hours | Daily digest | Slack, phone, email |
| Leadership | Within 30 min | Within 2 hours | Daily summary | Weekly summary | Email, Slack |
| All Staff | Within 1 hour | Within 4 hours | Next standup | N/A | Slack #general |

### 7.2 External Communication

| Audience | When to Notify | Who Notifies | Channel |
|----------|----------------|-------------|---------|
| Affected customers | P1: within 1 hour of confirmation; P2: within 4 hours if user-facing | Communications Lead | Email (SendGrid) |
| All customers | P1 data breach: within 24 hours | IC + Communications Lead | Email + status page |
| Regulatory bodies | Data breach affecting PII: within 72 hours (GDPR) | IC + Legal counsel | Formal written notice |
| Supabase support | Any P1/P2 affecting Supabase services | Technical Lead | Supabase support portal |

### 7.3 Communication Principles

1. **Acknowledge quickly** — Confirm awareness even before root cause is known
2. **Be transparent** — Share what you know and what you don't know
3. **Regular updates** — Silence breeds anxiety; maintain update cadence per SLA
4. **Single source of truth** — All external communications approved by IC
5. **Blameless language** — Focus on systems and processes, not individuals

### 7.4 Notification Templates

See Appendix D for ready-to-use customer notification templates.

---

## 8. Recovery Procedures

### 8.1 Service Recovery Priority Order

Restore services in this order to minimize user impact:

| Priority | Service | Recovery Method | Verification |
|:--------:|---------|----------------|-------------|
| 1 | **Supabase Database** | Supabase Point-in-Time Recovery or daily backup restore | `SELECT count(*) FROM devices;` query returns expected data |
| 2 | **Supabase Auth** | Verify auth service health; clear stuck sessions if needed | Successful login test |
| 3 | **Edge Functions** | Redeploy from latest known-good commit with `--no-verify-jwt` | `curl` health check on each function |
| 4 | **Frontend** | Rebuild and deploy via GitHub Actions | Load sentinel.netneural.ai, verify navigation |
| 5 | **Integrations** | Verify Golioth, SendGrid, Sentry connectivity | Send test alert email, check Sentry event |
| 6 | **Monitoring** | Confirm Sentry, alerting, and audit logging are operational | Trigger test error, verify it appears |

### 8.2 Database Recovery

**Supabase provides automated daily backups and point-in-time recovery (PITR).**

**Restore from backup (via Supabase Dashboard):**
1. Go to: `https://supabase.com/dashboard/project/{ref}/settings/backups`
2. Select the backup closest to (but before) the incident
3. Click "Restore" — this creates a new project with restored data
4. Verify data integrity in the restored project
5. Update DNS/environment variables to point to restored project (if needed)
6. Verify RLS policies are intact

**Restore from migration files (clean rebuild):**
```bash
cd development

# Link to target project
npx supabase link --project-ref <PROJECT_REF>

# Reset and replay all migrations
echo "y" | npx supabase db reset --linked

# Verify migrations applied
npx supabase migration list --linked
```

**Project references:**
| Environment | Project Ref | Domain |
|-------------|-------------|--------|
| Production | `bldojxpockljyivldxwf` | sentinel.netneural.ai |
| Staging | `atgbmxicqikmapfqouco` | demo-stage.netneural.ai |
| Development | `tsomafkalaoarnuwgdyu` | demo.netneural.ai |

### 8.3 Frontend Recovery

GitHub Pages serves the static frontend. Recovery is a rebuild and redeploy:

```bash
cd development

# Verify clean build
npm run build

# Deploy via the correct repo
# Staging (MonoRepo-Staging)
git push origin staging

# Dev (NetNeural/demo)
git push demo staging:main --force

# Production (NetNeural/MonoRepo)
git push monorepo staging:main --force
```

### 8.4 Edge Function Recovery

All Edge Functions must be deployed with `--no-verify-jwt`:

```bash
cd development

# Deploy a specific function
npx supabase functions deploy <function-name> \
  --project-ref <PROJECT_REF> \
  --no-verify-jwt

# Deploy all functions
for fn in supabase/functions/*/; do
  fn_name=$(basename "$fn")
  npx supabase functions deploy "$fn_name" \
    --project-ref <PROJECT_REF> \
    --no-verify-jwt
done
```

### 8.5 Secrets Rotation

If credentials are compromised, rotate in this order:

1. **Supabase service role key** — Regenerate via Supabase Dashboard → Settings → API
2. **Supabase anon key** — Regenerate via Supabase Dashboard → Settings → API
3. **GitHub Secrets** — Update all 22 secrets across all 3 repos (MonoRepo, MonoRepo-Staging, demo)
4. **SendGrid API key** — Regenerate in SendGrid dashboard
5. **Golioth API key** — Regenerate in Golioth console
6. **Sentry DSN** — Regenerate in Sentry project settings
7. **Update environment files** — `.env.production`, `.env.staging`, `.env.development`
8. **Redeploy all services** — Frontend + Edge Functions with new credentials

Reference: `docs/SECRETS_INVENTORY.md` for complete catalog, `docs/SECRETS_GOVERNANCE.md` for rotation schedules.

### 8.6 Recovery Verification Checklist

Before declaring the incident resolved:

- [ ] All affected services are operational
- [ ] User authentication works (login/logout/signup)
- [ ] Device data is displaying correctly
- [ ] Alert rules are triggering properly
- [ ] Edge Functions are responding (executive-summary, assessment-report, etc.)
- [ ] Audit logging is capturing events
- [ ] Sentry is receiving error/performance data
- [ ] Email notifications are sending (SendGrid)
- [ ] RLS policies are enforced (cross-org data isolation verified)
- [ ] No residual indicators of compromise
- [ ] Monitoring is active and alerting properly

---

## 9. Post-Incident Review

### 9.1 Timeline

| Action | Deadline |
|--------|----------|
| Schedule post-mortem meeting | Within 48 hours of resolution |
| Complete post-mortem document | Within 5 business days |
| Assign remediation action items | At post-mortem meeting |
| Complete remediation items | Per assigned deadlines |
| Update IRP if needed | Within 10 business days |

### 9.2 Post-Mortem Process

1. **Incident Commander** schedules the post-mortem within 48 hours
2. All IRT members who participated must attend
3. Review is **blameless** — focus on systems, processes, and improvements
4. Use the Post-Mortem Template (Appendix C)
5. IC ensures action items have assigned owners and due dates
6. Action items are tracked as GitHub Issues (label: `incident-followup`)
7. Post-mortem document is stored in `docs/post-mortems/YYYY-MM-DD-title.md`

### 9.3 Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| **MTTD** | Mean Time to Detect | < 15 minutes (P1) |
| **MTTA** | Mean Time to Acknowledge | Per SLA (§5.2) |
| **MTTC** | Mean Time to Contain | Per SLA (§5.2) |
| **MTTR** | Mean Time to Resolve | Per SLA (§5.2) |
| **Incident Count** | Total incidents per quarter | Decreasing trend |
| **Repeat Incidents** | Same root cause recurrence | 0 target |
| **SLA Compliance** | % of incidents within SLA | > 95% |

---

## 10. Training & Testing

### 10.1 Training Requirements

| Training | Frequency | Audience | Method |
|----------|-----------|----------|--------|
| IRP overview | Onboarding + annually | All team members | Document review + quiz |
| IRT role-specific training | Annually | IRT members | Workshop |
| Tabletop exercise | Quarterly | IRT members | Simulated scenario |
| Full simulation drill | Annually | All team members | Live exercise |

### 10.2 Tabletop Exercise Scenarios

Conduct at least one scenario per quarter, rotating through these:

1. **Q1 — Data Breach:** Simulated unauthorized access to production database via compromised service role key
2. **Q2 — Full Outage:** Supabase production project becomes unavailable during business hours
3. **Q3 — Credential Compromise:** GitHub Secret exposed in a public repository fork
4. **Q4 — Supply Chain:** Malicious dependency introduced via npm package update

### 10.3 Exercise Documentation

Each exercise must produce:
- Scenario description and objectives
- Participant list and roles
- Timeline of decisions made
- Identified gaps in the IRP
- Action items for improvement

---

## 11. Plan Maintenance

### 11.1 Review Schedule

| Review Type | Frequency | Responsible | Next Due |
|-------------|-----------|-------------|----------|
| **Quarterly review** | Every 3 months | IC + IRT | June 1, 2026 |
| **Annual full review** | Yearly | IC + Leadership | March 1, 2027 |
| **Post-incident update** | After every P1/P2 | IC | As needed |
| **Contact info update** | Monthly | DevOps Lead | April 1, 2026 |

### 11.2 Change Triggers

This plan must be reviewed and updated when:
- A P1 or P2 incident occurs
- Team membership changes (new hires, departures)
- Infrastructure changes (new services, providers, environments)
- Regulatory requirements change
- Post-mortem identifies IRP gaps
- Annual review date is reached

### 11.3 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-01 | Heath Scheiman / AI-Assisted | Initial creation — satisfies SOC 2 IR-1 and FISMA IR-1 through IR-8 |

---

## Appendix A — Contact Directory

### Internal Incident Response Team

| Name | Role | Email | Phone | Availability |
|------|------|-------|-------|-------------|
| Heath Scheiman | Incident Commander / CTO | heath.scheiman@netneural.ai | [On file] | 24/7 for P1 |
| Chris Payne | Technical Lead | chris.payne@netneural.ai | [On file] | 24/7 for P1 |
| Mike Jordan | DevOps / Infrastructure | mike.jordan@netneural.ai | [On file] | Business hours + P1 on-call |
| Matt Scholle | Database / Backend Lead | matt.scholle@netneural.ai | [On file] | Business hours + P1 on-call |

### External Contacts

| Organization | Purpose | Contact Method | SLA |
|-------------|---------|----------------|-----|
| **Supabase Support** | Database, Auth, Edge Function issues | support@supabase.io / Dashboard support | Enterprise plan response times |
| **GitHub Support** | Repository, Actions, Pages issues | support.github.com | Business hours |
| **SendGrid Support** | Email delivery issues | support portal | Standard SLA |
| **Golioth Support** | IoT device integration issues | support portal | Standard SLA |
| **Sentry Support** | Error monitoring issues | support portal | Standard SLA |
| **DNS Provider** | Domain resolution issues | Provider's support portal | Per contract |
| **Legal Counsel** | Data breach notification requirements | [On file] | As needed |

---

## Appendix B — Incident Log Template

```markdown
# Incident Log — INC-YYYY-MMDD-###

## Summary
| Field | Value |
|-------|-------|
| **Incident ID** | INC-YYYY-MMDD-### |
| **Date/Time Detected** | YYYY-MM-DD HH:MM UTC |
| **Detected By** | [Name / System] |
| **Detection Method** | [Sentry alert / User report / Monitoring / Manual] |
| **Severity** | P1 / P2 / P3 / P4 |
| **Incident Commander** | [Name] |
| **Status** | Investigating / Contained / Resolved / Closed |

## Affected Systems
- [ ] Frontend (GitHub Pages)
- [ ] Supabase Database
- [ ] Supabase Auth
- [ ] Edge Functions
- [ ] Integrations (Golioth / SendGrid / Sentry)
- [ ] Other: ___

## Impact
- **Users affected:** [Count or "All"]
- **Organizations affected:** [Count or "All"]
- **Data at risk:** [Yes/No — describe if yes]
- **Financial impact:** [Estimated or "TBD"]

## Timeline
| Time (UTC) | Action | Actor |
|------------|--------|-------|
| HH:MM | Incident detected | [Name/System] |
| HH:MM | IC notified | [Name] |
| HH:MM | Severity classified as Px | [IC Name] |
| HH:MM | Containment action taken | [Name] |
| HH:MM | Root cause identified | [Name] |
| HH:MM | Fix deployed | [Name] |
| HH:MM | Service restored | [Name] |
| HH:MM | Incident resolved | [IC Name] |

## Root Cause
[Description of the root cause]

## Resolution
[Description of what was done to resolve the incident]

## Follow-Up Actions
- [ ] Action item 1 — Owner: [Name] — Due: [Date]
- [ ] Action item 2 — Owner: [Name] — Due: [Date]
```

---

## Appendix C — Post-Mortem Template

```markdown
# Post-Mortem: INC-YYYY-MMDD-###

**Date of Incident:** YYYY-MM-DD  
**Post-Mortem Date:** YYYY-MM-DD  
**Author:** [Name]  
**Attendees:** [List all participants]

## Incident Summary
[2-3 sentence summary of what happened]

## Impact
- **Duration:** [Total time from detection to resolution]
- **Severity:** P1 / P2 / P3 / P4
- **Users impacted:** [Count]
- **Data compromised:** [Yes/No — details]
- **SLA met:** [Yes/No — details]

## Timeline
| Time (UTC) | Event |
|------------|-------|
| | |

## Root Cause Analysis
### What happened?
[Detailed technical explanation]

### Why did it happen?
[5 Whys or fishbone analysis]

### Why wasn't it detected sooner?
[Gaps in monitoring/alerting]

## What Went Well
- [Positive observations about the response]

## What Could Be Improved
- [Areas for improvement — blameless]

## Action Items
| # | Action | Owner | Priority | Due Date | Status |
|---|--------|-------|----------|----------|--------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

## Lessons Learned
[Key takeaways for the team]

## IRP Updates Required
- [ ] No updates needed
- [ ] Updates needed: [describe changes]
```

---

## Appendix D — Customer Notification Templates

### D.1 — Initial Incident Acknowledgment (P1/P2)

**Subject:** [NetNeural] Service Disruption — We're Investigating

```
Dear [Customer Name],

We are aware of an issue affecting the NetNeural Sentinel platform and are 
actively investigating. Our team was alerted at [TIME] UTC and is working 
to resolve this as quickly as possible.

What we know so far:
- [Brief description of symptoms]
- [Affected services]

What we're doing:
- Our incident response team has been mobilized
- We are working to identify the root cause and restore service

We will provide an update within [30 minutes / 2 hours] or sooner if we 
have new information.

We apologize for the inconvenience and appreciate your patience.

Best regards,
NetNeural Incident Response Team
```

### D.2 — Status Update

**Subject:** [NetNeural] Service Disruption — Update #[N]

```
Dear [Customer Name],

Here is an update on the service disruption reported at [ORIGINAL TIME] UTC.

Current Status: [Investigating / Identified / Monitoring / Resolved]

Update:
- [What we've learned since last update]
- [Actions taken]
- [Expected next steps]

Estimated resolution: [Time estimate or "We are still investigating"]

Next update: [TIME] UTC

Best regards,
NetNeural Incident Response Team
```

### D.3 — Incident Resolved

**Subject:** [NetNeural] Service Restored — Incident Resolved

```
Dear [Customer Name],

The service disruption affecting [affected services] has been resolved as 
of [TIME] UTC. All systems are operating normally.

Summary:
- **Duration:** [Start time] to [End time] UTC ([X hours/minutes])
- **Root Cause:** [Brief, non-technical explanation]
- **Resolution:** [What was done to fix it]
- **Data Impact:** [No data was lost or compromised / Details if applicable]

We have implemented [preventive measures] to reduce the likelihood of 
this type of incident occurring again. A detailed post-mortem review 
will be conducted within the next 48 hours.

We apologize for the disruption and thank you for your patience.

Best regards,
NetNeural Incident Response Team
```

### D.4 — Data Breach Notification (GDPR-Compliant)

**Subject:** [NetNeural] Important Security Notice — Action Required

```
Dear [Customer Name],

We are writing to inform you of a security incident that may have 
affected your data on the NetNeural Sentinel platform.

What Happened:
[Clear description of the incident]

When It Happened:
[Date and time range]

What Information Was Involved:
[Specific data types — e.g., email addresses, device names, telemetry data]

What We Are Doing:
- [Immediate containment actions taken]
- [Investigation status]
- [Preventive measures being implemented]

What You Can Do:
- [Change your password at sentinel.netneural.ai]
- [Review your account activity in the audit log]
- [Contact us if you notice suspicious activity]

Contact Us:
If you have questions or concerns, please contact us at:
- Email: security@netneural.ai
- Subject line: [Incident Reference Number]

We take the security of your data seriously and deeply regret this 
incident. We are committed to transparency and will keep you informed 
of any developments.

Best regards,
Heath Scheiman
CTO, NetNeural
```

---

## Appendix E — Supabase-Specific Procedures

### E.1 Accessing Supabase Dashboard During Incident

| Environment | Dashboard URL |
|-------------|-------------|
| Production | `https://supabase.com/dashboard/project/bldojxpockljyivldxwf` |
| Staging | `https://supabase.com/dashboard/project/atgbmxicqikmapfqouco` |
| Development | `https://supabase.com/dashboard/project/tsomafkalaoarnuwgdyu` |

### E.2 Checking Supabase Service Status

- **Status page:** https://status.supabase.com
- **API health:** `curl https://<PROJECT_REF>.supabase.co/rest/v1/ -H "apikey: <ANON_KEY>"`
- **Auth health:** `curl https://<PROJECT_REF>.supabase.co/auth/v1/health`

### E.3 Edge Function Logs

```bash
# View recent function logs
npx supabase functions log <function-name> --project-ref <PROJECT_REF>

# Via Dashboard: Supabase Dashboard → Edge Functions → Select function → Logs
```

### E.4 Database Emergency Queries

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Check RLS status on critical tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- Verify no cross-org data leakage (spot check)
SELECT DISTINCT organization_id FROM devices;

-- Check recent audit log entries
SELECT * FROM user_audit_log 
ORDER BY created_at DESC 
LIMIT 20;

-- Kill a specific query (emergency)
SELECT pg_terminate_backend(<PID>);
```

### E.5 Emergency RLS Lock-Down

If RLS policies are suspected compromised:

```sql
-- Verify RLS is enabled on all critical tables
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner too (maximum security)
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
```

### E.6 Invalidating All User Sessions (Nuclear Option)

```sql
-- Delete all active sessions (forces re-login for all users)
DELETE FROM auth.sessions;

-- Delete sessions for a specific user
DELETE FROM auth.sessions WHERE user_id = '<USER_UUID>';

-- Delete all refresh tokens
DELETE FROM auth.refresh_tokens;
```

---

## Appendix F — Regulatory References

### NIST SP 800-61r2 Alignment

This IRP follows the NIST Computer Security Incident Handling Guide (SP 800-61 Revision 2) four-phase lifecycle:

| NIST Phase | IRP Section |
|------------|-------------|
| 1. Preparation | §4 (Roles), §10 (Training), §11 (Maintenance) |
| 2. Detection & Analysis | §6.1 (Detection), §6.2 (Triage) |
| 3. Containment, Eradication & Recovery | §6.3 (Containment), §6.4 (Eradication), §8 (Recovery) |
| 4. Post-Incident Activity | §9 (Post-Incident Review) |

### SOC 2 Control Mapping

| SOC 2 Control | Description | IRP Coverage |
|---------------|-------------|-------------|
| CC7.2 | Monitoring for anomalies | §6.1 Detection Sources |
| CC7.3 | Evaluating security events | §5 Classification, §6.2 Triage |
| CC7.4 | Responding to incidents | §6.3-6.5 Response Procedures |
| CC7.5 | Recovering from incidents | §8 Recovery Procedures |
| CC2.2 | Internal communication of policies | §7 Communication Plan |
| A1.2 | Recovery mechanisms | §8 Recovery Procedures |

### FISMA Control Mapping

| FISMA Control | Description | IRP Coverage |
|---------------|-------------|-------------|
| IR-1 | Incident Response Policy | This document (entire) |
| IR-2 | Incident Response Training | §10 Training & Testing |
| IR-3 | Incident Response Testing | §10.2 Tabletop Exercises |
| IR-4 | Incident Handling | §6 Response Procedures |
| IR-5 | Incident Monitoring | §6.1 Detection, §9.3 Metrics |
| IR-6 | Incident Reporting | §7 Communication Plan, Appendix B |
| IR-7 | Incident Response Assistance | §4 Roles, Appendix A Contacts |
| IR-8 | Incident Response Plan | §11 Plan Maintenance |

---

*This document is maintained by the NetNeural Incident Response Team. For questions, contact heath.scheiman@netneural.ai.*

*Reference: NIST Special Publication 800-61 Revision 2 — Computer Security Incident Handling Guide (https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final)*
