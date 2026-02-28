# AI-Powered Analytics & Reporting Features

## Overview

NetNeural IoT Platform includes comprehensive AI-powered analytics and reporting capabilities to help you make data-driven decisions about your IoT fleet.

## Current AI Features

### 1. **AI Forecasting Section** 📈

**Location:** `/dashboard/analytics`

**Features:**
- **Trend Predictions**: Linear regression forecasting for temperature, battery, RSSI, and humidity
- **Anomaly Detection**: Statistical outlier detection using 2σ threshold
- **Battery Depletion Forecasting**: Predicts when devices will run out of battery
- **Confidence Scoring**: R² coefficient displayed for prediction reliability

**How It Works:**
1. Analyzes telemetry data over selected time range (24h, 7d, 30d)
2. Calculates regression slope and intercept for each metric
3. Detects anomalies (values > 2 standard deviations from mean)
4. Forecasts battery depletion using drain rate calculation
5. Displays confidence level (●= high, ◐= moderate, ○= low)

**Example Use Cases:**
- Identify devices with battery drain issues before they go offline
- Detect temperature anomalies that may indicate sensor malfunction
- Predict when signal strength will degrade below acceptable levels

---

### 2. **OpenAI-Powered Insights** 🤖

**Location:** Device details page → Statistical Summary Card

**Features:**
- **Natural Language Insights**: GPT-3.5-turbo analyzes sensor data and provides actionable recommendations
- **Smart Caching**: 15-minute cache reduces API costs by ~95%
- **Graceful Fallback**: Switches to rule-based analysis if OpenAI unavailable
- **Toggle Control**: Users can switch between AI and rule-based analysis

**How It Works:**
1. Sends last 50 telemetry readings to Edge Function `/functions/v1/ai-insights`
2. OpenAI generates 2-4 insights (normal, warning, critical, info)
3. Results cached in `ai_insights_cache` table for 15 minutes
4. Token usage tracked for cost monitoring

**Cost Control:**
- Average: $0.00075 per insight (~500 tokens @ $0.0015/1K)
- With cache: ~$0.072 per device per day
- Monthly: ~$2.20 per device with continuous monitoring

**Example Insights:**
- "Battery drain rate 2x higher than normal. Check device power settings."
- "Temperature readings stable. No anomalies detected in last 48 hours."
- "Signal strength degrading. Consider relocating device or adding repeater."

---

### 3. **AI Report Summaries** 📊

**Location:** Reports pages (Alert History, Telemetry Trends, Audit Log)

**Features:**
- **Key Findings**: 2-3 main insights from report data
- **Red Flags**: Critical issues requiring immediate attention
- **Recommendations**: 2-3 actionable next steps
- **Trend Analysis**: One-paragraph summary of patterns
- **Confidence Scoring**: AI confidence level (0-100%)

**How It Works:**
1. Report generates with filtering/date range
2. Component calls `/functions/v1/generate-report-summary`
3. OpenAI GPT-3.5-turbo analyzes report metadata
4. Summary cached for 30 minutes per organization
5. Falls back to rule-based summary if AI unavailable

**Example Summary:**
```
Alert History Report (Last 7 Days)

Key Findings:
• 42 total alerts received, 38 resolved (90.5% resolution rate)
• Average response time: 12.3 minutes (excellent)
• 3 devices generated 60% of all alerts

Red Flags:
• Device "Sensor-A12" has 15 critical alerts - investigate immediately

Recommendations:
• Review alert thresholds for top 3 alerting devices
• Consider maintenance schedule for sensor-A12
• Continue current response time performance

Trend Analysis: Alert volume stable compared to previous week. 
Response times improved by 15%. One device requires attention.

Confidence: 85%
```

---

## Metric Definitions

### Dashboard Metrics

**Total Devices**
- Definition: Total registered devices in your organization (online + offline)
- Calculation: `COUNT(devices WHERE organization_id = current_org)`

**Online Devices**
- Definition: Devices that sent telemetry within last 5 minutes
- Calculation: `COUNT(devices WHERE last_seen > NOW() - 5 minutes)`

**Active Alerts**
- Definition: Unresolved alerts requiring attention
- Calculation: `COUNT(alerts WHERE is_resolved = false)`

**Uptime %**
- Definition: Percentage of time device was online in selected period
- Calculation: `(online_hours / total_hours) × 100`

**Battery Level**
- Definition: Current battery charge percentage from device telemetry
- Example: 85% = 85% charge remaining

**RSSI (Signal Strength)**
- Definition: Received Signal Strength Indicator in dBm
- Scale: -65 dBm = excellent, -85 dBm = fair, -100 dBm = poor

**Response Time**
- Definition: Average time from alert creation to acknowledgment
- Calculation: `AVG(acknowledged_at - created_at)`

**AI Confidence**
- Definition: Statistical confidence of AI prediction
- Calculation: R² (coefficient of determination) for regression models
- Example: 0.85 (85%) = highly reliable predictions

---

## Data Freshness Indicators

All reports and dashboards display data freshness:

- ✅ **Fresh** (green): Updated < 15 minutes ago  - ⚠️ **Warning** (yellow): Updated 15-60 minutes ago
- 🔴 **Stale** (red): Updated > 1 hour ago

Hover over timestamps to see exact update time.

---

## Export Capabilities

### CSV Export ✅
- **Available**: All reports (Alert History, Telemetry Trends, Audit Log)
- **Limit**: 10,000 rows per export
- **Format**: UTF-8 CSV with headers
- **Progress**: Shows progress bar for large exports

