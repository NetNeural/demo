# NetNeural IoT Platform - User Quick Start Guide
**Version 1.0** | **Last Updated:** February 17, 2026  
**For:** End Users (Device Operators, Facility Managers, Monitoring Personnel)

---

## Welcome to NetNeural!

This quick start guide will help you begin using the NetNeural IoT Platform in **under 10 minutes**. You'll learn how to log in, view your devices, set up alerts, and monitor your IoT infrastructure.

---

## Table of Contents
1. [Logging In](#1-logging-in)
2. [Understanding the Dashboard](#2-understanding-the-dashboard)
3. [Adding Your First Device](#3-adding-your-first-device)
4. [Setting Up Threshold Alerts](#4-setting-up-threshold-alerts)
5. [Viewing and Acknowledging Alerts](#5-viewing-and-acknowledging-alerts)
6. [Common Tasks](#6-common-tasks)
7. [Getting Help](#7-getting-help)

---

## 1. Logging In

### Step 1: Access the Platform

Navigate to your organization's NetNeural platform URL:
- **Staging:** https://demo-stage.netneural.ai
- **Production:** https://app.netneural.io (or your custom domain)

### Step 2: Enter Credentials

1. Enter your **email address** (provided by your administrator)
2. Enter your **password**
3. Click **"Sign In"**

**First-time users:** Check your email for a verification link and follow the instructions.

### Step 3: Two-Factor Authentication (if enabled)

If your organization requires 2FA:
1. Enter the 6-digit code from your authenticator app (Google Authenticator, Authy, etc.)
2. Click **"Verify"**

**✅ Success!** You're now logged into your NetNeural dashboard.

---

## 2. Understanding the Dashboard

The dashboard is your command center for monitoring all devices.

### Dashboard Sections

#### **Top Navigation Bar**
- **Organization Selector:** Switch between organizations (if you have access to multiple)
- **User Menu:** Access settings, profile, and sign out
- **Notifications:** View system alerts and updates

#### **Sidebar Menu**
- 📊 **Dashboard:** Overview of all devices and alerts
- 📱 **Devices:** List and manage all devices
- 🚨 **Alerts:** View and manage threshold breaches
- ⚙️ **Settings:** Configure thresholds, users, and integrations
- 📈 **Analytics:** Historical data and trends (coming soon)

#### **Main Dashboard View**

**Key Metrics Cards (Top Row):**
- **Total Devices:** Count of all registered devices
- **Online Devices:** Currently connected devices
- **Active Alerts:** Unacknowledged threshold breaches
- **System Health:** Overall platform status

**Recent Alerts (Left Panel):**
- Real-time list of threshold breaches
- Color-coded by severity:
  - 🔴 **Critical:** Immediate action required
  - 🟡 **Warning:** Monitor closely
  - 🟢 **Info:** For your awareness

**Device List (Right Panel):**
- All devices with current status
- Battery levels and connectivity
- Last seen timestamp

---

## 3. Adding Your First Device

### Prerequisites
- Device must be registered with your integration provider (Golioth, AWS IoT, etc.)
- You need **Admin** or **Member** role permissions

### Step-by-Step

#### Option A: Manual Device Addition

1. Click **"Devices"** in the sidebar
2. Click **"+ Add Device"** button (top-right)
3. Fill in device details:
   - **Device Name:** Friendly name (e.g., "Warehouse Temp Sensor")
   - **Device Type:** Select "Sensor" or "Gateway"
   - **External Device ID:** Provider's device ID
   - **Integration:** Select your IoT provider
4. Click **"Add Device"**

**✅ Device added!** You'll see it in the device list within seconds.

#### Option B: Automatic Sync (Recommended)

If your integration supports auto-discovery:
1. Go to **Settings** → **Integrations**
2. Click **"Sync Devices"** next to your integration
3. Wait 10-30 seconds for sync to complete
4. Check **Devices** page – new devices appear automatically

**💡 Pro Tip:** Enable automatic sync in integration settings to continuously discover new devices.

---

## 4. Setting Up Threshold Alerts

Threshold alerts notify you when sensor values exceed safe limits.

### Step-by-Step

1. **Navigate to Device:**
   - Go to **Devices** page
   - Click on a device name to open details

2. **Open Thresholds Dialog:**
   - Click **"Alert Thresholds"** button
   - View current thresholds (if any)

3. **Add New Threshold:**
   - Click **"+ Add Threshold"**
   - Select **Sensor Type**: Temperature, Humidity, Pressure, Battery, etc.
   - Set **Critical Min/Max**: Values triggering red alerts
   - Set **Warning Min/Max**: Values triggering yellow alerts
   - Choose **Unit**: °F, °C, %, PSI, etc.
   - Click **"Save"**

### Example: Temperature Alert

**Scenario:** Alert if warehouse temperature goes above 80°F or below 32°F

```
Sensor Type: Temperature
Unit: °F (Fahrenheit)
Critical Min: 32°F (freezing risk)
Critical Max: 80°F (spoilage risk)
Warning Min: 35°F (monitor closely)
Warning Max: 75°F (getting warm)
```

**✅ Threshold created!** You'll receive alerts when values breach these limits.

### Common Threshold Examples

| Sensor Type | Use Case | Critical Min | Critical Max | Warning Min | Warning Max |
|-------------|----------|--------------|--------------|-------------|-------------|
| **Temperature** | Cold storage | 32°F | 40°F | 34°F | 38°F |
| **Humidity** | Server room | 30% | 60% | 35% | 55% |
| **Battery** | Device maintenance | 10% | N/A | 20% | N/A |
| **CO₂** | Air quality | N/A | 1000 ppm | N/A | 800 ppm |

---

## 5. Viewing and Acknowledging Alerts

### Alert Notifications

**You'll be notified when:**
- Sensor values breach thresholds
- Devices go offline unexpectedly
- System detects anomalies

**Notification Methods:**
- 📧 **Email:** Immediate alerts sent to your email
- 🔔 **In-App:** Badge on Alerts menu (sidebar)
- 📱 **Dashboard:** Real-time alert cards

### View Alerts

1. Click **"Alerts"** in sidebar
2. See all alerts in list or card view
3. Filter by:
   - **Status:** All / Unacknowledged only
   - **Severity:** Critical / Warning / Info
   - **Category:** Environmental / Connectivity / Security / System

### Alert Details

Click any alert to see:
- **Current Value:** What triggered the alert
- **Threshold Values:** Min/max limits breached
- **Device Info:** Which device triggered alert
- **Breach Type:** Critical min/max or warning
- **Timestamp:** When breach occurred

### Acknowledge Alerts

**Single Alert:**
1. Open alert details
2. Click **"Acknowledge"** button
3. Alert marked as handled (user/timestamp recorded)

**Bulk Acknowledge:**
1. Select multiple alerts (checkboxes)
2. Click **"Acknowledge Selected"** button
3. All selected alerts marked as handled

**💡 Why Acknowledge?**
- Tracks who handled the alert
- Removes from "Unacknowledged" view
- Maintains audit trail for compliance
- Shows team coordination

---

## 6. Common Tasks

### Export Device Data

1. Go to **Devices** page
2. Click **"Export CSV"** button (top-right)
3. Wait for export to complete
4. Download opens automatically

**CSV includes:**
- Device names and status
- Battery levels
- Last seen timestamps
- Integration details

### Change Temperature Units

**Global Setting:**
1. Go to **Settings** → **Preferences**
2. Select **Temperature Unit**: Fahrenheit or Celsius
3. Click **"Save"**

**On-the-Fly:**
- Click **°F** or **°C** toggle on any temperature display
- Converts instantly without page reload

### Search for Devices

1. Go to **Devices** page
2. Use **search bar** (top)
3. Search by:
   - Device name
   - Model
   - Device ID

### Filter Devices

**By Type:**
- Click **"All"** / **"Sensors"** / **"Gateways"** tabs

**By Status:**
- Click **"All"** / **"Online"** / **"Offline"** / **"Warning"** buttons

**By Organization:**
- Use organization selector (top navigation)

### View Device History

1. Click device name to open details
2. Scroll to **"Telemetry History"** section
3. View recent sensor readings
4. Click **"Show More"** for extended history

**Charts Available:**
- Temperature trends
- Humidity over time
- Battery drain rate
- Signal strength

---

## 7. Getting Help

### In-App Help

**Help Menu:**
- Click **"?"** icon (top-right navigation)
- Access:
  - Documentation
  - Video tutorials
  - API reference
  - Contact support

### Quick Reference Card

**Keyboard Shortcuts:**
- `Ctrl + K` or `Cmd + K`: Quick search
- `A`: Go to Alerts
- `D`: Go to Devices
- `H`: Go to Dashboard
- `?`: Show shortcuts

### Support Channels

**Email Support:**
- General inquiries: support@netneural.ai
- Technical issues: techsupport@netneural.ai
- Sales: sales@netneural.ai

**Response Times:**
- 🔴 **Critical:** <1 hour (production outages)
- 🟡 **High:** <4 hours (functionality impaired)
- 🟢 **Normal:** <24 hours (general questions)

**Community:**
- Community Forum: https://community.netneural.ai
- GitHub Issues: https://github.com/NetNeural/MonoRepo-Staging/issues

### Advanced Documentation

For more detailed information:
- **Administrator Guide:** Full platform administration
- **API Documentation:** Integration and automation
- **Developer Setup Guide:** Custom integrations
- **Video Tutorials:** Step-by-step visual guides

---

## Troubleshooting

### I can't log in

**Check:**
- ✅ Email address is correct (case-sensitive)
- ✅ Password is correct
- ✅ Account has been activated (check email)
- ✅ Not locked out (5 failed attempts = 15-minute lockout)

**Solution:** Click "Forgot Password?" to reset

### My device isn't showing up

**Check:**
- ✅ Device is registered with integration provider (Golioth, etc.)
- ✅ Integration is connected (Settings → Integrations)
- ✅ Auto-sync is enabled, or manual sync has run
- ✅ You have permission to view devices in this organization

**Solution:** Go to Settings → Integrations → "Sync Devices"

### I'm not receiving alert emails

**Check:**
- ✅ Email is verified (Settings → Profile)
- ✅ Alert email notifications are enabled (Settings → Notifications)
- ✅ Check spam/junk folder
- ✅ Email server isn't blocking netneural.ai domain

**Solution:** Add support@netneural.ai to your contacts

### Alerts show wrong temperature unit

**Check:**
- ✅ Temperature unit setting (Settings → Preferences)
- ✅ Threshold configured in same unit as preference
- ✅ Browser cache cleared (Ctrl + F5)

**Solution:** Toggle temperature unit (°F/°C) to force refresh

### Dashboard is loading slowly

**Check:**
- ✅ Internet connection speed
- ✅ Browser is up-to-date (Chrome, Firefox, Safari, Edge)
- ✅ Large number of devices (>100 may affect performance)

**Solution:** 
- Use device filters to reduce displayed items
- Clear browser cache
- Try incognito/private browsing mode

---

## Next Steps

Now that you're familiar with the basics:

1. **✅ Set up thresholds** for all critical sensors
2. **✅ Configure notification preferences** (Settings → Notifications)
3. **✅ Invite team members** (Settings → Users → Invite)
4. **✅ Explore Analytics** (coming soon) for trend analysis
5. **✅ Review Administrator Guide** if you have admin access

---

## Feedback

We're constantly improving NetNeural! Your feedback helps us build a better platform.

**Share your thoughts:**
- 📧 Email: feedback@netneural.ai
- 💬 Community Forum: https://community.netneural.ai
- ⭐ Feature requests: GitHub Issues

---

**Questions?** Contact support@netneural.ai or visit our [Help Center](https://help.netneural.ai)

**© 2026 NetNeural. All rights reserved.**
