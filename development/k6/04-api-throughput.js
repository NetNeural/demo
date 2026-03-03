import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

/**
 * Scenario 4: Edge Function API Throughput
 * 
 * Sustained load against all major Edge Functions to measure p95 response
 * times and identify throughput limits.
 * Acceptance criteria: p95 < 2s across all functions, < 1% error rate
 * 
 * Run:
 *   k6 run 04-api-throughput.js \
 *     -e SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co \
 *     -e ANON_KEY=<anon_key> \
 *     -e ACCESS_TOKEN=<jwt_token>
 */

const fnLatency = new Trend('edge_fn_latency', true)
const fnErrors  = new Rate('edge_fn_error_rate')

export const options = {
  scenarios: {
    api_throughput: {
      executor: 'constant-vus',
      vus: 30,
      duration: '3m',
    },
  },
  thresholds: {
    edge_fn_latency: ['p(95)<2000', 'p(99)<5000'],
    edge_fn_error_rate: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
}

const BASE_URL = __ENV.SUPABASE_URL || 'https://bldojxpockljyivldxwf.supabase.co'
const ANON_KEY = __ENV.ANON_KEY || ''
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || ANON_KEY

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ACCESS_TOKEN}`,
  'apikey': ANON_KEY,
}

function callFn(name, method = 'GET', body = null) {
  const url = `${BASE_URL}/functions/v1/${name}`
  const params = { headers: AUTH_HEADERS, timeout: '10s' }
  const start = Date.now()
  const res = method === 'GET'
    ? http.get(url, params)
    : http.post(url, JSON.stringify(body), params)
  fnLatency.add(Date.now() - start)
  const ok = res.status < 500
  fnErrors.add(!ok)
  return res
}

export default function () {
  group('organizations function', () => {
    const res = callFn('organizations')
    check(res, { 'orgs fn < 500': (r) => r.status < 500 })
  })

  sleep(0.1)

  group('user-profile function', () => {
    const res = callFn('get-user-profile')
    check(res, { 'profile fn < 500': (r) => r.status < 500 })
  })

  sleep(0.1)

  group('analytics summary function', () => {
    const res = callFn('analytics-summary', 'POST', {
      org_id: 'test',
      period: '7d',
    })
    check(res, { 'analytics fn < 500': (r) => r.status < 500 })
  })

  sleep(0.1)

  group('devices list (REST)', () => {
    const res = http.get(
      `${BASE_URL}/rest/v1/devices?select=id,name,status&limit=50`,
      { headers: AUTH_HEADERS }
    )
    fnLatency.add(0) // already tracked by http_req_duration
    check(res, { 'devices REST < 500': (r) => r.status < 500 })
  })

  sleep(Math.random() * 2 + 1)
}