### JSON Export ✅
- **Available**: Admin Tools → Data Export
- **Limit**: 5,000 records
- **Format**: Minified JSON array
- **Use Case**: API integration, custom analysis

### PDF Export ⚠️
- **Status**: Coming soon (placeholder implemented)
- **Planned**: Q2 2026
- **Features**: Organization branding, charts, multi-page reports

---

## Cost Optimization

### Caching Strategy

**AI Insights Cache:**
- Duration: 15 minutes
- Table: `ai_insights_cache`
- Key: `device_id + reading_count`
- Cleanup: Daily cron job

**Report Summaries Cache:**
- Duration: 30 minutes
- Table: `ai_report_summaries_cache`
- Key: `report_type + organization_id + date_range`
- Cleanup: Daily cron job

**Cost Savings:**
- Without cache: ~$21.60/device/month
- With cache: ~$2.20/device/month
- **Savings: 90%**

### Token Usage Tracking

All AI requests log token usage:
```sql
SELECT 
  SUM(token_usage) as total_tokens,
  SUM(token_usage) * 0.0015 / 1000 as cost_usd
FROM ai_insights_cache
WHERE organization_id = 'your-org-id'
  AND created_at >= NOW() - INTERVAL '30 days';
```

---

## API Endpoints

### `/functions/v1/ai-insights`
**Method:** POST  
**Auth:** Required (Bearer token)  
**Payload:**
```json
{
  "deviceId": "uuid",
  "deviceName": "Sensor-A",
  "telemetryReadings": [...],
  "temperatureUnit": "celsius",
  "organizationId": "uuid"
}
```
**Response:**
```json
{
  "insights": [
    {
      "type": "warning",
      "title": "Battery Drain Detected",
      "message": "Battery level dropping 2%/hour. Check power settings.",
      "confidence": 0.85
    }
  ],
  "cached": false,
  "generated_at": "2026-02-19T10:30:00Z"
}
```

### `/functions/v1/generate-report-summary`
**Method:** POST  
**Auth:** Required (Bearer token)  
**Payload:**
```json
{
  "reportType": "alert-history",
  "reportData": {
    "dateRange": "Last 7 days",
    "totalRecords": 42,
    "criticalCount": 8
  },
  "organizationId": "uuid"
}
```
**Response:**
```json
{
  "keyFindings": ["..."],
  "redFlags": ["..."],
  "recommendations": ["..."],
  "trendAnalysis": "...",
  "confidence": 0.85,
  "generatedAt": "2026-02-19T10:30:00Z"
}
```

---

## Troubleshooting

### AI Insights Not Loading

**Symptom:** "AI insights unavailable, using rule-based fallback"

**Causes:**
1. `OPENAI_API_KEY` not configured in Edge Function secrets
2. OpenAI API rate limit exceeded
3. Network connectivity issue

**Solution:**
```bash
# Check Edge Function secrets
supabase secrets list

# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-...

# Restart Edge Functions
supabase functions deploy ai-insights
supabase functions deploy generate-report-summary
```

### Cache Not Working

**Symptom:** Every request calls OpenAI (high costs)

**Check cache tables:**
```sql
-- Verify cache entries exist
SELECT COUNT(*), MAX(created_at) 
FROM ai_insights_cache;

-- Check expiration policy
SELECT * FROM ai_insights_cache 
WHERE expires_at < NOW() 
LIMIT 5;
```

**Fix:**
```sql
-- Manually run cleanup if cron not working
SELECT cleanup_expired_ai_cache();

-- Extend cache duration if needed
UPDATE ai_insights_cache 
SET expires_at = NOW() + INTERVAL '30 minutes'
WHERE expires_at < NOW() + INTERVAL '5 minutes';
```

### High Token Usage

**Monitor usage:**
```sql
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as requests,
  SUM(token_usage) as total_tokens,
  ROUND(SUM(token_usage) * 0.0015 / 1000, 4) as cost_usd
FROM ai_insights_cache
WHERE organization_id = 'your-org-id'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC
LIMIT 30;
```

**Optimization tips:**
1. Increase cache duration (15min → 30min)
2. Reduce max_tokens in Edge Function (500 → 300)
3. Limit telemetry readings sent (50 → 25)
4. Disable AI for low-priority devices

---

## Security & Privacy

### Data Handling
- ✅ Telemetry data transmitted over HTTPS
- ✅ OpenAI API calls encrypted in transit
- ✅ No PII sent to OpenAI (device IDs anonymized)
- ✅ Cache entries deleted after expiration
- ✅ RLS policies enforce organization isolation

### Compliance
- **GDPR**: Telemetry data processed in EU/US regions
- **Data Retention**: AI cache auto-deleted after expiration
- **Audit Trail**: All AI requests logged in `user_audit_log`

---

## Roadmap

### Phase 1: Implemented ✅
- AI Forecasting (linear regression, anomaly detection)
- OpenAI-powered device insights
- AI report summaries
- Metric tooltips and definitions
- Data freshness indicators

### Phase 2: Planned (Q2 2026)
- Predictive maintenance AI
- Smart alert prioritization
- Root cause analysis
- PDF export with branding
- Scheduled reports

### Phase 3: Future (Q3 2026)
- Natural language query interface
- Device clustering & segmentation
- IoT chatbot assistant
- Custom dashboards with AI recommendations

---

## Support

**Questions?** Contact support@netneural.com  
**Feature Requests:** GitHub Issues  
**Documentation:** https://docs.netneural.com/ai-features
