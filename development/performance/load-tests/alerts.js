import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const supabaseUrl = __ENV.SUPABASE_URL || 'http://localhost:54321';
  const token = __ENV.AUTH_TOKEN;
  const supabaseKey = __ENV.SUPABASE_ANON_KEY;
  
  if (!token || !supabaseKey) {
    throw new Error('AUTH_TOKEN and SUPABASE_ANON_KEY environment variables required');
  }
  
  const res = http.get(`${supabaseUrl}/rest/v1/alerts?select=*,device:devices(*)&order=created_at.desc&limit=100`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseKey,
    },
  });

  check(res, {
    'alerts list loads': (r) => r.status === 200,
    'alerts list fast': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
