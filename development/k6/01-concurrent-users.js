import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

/**
 * Scenario 1: 50 Concurrent Dashboard Users
 *
 * Simulates 50 users browsing the dashboard simultaneously.
 * Acceptance criteria: p95 page load equivalent (REST calls) < 3s
 *
 * Run:
 *   k6 run 01-concurrent-users.js \
 *     -e SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co \
 *     -e ANON_KEY=<anon_key> \
 *     -e ACCESS_TOKEN=<jwt_token>
 */

const dashboardLatency = new Trend('dashboard_latency', true)
const errorRate = new Rate('error_rate')

export const options = {
  scenarios: {
    concurrent_users: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 }, // Ramp up to 10
        { duration: '1m', target: 50 }, // Ramp up to 50
        { duration: '2m', target: 50 }, // Hold at 50
        { duration: '30s', target: 0 }, // Ramp down
      ],
    },
  },
  thresholds: {
    dashboard_latency: ['p(95)<3000'], // p95 < 3s
    error_rate: ['rate<0.01'], // < 1% errors
    http_req_duration: ['p(95)<3000'],
  },
}

const BASE_URL =
  __ENV.SUPABASE_URL || 'https://bldojxpockljyivldxwf.supabase.co'
const ANON_KEY = __ENV.ANON_KEY || ''
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || ANON_KEY

const headers = {
  'Content-Type': 'application/json',
  apikey: ANON_KEY,
  Authorization: `Bearer ${ACCESS_TOKEN}`,
  Accept: 'application/json',
}

export default function () {
  const start = Date.now()

  // Simulate dashboard page loading: fetch org overview data
  const orgRes = http.get(
    `${BASE_URL}/rest/v1/organizations?select=id,name,settings&limit=10`,
    { headers }
  )
  check(orgRes, {
    'orgs status 200': (r) => r.status === 200,
    'orgs has body': (r) => r.body && r.body.length > 0,
  })
  errorRate.add(orgRes.status !== 200)

  // Fetch devices count
  const devicesRes = http.get(`${BASE_URL}/rest/v1/devices?select=id&limit=1`, {
    headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
  })
  check(devicesRes, {
    'devices status 200/206': (r) => r.status === 200 || r.status === 206,
  })
  errorRate.add(devicesRes.status !== 200 && devicesRes.status !== 206)

  // Fetch recent alerts
  const alertsRes = http.get(
    `${BASE_URL}/rest/v1/alerts?select=id,name,status&status=in.(active,triggered)&limit=20`,
    { headers }
  )
  check(alertsRes, { 'alerts status 200': (r) => r.status === 200 })
  errorRate.add(alertsRes.status !== 200)

  const elapsed = Date.now() - start
  dashboardLatency.add(elapsed)

  // Simulate user reading the dashboard
  sleep(Math.random() * 3 + 2)
}
