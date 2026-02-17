# NetNeural IoT Platform - Video Tutorials Plan
**Version 1.0** | **Last Updated:** February 17, 2026  
**Status:** Planning Complete, Production Pending

---

## Overview

This document outlines the plan for creating a comprehensive video tutorial series for the NetNeural IoT Platform. Videos will be professionally produced with screen recordings, narration, closed captions, and embedded in documentation.

**Target Completion:** Q1 2026 (March 31, 2026)

---

## Table of Contents

1. [Tutorial Series](#1-tutorial-series)
2. [Production Specifications](#2-production-specifications)
3. [Recording Setup](#3-recording-setup)
4. [Editing Guidelines](#4-editing-guidelines)
5. [Hosting & Distribution](#5-hosting--distribution)
6. [Accessibility](#6-accessibility)
7. [Timeline & Resources](#7-timeline--resources)

---

## 1. Tutorial Series

### Tutorial 1: Platform Overview (5 minutes)

**Objective:** Provide high-level introduction to NetNeural IoT Platform capabilities.

**Target Audience:** New users, decision-makers, evaluators

**Script:**

**[0:00-0:30] Introduction**
- "Welcome to NetNeural IoT Platform - your complete solution for IoT device management."
- "In this 5-minute overview, we'll explore the key features that make NetNeural the ideal platform for monitoring and managing your IoT devices."
- Show: Login screen → Dashboard transition

**[0:30-1:30] Dashboard Overview**
- "The dashboard gives you an at-a-glance view of your entire IoT ecosystem."
- Show: Dashboard with metrics cards
- "Here you see 42 devices online, 7 unacknowledged alerts, and real-time telemetry data."
- Highlight: Device status cards, alert panel, recent activity feed

**[1:30-2:30] Device Management**
- "Managing devices is simple. Click 'Devices' to see your full inventory."
- Show: Device list with filters
- "Search, filter by status or location, and view detailed device information."
- Click device → Show device detail page with live telemetry charts

**[2:30-3:30] Alerts & Notifications**
- "NetNeural monitors your devices 24/7 and alerts you when thresholds are exceeded."
- Show: Alert list with critical temperature alert
- "Acknowledge alerts individually or in bulk, add notes, and track resolution history."
- Demonstrate: Click alert → View details → Acknowledge

**[3:30-4:30] Advanced Features**
- "Configure custom alert thresholds for each sensor type."
- Show: Threshold configuration form
- "Integrate with external IoT platforms like Golioth, AWS IoT, and MQTT brokers."
- Show: Integrations page
- "Generate AI-powered insights for predictive maintenance."
- Show: AI insights panel

**[4:30-5:00] Call-to-Action**
- "Ready to get started? Check out our Quick Start Guide in the documentation."
- "For detailed tutorials, watch the next videos in this series."
- Show: Documentation links, next video thumbnail

**Scenes to Record:**
- Clean dashboard with sample data (seed database)
- Device list with 10-15 visible devices
- Alert acknowledgement workflow
- Threshold configuration form
- Integrations page

---

### Tutorial 2: Device Setup (10 minutes)

**Objective:** Guide users through adding and configuring their first device.

**Target Audience:** End users, facility managers, technicians

**Script:**

**[0:00-1:00] Introduction**
- "In this tutorial, you'll learn how to add devices to NetNeural in two ways: manual entry and automatic synchronization."
- Show: Devices page

**[1:00-3:00] Manual Device Addition**
- "Click the 'Add Device' button to open the device form."
- Walk through form fields:
  * Device Name: "Warehouse Freezer 1"
  * Device Type: Select "Temperature Sensor"
  * Model: "TempSense Pro"
  * Serial Number: "TS-2024-001"
  * Location: Select from dropdown or create new
- "Click 'Create Device' and your device appears in the list."
- Show: New device in list with "offline" status

**[3:00-5:00] Automatic Device Sync (Golioth)**
- "For faster setup, connect your Golioth account to automatically sync devices."
- Navigate: Settings → Integrations → Add Integration
- Select "Golioth" from dropdown
- "Enter your Golioth API key from the Golioth Console."
- Show: API key field, "Test Connection" button
- Click "Test Connection" → ✅ Success
- Click "Save" → Enable "Auto-Sync"
- "Set sync interval to 5 minutes for real-time updates."
- Click "Sync Devices" → Show progress bar
- "Your Golioth devices now appear in NetNeural automatically."

**[5:00-7:00] Configure Alert Thresholds**
- "Now let's configure alert thresholds for our new device."
- Click device → "Configure Thresholds" tab
- "For a freezer, we want alerts if temperature goes above 40°F or below 32°F."
- Fill in threshold form:
  * Sensor Type: Temperature
  * Warning Min: 34°F
  * Warning Max: 38°F
  * Critical Min: 32°F
  * Critical Max: 40°F
  * Unit: Fahrenheit
- "Enable email notifications and add your email address."
- Click "Save Thresholds"

**[7:00-9:00] Verify Device is Reporting**
- "Back on the device page, you should see telemetry data appearing."
- Show: Device detail page with live chart updating
- "The green status indicator means the device is online and healthy."
- "Hover over chart points to see exact values and timestamps."
- "Use the time range selector to view historical data."

**[9:00-10:00] Troubleshooting & Next Steps**
- "If your device shows 'offline', check network connectivity and API credentials."
- "For more help, see the Troubleshooting section in the User Guide."
- "Next, watch 'Alert Configuration Tutorial' to customize your alerting strategy."

**Scenes to Record:**
- Device form (empty → filled → submitted)
- Golioth integration setup (API key entry, test connection, sync)
- Threshold configuration form
- Device detail page with live telemetry chart
- Device list showing newly added device

---

### Tutorial 3: Alert Configuration (8 minutes)

**Objective:** Teach users how to configure, customize, and manage alert thresholds.

**Target Audience:** Facility managers, operations managers, administrators

**Script:**

**[0:00-1:00] Introduction**
- "Effective alerting is critical for maintaining operational standards."
- "In this tutorial, you'll learn how to configure alert thresholds, set up notifications, and manage alert rules."

**[1:00-3:00] Understanding Threshold Types**
- "NetNeural supports two threshold levels: Warning and Critical."
- Show diagram:
  * Green zone: Normal range (34-38°F)
  * Yellow zone: Warning range (32-34°F, 38-40°F)
  * Red zone: Critical range (<32°F, >40°F)
- "Warning alerts notify you of potential issues. Critical alerts require immediate action."

**[3:00-5:00] Configuring Thresholds**
- Navigate: Device → Configure Thresholds
- "Let's configure thresholds for a cold storage facility."
- Walk through form:
  * Sensor Type: Temperature
  * Critical Min: 32°F (FDA requirement for refrigerated foods)
  * Critical Max: 40°F
  * Warning Min: 34°F (2°F buffer)
  * Warning Max: 38°F
- "Use warning thresholds to catch trends before they become critical."
- Click "Save"

**[5:00-6:30] Notification Configuration**
- "Configure who receives alerts and how."
- Settings → Notifications → Email
- Add recipients: "manager@example.com, technician@example.com"
- Select severity filter: "Critical and Warning"
- Choose delivery mode:
  * Immediate: For critical alerts
  * Hourly Digest: For warnings
- Set quiet hours: "10 PM - 6 AM" (suppress non-critical alerts)
- Click "Test Email" → Verify receipt
- Click "Save"

**[6:30-7:30] Bulk Threshold Configuration**
- "Apply the same thresholds to multiple devices at once."
- Settings → Alert Templates → Create Template
- Name: "Cold Storage Standard"
- Configure all thresholds
- Save template
- Devices page → Select 10 devices (checkboxes)
- Bulk Actions → Apply Template → Select "Cold Storage Standard"
- "All 10 devices now have consistent thresholds."

**[7:30-8:00] Best Practices & Next Steps**
- "Set warning thresholds 10-20% stricter than critical to catch issues early."
- "Test alerts by temporarily adjusting thresholds below current values."
- "Review alert history monthly to optimize threshold settings."
- "Next: Watch 'Reporting Tutorial' to analyze alert trends."

**Scenes to Record:**
- Threshold configuration form with visual diagram
- Notification configuration page
- Test email demonstration
- Bulk threshold application workflow
- Alert template creation

---

### Tutorial 4: Reporting & Analytics (7 minutes)

**Objective:** Demonstrate how to generate reports, analyze trends, and export data.

**Target Audience:** Managers, compliance officers, data analysts

**Script:**

**[0:00-1:00] Introduction**
- "NetNeural provides comprehensive reporting to track device health, alert trends, and compliance."
- "In this tutorial, you'll learn to generate reports, analyze data, and export for audits."

**[1:00-2:30] Dashboard Analytics**
- "The dashboard provides real-time overview metrics."
- Show: Dashboard with metrics cards
- "Total Devices: 42 (38 online, 4 offline)"
- "Unacknowledged Alerts: 7 (2 critical, 5 warning)"
- "Telemetry Readings Today: 60,480"
- "Click any metric to drill down into details."

**[2:30-4:00] Device Health Report**
- Navigate: Reports → Device Health
- Select organization: "ACME Corporation"
- Select date range: "Last 30 days"
- Click "Generate PDF"
- Show: PDF report preview
- "Report includes:"
  * Device uptime percentage
  * Battery health trends
  * Connectivity issues
  * Alert frequency per device
  * Data transmission gaps

**[4:00-5:00] Alert Summary Report**
- Navigate: Reports → Alerts
- Select date range: "Last week"
- Filter by: Severity "Critical"
- Click "Generate Report"
- Show: Report with:
  * Total critical alerts: 17
  * Average acknowledgment time: 12 minutes
  * Top alerting devices (table)
  * Alert breakdown by category (chart)

**[5:00-6:00] Data Export**
- "Export raw data for custom analysis in Excel or BI tools."
- Navigate: Devices page
- Select devices (checkboxes)
- Click "Export CSV"
- Show: CSV file opening in Excel
- Columns: Device ID, Name, Status, Last Seen, Battery, etc.
- "You can also export telemetry data and alert history."

**[6:00-7:00] Scheduled Reports**
- "Automate report delivery for weekly/monthly reviews."
- Settings → Reports → Scheduled Reports
- Click "New Scheduled Report"
- Configure:
  * Report Type: Device Health
  * Frequency: Weekly (Every Monday 8 AM)
  * Recipients: management@example.com
  * Format: PDF
- Click "Save"
- "You'll receive reports automatically via email."

**Scenes to Record:**
- Dashboard with live metrics
- Device Health report generation and PDF preview
- Alert Summary report with charts
- CSV export demonstration
- Scheduled report configuration

---

### Tutorial 5: Administrator Functions (12 minutes)

**Objective:** Teach administrators how to manage users, organizations, integrations, and security.

**Target Audience:** System administrators, IT managers, security officers

**Script:**

**[0:00-1:00] Introduction**
- "As an administrator, you're responsible for managing users, organizations, integrations, and security."
- "This tutorial covers all administrative functions in NetNeural."

**[1:00-3:00] Organization Management**
- Navigate: Settings → Organizations
- "Organizations represent your company structure: divisions, facilities, departments."
- Click "New Organization"
- Fill in:
  * Name: "North American Division"
  * Parent Organization: "ACME Corporation"
  * Timezone: "America/New_York"
  * Temperature Unit: "Fahrenheit"
- Click "Create"
- "Sub-organizations inherit permissions from parent organizations."

**[3:00-5:00] User Management**
- Navigate: Settings → Users
- "Four user roles: Owner (full access), Admin (manage users/devices), Member (view and acknowledge), Viewer (read-only)."
- Click "Invite User"
- Enter:
  * Email: "john@example.com"
  * Role: "Admin"
  * Organizations: Select "North American Division"
- Click "Send Invitation"
- "User receives email with invitation link valid for 7 days."
- Show: Change user role dropdown, Remove user button

**[5:00-7:00] Integration Setup (Golioth)**
- Navigate: Settings → Integrations → Add Integration
- Select "Golioth"
- Name: "Golioth Production"
- API Key: [paste from Golioth Console]
- API URL: "https://api.golioth.io"
- Click "Test Connection" → ✅ Success
- Enable "Auto-Sync" → Set interval: "5 minutes"
- Click "Save"
- Click "Sync Devices" → Wait 10-30 seconds
- Navigate: Devices → Verify devices imported

**[7:00-9:00] Security Configuration**
- Navigate: Settings → Security
- **Password Policy:**
  * Minimum length: 12 characters
  * Complexity: Uppercase + lowercase + number + special char
  * Expiration: 90 days
  * History: Last 5 passwords
- **2FA Policy:**
  * Select: "Required for Admin and Owner roles"
  * Grace period: 7 days
- **Account Lockout:**
  * Failed attempts: 5
  * Lockout duration: 15 minutes
- Click "Save"

**[9:00-10:30] API Key Management**
- Navigate: Settings → API Keys
- Click "New API Key"
- Configure:
  * Name: "CI/CD Pipeline Key"
  * Permissions: "Read-only"
  * Scope: "North American Division"
  * Expiration: "90 days"
- Click "Create" → Copy key (shown once!)
- "Store key securely in GitHub Secrets or vault."
- "Rotate keys every 90 days for security."

**[10:30-11:30] Audit Logs**
- Navigate: Settings → Audit Log
- "All user actions are logged for compliance and security."
- Filter by:
  * Date range: Last 30 days
  * User: Select specific user
  * Action type: "threshold_update"
- View: User, Action, Timestamp, Details
- Click "Export CSV" for compliance reports

**[11:30-12:00] Best Practices & Resources**
- "Enable 2FA for all admins to prevent unauthorized access."
- "Review audit logs monthly for suspicious activity."
- "Rotate API keys quarterly."
- "Document your organization structure in the Administrator Guide."
- "For questions, contact support@netneural.ai."

**Scenes to Record:**
- Organization creation workflow
- User invitation and role management
- Golioth integration setup (complete flow)
- Security settings configuration
- API key creation (with copy step emphasized)
- Audit log filtering and export

---

## 2. Production Specifications

### Video Format
- **Resolution:** 1920x1080 (1080p Full HD)
- **Frame Rate:** 30 fps
- **Aspect Ratio:** 16:9
- **File Format:** MP4 (H.264 codec)
- **Audio:** AAC, 128 kbps, stereo

### Visual Style
- **Brand Colors:** 
  * Primary: #2563EB (Blue)
  * Secondary: #10B981 (Green)
  * Accent: #F59E0B (Orange)
- **Cursor:** Highlight cursor clicks with ripple effect
- **Transitions:** Smooth fade (0.5s duration)
- **Text Overlays:** 
  * Font: Inter (Google Fonts)
  * Size: 24-32px
  * Position: Lower third
  * Background: Semi-transparent dark overlay

### Audio
- **Narration:** Professional voiceover or presenter
- **Background Music:** Subtle instrumental (volume: 15-20%, copyright-free)
- **Sound Effects:** 
  * Click sounds for button presses
  * Success chime for completions
  * Alert sound for errors

---

## 3. Recording Setup

### Software Options

**Option 1: Loom (Recommended for quick production)**
- **Cost:** Free tier (up to 25 videos, 5 min each) or Business ($12.50/user/month)
- **Pros:** 
  * Easy to use
  * Automatic cloud hosting
  * Built-in editing
  * Instant sharing
- **Cons:** 
  * Limited editing capabilities
  * 720p max on free tier

**Option 2: OBS Studio (Recommended for professional production)**
- **Cost:** Free and open-source
- **Pros:**
  * High quality (1080p/4K)
  * Advanced scene management
  * Plugins and effects
  * Multi-source recording
- **Cons:**
  * Steeper learning curve
  * Requires separate editing

**Option 3: Camtasia (Recommended for all-in-one solution)**
- **Cost:** $299.99 one-time purchase
- **Pros:**
  * Recording + editing in one tool
  * Professional effects library
  * Quizzes and interactivity
  * Multi-format export
- **Cons:**
  * Expensive upfront cost

### Recording Environment
- **Display:** 1920x1080 resolution (scale UI to 100%)
- **Browser:** Chrome or Firefox (latest version)
- **Browser Extensions:** Disable ad blockers, Dev Tools closed
- **Data:** Use seeded database with realistic sample data (not production data)
- **Audio:** Quiet room, microphone with pop filter, test recording first

### Presenter Guidelines
- **Pacing:** Speak slowly and clearly (150-160 words per minute)
- **Pauses:** 2-3 second pause after each major step
- **Mistakes:** Don't stop! Continue and edit later
- **Script:** Have script visible on second monitor or printed

---

## 4. Editing Guidelines

### Editing Software

**Option 1: DaVinci Resolve (Free)**
- Professional-grade editing
- Color correction and audio mixing
- Learning curve: Moderate

**Option 2: Adobe Premiere Pro (Paid)**
- Industry standard
- Integration with After Effects for motion graphics
- Cost: $20.99/month (Creative Cloud)

**Option 3: iMovie (Mac only, Free)**
- Simple and intuitive
- Good for basic editing
- Limited effects

### Editing Checklist

**Video Editing:**
- [ ] Remove mistakes and long pauses
- [ ] Add smooth transitions between scenes (0.5s fade)
- [ ] Apply consistent color grading (brand colors)
- [ ] Add text overlays for key steps (lower third)
- [ ] Highlight cursor clicks with effects
- [ ] Add intro graphic (3-5 seconds)
- [ ] Add outro with call-to-action (5-7 seconds)

**Audio Editing:**
- [ ] Remove background noise (use noise gate/suppression)
- [ ] Normalize audio levels (-3dB peak)
- [ ] Add background music (15-20% volume)
- [ ] Fade in/out music at start/end
- [ ] Sync voiceover with on-screen actions

**Quality Control:**
- [ ] Watch full video at 1x speed
- [ ] Check all links and references are accurate
- [ ] Verify audio/video sync
- [ ] Test playback on mobile device
- [ ] Review with colleague for feedback

### Intro/Outro Templates

**Intro (3-5 seconds):**
```
[NetNeural Logo Animation]
"NetNeural IoT Platform Tutorial"
"Tutorial 1: Platform Overview"
```

**Outro (5-7 seconds):**
```
"Thank you for watching!"
"Next: [Next Tutorial Title]"
"Subscribe for more tutorials"
[NetNeural logo + website URL]
```

---

## 5. Hosting & Distribution

### Primary Hosting: YouTube

**NetNeural Channel Setup:**
- Channel Name: "NetNeural Platform"
- Channel Description: "Official tutorials for the NetNeural IoT Platform. Learn device management, alert configuration, reporting, and administration."
- Channel Art: 2560x1440px banner with brand colors
- Profile Picture: NetNeural logo (800x800px)

**Video Upload Checklist:**
- [ ] Title: "NetNeural Tutorial 1: Platform Overview (5 min)"
- [ ] Description: Include timestamps, links to docs, support contact
- [ ] Tags: netneural, iot, tutorial, device management, platform overview
- [ ] Thumbnail: Custom 1280x720px image with tutorial number + title
- [ ] Playlist: Add to "NetNeural Tutorials" playlist
- [ ] Visibility: Public (or Unlisted for beta testing)
- [ ] End Screen: Add links to next video and subscribe button
- [ ] Cards: Add cards at relevant timestamps linking to docs

**Video Description Template:**
```markdown
📘 NetNeural Tutorial 1: Platform Overview (5 minutes)

In this tutorial, you'll get a high-level introduction to the NetNeural IoT Platform, including:
- Dashboard overview
- Device management
- Alerts and notifications
- Advanced features

🔗 Resources:
- User Quick Start Guide: https://netneural.io/docs/user-guide
- Administrator Guide: https://netneural.io/docs/admin-guide
- API Documentation: https://netneural.io/docs/api
- Support: support@netneural.ai

⏰ Timestamps:
0:00 Introduction
0:30 Dashboard Overview
1:30 Device Management
2:30 Alerts & Notifications
3:30 Advanced Features
4:30 Next Steps

📧 Questions or feedback? Contact support@netneural.ai

👍 Like this video? Subscribe for more tutorials!

#netneural #iot #tutorial #devicemanagement
```

### Secondary Hosting: Vimeo (Optional)

**Use Case:** Higher quality playback, no ads, privacy controls

**Vimeo Plan:** Plus ($12/month) or Pro ($40/month)

**Benefits:**
- Ad-free playback
- Password protection for internal videos
- Better analytics
- Customizable player

### Embedding in Documentation

**Markdown Example (`docs/USER_QUICK_START.md`):**
```markdown
## Video Tutorial: Platform Overview

<iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID" title="NetNeural Tutorial 1: Platform Overview" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

**Duration:** 5 minutes  
**Topics:** Dashboard overview, device management, alerts, advanced features

[Watch on YouTube](https://youtube.com/watch?v=VIDEO_ID) | [Download PDF Transcript](./transcripts/tutorial-1.pdf)
```

**HTML Example (for Next.js pages):**
```tsx
<div className="video-container">
  <iframe
    width="100%"
    height="400"
    src="https://www.youtube.com/embed/VIDEO_ID"
    title="NetNeural Tutorial 1: Platform Overview"
    frameBorder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
  />
</div>

<style jsx>{`
  .video-container {
    position: relative;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    height: 0;
    overflow: hidden;
  }
  .video-container iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
`}</style>
```

---

## 6. Accessibility

### Closed Captions (Required)

**Generation Methods:**

**Option 1: YouTube Auto-Generated (Free, Quick)**
1. Upload video to YouTube
2. YouTube generates captions automatically (90% accuracy)
3. Edit captions for 100% accuracy
4. Download SRT file for other platforms

**Option 2: Rev.com (Paid, High Accuracy)**
- Cost: $1.50/minute (~$7.50 for 5-min video)
- Turnaround: 24 hours
- Accuracy: 99%+
- Human-reviewed

**Option 3: Manual Transcription (Free, Time-Consuming)**
1. Use free tools: YouTube Studio, Subtitle Edit, Aegisub
2. Transcribe narration word-for-word
3. Add timestamps (0:00:00,000 --> 0:00:05,000)
4. Export as SRT or VTT format

**Caption Format (SRT Example):**
```srt
1
00:00:00,000 --> 00:00:05,000
Welcome to NetNeural IoT Platform - your complete solution for IoT device management.

2
00:00:05,000 --> 00:00:10,000
In this 5-minute overview, we'll explore the key features that make NetNeural ideal.
```

### Audio Descriptions (Recommended)

**For visually impaired users:**
- Add verbal descriptions of on-screen actions
- Example: "Clicking the 'Add Device' button in the top-right corner"
- Describe visual elements: "The chart shows temperature rising from 34°F to 38°F"

### Transcript (PDF)

**Create downloadable PDF transcript for each video:**
1. Export captions as plain text
2. Format in Word or Google Docs with:
   - Video title and duration
   - Timestamps for each section
   - Links to referenced documentation
3. Export as PDF
4. Host on website: `/docs/transcripts/tutorial-1-platform-overview.pdf`

---

## 7. Timeline & Resources

### Production Schedule

| Phase | Duration | Tasks | Deliverables |
|-------|----------|-------|--------------|
| **Pre-Production** | Week 1-2 | Script writing, storyboarding, data seeding | 5 finalized scripts, seeded database |
| **Recording** | Week 3-4 | Screen recording, voiceover narration | 5 raw video files |
| **Post-Production** | Week 5-6 | Editing, effects, captions | 5 edited videos with captions |
| **Publishing** | Week 7 | YouTube upload, embedding, testing | Published videos, updated docs |
| **Promotion** | Week 8 | Social media, email announcement, in-app links | Playlist live, users notified |

**Total Duration:** 8 weeks (target completion: March 31, 2026)

### Resource Requirements

**Personnel:**
- Video Producer/Editor: 40 hours
- Script Writer: 16 hours
- Voiceover Narrator: 8 hours
- QA Tester: 8 hours
- **Total:** 72 hours (~2 person-weeks)

**Budget:**
- Software (Camtasia one-time): $300
- Voiceover (Rev.com): $5/video × 5 = $25
- Closed Captions (Rev.com): $7.50/video × 5 = $37.50
- YouTube Premium (ad-free hosting): Free
- **Total:** ~$362.50

**Equipment (Existing):**
- High-quality microphone (Blue Yeti or equivalent)
- 1920x1080 monitor
- Quiet recording environment

---

## 8. Success Metrics

### Video Performance KPIs

**YouTube Analytics:**
- **Views:** Target 500+ views per video in first month
- **Watch Time:** Target 60% average completion rate
- **Engagement:** Target 5% like rate, 2% comment rate
- **Click-Through Rate (CTR):** Target 8% for thumbnails

**Documentation Metrics:**
- **Page Views:** Increase of 30% on doc pages with embedded videos
- **Time on Page:** Increase of 40% (users watching videos)
- **Bounce Rate:** Decrease of 20% (videos keep users engaged)

**User Feedback:**
- Survey new users: "Did video tutorials help you get started?" (Target: 80% yes)
- Support tickets: Track reduction in basic "how-to" questions (Target: 30% reduction)

---

## 9. Maintenance & Updates

### Video Update Schedule

**Quarterly Review (Every 3 months):**
- Review analytics to identify low-performing videos
- Check for outdated UI/features
- Re-record segments if major changes

**Immediate Update Triggers:**
- Major UI redesign
- New feature that changes core workflow
- Critical bug fix that invalidates tutorial steps

**Versioning:**
- Video title includes version: "Tutorial 1: Platform Overview (v2.0)"
- Description includes "Last updated: February 2026"
- YouTube allows video replacement without changing URL

---

## Appendix

### A. Recording Script Template

```markdown
# Tutorial [Number]: [Title] ([Duration] minutes)

**Objective:** [What users will learn]
**Target Audience:** [Who should watch this]

---

## Script

### [Timestamp] Scene 1: [Scene Name]
**Screen:** [What's visible on screen]
**Action:** [Mouse clicks, navigation]
**Narration:**
"[Exact words to say]"

### [Timestamp] Scene 2: [Scene Name]
**Screen:** [What's visible]
**Action:** [Actions]
**Narration:**
"[Words]"

---

## B-Roll Footage Needed
- [ ] Dashboard loading animation
- [ ] Device list scrolling
- [ ] Success notification animation

## Props/Data Needed
- Seeded database with 42 devices
- Sample Golioth API key (test account)
- Pre-configured alert thresholds
```

### B. Thumbnail Design Template

**Dimensions:** 1280x720px (16:9)

**Elements:**
- Bold tutorial number (top-left): "1"
- Tutorial title: "Platform Overview"
- Screenshot of key UI element
- NetNeural logo (bottom-right)
- Duration badge: "5 MIN"
- Brand colors background gradient

**Tools:** Canva (free), Adobe Photoshop, Figma

---

## Contact & Support

**Video Production Questions:** video@netneural.ai  
**Script Feedback:** docs@netneural.ai  
**Technical Issues:** techsupport@netneural.ai

---

**© 2026 NetNeural. All rights reserved.**

**Document Version:** 1.0  
**Last Reviewed By:** Marketing & Documentation Team  
**Next Review Date:** April 17, 2026
