import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

/**
 * Scenario 2: Telemetry Ingestion Burst
 *
 * Simulates 500 devices reporting sensor readings every 60 seconds.
 * Target rate: ~8.3 messages/second sustained.
 * Acceptance criteria: no data loss, edge function p95 < 2s
 *
 * Run:
 *   k6 run 02-telemetry-ingestion.js \
 *     -e SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co \
 *     -e ANON_KEY=<anon_key> \
 *     -e ACCESS_TOKEN=<jwt_token>
 */

const ingestionLatency = new Trend('ingestion_latency', true)
const ingestionErrors = new Rate('ingestion_error_rate')
const messagesSent = new Counter('messages_sent')

export const options = {
  scenarios: {
    telemetry_burst: {
      executor: 'constant-arrival-rate',
      rate: 500, // 500 iterations per minute = ~500 devices/min
      timeUnit: '1m',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    ingestion_latency: ['p(95)<2000'], // p95 ingestion < 2s
    ingestion_error_rate: ['rate<0.001'], // < 0.1% loss
    http_req_duration: ['p(95)<2000'],
  },
}

const BASE_URL =
  __ENV.SUPABASE_URL || 'https://bldojxpockljyivldxwf.supabase.co'
const ANON_KEY = __ENV.ANON_KEY || ''
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || ANON_KEY

// Simulate a reading from a randomly-chosen device
function generateReading() {
  const deviceIds = [
    'device-sim-001',
    'device-sim-002',
    'device-sim-003',
    'device-sim-004',
    'device-sim-005',
  ]
  const deviceId = deviceIds[Math.floor(Math.random() * deviceIds.length)]
  return {
    device_id: deviceId,
    timestamp: new Date().toISOString(),
    readings: {
      temperature: +(20 + Math.random() * 15).toFixed(2),
      humidity: +(40 + Math.random() * 40).toFixed(2),
      battery: +(80 + Math.random() * 20).toFixed(1),
    },
    signal_strength: -50 - Math.floor(Math.random() * 40),
  }
}

export default function () {
  const payload = JSON.stringify(generateReading())

  const start = Date.now()
  const res = http.post(`${BASE_URL}/functions/v1/ingest-telemetry`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      apikey: ANON_KEY,
    },
    timeout: '5s',
  })

  const latency = Date.now() - start
  ingestionLatency.add(latency)
  messagesSent.add(1)

  const ok = res.status === 200 || res.status === 201
  ingestionErrors.add(!ok)
  check(res, {
    'telemetry accepted (200/201)': (r) => r.status === 200 || r.status === 201,
    'latency < 2s': () => latency < 2000,
  })

  // No sleep — arrival rate handles pacing
}
