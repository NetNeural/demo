import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '1m', target: 100 }, // Stress test with 100 users
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% under 500ms
    http_req_failed: ['rate<0.05'], // Less than 5% failures
  },
}

export default function () {
  const supabaseUrl = __ENV.SUPABASE_URL || 'http://localhost:54321'
  const token = __ENV.AUTH_TOKEN
  const supabaseKey = __ENV.SUPABASE_ANON_KEY

  if (!token || !supabaseKey) {
    throw new Error(
      'AUTH_TOKEN and SUPABASE_ANON_KEY environment variables required'
    )
  }

  // Test multiple endpoints
  const endpoints = [
    '/rest/v1/devices?limit=25',
    '/rest/v1/alerts?limit=20',
    '/rest/v1/device_telemetry_history?limit=50',
  ]

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]

  const res = http.get(`${supabaseUrl}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseKey,
    },
  })

  check(res, {
    'api responds': (r) => r.status === 200,
    'api fast': (r) => r.timings.duration < 500,
  })

  sleep(0.5)
}
