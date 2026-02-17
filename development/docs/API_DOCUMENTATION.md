# NetNeural IoT Platform - API Documentation
**Version 1.0** | **Last Updated:** February 17, 2026  
**Base URL:** `https://api.netneural.io`

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Authentication](#2-authentication)
3. [Rate Limiting](#3-rate-limiting)
4. [Error Handling](#4-error-handling)
5. [Devices API](#5-devices-api)
6. [Alerts API](#6-alerts-api)
7. [Thresholds API](#7-thresholds-api)
8. [Telemetry API](#8-telemetry-api)
9. [Organizations API](#9-organizations-api)
10. [Members API](#10-members-api)
11. [Integrations API](#11-integrations-api)
12. [AI Insights API](#12-ai-insights-api)
13. [Dashboard Stats API](#13-dashboard-stats-api)
14. [Webhooks](#14-webhooks)
15. [Code Examples](#15-code-examples)
16. [Postman Collection](#16-postman-collection)

---

## 1. Introduction

The NetNeural IoT Platform API is a RESTful API built on Supabase Edge Functions (Deno runtime). All endpoints return JSON and enforce Row-Level Security (RLS) for data isolation.

**Key Features:**
- ✅ **RESTful design:** Standard HTTP methods (GET, POST, PATCH, DELETE)
- ✅ **JWT Authentication:** Secure token-based authentication
- ✅ **Rate Limiting:** Fair usage policies enforced
- ✅ **Real-time subscriptions:** WebSocket support for live updates
- ✅ **Row-Level Security (RLS):** Automatic data isolation by organization
- ✅ **OpenAPI 3.0 Specification:** Machine-readable API spec available

**API Versioning:**
- Current version: `v1`
- Version included in URL path: `/v1/devices`
- Breaking changes will increment major version

---

## 2. Authentication

### 2.1 Authentication Methods

**Method 1: JWT Token (Recommended)**
```bash
curl https://api.netneural.io/v1/devices \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Method 2: API Key**
```bash
curl https://api.netneural.io/v1/devices \\
  -H "apikey: YOUR_API_KEY"
```

### 2.2 Obtaining JWT Token

**Login Endpoint:**
```http
POST /auth/v1/token
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "v1.MR5S8Y_...",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "role": "authenticated"
  }
}
```

**Token Expiration:**
- Access tokens expire after **1 hour**
- Refresh tokens expire after **30 days**
- Use refresh token to obtain new access token

**Refresh Token:**
```http
POST /auth/v1/token?grant_type=refresh_token
Content-Type: application/json

{
  "refresh_token": "v1.MR5S8Y_..."
}
```

### 2.3 Creating API Keys

**Via UI:**
1. Go to **Settings** → **API Keys**
2. Click **"+ New API Key"**
3. Copy key (shown once)

**Via CLI:**
```bash
netneural api-keys create \\
  --name "Production Key" \\
  --scope read-write \\
  --organization-id org-123
```

**⚠️ Security Best Practices:**
- ❌ Never commit API keys to Git
- ✅ Store keys in environment variables
- ✅ Rotate keys every 90 days
- ✅ Use read-only keys when possible

---

## 3. Rate Limiting

### 3.1 Rate Limits by Tier

| Tier | Requests/Minute | Requests/Hour | Burst Limit |
|------|-----------------|---------------|-------------|
| **Free** | 60 | 1,200 | 100 |
| **Pro** | 300 | 10,000 | 500 |
| **Enterprise** | 1,000 | 50,000 | 2,000 |

### 3.2 Rate Limit Headers

All responses include rate limit headers:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1676592345
```

### 3.3 Rate Limit Exceeded

When rate limit exceeded, API returns:
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please wait 45 seconds.",
  "retry_after": 45,
  "limit": 60,
  "reset_at": "2026-02-17T15:32:25Z"
}
```

**Handling Rate Limits (JavaScript):**
```typescript
const response = await fetch('https://api.netneural.io/v1/devices', {
  headers: { 'Authorization': `Bearer ${token}` }
})

if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After')
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
  // Retry request
}
```

---

## 4. Error Handling

### 4.1 HTTP Status Codes

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| **200** | OK | Successful GET/PATCH request |
| **201** | Created | Successful POST request |
| **204** | No Content | Successful DELETE request |
| **400** | Bad Request | Invalid request body/parameters |
| **401** | Unauthorized | Missing or invalid authentication |
| **403** | Forbidden | Insufficient permissions (RLS violation) |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Resource already exists (e.g., duplicate threshold) |
| **422** | Unprocessable Entity | Validation error |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Server error (contact support) |
| **503** | Service Unavailable | Temporary downtime (maintenance) |

### 4.2 Error Response Format

All errors return consistent JSON structure:
```json
{
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device with ID 'device-123' not found",
    "details": {
      "device_id": "device-123",
      "organization_id": "org-456"
    },
    "timestamp": "2026-02-17T15:32:45.123Z",
    "request_id": "req_abc123def456"
  }
}
```

### 4.3 Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_TOKEN` | 401 | JWT token expired or invalid |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource doesn't exist |
| `VALIDATION_ERROR` | 422 | Request body validation failed |
| `DUPLICATE_RESOURCE` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `DATABASE_ERROR` | 500 | Database query failed |
| `INTEGRATION_ERROR` | 502 | External integration (Golioth, AWS) failed |

---

## 5. Devices API

### 5.1 List Devices

**Endpoint:** `GET /v1/devices`

**Query Parameters:**
- `organization_id` (optional): Filter by organization
- `status` (optional): Filter by status (`online`, `offline`)
- `limit` (optional): Max results (default: 100, max: 500)

**Request:**
```bash
curl https://api.netneural.io/v1/devices?organization_id=org-123&limit=50 \\
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "devices": [
    {
      "id": "device-abc123",
      "name": "Warehouse Freezer 1",
      "device_type": "temperature_sensor",
      "model": "TempSense Pro",
      "serial_number": "TS-2024-001",
      "status": "online",
      "firmware_version": "2.1.3",
      "location_id": "loc-456",
      "location": "Building A - Room 101",
      "last_seen": "2026-02-17T15:30:00Z",
      "battery_level": 85,
      "signal_strength": -65,
      "external_device_id": "golioth-device-789",
      "integration_id": "integration-001",
      "integration_name": "Golioth Production",
      "integration_type": "golioth",
      "hardware_ids": ["hwid-1", "hwid-2"],
      "cohort_id": "cohort-prod",
      "metadata": {
        "manufacturer": "TempSense Inc.",
        "installation_date": "2025-11-15"
      },
      "organization_id": "org-123",
      "created_at": "2025-11-15T10:00:00Z",
      "updated_at": "2026-02-17T15:30:00Z"
    }
  ],
  "count": 1,
  "organization_id": "org-123"
}
```

### 5.2 Get Single Device

**Endpoint:** `GET /v1/devices/{device_id}`

**Request:**
```bash
curl https://api.netneural.io/v1/devices/device-abc123 \\
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "device": {
    "id": "device-abc123",
    "name": "Warehouse Freezer 1",
    "device_type": "temperature_sensor",
    "status": "online",
    "last_seen": "2026-02-17T15:30:00Z",
    "battery_level": 85,
    "metadata": { ... }
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device with ID 'device-abc123' not found"
  }
}
```

### 5.3 Create Device

**Endpoint:** `POST /v1/devices`

**Request Body:**
```json
{
  "name": "New Sensor",
  "device_type": "temperature_sensor",
  "model": "TempSense Pro",
  "serial_number": "TS-2026-042",
  "organization_id": "org-123",
  "location_id": "loc-456",
  "firmware_version": "2.1.3",
  "metadata": {
    "installation_notes": "Installed near loading dock"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "device": {
    "id": "device-new-123",
    "name": "New Sensor",
    "created_at": "2026-02-17T15:32:00Z"
  }
}
```

### 5.4 Update Device

**Endpoint:** `PATCH /v1/devices/{device_id}`

**Request Body (partial update):**
```json
{
  "name": "Updated Sensor Name",
  "location_id": "loc-789",
  "metadata": {
    "notes": "Relocated to new warehouse"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "device": {
    "id": "device-abc123",
    "name": "Updated Sensor Name",
    "updated_at": "2026-02-17T15:35:00Z"
  }
}
```

### 5.5 Delete Device

**Endpoint:** `DELETE /v1/devices/{device_id}`

**Request:**
```bash
curl -X DELETE https://api.netneural.io/v1/devices/device-abc123 \\
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (204 No Content)**

**Note:** Devices are soft-deleted (marked with `deleted_at` timestamp) and can be recovered.

---

## 6. Alerts API

### 6.1 List Alerts

**Endpoint:** `GET /v1/alerts`

**Query Parameters:**
- `organization_id` (optional): Filter by organization
- `severity` (optional): Filter by severity (`info`, `warning`, `critical`)
- `resolved` (optional): Filter by resolution (`true`, `false`)
- `limit` (optional): Max results (default: 50, max: 500)

**Request:**
```bash
curl "https://api.netneural.io/v1/alerts?severity=critical&resolved=false&limit=20" \\
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "alert-123",
      "title": "Critical Temperature Alert",
      "message": "Temperature exceeded critical threshold: 45°F > 40°F",
      "severity": "critical",
      "alertType": "threshold_breach",
      "category": "temperature",
      "deviceId": "device-abc123",
      "deviceName": "Warehouse Freezer 1",
      "deviceType": "temperature_sensor",
      "timestamp": "2026-02-17T15:30:00Z",
      "isResolved": false,
      "resolvedAt": null,
      "resolvedBy": null,
      "metadata": {
        "sensor_type": "temperature",
        "current_value": 45,
        "threshold_value": 40,
        "unit": "F"
      }
    }
  ],
  "count": 1,
  "limit": 20,
  "filters": {
    "severity": "critical",
    "resolved": "false"
  }
}
```

### 6.2 Acknowledge Alert

**Endpoint:** `POST /v1/alerts/{alert_id}/acknowledge`

**Request Body:**
```json
{
  "acknowledgement_type": "reviewed",
  "notes": "Checked freezer - door was left open. Issue resolved."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "alert": {
    "id": "alert-123",
    "isResolved": true,
    "resolvedAt": "2026-02-17T15:35:00Z",
    "resolvedBy": "user-456"
  }
}
```

### 6.3 Bulk Acknowledge Alerts

**Endpoint:** `POST /v1/alerts/bulk-acknowledge`

**Request Body:**
```json
{
  "alert_ids": ["alert-123", "alert-456", "alert-789"],
  "organization_id": "org-123",
  "acknowledgement_type": "bulk_reviewed",
  "notes": "Batch review - all issues resolved"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "acknowledged_count": 3,
  "alert_ids": ["alert-123", "alert-456", "alert-789"],
  "acknowledged_at": "2026-02-17T15:40:00Z"
}
```

---

## 7. Thresholds API

### 7.1 List Thresholds for Device

**Endpoint:** `GET /v1/thresholds?device_id={device_id}`

**Request:**
```bash
curl "https://api.netneural.io/v1/thresholds?device_id=device-abc123" \\
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "thresholds": [
    {
      "id": "threshold-123",
      "device_id": "device-abc123",
      "sensor_type": "temperature",
      "min_value": 34,
      "max_value": 38,
      "critical_min": 32,
      "critical_max": 40,
      "temperature_unit": "fahrenheit",
      "alert_enabled": true,
      "alert_severity": "critical",
      "alert_message": "Temperature out of safe range",
      "notify_on_breach": true,
      "notification_cooldown_minutes": 15,
      "notify_user_ids": ["user-456", "user-789"],
      "notify_emails": ["manager@example.com"],
      "notification_channels": ["email", "slack"],
      "created_at": "2025-11-15T10:00:00Z",
      "updated_at": "2026-02-17T15:00:00Z"
    }
  ]
}
```

### 7.2 Create Threshold

**Endpoint:** `POST /v1/thresholds`

**Request Body:**
```json
{
  "device_id": "device-abc123",
  "sensor_type": "temperature",
  "min_value": 34,
  "max_value": 38,
  "critical_min": 32,
  "critical_max": 40,
  "temperature_unit": "fahrenheit",
  "alert_enabled": true,
  "alert_severity": "critical",
  "alert_message": "Temperature critical",
  "notify_on_breach": true,
  "notification_cooldown_minutes": 15,
  "notify_emails": ["manager@example.com"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "threshold": {
    "id": "threshold-new-123",
    "device_id": "device-abc123",
    "sensor_type": "temperature",
    "created_at": "2026-02-17T15:45:00Z"
  }
}
```

**Response (409 Conflict):**
```json
{
  "error": {
    "code": "DUPLICATE_THRESHOLD",
    "message": "Threshold for temperature already exists on this device"
  }
}
```

### 7.3 Update Threshold

**Endpoint:** `PATCH /v1/thresholds?threshold_id={threshold_id}`

**Request Body:**
```json
{
  "critical_max": 42,
  "alert_severity": "warning",
  "notification_cooldown_minutes": 30
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "threshold": {
    "id": "threshold-123",
    "critical_max": 42,
    "updated_at": "2026-02-17T15:50:00Z"
  }
}
```

### 7.4 Delete Threshold

**Endpoint:** `DELETE /v1/thresholds?threshold_id={threshold_id}`

**Response (204 No Content)**

---

## 8. Telemetry API

### 8.1 Get Latest Telemetry

**Endpoint:** `GET /v1/telemetry/latest?device_id={device_id}`

**Query Parameters:**
- `device_id` (required): Device ID
- `limit` (optional): Number of readings (default: 10, max: 100)
- `sensor_type` (optional): Filter by sensor (`temperature`, `humidity`, etc.)

**Request:**
```bash
curl "https://api.netneural.io/v1/telemetry/latest?device_id=device-abc123&limit=5" \\
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "telemetry": [
    {
      "id": "telemetry-123",
      "device_id": "device-abc123",
      "sensor_type": "temperature",
      "value": 36.5,
      "unit": "F",
      "device_timestamp": "2026-02-17T15:52:00Z",
      "received_at": "2026-02-17T15:52:01Z",
      "metadata": {
        "battery_level": 85,
        "signal_strength": -65
      }
    }
  ],
  "count": 1,
  "device_id": "device-abc123"
}
```

### 8.2 Get Telemetry Range

**Endpoint:** `GET /v1/telemetry/range?device_id={device_id}&start={timestamp}&end={timestamp}`

**Query Parameters:**
- `device_id` (required): Device ID
- `start` (required): Start timestamp (ISO 8601)
- `end` (required): End timestamp (ISO 8601)
- `sensor_type` (optional): Filter by sensor
- `limit` (optional): Max results (default: 1000, max: 10000)

**Request:**
```bash
curl "https://api.netneural.io/v1/telemetry/range?device_id=device-abc123&start=2026-02-17T00:00:00Z&end=2026-02-17T23:59:59Z" \\
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "telemetry": [ /* array of readings */ ],
  "count": 1440,
  "device_id": "device-abc123",
  "time_range": {
    "start": "2026-02-17T00:00:00Z",
    "end": "2026-02-17T23:59:59Z"
  }
}
```

### 8.3 Get Telemetry Statistics

**Endpoint:** `GET /v1/telemetry/stats?device_id={device_id}&sensor_type={sensor_type}&window={window}`

**Query Parameters:**
- `device_id` (required): Device ID
- `sensor_type` (required): Sensor type
- `window` (required): Time window (`1h`, `24h`, `7d`, `30d`)

**Request:**
```bash
curl "https://api.netneural.io/v1/telemetry/stats?device_id=device-abc123&sensor_type=temperature&window=24h" \\
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "statistics": {
    "count": 1440,
    "min": 32.5,
    "max": 39.2,
    "avg": 36.1,
    "latest": 36.5,
    "sensor_type": "temperature",
    "unit": "F",
    "window": "24h",
    "calculated_at": "2026-02-17T15:55:00Z"
  }
}
```

---

## 9. Organizations API

### 9.1 List Organizations

**Endpoint:** `GET /v1/organizations`

**Request:**
```bash
curl https://api.netneural.io/v1/organizations \\
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "organizations": [
    {
      "id": "org-123",
      "name": "ACME Corporation",
      "slug": "acme-corp",
      "parent_id": null,
      "timezone": "America/New_York",
      "temperature_unit": "fahrenheit",
      "data_retention_days": 90,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2026-02-17T15:00:00Z"
    }
  ],
  "count": 1
}
```

### 9.2 Get Organization Details

**Endpoint:** `GET /v1/organizations/{org_id}`

**Response (200 OK):**
```json
{
  "success": true,
  "organization": {
    "id": "org-123",
    "name": "ACME Corporation",
    "slug": "acme-corp",
    "settings": { /* org settings */ }
  }
}
```

### 9.3 Update Organization

**Endpoint:** `PATCH /v1/organizations/{org_id}`

**Request Body:**
```json
{
  "name": "ACME Corp (Updated)",
  "timezone": "America/Los_Angeles",
  "data_retention_days": 120
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "organization": {
    "id": "org-123",
    "name": "ACME Corp (Updated)",
    "updated_at": "2026-02-17T16:00:00Z"
  }
}
```

---

## 10. Members API

### 10.1 List Organization Members

**Endpoint:** `GET /v1/members?organization_id={org_id}`

**Response (200 OK):**
```json
{
  "success": true,
  "members": [
    {
      "id": "member-123",
      "user_id": "user-456",
      "organization_id": "org-123",
      "role": "admin",
      "email": "admin@example.com",
      "full_name": "Jane Doe",
      "joined_at": "2025-11-15T10:00:00Z"
    }
  ],
  "count": 1
}
```

### 10.2 Add Member

**Endpoint:** `POST /v1/members`

**Request Body:**
```json
{
  "organization_id": "org-123",
  "user_email": "newuser@example.com",
  "role": "member"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "member": {
    "id": "member-new-123",
    "user_email": "newuser@example.com",
    "role": "member",
    "invitation_sent": true
  }
}
```

### 10.3 Update Member Role

**Endpoint:** `PATCH /v1/members/{member_id}`

**Request Body:**
```json
{
  "role": "admin"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "member": {
    "id": "member-123",
    "role": "admin",
    "updated_at": "2026-02-17T16:05:00Z"
  }
}
```

### 10.4 Remove Member

**Endpoint:** `DELETE /v1/members/{member_id}`

**Response (204 No Content)**

---

## 11. Integrations API

### 11.1 List Integrations

**Endpoint:** `GET /v1/integrations?organization_id={org_id}`

**Response (200 OK):**
```json
{
  "success": true,
  "integrations": [
    {
      "id": "integration-123",
      "name": "Golioth Production",
      "integration_type": "golioth",
      "status": "active",
      "auto_sync_enabled": true,
      "sync_interval_minutes": 5,
      "last_synced_at": "2026-02-17T16:00:00Z",
      "sync_status": "success",
      "created_at": "2025-11-15T10:00:00Z"
    }
  ],
  "count": 1
}
```

### 11.2 Create Integration

**Endpoint:** `POST /v1/integrations`

**Request Body:**
```json
{
  "name": "Golioth Production",
  "integration_type": "golioth",
  "organization_id": "org-123",
  "api_key": "golioth-api-key-here",
  "api_url": "https://api.golioth.io",
  "auto_sync_enabled": true,
  "sync_interval_minutes": 5
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "integration": {
    "id": "integration-new-123",
    "name": "Golioth Production",
    "status": "active",
    "created_at": "2026-02-17T16:10:00Z"
  }
}
```

### 11.3 Trigger Device Sync

**Endpoint:** `POST /v1/integrations/{integration_id}/sync`

**Response (200 OK):**
```json
{
  "success": true,
  "sync_job": {
    "integration_id": "integration-123",
    "started_at": "2026-02-17T16:15:00Z",
    "status": "in_progress"
  }
}
```

### 11.4 Delete Integration

**Endpoint:** `DELETE /v1/integrations/{integration_id}`

**Response (204 No Content)**

**⚠️ Warning:** Deleting integration does NOT delete synced devices, but stops future syncing.

---

## 12. AI Insights API

### 12.1 Get AI Insights for Device

**Endpoint:** `POST /v1/ai-insights`

**Request Body:**
```json
{
  "deviceId": "device-abc123",
  "deviceName": "Warehouse Freezer 1",
  "installedAt": "2025-11-15T10:00:00Z",
  "telemetryReadings": [
    {
      "telemetry": {
        "value": 36.5,
        "type": 1,
        "sensor": "temperature"
      },
      "device_timestamp": "2026-02-17T16:00:00Z",
      "received_at": "2026-02-17T16:00:01Z"
    }
  ],
  "temperatureUnit": "fahrenheit",
  "organizationId": "org-123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "insights": [
    {
      "type": "normal",
      "title": "Temperature Stable",
      "message": "Temperature has been within normal range (34-38°F) for the past 24 hours.",
      "confidence": 0.95
    },
    {
      "type": "info",
      "title": "Predictive Maintenance",
      "message": "Battery level trending downward. Expect replacement needed in 45 days.",
      "confidence": 0.78
    }
  ],
  "cached": false,
  "generated_at": "2026-02-17T16:20:00Z",
  "expires_at": "2026-02-17T16:35:00Z"
}
```

**Cache Behavior:**
- Insights cached for **15 minutes**
- Subsequent requests return cached insights (reduces OpenAI API costs)
- `cached: true` indicates cached response

**Fallback Behavior:**
If `OPENAI_API_KEY` not configured:
```json
{
  "error": "OpenAI API not configured",
  "fallback": true,
  "insights": []
}
```

---

## 13. Dashboard Stats API

### 13.1 Get Dashboard Statistics

**Endpoint:** `GET /v1/dashboard-stats?organization_id={org_id}`

**Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "devices": {
      "total": 42,
      "online": 38,
      "offline": 4,
      "battery_low": 3
    },
    "alerts": {
      "unacknowledged": 7,
      "critical": 2,
      "warning": 5,
      "info": 12,
      "last_24h": 19
    },
    "telemetry": {
      "readings_today": 60480,
      "readings_last_hour": 2520,
      "avg_reading_interval_seconds": 60
    },
    "organization_id": "org-123",
    "generated_at": "2026-02-17T16:25:00Z"
  }
}
```

**Use Cases:**
- Dashboard overview cards
- Health monitoring
- Capacity planning

---

## 14. Webhooks

### 14.1 Webhook Events

NetNeural can send webhook notifications for events:

**Supported Events:**
- `alert.created` - New alert generated
- `alert.acknowledged` - Alert acknowledged
- `device.online` - Device came online
- `device.offline` - Device went offline
- `threshold.breached` - Sensor exceeded threshold
- `integration.sync_completed` - Device sync finished

### 14.2 Webhook Configuration

**Via UI:**
1. Go to **Settings** → **Webhooks**
2. Click **"+ New Webhook"**
3. Enter **URL:** `https://your-server.com/netneural-webhook`
4. Select **Events:** (checkboxes)
5. Click **"Save"**

**Webhook Payload Example (alert.created):**
```json
{
  "event": "alert.created",
  "timestamp": "2026-02-17T16:30:00Z",
  "data": {
    "alert_id": "alert-123",
    "title": "Critical Temperature Alert",
    "severity": "critical",
    "device_id": "device-abc123",
    "device_name": "Warehouse Freezer 1",
    "organization_id": "org-123"
  },
  "signature": "sha256=abc123def456..." // Webhook signing
}
```

### 14.3 Webhook Verification

Verify webhook authenticity using signature:

**Node.js Example:**
```javascript
const crypto = require('crypto')

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')
  
  return `sha256=${expectedSignature}` === signature
}

// Usage
app.post('/netneural-webhook', (req, res) => {
  const signature = req.headers['x-netneural-signature']
  const secret = process.env.WEBHOOK_SECRET
  
  if (!verifyWebhook(req.body, signature, secret)) {
    return res.status(401).send('Invalid signature')
  }
  
  // Process webhook
  console.log('Event:', req.body.event)
  res.sendStatus(200)
})
```

---

## 15. Code Examples

### 15.1 JavaScript/TypeScript

**Fetch Devices:**
```typescript
const token = 'YOUR_JWT_TOKEN'

async function getDevices(organizationId: string) {
  const response = await fetch(
    `https://api.netneural.io/v1/devices?organization_id=${organizationId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  )
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }
  
  const data = await response.json()
  return data.devices
}

