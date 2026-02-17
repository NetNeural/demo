import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% under 2s
  },
};

export default function () {
  const supabaseUrl = __ENV.SUPABASE_URL || 'http://localhost:54321';
  const token = __ENV.AUTH_TOKEN;
  const supabaseKey = __ENV.SUPABASE_ANON_KEY;
  
  if (!token || !supabaseKey) {
    throw new Error('AUTH_TOKEN and SUPABASE_ANON_KEY environment variables required');
  }
  
  const res = http.get(`${supabaseUrl}/rest/v1/devices?select=*&order=name.asc&limit=200`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseKey,
    },
  });

  check(res, {
    'devices list loads': (r) => r.status === 200,
    'devices list fast': (r) => r.timings.duration < 2000,
    'returns devices': (r) => {
      try {
        return JSON.parse(r.body).length >= 0;
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
