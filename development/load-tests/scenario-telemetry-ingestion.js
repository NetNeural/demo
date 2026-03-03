/**
 * k6 Load Test: Telemetry Ingestion
 * Simulates 500 devices each sending telemetry every 60 seconds.
 * Run: k6 run -e SUPABASE_URL=... -e ANON_KEY=... scenario-telemetry-ingestion.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate, Counter } from 'k6/metrics'
import { randomSeed, randomItem } from 'k6'

const ingestLatency = new Trend('telemetry_ingest_latency_ms')
const ingestSuccess = new Rate('telemetry_ingest_success')
const totalIngested = new Counter('telemetry_records_ingested')

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://bldojxpockljyivldxwf.supabase.co'
const ANON_KEY = __ENV.ANON_KEY || ''
const SERVICE_KEY = __ENV.SERVICE_KEY || '' // for direct DB inserts under load

// 500 simulated devices
const DEVICE_COUNT = 500

// Each VU represents one device; 500 VUs run simultaneously
export const options = {
  scenarios: {
    telemetry_flood: {
      executor: 'constant-vus',
      vus: 500,
      duration: '3m',
    },
  },
  thresholds: {
    'telemetry_ingest_latency_ms': ['p(95)<2000'],
    'telemetry_ingest_success': ['rate>0.99'],
    'http_req_failed': ['rate<0.01'],
  },
}

function generateTelemetry(deviceIndex) {
  return JSON.stringify({
    device_id: `load-test-device-${String(deviceIndex).padStart(4, '0')}`,
    timestamp: new Date().toISOString(),
    readings: {
      temperature: 20 + Math.random() * 20,
      humidity: 40 + Math.random() * 40,
      battery: 80 + Math.random() * 20,
      rssi: -50 - Math.random() * 40,
    },
    metadata: {
      firmware_version: '1.2.3',
      protocol: 'mqtt',
      load_test: true,
    },
  })
}

export default function () {
  // Each VU gets its own device index
  const deviceIndex = (__VU - 1) % DEVICE_COUNT

  const payload = generateTelemetry(deviceIndex)
  const start = Date.now()

  // Ingest via Edge Function
  const res = http.post(
    `${SUPABASE_URL}/functions/v1/ingest-telemetry`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY || ANON_KEY}`,
        apikey: ANON_KEY,
      },
    }
  )

  const latency = Date.now() - start
  ingestLatency.add(latency)
  totalIngested.add(1)

  const ok = check(res, {
    'telemetry: accepted (200/201/204)': (r) => [200, 201, 204].includes(r.status),
    'telemetry: <2s': () => latency < 2000,
  })
  ingestSuccess.add(ok)

  // Devices send every ~60s; divide by VU count for stagger
  sleep(60 / DEVICE_COUNT * 5 + Math.random() * 2)
}

export function handleSummary(data) {
  return {
    stdout: `
=== Telemetry Ingestion Load Test Results ===
Total Records Ingested: ${data.metrics.telemetry_records_ingested?.values.count ?? 0}
Success Rate: ${((data.metrics.telemetry_ingest_success?.values.rate ?? 0) * 100).toFixed(2)}%
p50 Latency: ${data.metrics.telemetry_ingest_latency_ms?.values['p(50)']?.toFixed(0) ?? '?'}ms
p95 Latency: ${data.metrics.telemetry_ingest_latency_ms?.values['p(95)']?.toFixed(0) ?? '?'}ms
p99 Latency: ${data.metrics.telemetry_ingest_latency_ms?.values['p(99)']?.toFixed(0) ?? '?'}ms
HTTP Error Rate: ${((data.metrics.http_req_failed?.values.rate ?? 0) * 100).toFixed(2)}%

Threshold: p95 < 2000ms — ${(data.metrics.telemetry_ingest_latency_ms?.values['p(95)'] ?? 9999) < 2000 ? '✓ PASS' : '✗ FAIL'}
Threshold: success rate > 99% — ${((data.metrics.telemetry_ingest_success?.values.rate ?? 0) * 100) > 99 ? '✓ PASS' : '✗ FAIL'}
`,
    'load-tests/results/telemetry-ingestion.json': JSON.stringify(data),
  }
}