// Usage
const devices = await getDevices('org-123')
console.log(`Found ${devices.length} devices`)
```

**Create Threshold:**
```typescript
async function createThreshold(deviceId: string, threshold: any) {
  const response = await fetch('https://api.netneural.io/v1/thresholds', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      device_id: deviceId,
      sensor_type: 'temperature',
      critical_min: 32,
      critical_max: 40,
      temperature_unit: 'fahrenheit',
      alert_enabled: true,
      ...threshold
    })
  })
  
  return response.json()
}
```

### 15.2 Python

**Fetch Alerts:**
```python
import requests

TOKEN = "YOUR_JWT_TOKEN"
BASE_URL = "https://api.netneural.io/v1"

def get_unacknowledged_alerts(organization_id: str):
    response = requests.get(
        f"{BASE_URL}/alerts",
        params={
            "organization_id": organization_id,
            "resolved": "false",
            "limit": 100
        },
        headers={"Authorization": f"Bearer {TOKEN}"}
    )
    response.raise_for_status()
    return response.json()["alerts"]

# Usage
alerts = get_unacknowledged_alerts("org-123")
print(f"Unacknowledged alerts: {len(alerts)}")
```

**Bulk Acknowledge Alerts:**
```python
def acknowledge_alerts(alert_ids: list[str], org_id: str):
    response = requests.post(
        f"{BASE_URL}/alerts/bulk-acknowledge",
        json={
            "alert_ids": alert_ids,
            "organization_id": org_id,
            "acknowledgement_type": "bulk_reviewed",
            "notes": "Batch acknowledgement"
        },
        headers={"Authorization": f"Bearer {TOKEN}"}
    )
    return response.json()
