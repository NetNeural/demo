import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Gauge } from 'k6/metrics'

/**
 * Scenario 5: Database Connection Pool Saturation Test
 * 
 * Rapidly ramps VUs to find the point at which Supabase's PgBouncer
 * connection pool saturates. Look for 500 errors or dramatic latency spikes.
 * Acceptance criteria: No pool exhaustion at expected production load (<= 100 VUs)
 * 
 * Run:
 *   k6 run 05-db-connections.js \
 *     -e SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co \
 *     -e ANON_KEY=<anon_key> \
 *     -e ACCESS_TOKEN=<jwt_token>
 * 
 * ⚠️  WARNING: Run this test during off-peak hours. Stop immediately if you
 *    see 503/pool exhaustion errors on production data.
 */

const queryLatency  = new Trend('db_query_latency', true)
const poolErrors    = new Rate('db_pool_error_rate')

export const options = {
  scenarios: {
    db_ramp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '20s', target: 20  },
        { duration: '30s', target: 50  },
        { duration: '30s', target: 100 },
        { duration: '1m',  target: 100 },  // Hold at production-expected concurrency
        { duration: '20s', target: 150 },  // Probe above expected max
        { duration: '20s', target: 0   },
      ],
    },
  },
  thresholds: {
    db_query_latency: ['p(95)<1000'],  // DB queries should be fast
    db_pool_error_rate: ['rate<0.05'],  // < 5% errors at any VU level
    // Fail the test if we see 503 pool-exhaustion errors at <=100 VUs
    http_req_failed: ['rate<0.05'],
  },
}

const BASE_URL = __ENV.SUPABASE_URL || 'https://bldojxpockljyivldxwf.supabase.co'
const ANON_KEY = __ENV.ANON_KEY || ''
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || ANON_KEY

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ACCESS_TOKEN}`,
  'Accept': 'application/json',
}

export default function () {
  // Mix of simple and slightly heavier queries to stress the pool

  // 1. Simple primary key lookup (should be very fast)
  const start1 = Date.now()
  const r1 = http.get(
    `${BASE_URL}/rest/v1/organizations?select=id,name&limit=1`,
    { headers: HEADERS }
  )
  queryLatency.add(Date.now() - start1)
  poolErrors.add(r1.status === 503 || r1.status === 500)
  check(r1, { 'org lookup ok': (r) => r.status === 200 || r.status === 206 })

  sleep(0.05)

  // 2. Slightly heavier join-like query
  const start2 = Date.now()
  const r2 = http.get(
    `${BASE_URL}/rest/v1/devices?select=id,name,organization_id,status&limit=25`,
    { headers: HEADERS }
  )
  queryLatency.add(Date.now() - start2)
  poolErrors.add(r2.status === 503 || r2.status === 500)
  check(r2, {
    'devices query ok': (r) => r.status === 200 || r.status === 206,
    'not pool exhausted': (r) => r.status !== 503,
  })

  sleep(0.05)

  // 3. Count query (aggregation)
  const start3 = Date.now()
  const r3 = http.get(
    `${BASE_URL}/rest/v1/alerts?select=id&status=eq.active`,
    { headers: { ...HEADERS, 'Prefer': 'count=exact', 'Range': '0-0' } }
  )
  queryLatency.add(Date.now() - start3)
  poolErrors.add(r3.status === 503 || r3.status === 500)
  check(r3, { 'count query ok': (r) => r.status === 200 || r.status === 206 })

  sleep(0.3)  // Brief pause between rounds
}

export function handleSummary(data) {
  const p95 = data.metrics.db_query_latency?.values?.['p(95)'] ?? 0
  const errRate = data.metrics.db_pool_error_rate?.values?.rate ?? 0

  console.log('\n=== DB Connection Pool Test Summary ===')
  console.log(`p95 Query Latency: ${Math.round(p95)}ms (threshold: 1000ms)`)
  console.log(`Pool Error Rate:   ${(errRate * 100).toFixed(2)}% (threshold: 5%)`)
  console.log(`Result: ${errRate < 0.05 && p95 < 1000 ? '✅ PASS' : '❌ FAIL — log as follow-up issue'}`)

  return {
    stdout: '',  // Suppress default stdout; log above is sufficient
  }
}
