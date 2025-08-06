# API Reference Documentation

## Overview
This document provides comprehensive API documentation for all NetNeural services, including authentication, endpoints, request/response formats, and integration examples.

## Base URLs

### Production
- **API Gateway**: `https://api.netneural.com`
- **Authentication**: `https://auth.netneural.com`
- **WebSocket**: `wss://ws.netneural.com`

### Development
- **API Gateway**: `https://api-dev.netneural.com`
- **Authentication**: `https://auth-dev.netneural.com`
- **WebSocket**: `wss://ws-dev.netneural.com`

## Authentication

### JWT Token Authentication
All API requests require a valid JWT token in the Authorization header.

```http
Authorization: Bearer <jwt-token>
```

### Login Endpoint
```http
POST /auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "user-123",
    "username": "user@example.com",
    "roles": ["user"]
  }
}
```

### Token Refresh
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Core Services APIs

### 🔐 SSO Service API

#### Base URL: `/auth`

#### Endpoints

##### Authentication
```http
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/validate
GET  /auth/profile
PUT  /auth/profile
POST /auth/change-password
POST /auth/forgot-password
POST /auth/reset-password
```

##### User Management
```http
GET    /auth/users              # List users (admin only)
POST   /auth/users              # Create user (admin only)
GET    /auth/users/{id}         # Get user details
PUT    /auth/users/{id}         # Update user
DELETE /auth/users/{id}         # Delete user (admin only)
```

#### Data Models

##### User Object
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "first_name": "string",
  "last_name": "string",
  "roles": ["string"],
  "is_active": "boolean",
  "last_login": "string (ISO 8601)",
  "created_at": "string (ISO 8601)",
  "updated_at": "string (ISO 8601)"
}
```

##### Authentication Response
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "Bearer",
  "expires_in": "number",
  "user": "User Object"
}
```

---

### 📱 Device Management APIs

#### Base URL: `/devices`

#### Endpoints

##### Device Operations
```http
GET    /devices                 # List all devices
POST   /devices                 # Create new device
GET    /devices/{id}            # Get device details
PUT    /devices/{id}            # Update device
DELETE /devices/{id}            # Delete device
POST   /devices/{id}/commands   # Send command to device
GET    /devices/{id}/telemetry  # Get device telemetry
GET    /devices/{id}/status     # Get device status
POST   /devices/{id}/reboot     # Reboot device
```

##### Device Configuration
```http
GET    /devices/{id}/config     # Get device configuration
PUT    /devices/{id}/config     # Update device configuration
POST   /devices/{id}/provision  # Provision device
POST   /devices/{id}/firmware   # Update firmware
```

#### Data Models

##### Device Object
```json
{
  "id": "string",
  "name": "string",
  "type": "string",
  "model": "string",
  "firmware_version": "string",
  "status": "online|offline|maintenance|error",
  "location": {
    "latitude": "number",
    "longitude": "number",
    "address": "string"
  },
  "metadata": "object",
  "last_seen": "string (ISO 8601)",
  "created_at": "string (ISO 8601)",
  "updated_at": "string (ISO 8601)"
}
```

##### Device Command
```json
{
  "command": "string",
  "parameters": "object",
  "timeout": "number",
  "priority": "low|normal|high|critical"
}
```

##### Telemetry Data
```json
{
  "device_id": "string",
  "timestamp": "string (ISO 8601)",
  "data": {
    "temperature": "number",
    "humidity": "number",
    "battery_level": "number",
    "signal_strength": "number"
  },
  "metadata": "object"
}
```

---

### 🚨 Alert Management APIs

#### Base URL: `/alerts`

#### Endpoints

##### Alert Operations
```http
GET    /alerts                  # List alerts
POST   /alerts                  # Create alert
GET    /alerts/{id}             # Get alert details
PUT    /alerts/{id}             # Update alert
DELETE /alerts/{id}             # Delete alert
POST   /alerts/{id}/acknowledge # Acknowledge alert
POST   /alerts/{id}/resolve     # Resolve alert
GET    /alerts/active           # Get active alerts
GET    /alerts/history          # Get alert history
```

##### Alert Rules
```http
GET    /alert-rules             # List alert rules
POST   /alert-rules             # Create alert rule
GET    /alert-rules/{id}        # Get alert rule
PUT    /alert-rules/{id}        # Update alert rule
DELETE /alert-rules/{id}        # Delete alert rule
POST   /alert-rules/{id}/test   # Test alert rule
```