```

### 15.3 cURL

**Create Device:**
```bash
curl -X POST https://api.netneural.io/v1/devices \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "New Sensor",
    "device_type": "temperature_sensor",
    "organization_id": "org-123",
    "metadata": {
      "location": "Building A"
    }
  }'
```

**Get Telemetry:**
```bash
curl "https://api.netneural.io/v1/telemetry/latest?device_id=device-abc123&limit=10" \\
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 16. Postman Collection

### 16.1 Import Collection

**Download:**
- [NetNeural API Postman Collection](https://api.netneural.io/postman/collection.json)

**Import to Postman:**
1. Open Postman
2. Click **Import** → **Link**
3. Paste: `https://api.netneural.io/postman/collection.json`
4. Collection appears in **Collections** sidebar

**Environment Variables:**
- `base_url`: `https://api.netneural.io/v1`
- `token`: Your JWT token
- `organization_id`: Your organization ID

### 16.2 Collection Contents

**Folders:**
- Authentication (login, refresh token)
- Devices (CRUD operations)
- Alerts (list, acknowledge, bulk operations)
- Thresholds (CRUD operations)
- Telemetry (latest, range, stats)
- Organizations (CRUD operations)
- Members (CRUD operations)
- Integrations (CRUD operations)
- AI Insights (get insights)
- Dashboard Stats (overview)

**All requests include:**
- Pre-request scripts (set auth headers)
- Test scripts (validate responses)
- Example responses

---

## Appendix

### A. OpenAPI Specification

**Download OpenAPI 3.0 spec:**
```bash
curl https://api.netneural.io/openapi.json -o netneural-api.json
```

**Redoc Documentation:**
- View interactive docs: https://api.netneural.io/docs

### B. SDK Libraries

**Official SDKs (Coming Soon):**
- `@netneural/js-sdk` - JavaScript/TypeScript
- `netneural-python` - Python
- `netneural-go` - Go

**Community SDKs:**
- Submit your SDK to community@netneural.ai

### C. Support

- **API Issues:** api-support@netneural.ai
- **Documentation Feedback:** docs@netneural.ai
- **Rate Limit Increase Requests:** sales@netneural.ai

---

**© 2026 NetNeural. All rights reserved.**

**Document Version:** 1.0  
**API Version:** v1  
**Last Reviewed By:** Platform Engineering Team  
**Next Review Date:** March 17, 2026
