# Performance Testing & Optimization Guide

## Overview

This document provides comprehensive guidance for performance testing, optimization, and monitoring of the NetNeural IoT Platform.

## Table of Contents

- [Performance Benchmarks](#performance-benchmarks)
- [Load Testing](#load-testing)
- [Database Query Optimization](#database-query-optimization)
- [Frontend Performance](#frontend-performance)
- [API Performance](#api-performance)
- [Caching Strategy](#caching-strategy)
- [Performance Monitoring](#performance-monitoring)
- [Troubleshooting](#troubleshooting)

---

## Performance Benchmarks

### Target Performance Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Dashboard Load Time (50 devices, 20 alerts) | < 3s | TBD | 🔍 |
| Device List Render (200 devices) | < 2s | TBD | 🔍 |
| Alert List Render (100 alerts) | < 2s | TBD | 🔍 |
| Telemetry Chart Load (7 days) | < 5s | TBD | 🔍 |
| Report Export (1,000 rows) | < 10s | TBD | 🔍 |
| Threshold Evaluation (100 devices) | < 5s | TBD | 🔍 |
| API Response Time (95th percentile) | < 500ms | TBD | 🔍 |
| Concurrent Users | 50+ | TBD | 🔍 |

### Measurement Tools

- **Frontend**: Lighthouse CI, Web Vitals, React DevTools Profiler
- **API**: k6, Artillery, Apache Bench (ab)
- **Database**: PostgreSQL `EXPLAIN ANALYZE`, pg_stat_statements
- **End-to-End**: Playwright with performance tracking

---

## Load Testing

### Setup k6 (Recommended)

```bash
# Install k6 (macOS)
brew install k6

# Install k6 (Linux - Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Verify installation
k6 version
```

### Load Test Scenarios

#### 1. Dashboard Load Test

**File**: `performance/load-tests/dashboard.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '2m', target: 50 },  // Stay at 50 users
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    http_req_failed: ['rate<0.01'],    // Less than 1% failures
  },
};

export default function () {
  // Test user credentials
  const loginPayload = JSON.stringify({
    email: 'test@netneural.ai',
    password: 'TestPassword123!',
  });

  // Login
  const loginRes = http.post('http://localhost:3000/api/auth/login', loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  // Dashboard load
  const dashboardRes = http.get('http://localhost:3000/dashboard', {
    headers: {
      'Authorization': `Bearer ${loginRes.json('access_token')}`,
    },
  });

  check(dashboardRes, {
    'dashboard loads': (r) => r.status === 200,
    'dashboard loads fast': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
```

**Run**:
```bash
k6 run performance/load-tests/dashboard.js
```

#### 2. Device List Load Test

**File**: `performance/load-tests/devices.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% under 2s
  },
};

export default function () {
  const token = __ENV.AUTH_TOKEN; // Set via: k6 run -e AUTH_TOKEN=xxx devices.js
  
  const res = http.get('http://localhost:54321/rest/v1/devices?select=*&order=name.asc&limit=200', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': __ENV.SUPABASE_ANON_KEY,
    },
  });

  check(res, {
    'devices list loads': (r) => r.status === 200,
    'devices list fast': (r) => r.timings.duration < 2000,
    'returns devices': (r) => JSON.parse(r.body).length > 0,
  });

  sleep(1);
}
```

#### 3. Alert List Load Test

**File**: `performance/load-tests/alerts.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const token = __ENV.AUTH_TOKEN;
  
  const res = http.get('http://localhost:54321/rest/v1/alerts?select=*,device:devices(*)&order=created_at.desc&limit=100', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': __ENV.SUPABASE_ANON_KEY,
    },
  });

  check(res, {
    'alerts list loads': (r) => r.status === 200,
    'alerts list fast': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
```

#### 4. API Endpoint Stress Test

**File**: `performance/load-tests/api-stress.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },  // Stress test with 100 users
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% under 500ms
    http_req_failed: ['rate<0.05'],   // Less than 5% failures
  },
};

export default function () {
  const token = __ENV.AUTH_TOKEN;
  
  // Test multiple endpoints
  const endpoints = [
    '/rest/v1/devices?limit=25',
    '/rest/v1/alerts?limit=20',
    '/rest/v1/device_telemetry_history?limit=50',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const res = http.get(`http://localhost:54321${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': __ENV.SUPABASE_ANON_KEY,
    },
  });

  check(res, {
    'api responds': (r) => r.status === 200,
    'api fast': (r) => r.timings.duration < 500,
  });

  sleep(0.5);
}
```

### Running Load Tests

```bash
# Set environment variables
export AUTH_TOKEN="your-jwt-token"
export SUPABASE_ANON_KEY="your-anon-key"

# Run individual tests
k6 run performance/load-tests/dashboard.js
k6 run -e AUTH_TOKEN=$AUTH_TOKEN performance/load-tests/devices.js
k6 run -e AUTH_TOKEN=$AUTH_TOKEN performance/load-tests/alerts.js
k6 run -e AUTH_TOKEN=$AUTH_TOKEN performance/load-tests/api-stress.js

# Generate HTML report
k6 run --out json=results.json performance/load-tests/dashboard.js
```

---

## Database Query Optimization

### Query Profiling

**File**: `performance/db-profiling/profile_queries.sql`

```sql
-- Enable pg_stat_statements extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries (> 100ms average)
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  min_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Reset statistics
SELECT pg_stat_statements_reset();

-- Profile specific query with EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT 
  d.*,
  COUNT(a.id) as alert_count
FROM devices d
LEFT JOIN alerts a ON a.device_id = d.id AND a.acknowledged_at IS NULL
WHERE d.organization_id = 'test-org-123'
GROUP BY d.id
ORDER BY d.name ASC
LIMIT 200;
```

### Required Indexes

**File**: `performance/db-profiling/add_indexes.sql`

```sql
-- Devices table indexes
CREATE INDEX IF NOT EXISTS idx_devices_organization_id ON devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_devices_name ON devices(name);
CREATE INDEX IF NOT EXISTS idx_devices_online_status ON devices(online_status);
CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices(device_type);
CREATE INDEX IF NOT EXISTS idx_devices_created_at ON devices(created_at DESC);

-- Alerts table indexes
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_organization_id ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged_at ON alerts(acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- Composite index for unacknowledged alerts by org
CREATE INDEX IF NOT EXISTS idx_alerts_unack_org ON alerts(organization_id, acknowledged_at) WHERE acknowledged_at IS NULL;

-- Device telemetry history indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_device_id ON device_telemetry_history(device_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON device_telemetry_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_device_created ON device_telemetry_history(device_id, created_at DESC);

-- User actions indexes
CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_device_id ON user_actions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_category ON user_actions(action_category);
CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at DESC);

-- Alert acknowledgements indexes
CREATE INDEX IF NOT EXISTS idx_alert_ack_alert_id ON alert_acknowledgements(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_ack_user_id ON alert_acknowledgements(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_ack_created_at ON alert_acknowledgements(acknowledged_at DESC);

-- Sensor thresholds indexes
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_device_id ON sensor_thresholds(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_org_id ON sensor_thresholds(organization_id);
CREATE INDEX IF NOT EXISTS idx_sensor_thresholds_enabled ON sensor_thresholds(enabled) WHERE enabled = true;

-- AI insights cache indexes
CREATE INDEX IF NOT EXISTS idx_ai_cache_device_id ON ai_insights_cache(device_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON ai_insights_cache(expires_at);

-- Analyze tables after creating indexes
ANALYZE devices;
ANALYZE alerts;
ANALYZE device_telemetry_history;
ANALYZE user_actions;
ANALYZE alert_acknowledgements;
ANALYZE sensor_thresholds;
ANALYZE ai_insights_cache;
```

### Query Optimization Tips

1. **Use Proper Indexes**: Ensure all foreign keys and frequently queried columns have indexes
2. **Limit Result Sets**: Always use `LIMIT` in queries, especially for large tables
3. **Avoid N+1 Queries**: Use JOINs or batch queries instead of iterating
4. **Use Materialized Views**: For complex aggregations that don't change often
5. **Partition Large Tables**: Consider partitioning telemetry data by date
6. **Use Connection Pooling**: Supabase handles this automatically

---

## Frontend Performance

### Lighthouse CI Setup

**File**: `.github/workflows/lighthouse.yml`

```yaml
name: Lighthouse CI

on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
        working-directory: ./development
      
      - name: Build application
        run: npm run build
        working-directory: ./development
      
      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/dashboard
            http://localhost:3000/dashboard/devices
            http://localhost:3000/dashboard/alerts
          uploadArtifacts: true
          temporaryPublicStorage: true
```

### Performance Budget

**File**: `lighthouserc.json`

```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "startServerCommand": "npm run start",
      "url": [
        "http://localhost:3000",
        "http://localhost:3000/dashboard",
        "http://localhost:3000/dashboard/devices",
        "http://localhost:3000/dashboard/alerts"
      ]
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}],
        "categories:accessibility": ["error", {"minScore": 0.9}],
        "first-contentful-paint": ["error", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 3000}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["error", {"maxNumericValue": 300}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### React Performance Optimization

#### 1. Code Splitting

```typescript
// Use dynamic imports for large components
const DevicesList = lazy(() => import('@/components/devices/DevicesList'))
const AlertsList = lazy(() => import('@/components/alerts/AlertsList'))

// Wrap in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <DevicesList />
</Suspense>
```

#### 2. Memoization

```typescript
// Memoize expensive computations
const sortedDevices = useMemo(() => {
  return devices.sort((a, b) => a.name.localeCompare(b.name))
}, [devices])

// Memoize callbacks
const handleDeviceClick = useCallback((deviceId: string) => {
  router.push(`/dashboard/devices/${deviceId}`)
}, [router])
```

#### 3. Virtual Scrolling

```typescript
// For large lists, use react-window or react-virtuoso
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={devices.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <DeviceCard device={devices[index]} style={style} />
  )}
</FixedSizeList>
```

---

## API Performance

### Edge Function Optimization

1. **Minimize Cold Starts**: Keep functions warm with scheduled pings
2. **Reduce Bundle Size**: Only import necessary modules
3. **Use Caching**: Implement Redis or in-memory caching for frequently accessed data
4. **Batch Database Queries**: Reduce database round-trips
5. **Set Appropriate Timeouts**: Avoid long-running functions

### API Response Caching

**Supabase PostgREST** automatically handles caching via HTTP headers. You can also implement application-level caching:

```typescript
// Cache API responses with stale-while-revalidate
export async function getDevices() {
  const cacheKey = 'devices-list'
  const cached = sessionStorage.getItem(cacheKey)
  
  if (cached) {
    const { data, timestamp } = JSON.parse(cached)
    const age = Date.now() - timestamp
    
    // Return cached data if less than 5 minutes old
    if (age < 5 * 60 * 1000) {
      return data
    }
  }
  
  // Fetch fresh data
  const { data, error } = await supabase.from('devices').select('*')
  
  if (!error) {
    sessionStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
  }
  
  return data
}
```

---

## Caching Strategy

### Current Implementation

1. **AI Insights Cache**: 15-minute cache in `ai_insights_cache` table
2. **Browser Cache**: Session storage for user preferences
3. **CDN Cache**: GitHub Pages serves static assets with cache headers

### Recommended Additions

1. **React Query**: Client-side data fetching and caching library
2. **Service Worker**: Offline support and background sync
3. **Redis**: Server-side caching for frequently accessed data (future consideration)

---

## Performance Monitoring

### Web Vitals

Track Core Web Vitals in production:

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }: { children: React.Node }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Sentry Performance Monitoring

Already configured in the application. View performance metrics at:
- https://sentry.io/organizations/netneural/performance/

### Custom Performance Tracking

```typescript
// utils/performance.ts
export function measurePageLoad() {
  if (typeof window === 'undefined') return
  
  window.addEventListener('load', () => {
    const perfData = window.performance.timing
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart
    
    console.log(`Page load time: ${pageLoadTime}ms`)
    
    // Send to analytics
    if (window.gtag) {
      window.gtag('event', 'timing_complete', {
        name: 'page_load',
        value: pageLoadTime,
        event_category: 'Performance'
      })
    }
  })
}
```

---

## Troubleshooting

### Slow Dashboard Load

1. Check network waterfall in DevTools
2. Identify slow API calls
3. Profile React components with React DevTools
4. Check for unnecessary re-renders
5. Implement pagination or infinite scroll

### Slow Database Queries

1. Run `EXPLAIN ANALYZE` on the query
2. Check for missing indexes
3. Ensure statistics are up to date (`ANALYZE table_name`)
4. Consider query rewriting
5. Add appropriate indexes

### High Memory Usage

1. Check for memory leaks in React components
2. Ensure useEffect cleanup functions are implemented
3. Limit in-memory data caching
4. Use pagination instead of loading all data

### Slow API Responses

1. Check Edge Function logs in Supabase dashboard
2. Profile database queries
3. Reduce payload size (select only needed columns)
4. Implement API response caching
5. Consider moving heavy computation to background jobs

---

## Performance Checklist

### Frontend
- [ ] Code splitting implemented for large components
- [ ] Images optimized and lazy-loaded
- [ ] Unnecessary re-renders eliminated (React.memo, useMemo, useCallback)
- [ ] Virtual scrolling for large lists
- [ ] Bundle size < 300kb gzipped
- [ ] Lighthouse score > 90

### API
- [ ] API responses < 500ms (95th percentile)
- [ ] Edge Functions < 1s execution time
- [ ] Proper error handling and timeouts
- [ ] Response caching where appropriate

### Database
- [ ] All foreign keys indexed
- [ ] Frequently queried columns indexed
- [ ] Composite indexes for common query patterns
- [ ] Statistics up to date (ANALYZE)
- [ ] Query plans reviewed (EXPLAIN ANALYZE)
- [ ] Slow query log monitored

### Caching
- [ ] AI insights cached (15 minutes)
- [ ] Static assets cached by CDN
- [ ] Browser caching strategy implemented
- [ ] Consider React Query for data fetching

### Monitoring
- [ ] Lighthouse CI running on PRs
- [ ] Sentry performance monitoring active
- [ ] Core Web Vitals tracked
- [ ] Database slow query log enabled

---

## Next Steps

1. ✅ Document performance benchmarks
2. ⏳ Run load tests and record baseline metrics
3. ⏳ Add missing database indexes
4. ⏳ Implement Lighthouse CI in GitHub Actions
5. ⏳ Consider React Query for client-side caching
6. ⏳ Set up performance budget enforcement
7. ⏳ Profile and optimize slow queries
8. ⏳ Implement virtual scrolling for large lists

---

**Last Updated**: February 17, 2026  
**Status**: Performance testing infrastructure in progress (Story 2.5)  
**Target**: < 3s dashboard load, < 500ms API responses, 50+ concurrent users