#### Data Models

##### Alert Object
```json
{
  "id": "string",
  "device_id": "string",
  "rule_id": "string",
  "type": "string",
  "severity": "info|warning|error|critical",
  "title": "string",
  "message": "string",
  "status": "active|acknowledged|resolved",
  "data": "object",
  "acknowledged_by": "string",
  "acknowledged_at": "string (ISO 8601)",
  "resolved_by": "string",
  "resolved_at": "string (ISO 8601)",
  "created_at": "string (ISO 8601)"
}
```

##### Alert Rule
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "condition": "string",
  "severity": "info|warning|error|critical",
  "enabled": "boolean",
  "device_filter": "object",
  "notification_channels": ["string"],
  "cooldown_period": "number",
  "created_at": "string (ISO 8601)",
  "updated_at": "string (ISO 8601)"
}
```

---

### 📊 Data Management APIs

#### Base URL: `/data`

#### Endpoints

##### Data Query
```http
GET    /data/query              # Query telemetry data
POST   /data/query              # Complex data query
GET    /data/export             # Export data
GET    /data/aggregations       # Get data aggregations
GET    /data/devices/{id}/latest # Get latest device data
GET    /data/devices/{id}/history # Get device data history
```

##### Data Processing
```http
POST   /data/ingestion          # Ingest bulk data
POST   /data/transform          # Transform data
POST   /data/validate           # Validate data format
GET    /data/stats              # Get data statistics
```

#### Query Parameters

##### Data Query
```http
GET /data/query?device_id=123&start_time=2025-01-01T00:00:00Z&end_time=2025-01-02T00:00:00Z&metrics=temperature,humidity&interval=1h
```

**Parameters**:
- `device_id`: Filter by device ID
- `start_time`: Start time (ISO 8601)
- `end_time`: End time (ISO 8601)
- `metrics`: Comma-separated list of metrics
- `interval`: Aggregation interval (1m, 5m, 1h, 1d)
- `limit`: Maximum number of results
- `offset`: Pagination offset

#### Data Models

##### Query Response
```json
{
  "data": [
    {
      "timestamp": "string (ISO 8601)",
      "device_id": "string",
      "metrics": {
        "temperature": "number",
        "humidity": "number"
      }
    }
  ],
  "pagination": {
    "total": "number",
    "limit": "number",
    "offset": "number",
    "has_more": "boolean"
  },
  "metadata": {
    "query_time": "number",
    "cached": "boolean"
  }
}
```

---

### 📈 Analytics APIs

#### Base URL: `/analytics`

#### Endpoints

##### Dashboard Data
```http
GET    /analytics/dashboard     # Get dashboard data
GET    /analytics/kpis          # Get key performance indicators
GET    /analytics/trends        # Get trend analysis
GET    /analytics/reports       # List available reports
GET    /analytics/reports/{id}  # Get specific report
POST   /analytics/reports       # Generate custom report
```

##### Device Analytics
```http
GET    /analytics/devices/health    # Device health overview
GET    /analytics/devices/uptime    # Device uptime statistics
GET    /analytics/devices/usage     # Device usage patterns
GET    /analytics/devices/performance # Device performance metrics
```

#### Data Models

##### Dashboard Data
```json
{
  "summary": {
    "total_devices": "number",
    "online_devices": "number",
    "active_alerts": "number",
    "data_points_today": "number"
  },
  "charts": {
    "device_status": [
      {
        "status": "string",
        "count": "number",
        "percentage": "number"
      }
    ],
    "alert_trends": [
      {
        "date": "string",
        "count": "number",
        "severity": "string"
      }
    ],
    "data_volume": [
      {
        "timestamp": "string",
        "volume": "number"
      }
    ]
  }
}
```

---

## WebSocket APIs

### Real-time Data Streaming

#### Connection
```javascript
const ws = new WebSocket('wss://ws.netneural.com/stream');
ws.onopen = function() {
    // Send authentication
    ws.send(JSON.stringify({
        type: 'auth',
        token: 'jwt-token'
    }));
};
```

#### Subscription
```javascript
// Subscribe to device updates
ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'devices',
    filter: {
        device_id: '123'
    }
}));

