# NetNeural IoT Platform - Administrator Guide
**Version 1.0** | **Last Updated:** February 17, 2026  
**For:** System Administrators, IT Managers, DevOps Teams

---

## Introduction

This comprehensive guide covers all administrative functions of the NetNeural IoT Platform. As an administrator, you're responsible for managing users, organizations, integrations, security policies, and system health.

**Target Audience:**
- System Administrators
- IT Managers
- DevOps Engineers
- Compliance Officers

---

## Table of Contents

1. [Organization Management](#1-organization-management)
2. [User Management & Permissions](#2-user-management--permissions)
3. [Device Integration Setup](#3-device-integration-setup)
4. [Alert Configuration & Best Practices](#4-alert-configuration--best-practices)
5. [Reporting & Audit Logs](#5-reporting--audit-logs)
6. [Security & Compliance](#6-security--compliance)
7. [Performance Monitoring](#7-performance-monitoring)
8. [Backup & Disaster Recovery](#8-backup--disaster-recovery)
9. [Troubleshooting](#9-troubleshooting)
10. [API Access & Automation](#10-api-access--automation)

---

## 1. Organization Management

### 1.1 Organization Hierarchy

NetNeural supports multi-tenant organization hierarchy:

```
Enterprise Organization (Root)
├── Division A
│   ├── Facility 1
│   └── Facility 2
├── Division B
│   ├── Warehouse 1
│   └── Warehouse 2
└── Shared Services
    ├── IT Department
    └── Quality Assurance
```

**Key Concepts:**
- **Root Organization:** Top-level entity (e.g., company)
- **Sub-Organizations:** Divisions, facilities, departments
- **Member Inheritance:** Users can belong to multiple organizations
- **Device Scoping:** Devices belong to one organization only

### 1.2 Creating Organizations

**Via UI:**
1. Navigate to **Settings** →  **Organizations**
2. Click **"+ New Organization"**
3. Fill in details:
   - **Name:** Organization name (e.g., "North American Division")
   - **Slug:** URL-friendly identifier (auto-generated)
   - **Parent Organization:** Select if creating sub-org
4. Click **"Create"**

**Via API:**
```bash
curl -X POST https://api.netneural.io/organizations \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "North American Division",
    "slug": "north-america",
    "parent_id": "parent-org-uuid"
  }'
```

### 1.3 Organization Settings

**Configure:**
- ✅ **Default Timezone:** Used for reports and timestamps
- ✅ **Temperature Unit:** Fahrenheit or Celsius (defaults for new users)
- ✅ **Alert Email Domains:** Whitelist for alert recipients
- ✅ **Data Retention:** How long to keep telemetry data (default: 90 days)
- ✅ **API Rate Limits:** Requests per minute/hour
- ✅ **Billing Information:** Payment method and subscription tier

**Access:** Settings → Organizations → [Select Org] → Settings

### 1.4 Organization Transfer

**Scenario:** Move devices from one organization to another

**Prerequisites:**
- You have **Owner** role in both organizations
- Devices are not actively syncing

**Steps:**
1. Go to **Devices** page
2. Select devices to transfer (checkboxes)
3. Click **"Bulk Actions" → "Transfer to Organization"**
4. Select destination organization
5. Confirm transfer (irreversible within 24 hours)

**⚠️ Warning:** Transferred devices retain their telemetry history but alert thresholds are reset.

---

## 2. User Management & Permissions

### 2.1 User Roles Matrix

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Owner** | Full access, user management, billing | CEO, CTO, System Owner |
| **Admin** | Manage devices, thresholds, users (no billing) | IT Manager, Operations Manager |
| **Member** | View all, edit own devices, acknowledge alerts | Facility Manager, Technician |
| **Viewer** | Read-only access (no changes) | Auditor, Executive Dashboard |

### 2.2 Permission Details

**Owner Can:**
- ✅ Everything an Admin can do
- ✅ Manage billing and subscription
- ✅ Delete organization
- ✅ Transfer organization ownership
- ✅ Manage API keys and integrations
- ✅ Configure global security policies

**Admin Can:**
- ✅ Add/remove users
- ✅ Assign roles (except Owner)
- ✅ Configure integrations
- ✅ Manage devices (add, edit, delete)
- ✅ Configure alert thresholds (all devices)
- ✅ View audit logs
- ✅ Export data

**Member Can:**
- ✅ View all devices
- ✅ Acknowledge alerts
- ✅ Edit devices they created
- ✅ Configure thresholds on own devices
- ✅ Export device data

**Viewer Can:**
- ✅ View dashboard
- ✅ View devices (read-only)
- ✅ View alerts (cannot acknowledge)

### 2.3 Adding Users

**Invite New User:**
1. Go to **Settings** → **Users**
2. Click **"+ Invite User"**
3. Enter:
   - **Email Address**
   - **Role:** Select from dropdown
   - **Organization(s):** Select which orgs they can access
4. Click **"Send Invitation"**

**User receives email with:**
- Invitation link (valid for 7 days)
- Instructions to set password
- Link to User Quick Start Guide

**Bulk Invitation (CSV Import):**
1. Prepare CSV file:
   ```csv
   email,role,organization_ids
   john@example.com,admin,"org-123,org-456"
   jane@example.com,member,"org-123"
   ```
2. Go to **Settings** → **Users** → **"Import CSV"**
3. Upload file
4. Review and confirm
5. All users receive invitation emails

### 2.4 Managing Existing Users

**Change User Role:**
1. Go to **Settings** → **Users**
2. Find user in list
3. Click **role dropdown** → Select new role
4. Click **"Save"**
5. User receives email notification

**Revoke Access:**
1. Go to **Settings** → **Users**
2. Find user in list
3. Click **"Remove from Organization"**
4. Confirm removal
5. User loses access immediately

**Deactivate User (All Organizations):**
1. Contact support@netneural.ai (security precaution)
2. Provide user email and justification
3. Support team deactivates within 1 hour

### 2.5 Multi-Organization Access

**Scenario:** User needs access to multiple organizations with different roles

**Example:**
- **Organization A (North Region):** Admin
- **Organization B (South Region):** Member
- **Organization C (Shared Services):** Viewer

**Setup:**
1. Go to each organization
2. Invite user with appropriate role for that org
3. User can switch organizations via dropdown (top navigation)

**Role Priority:**
- Highest role takes precedence globally for certain actions
- Organization-specific permissions apply when scoped to that org

---

## 3. Device Integration Setup

### 3.1 Supported Integrations

| Provider | Devices | Status | Setup Time |
|----------|---------|--------|------------|
| **Golioth** | 200+ models | ✅ Active | 10 min |
| **AWS IoT Core** | All AWS-compatible | 🔄 Beta | 15 min |
| **Azure IoT Hub** | Azure-compatible | 📋 Planned | - |
| **Generic MQTT** | Any MQTT device | ✅ Active | 20 min |

### 3.2 Golioth Integration

**Prerequisites:**
- Golioth account with API access
- API Key with read/write permissions
- Devices registered in Golioth

**Setup Steps:**

1. **Get Golioth API Key:**
   - Log in to https://console.golioth.io
   - Go to **Settings** → **API Keys**
   - Create new key → Copy key (shows once)

2. **Configure in NetNeural:**
   - Go to **Settings** → **Integrations**
   - Click **"+ Add Integration"**
   - Select **"Golioth"**
   - Enter:
     - **Integration Name:** "Golioth Production"
     - **API Key:** [Paste key from step 1]
     - **API URL:** https://api.golioth.io (default)
   - Click **"Test Connection"** → Should show ✅ Success
   - Click **"Save"**

3. **Initial Device Sync:**
   - Click **"Sync Devices"** button
   - Wait 10-30 seconds
   - Check **Devices** page → Devices appear
   - Verify: Device count matches Golioth console

4. **Configure Auto-Sync:**
   - Edit integration → Enable **"Auto-Sync"**
   - Set **Sync Interval:** 5 minutes (recommended)
   - Set **Sync Method:** "Incremental" (faster)
   - Click **"Save"**

**✅ Integration Active!** New devices in Golioth automatically appear in NetNeural.

### 3.3 AWS IoT Core Integration (Beta)

**Prerequisites:**
- AWS account with IoT Core enabled
- IAM user with IoT permissions
- Access Key ID and Secret Access Key

**Required IAM Permissions:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:ListThings",
        "iot:DescribeThing",
        "iot:GetThingShadow",
        "iot:SearchIndex"
      ],
      "Resource": "*"
    }
  ]
}
```

**Setup:**
1. **Create IAM User:**
   - AWS Console → IAM → Users → Create User
   - Generate Access Key → Save credentials

2. **Configure in NetNeural:**
   - Go to **Settings** → **Integrations** → **"+ Add Integration"**
   - Select **"AWS IoT Core"**
   - Enter:
     - **Access Key ID**
     - **Secret Access Key**
     - **AWS Region:** e.g., us-east-1
   - Click **"Test Connection"** → Verify
   - Click **"Save"**

3. **Device Sync:**
   - Click **"Sync Devices"**
   - AWS Things import as devices

**⚠️ Beta Notice:** AWS integration lacks advanced features (device shadow, jobs). Coming in Q1 2026.

### 3.4 Generic MQTT Integration

**For custom MQTT devices:**

1. **Setup MQTT Broker:**
   - Use existing broker (Mosquitto, HiveMQ, etc.)
   - Or use NetNeural-hosted broker (contact sales)

2. **Configure Topic Structure:**
   ```
   devices/{device_id}/telemetry         # Device sends data
   devices/{device_id}/commands          # NetNeural sends commands
   devices/{device_id}/status            # Online/offline status
   ```

3. **Create Integration:**
   - Go to **Settings** → **Integrations** → **" + Add Integration"**
   - Select **"Generic MQTT"**
   - Enter:
     - **Broker URL:** mqtt://broker.example.com:1883
     - **Username/Password** (if required)
     - **Topic Prefix:** devices/
   - Click **"Test Connection"**
   - Click **"Save"**

4. **Device Registration:**
   - Manually add devices via UI or API
   - Match Device ID to MQTT client ID

---

## 4. Alert Configuration & Best Practices

### 4.1 Threshold Strategy

**General Principles:**
- **Critical Thresholds:** Immediate action required (business/safety impact)
- **Warning Thresholds:** Monitor closely (potential issue developing)
- **Hysteresis:** Avoid alert "flapping" (50°F critical → 52°F warning prevents oscillation)

### 4.2 Recommended Thresholds by Industry

#### **Cold Storage / Food Safety**
| Sensor | Critical Min | Critical Max | Warning Min | Warning Max |
|--------|--------------|--------------|-------------|-------------|
| Temperature | 32°F (0°C) | 40°F (4°C) | 34°F (1°C) | 38°F (3°C) |
| Humidity | 80% | 95% | 82% | 92% |

**Justification:** FDA requires <40°F for refrigerated foods

#### **Data Center / Server Room**
| Sensor | Critical Min | Critical Max | Warning Min | Warning Max |
|--------|--------------|--------------|-------------|-------------|
| Temperature | 59°F (15°C) | 80°F (27°C) | 64°F (18°C) | 75°F (24°C) |
| Humidity | 20% | 80% | 30% | 70% |
| CO₂ | - | 1000 ppm | - | 800 ppm |

**Justification:** ASHRAE TC 9 guidelines (59-89°F range, 64-80°F optimal)

#### **Healthcare / Pharmaceutical**
| Sensor | Critical Min | Critical Max | Warning Min | Warning Max |
|--------|--------------|--------------|-------------|-------------|
| Temperature | 68°F (20°C) | 77°F (25°C) | 70°F (21°C) | 75°F (24°C) |
| Humidity | 30% | 60% | 35% | 55% |

**Justification:** USP <797> pharmaceutical storage requirements

### 4.3 Bulk Threshold Configuration

**Scenario:** Apply same thresholds to 50 devices

**Method 1: Threshold Templates**
1. Go to **Settings** → **Alert Templates**
2. Click **"+ New Template"**
3. Create template:
   - **Name:** "Cold Storage Standard"
   - **Thresholds:** Configure all sensors
4. Save template

5. **Apply to Devices:**
   - Go to **Devices** page
   - Select multiple devices (checkboxes)
   - Click **"Bulk Actions" → "Apply Thresholds Template"**
   - Confirm application

**Method 2: API Bulk Update**
```bash
curl -X POST https://api.netneural.io/thresholds/bulk \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -d '{
    "device_ids": ["device-1", "device-2", "device-3"],
    "thresholds": [
      {
        "sensor_type": "temperature",
        "unit": "F",
        "critical_min": 32,
        "critical_max": 40,
        "warning_min": 34,
        "warning_max": 38
      }
    ]
  }'
```

### 4.4 Alert Notification Configuration

**Email Alerts:**
1. Go to **Settings** → **Notifications** → **Email**
2. Configure:
   - **Recipients:** Add email addresses (comma-separated)
   - **Severity Filter:** Which alerts to send (Critical only vs. All)
   - **Digest Mode:** Immediate vs. Hourly digest vs. Daily digest
   - **Quiet Hours:** Suppress alerts during off-hours (e.g., 10 PM - 6 AM)
3. Click **"Test Email"** → Verify receipt
4. Click **"Save"**

**Slack Integration (Coming Soon):**
- Connect Slack workspace
- Choose channel for alerts
- Configure alert formatting

### 4.5 Alert Escalation Rules

**Scenario:** If alert not acknowledged in 30 minutes, escalate to manager

**Setup:**
1. Go to **Settings** → **Alerts** → **Escalation Rules**
2. Click **"+ New Rule"**
3. Configure:
   - **Name:** "Critical Temperature Escalation"
   - **Trigger:** Alert severity = Critical, Unacknowledged for 30 minutes
   - **Action:** Send email to manager@example.com, Send SMS (requires Twilio integration)
   - **Repeat:** Every 1 hour until acknowledged
4. Save rule

---

## 5. Reporting & Audit Logs

### 5.1 Audit Log

**All user actions are logged:**
- User login/logout
- Device additions/deletions
- Threshold changes
- Alert acknowledgments
- User role changes
- Integration configuration changes

**Access Audit Log:**
1. Go to **Settings** → **Audit Log**
2. Filter by:
   - **Date Range**
   - **User:** Specific user actions
   - **Action Type:** login, device_delete, threshold_update, etc.
   - **Device:** Actions on specific device
3. Click **"Export CSV"** for compliance reports

**Audit Log Retention:** 1 year (configurable up to 7 years for compliance)

### 5.2 User Activity Report

**Generate report of user logins and actions:**

1. Go to **Reports** → **User Activity**
2. Select date range
3. Select users (or all)
4. Click **"Generate Report"**
5. Report includes:
   - Login timestamps and IP addresses
   - Actions performed (with timestamps)
   - Failed login attempts
   - Session durations

**Use Cases:**
- Compliance audits (SOC 2, HIPAA)
- Security investigations
- User activity monitoring

### 5.3 Device Health Report

**

Weekly/monthly device health summary:**

**Metrics Included:**
- Device uptime percentage
- Battery health trends
- Connectivity issues
- Alert frequency per device
- Data transmission gaps

**Generate:**
1. Go to **Reports** → **Device Health**
2. Select organization
3. Select date range
4. Click **"Generate PDF"**

**Scheduled Reports:**
- Configure in **Settings** → **Reports** → **Scheduled Reports**
- Automatic email delivery every Monday 8 AM

### 5.4 Alert Summary Report

**Compliance and performance tracking:**

**Metrics:**
- Total alerts generated
- Alert acknowledgment times (avg/median)
- Unacknowledged alert count
- Alert breakdown by severity/category
- Top alerting devices

**Generate:**
1. Go to **Reports** → **Alerts**
2. Select date range
3. Filter by severity/category (optional)
4. Click **"Generate Report"**

---

## 6. Security & Compliance

### 6.1 Authentication & Access Control

**Multi-Factor Authentication (2FA):**
- Enforced for all Owners and Admins
- Optional for Members and Viewers
- Supported: TOTP (Google Authenticator, Authy)

**Enable 2FA Organization-Wide:**
1. Go to **Settings** → **Security** → **2FA Policy**
2. Select: **"Required for Admin+"** or **"Required for All Users"**
3. Set **Grace Period:** 7 days (users must enable within 7 days)
4. Click **"Save"**

**Password Policy:**
- Minimum 12 characters (configurable up to 20)
- Must include: uppercase, lowercase, number, special character
- Password expiration: 90 days (configurable or disable)
- Password history: Last 5 passwords cannot be reused
- Account lockout: 5 failed attempts = 15-minute lockout

**Configure:**
Settings → Security → Password Policy

### 6.2 Row-Level Security (RLS)

NetNeural uses **PostgreSQL Row-Level Security (RLS)** to enforce data isolation:

**Policies:**
- Users see only devices in their organizations
- Admins see all data within their organization
- Viewers have read-only access
- API keys are scoped to specific organizations

**Verify RLS is Active:**
1. Go to **Settings** → **Security** → **Database Policies**
2. Check status: **"🟢 Active"**
3. View policy details (read-only)

**⚠️ WARNING:** Never disable RLS in production. Contact support if issues arise.

### 6.3 API Key Management

**Create API Key:**
1. Go to **Settings** → **API Keys**
2. Click **"+ New API Key"**
3. Configure:
   - **Name:** "CI/CD Pipeline Key"
   - **Permissions:** Read-only vs. Read-write
   - **Scope:** Organization(s) this key can access
   - **Expiration:** 90 days (recommended) or Never
4. Click **"Create"**
5. **Copy key immediately** (shown once)

**Best Practices:**
- ✅ Use separate keys for different services (CI/CD, monitoring, integrations)
- ✅ Rotate keys every 90 days
- ✅ Set expiration dates
- ✅ Use read-only keys when possible
- ❌ Never commit keys to Git repositories
- ❌ Don't share keys via email/Slack

**Rotate API Key:**
1. Create new API key (step above)
2. Update all services using old key
3. Verify new key works (test API calls)
4. Revoke old key

### 6.4 Data Encryption

**At Rest:**
- Database: AES-256 encryption (Supabase managed)
- Backups: Encrypted with separate key
- Secrets: GitHub Secrets (encrypted at rest)

**In Transit:**
- TLS 1.3 for all API calls
- WebSocket Secure (WSS) for real-time updates
- Certificate: Let's Encrypt wildcard cert (auto-renewed)

**Verify Encryption:**
- `curl -I https://api.netneural.io` → Check `Strict-Transport-Security` header
- Browser DevTools → Network → Check protocol (h2/HTTP2)

### 6.5 Compliance Certifications

**Current:**
- ✅ **SOC 2  Type I** (in progress - Q2 2026)
- ✅ **GDPR Compliant** (data residency in US/EU)
- ✅ **HIPAA Eligible** (via AWS/Supabase BAA)

**Data Residency:**
- **US:** Default (AWS us-east-1)
- **EU:** Available (AWS eu-west-1) - Contact sales

**Data Subject Rights (GDPR):**
- **Access:** Users can export all their data (Settings → Privacy → Download Data)
- **Deletion:** Users can request account deletion (soft delete = 30 days, hard delete = 90 days)
- **Portability:** Export in JSON/CSV format

**Contact:** privacy@netneural.ai for GDPR requests

---

## 7. Performance Monitoring

### 7.1 Sentry Dashboard

**Access:** https://sentry.io/organizations/netneural/

**Key Metrics:**
- **Transaction Duration:** Page load times (P50, P95, P99)
- **Web Vitals:** LCP, FID, CLS scores
- **Error Rate:** Exceptions per 1,000 transactions
- **Slow Queries:** Database queries >1 second

**Performance Alerts:**
- Automatic alerts for performance degradation
- Slack notifications to #netneural-alerts

### 7.2 Supabase Analytics

**Access:** Supabase Dashboard → Analytics

**Monitor:**
- Database query performance
- Connection pool usage
- Table sizes and disk usage
- Index efficiency

**Weekly Review:**
- Check **slow_queries** view for optimization opportunities
- Review **table_bloat_stats** to schedule maintenance

---

## 8. Backup & Disaster Recovery

### 8.1 Backup Strategy

**Database:**
- **Automated Backups:** Daily at 2 AM UTC (Supabase managed)
- **Retention:** 7 days (configurable up to 30 days)
- **Storage:** S3 (encrypted, versioned)

**Application Configuration:**
- Integration settings: Backed up to GitHub every commit
- Threshold templates: Included in database backup
- User settings: Included in database backup

### 8.2 Restore Procedures

**Database Restore:**
1. Contact support@netneural.ai with:
   - Desired restore point (date/time)
   - Organization ID
   - Justification (security incident, data corruption, etc.)
2. NetNeural support initiates restore (1-4 hour window)
3. Verify restored data
4. Resume normal operations

**⚠️ WARNING:** Restore overwrites current data. Consider testing in staging environment first.

### 8.3 Disaster Recovery Plan

**RTO (Recovery Time Objective):** 4 hours  
**RPO (Recovery Point Objective):** 24 hours (data loss up to 24 hours acceptable)

**Failure Scenarios:**

**Scenario 1: Database Failure**
- Supabase automatic failover to replica (30 seconds)
- DNS update if needed (5 minutes)
- User impact: Brief connection errors

**Scenario 2: Region Outage (AWS us-east-1)**
- Manual failover to eu-west-1 (4 hours)
- DNS update required
- Users redirected to EU region

**Scenario 3: Complete Data Loss**
- Restore from latest backup (2-4 hours)
- Verify data integrity
- Resume operations

**Contact:** support@netneural.ai for emergency assistance (24/7)

---

## 9. Troubleshooting

### 9.1 Users Can't Log In

**Symptoms:**
- "Invalid credentials" error
- Account locked message
- "Email not verified" error

**Diagnostics:**
1. Check **Audit Log** for failed login attempts
2. Verify user email is correct (case-sensitive)
3. Check if account is active (Settings → Users)
4. Check if 2FA is required but not configured

**Solutions:**
- Reset password: **Settings → Users → Reset Password**
- Unlock account: **Settings → Users → Unlock Account**
- Resend verification email: **Settings → Users → Resend Verification**
- Disable 2FA temporarily: **Settings → Users → Disable 2FA** (requires Owner role)

### 9.2 Devices Not Syncing

**Symptoms:**
- Devices missing from list
- "Last synced: 2 hours ago" (should be <10 minutes)
- Sync button shows error

**Diagnostics:**
1. Check integration status: **Settings → Integrations** → Should show 🟢 Active
2. Test connection: Click **"Test Connection"** → Should show ✅ Success
3. Check provider dashboard (Golioth, AWS) → Verify devices exist
4. Check API key expiration

**Solutions:**
- **Reconnect Integration:**
  1. Edit integration
  2. Re-enter API credentials
  3. Test connection
  4. Save
  5. Click "Sync Devices"

- **Force Sync:**
  1. Go to **Settings → Integrations**
  2. Click **"Force Full Sync"** (may take 2-5 minutes)
  3. Wait for completion
  4. Verify devices appear

- **Contact Provider Support:**
  - Golioth: support@golioth.io
  - AWS: Open AWS Support ticket

### 9.3 Missing Telemetry Data

**Symptoms:**
- Charts show gaps
- "No data available" message
- Last seen timestamp is old

**Diagnostics:**
1. Check device connection status (online vs. offline)
2. Check provider dashboard → Verify device is sending data
3. Check device configuration → Telemetry streaming enabled?
4. Check database query performance (slow queries?)

**Solutions:**
- **Device offline:** Restart device, check network connectivity
- **Integration paused:** Resume integration (Settings → Integrations)
- **Data retention exceeded:** Extend retention period (Settings → Data Retention)

### 9.4 Alerts Not Triggering

**Symptoms:**
- Sensor value exceeds threshold but no alert generated
- Alert generated but no email received

**Diagnostics:**
1. Check threshold configuration (correct min/max values?)
2. Check unit mismatch (°F vs. °C)
3. Check alert evaluation (Settings → Alerts → Last Evaluation)
4. Check email notification settings (Settings → Notifications)

**Solutions:**
- **Threshold Misconfiguration:**
  1. Edit threshold
  2. Verify min < max
  3. Verify correct unit
  4. Save

- **Email Not Sending:**
  1. Check spam/junk folder
  2. Verify email address (Settings → Notifications)
  3. Send test email (Settings → Notifications → Test Email)
  4. Contact support if test fails

### 9.5 Performance Issues

**Symptoms:**
- Dashboard loads slowly (>5 seconds)
- "Loading..." spinner never resolves
- API calls timeout

**Diagnostics:**
1. Check browser console for errors (F12 → Console)
2. Check network speed (slow connection?)
3. Check device count (>1,000 devices may affect performance)
4. Check Sentry dashboard for performance issues

**Solutions:**
- **Browser Cache:** Clear cache (Ctrl + Shift + Delete) or hard reload (Ctrl + F5)
- **Filter Devices:** Use device filters to reduce displayed items
- **Upgrade Subscription:** Higher tiers get better performance (contact sales)
- **Report Issue:** support@netneural.ai with:
  - Browser + version
  - Screenshot of slow page
  - Network tab export (Chrome DevTools → Network → Export HAR)

---

## 10. API Access & Automation

### 10.1 API Documentation

**Full API Reference:** https://api.netneural.io/docs

**Endpoints:**
- `/devices` - List, create, update, delete devices
- `/alerts` - Query alerts, acknowledge
- `/telemetry` - Query historical telemetry data
- `/thresholds` - Configure alert thresholds
- `/users` - User management
- `/organizations` - Organization management

### 10.2 Common Automation Tasks

**Daily Device Health Check (Bash Script):**
```bash
#!/bin/bash
API_KEY="your-api-key-here"
API_URL="https://api.netneural.io"

# Fetch offline devices
offline_devices=$(curl -s "$API_URL/devices?status=offline" \\
  -H "Authorization: Bearer $API_KEY" | jq '.data | length')

if [ "$offline_devices" -gt 5 ]; then
  echo "⚠️ WARNING: $offline_devices devices offline!"
  # Send alert (email, Slack, PagerDuty, etc.)
fi
```

**Bulk Threshold Update (Python):**
```python
import requests

API_KEY = "your-api-key-here"
API_URL = "https://api.netneural.io"

headers = {"Authorization": f"Bearer {API_KEY}"}

# Get all devices
devices = requests.get(f"{API_URL}/devices", headers=headers).json()["data"]

for device in devices:
    # Update temperature threshold
    requests.post(
        f"{API_URL}/thresholds",
        headers=headers,
        json={
            "device_id": device["id"],
            "sensor_type": "temperature",
            "unit": "F",
            "critical_min": 32,
            "critical_max": 80,
            "warning_min": 35,
            "warning_max": 75,
        },
    )
print(f"✅ Updated {len(devices)} devices")
```

---

## Appendix

### A. Security Checklist

- [ ] 2FA enabled for all admins
- [ ] Password policy configured (12+ chars, complexity, expiration)
- [ ] API keys rotated quarterly
- [ ] Audit logs reviewed monthly
- [ ] User access review (quarterly - remove inactive users)
- [ ] Integration API keys have expiration dates
- [ ] TLS 1.3 enforced (check `curl -I` output)
- [ ] Row-Level Security (RLS) active
- [ ] Secrets stored in GitHub Secrets (not `.env` files in Git)

### B. Monthly Maintenance Tasks

- [ ] Review slow queries (Supabase → Query Performance)
- [ ] Review audit logs for suspicious activity
- [ ] Review user access (remove inactive users)
- [ ] Check backup integrity (test restore)
- [ ] Review Sentry performance alerts
- [ ] Update threshold templates based on incidents
- [ ] Review device online/offline trends

### C. Support Contacts

- **General Support:** support@netneural.ai (24-hour response)
- **Technical Support:** techsupport@netneural.ai (<4-hour response)
- **Security Issues:** security@netneural.ai (immediate escalation)
- **Sales/Billing:** sales@netneural.ai
- **Privacy/GDPR:** privacy@netneural.ai
- **Emergency Hotline:** +1-800-XXX-XXXX (24/7, critical outages only)

---

**© 2026 NetNeural. All rights reserved.**

**Document Version:** 1.0  
**Last Reviewed By:** DevOps Team  
**Next Review Date:** March 17, 2026
