import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 50 }, // Ramp up to 50 users
    { duration: '2m', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    http_req_failed: ['rate<0.01'], // Less than 1% failures
  },
}

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000'

  // Dashboard load
  const dashboardRes = http.get(`${baseUrl}/dashboard`)

  check(dashboardRes, {
    'dashboard loads': (r) => r.status === 200,
    'dashboard loads fast': (r) => r.timings.duration < 3000,
    'dashboard has content': (r) =>
      r.body.includes('Dashboard') || r.body.includes('devices'),
  })

  sleep(1)
}