// Subscribe to alerts
ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'alerts',
    filter: {
        severity: ['error', 'critical']
    }
}));
```

#### Message Types

##### Device Update
```json
{
  "type": "device_update",
  "channel": "devices",
  "data": {
    "device_id": "string",
    "status": "string",
    "telemetry": "object",
    "timestamp": "string (ISO 8601)"
  }
}
```

##### Alert Notification
```json
{
  "type": "alert",
  "channel": "alerts",
  "data": {
    "alert": "Alert Object",
    "device": "Device Object"
  }
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": "object",
    "timestamp": "string (ISO 8601)",
    "request_id": "string"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request body or parameters |
| `UNAUTHORIZED` | 401 | Invalid or missing authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Requested resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Error Examples

#### Validation Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field_errors": {
        "email": ["must be a valid email address"],
        "password": ["must be at least 8 characters"]
      }
    },
    "timestamp": "2025-08-05T12:00:00Z",
    "request_id": "req-123"
  }
}
```

#### Authentication Error
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid authentication token",
    "details": {
      "reason": "token_expired"
    },
    "timestamp": "2025-08-05T12:00:00Z",
    "request_id": "req-124"
  }
}
```

---

## Rate Limiting

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1641024000
X-RateLimit-Window: 3600
```

### Rate Limits by Endpoint

| Endpoint Pattern | Limit | Window |
|-----------------|-------|--------|
| `/auth/login` | 5 requests | 15 minutes |
| `/devices/**` | 1000 requests | 1 hour |
| `/alerts/**` | 500 requests | 1 hour |
| `/data/query` | 100 requests | 1 hour |
| `/analytics/**` | 200 requests | 1 hour |

---

## Pagination

### Request Parameters
```http
GET /devices?limit=20&offset=40&sort=created_at&order=desc
```

### Response Format
```json
{
  "data": ["array of objects"],
  "pagination": {
    "total": 1000,
    "limit": 20,
    "offset": 40,
    "has_more": true,
    "next_offset": 60,
    "previous_offset": 20
  }
}
```

---

## Filtering and Sorting

### Query Parameters

#### Filtering
```http
GET /devices?status=online&type=sensor&location.city=New York
```

#### Sorting
```http
GET /devices?sort=name,created_at&order=asc,desc
```

#### Full-text Search
```http
GET /devices?search=temperature sensor&fields=name,description
```

### Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `status=online` |
| `ne` | Not equals | `status[ne]=offline` |
| `gt` | Greater than | `created_at[gt]=2025-01-01` |
| `gte` | Greater than or equal | `battery_level[gte]=20` |
| `lt` | Less than | `temperature[lt]=30` |
| `lte` | Less than or equal | `humidity[lte]=80` |
| `in` | In array | `type[in]=sensor,gateway` |
| `nin` | Not in array | `status[nin]=offline,error` |
| `like` | Partial match | `name[like]=temp` |

---

## SDK Examples

### JavaScript/TypeScript SDK

#### Installation
```bash
npm install @netneural/sdk
```

#### Usage
```typescript
import { NetNeuralSDK } from '@netneural/sdk';

const sdk = new NetNeuralSDK({
  apiUrl: 'https://api.netneural.com',
  authUrl: 'https://auth.netneural.com'
});

// Authentication
await sdk.auth.login('user@example.com', 'password');

// Device operations
const devices = await sdk.devices.list({
  status: 'online',
  limit: 10
});

const device = await sdk.devices.get('device-123');

// Real-time subscriptions
sdk.ws.subscribe('devices', (update) => {
  console.log('Device update:', update);
});

// Alert management
const alerts = await sdk.alerts.list({
  severity: ['error', 'critical'],
  status: 'active'
});

await sdk.alerts.acknowledge('alert-123');
```

### Python SDK

#### Installation
```bash
pip install netneural-sdk
```

#### Usage
```python
from netneural_sdk import NetNeuralSDK

sdk = NetNeuralSDK(
    api_url='https://api.netneural.com',
    auth_url='https://auth.netneural.com'
)

# Authentication
sdk.auth.login('user@example.com', 'password')

# Device operations
devices = sdk.devices.list(status='online', limit=10)
device = sdk.devices.get('device-123')

# Data querying
data = sdk.data.query(
    device_id='device-123',
    start_time='2025-01-01T00:00:00Z',
    end_time='2025-01-02T00:00:00Z',
    metrics=['temperature', 'humidity']
)

# Alert operations
alerts = sdk.alerts.list(severity=['error', 'critical'])
sdk.alerts.acknowledge('alert-123')
```

### Go SDK

#### Installation
```bash
go get github.com/NetNeural/go-sdk
```

#### Usage
```go
package main

import (
    "context"
    "log"
    
    "github.com/NetNeural/go-sdk"
)

func main() {
    client := nnsdk.NewClient(&nnsdk.Config{
        APIUrl:  "https://api.netneural.com",
        AuthURL: "https://auth.netneural.com",
    })
    
    // Authentication
    err := client.Auth.Login(context.Background(), "user@example.com", "password")
    if err != nil {
        log.Fatal(err)
    }
    
    // Device operations
    devices, err := client.Devices.List(context.Background(), &nnsdk.DeviceListParams{
        Status: "online",
        Limit:  10,
    })
    if err != nil {
        log.Fatal(err)
    }
    
    // Alert operations
    alerts, err := client.Alerts.List(context.Background(), &nnsdk.AlertListParams{
        Severity: []string{"error", "critical"},
        Status:   "active",
    })
    if err != nil {
        log.Fatal(err)
    }
}
```

---

## Testing APIs

### Postman Collection
Import the NetNeural API collection for easy testing:
```json
{
  "info": {
    "name": "NetNeural API Collection",
    "description": "Complete API collection for NetNeural services"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{access_token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "https://api.netneural.com"
    },
    {
      "key": "auth_url", 
      "value": "https://auth.netneural.com"
    }
  ]
}
```

### cURL Examples

#### Login
```bash
curl -X POST https://auth.netneural.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "password123"
  }'
```

#### List Devices
```bash
curl -X GET https://api.netneural.com/devices \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json"
```

#### Create Alert Rule
```bash
curl -X POST https://api.netneural.com/alert-rules \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Temperature Alert",
    "condition": "temperature > 80",
    "severity": "warning",
    "enabled": true
  }'
```

---

## OpenAPI Specification

### Download OpenAPI Specs
- **Complete API**: `https://api.netneural.com/openapi.json`
- **Authentication**: `https://auth.netneural.com/openapi.json`
- **Device Management**: `https://api.netneural.com/devices/openapi.json`
- **Alert Management**: `https://api.netneural.com/alerts/openapi.json`

### Generate Client SDKs
```bash
# Generate TypeScript client
openapi-generator-cli generate -i https://api.netneural.com/openapi.json -g typescript-axios -o ./sdk/typescript

# Generate Python client
openapi-generator-cli generate -i https://api.netneural.com/openapi.json -g python -o ./sdk/python

# Generate Go client
openapi-generator-cli generate -i https://api.netneural.com/openapi.json -g go -o ./sdk/go
```

---

## Webhooks

### Webhook Configuration
```http
POST /webhooks
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "url": "https://your-app.com/webhooks/netneural",
  "events": ["device.status_changed", "alert.created", "alert.resolved"],
  "secret": "webhook-secret-key",
  "active": true
}
```

### Webhook Events

#### Device Status Changed
```json
{
  "event": "device.status_changed",
  "timestamp": "2025-08-05T12:00:00Z",
  "data": {
    "device": "Device Object",
    "previous_status": "online",
    "current_status": "offline"
  }
}
```

#### Alert Created
```json
{
  "event": "alert.created",
  "timestamp": "2025-08-05T12:00:00Z",
  "data": {
    "alert": "Alert Object",
    "device": "Device Object"
  }
}
```

### Webhook Security
Verify webhook signatures using HMAC SHA256:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(digest, 'hex')
  );
}
```

---

## Best Practices

### API Design
- Use RESTful conventions
- Implement proper HTTP status codes
- Include comprehensive error messages
- Use consistent naming conventions
- Implement proper pagination
- Support filtering and sorting

### Security
- Always use HTTPS
- Implement proper authentication
- Use rate limiting
- Validate all inputs
- Log security events
- Implement CORS properly

### Performance
- Implement caching where appropriate
- Use compression
- Optimize database queries
- Implement connection pooling
- Use CDN for static assets
- Monitor API performance

### Documentation
- Keep documentation up to date
- Provide clear examples
- Include error scenarios
- Document rate limits
- Provide SDKs in multiple languages
- Include testing tools
