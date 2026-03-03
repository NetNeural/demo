import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate, Counter } from 'k6/metrics'

// Custom metrics
const loginLatency = new Trend('login_latency_ms')
const dashboardLatency = new Trend('dashboard_latency_ms')
const apiLatency = new Trend('api_latency_ms')
const errorRate = new Rate('error_rate')
const totalRequests = new Counter('total_requests')

// ──────────────────────────────────────
// Config — override via env vars:
//   k6 run -e BASE_URL=https://demo-stage.netneural.ai scenario-concurrent-users.js
// ──────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'https://sentinel.netneural.ai'
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://bldojxpockljyivldxwf.supabase.co'
const ANON_KEY = __ENV.ANON_KEY || ''
const TEST_EMAIL = __ENV.TEST_EMAIL || 'loadtest@netneural.ai'
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'LoadTest123!'

export const options = {
  // 50 concurrent users ramping up over 2m, holding for 5m, then ramping down
  stages: [
    { duration: '1m', target: 10 },   // warm up
    { duration: '1m', target: 50 },   // ramp to 50
    { duration: '5m', target: 50 },   // sustain 50 concurrent users
    { duration: '1m', target: 0 },    // ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'],       // p95 < 2s
    'http_req_failed': ['rate<0.01'],          // error rate < 1%
    'login_latency_ms': ['p(95)<3000'],
    'dashboard_latency_ms': ['p(95)<2000'],
    'api_latency_ms': ['p(95)<2000'],
    'error_rate': ['rate<0.05'],
  },
}

function getAuthToken() {
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`
  const payload = JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
  }
  const start = Date.now()
  const res = http.post(url, payload, params)
  loginLatency.add(Date.now() - start)
  totalRequests.add(1)

  const ok = check(res, {
    'auth: status 200': (r) => r.status === 200,
    'auth: has access_token': (r) => {
      try { return !!JSON.parse(r.body).access_token }
      catch { return false }
    },
  })
  errorRate.add(!ok)

  if (res.status !== 200) return null
  return JSON.parse(res.body).access_token
}

function callOrganizationsAPI(token) {
  const start = Date.now()
  const res = http.get(`${SUPABASE_URL}/functions/v1/organizations`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
  })
  apiLatency.add(Date.now() - start)
  totalRequests.add(1)

  const ok = check(res, {
    'organizations API: 200 or 403': (r) => r.status === 200 || r.status === 403,
    'organizations API: <2s': (r) => r.timings.duration < 2000,
  })
  errorRate.add(!ok)
  return res
}

function callDevicesAPI(token) {
  const start = Date.now()
  const res = http.get(`${SUPABASE_URL}/rest/v1/devices?select=id,name&limit=20`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
  })
  apiLatency.add(Date.now() - start)
  totalRequests.add(1)

  check(res, {
    'devices API: 200': (r) => r.status === 200,
  })
}

function loadDashboard() {
  const start = Date.now()
  const res = http.get(`${BASE_URL}/dashboard`)
  dashboardLatency.add(Date.now() - start)
  totalRequests.add(1)

  check(res, {
    'dashboard: 200 or 302': (r) => r.status === 200 || r.status === 302,
  })
}

export default function () {
  // 1. Load dashboard homepage
  loadDashboard()
  sleep(0.5)

  // 2. Authenticate
  const token = getAuthToken()
  if (!token) {
    sleep(2)
    return
  }
  sleep(1)

  // 3. Call organizations API
  callOrganizationsAPI(token)
  sleep(1)

  // 4. Call devices API
  callDevicesAPI(token)
  sleep(1)

  // Simulate user browsing
  sleep(Math.random() * 2 + 1)
}
