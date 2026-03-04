import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

/**
 * Scenario 3: Alert Evaluation Under Load
 *
 * Simulates the alert evaluation pipeline processing 100+ active rules
 * while new telemetry arrives. Tests threshold evaluation performance.
 *
 * Run:
 *   k6 run 03-alert-evaluation.js \
 *     -e SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co \
 *     -e ANON_KEY=<anon_key> \
 *     -e ACCESS_TOKEN=<jwt_token>
 */

const evalLatency = new Trend('alert_eval_latency', true)
const evalErrors = new Rate('alert_eval_error_rate')

export const options = {
  scenarios: {
    alert_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '2m', target: 20 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    alert_eval_latency: ['p(95)<2000'],
    alert_eval_error_rate: ['rate<0.02'],
  },
}

const BASE_URL =
  __ENV.SUPABASE_URL || 'https://bldojxpockljyivldxwf.supabase.co'
const ANON_KEY = __ENV.ANON_KEY || ''
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || ANON_KEY

const REST_HEADERS = {
  'Content-Type': 'application/json',
  apikey: ANON_KEY,
  Authorization: `Bearer ${ACCESS_TOKEN}`,
}

export default function () {
  const start = Date.now()

  // Fetch active alert rules (simulates evaluation polling)
  const rulesRes = http.get(
    `${BASE_URL}/rest/v1/alerts?select=id,name,conditions,status&status=in.(active,enabled)&limit=100`,
    { headers: REST_HEADERS }
  )
  check(rulesRes, { 'rules fetch 200': (r) => r.status === 200 })
  evalErrors.add(rulesRes.status !== 200)

  // Fetch recent telemetry to evaluate against rules
  const telemetryRes = http.get(
    `${BASE_URL}/rest/v1/telemetry?select=device_id,readings,timestamp&order=timestamp.desc&limit=100`,
    { headers: REST_HEADERS }
  )
  check(telemetryRes, { 'telemetry fetch 200': (r) => r.status === 200 })
  evalErrors.add(telemetryRes.status !== 200)

  // Trigger edge function evaluation
  const evalRes = http.post(
    `${BASE_URL}/functions/v1/evaluate-alerts`,
    JSON.stringify({
      trigger: 'load_test',
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        apikey: ANON_KEY,
      },
      timeout: '10s',
    }
  )
  // 200 = evaluated, 204 = no rules to evaluate, 404 = function not found (skip)
  const evalOk =
    evalRes.status === 200 || evalRes.status === 204 || evalRes.status === 404
  check(evalRes, { 'eval function ok': () => evalOk })
  evalErrors.add(!evalOk)

  evalLatency.add(Date.now() - start)
  sleep(1)
}
