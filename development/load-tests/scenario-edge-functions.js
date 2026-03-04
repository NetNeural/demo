/**
 * k6 Load Test: Edge Function Response Times
 * Verifies p95 response time < 2s across all key edge functions.
 * Run: k6 run -e SUPABASE_URL=... -e ANON_KEY=... -e ACCESS_TOKEN=... scenario-edge-functions.js
 */
import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const SUPABASE_URL =
  __ENV.SUPABASE_URL || 'https://bldojxpockljyivldxwf.supabase.co'
const ANON_KEY = __ENV.ANON_KEY || ''
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || ANON_KEY

// Per-function latency metrics
const orgsLatency = new Trend('ef_organizations_latency_ms')
const devicesLatency = new Trend('ef_devices_latency_ms')
const alertsLatency = new Trend('ef_alerts_latency_ms')
const analyticsLatency = new Trend('ef_analytics_latency_ms')
const efSuccess = new Rate('ef_success_rate')

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    ef_organizations_latency_ms: ['p(95)<2000'],
    ef_devices_latency_ms: ['p(95)<2000'],
    ef_alerts_latency_ms: ['p(95)<2000'],
    ef_analytics_latency_ms: ['p(95)<2000'],
    ef_success_rate: ['rate>0.95'],
    http_req_failed: ['rate<0.05'],
  },
}

function callEF(name, path, method = 'GET', body = null, latencyMetric) {
  const url = `${SUPABASE_URL}/functions/v1/${path}`
  const params = {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
  }

  const start = Date.now()
  const res =
    method === 'GET'
      ? http.get(url, params)
      : http.post(url, body ? JSON.stringify(body) : null, params)
  const latency = Date.now() - start

  if (latencyMetric) latencyMetric.add(latency)

  const ok = check(res, {
    [`${name}: not 5xx`]: (r) => r.status < 500,
    [`${name}: <2s`]: () => latency < 2000,
  })
  efSuccess.add(ok)
  return res
}

export default function () {
  group('Organizations Edge Function', () => {
    callEF('organizations', 'organizations', 'GET', null, orgsLatency)
    sleep(0.5)
  })

  group('Devices Edge Function', () => {
    callEF('devices', 'devices', 'GET', null, devicesLatency)
    sleep(0.5)
  })

  group('Alerts Edge Function', () => {
    callEF('alerts', 'alerts', 'GET', null, alertsLatency)
    sleep(0.5)
  })

  group('Analytics Edge Function', () => {
    callEF(
      'analytics',
      'get-analytics',
      'POST',
      { period: '7d', limit: 10 },
      analyticsLatency
    )
    sleep(0.5)
  })

  sleep(1)
}

export function handleSummary(data) {
  const functions = [
    { name: 'organizations', metric: 'ef_organizations_latency_ms' },
    { name: 'devices', metric: 'ef_devices_latency_ms' },
    { name: 'alerts', metric: 'ef_alerts_latency_ms' },
    { name: 'analytics', metric: 'ef_analytics_latency_ms' },
  ]

  const rows = functions
    .map((f) => {
      const p95 = data.metrics[f.metric]?.values['p(95)']?.toFixed(0) ?? '?'
      const pass = (data.metrics[f.metric]?.values['p(95)'] ?? 9999) < 2000
      return `  ${f.name.padEnd(20)} p95=${p95}ms   ${pass ? '✓ PASS' : '✗ FAIL'}`
    })
    .join('\n')

  return {
    stdout: `
=== Edge Function Load Test Results ===
${rows}

Overall Success Rate: ${((data.metrics.ef_success_rate?.values.rate ?? 0) * 100).toFixed(2)}%
HTTP Error Rate: ${((data.metrics.http_req_failed?.values.rate ?? 0) * 100).toFixed(2)}%
`,
    'load-tests/results/edge-functions.json': JSON.stringify(data),
  }
}
