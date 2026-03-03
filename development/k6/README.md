/**
 * k6 Load Test Suite — NetNeural Sentinel
 * GitHub Issue #345: Load Testing Against Production Environment
 *
 * Prerequisites:
 *   brew install k6  (macOS)
 *   choco install k6  (Windows)
 *   apt-get install k6  (Debian/Ubuntu)
 *
 * Required environment variables:
 *   SUPABASE_URL    — Production Supabase URL (https://bldojxpockljyivldxwf.supabase.co)
 *   ANON_KEY        — Supabase anon/public key (safe to use in tests)
 *   ACCESS_TOKEN    — A valid JWT from a test user login (for authenticated endpoints)
 *
 * Getting an ACCESS_TOKEN:
 *   curl -X POST https://bldojxpockljyivldxwf.supabase.co/auth/v1/token?grant_type=password \
 *     -H "apikey: <ANON_KEY>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"test@netneural.ai","password":"<password>"}' | jq .access_token
 *
 * Running individual scenarios:
 *   k6 run k6/01-concurrent-users.js    -e SUPABASE_URL=... -e ANON_KEY=... -e ACCESS_TOKEN=...
 *   k6 run k6/02-telemetry-ingestion.js -e SUPABASE_URL=... -e ANON_KEY=... -e ACCESS_TOKEN=...
 *   k6 run k6/03-alert-evaluation.js    -e SUPABASE_URL=... -e ANON_KEY=... -e ACCESS_TOKEN=...
 *   k6 run k6/04-api-throughput.js      -e SUPABASE_URL=... -e ANON_KEY=... -e ACCESS_TOKEN=...
 *   k6 run k6/05-db-connections.js      -e SUPABASE_URL=... -e ANON_KEY=... -e ACCESS_TOKEN=...
 *
 * Running with output to CSV:
 *   k6 run k6/01-concurrent-users.js --out csv=results/01-$(date +%Y%m%d).csv -e ...
 *
 * Acceptance Criteria (Issue #345):
 *   ✅ Dashboard page load equivalent < 3s at 50 concurrent users (01-concurrent-users)
 *   ✅ Telemetry ingestion handles 500 msg/min without data loss (02-telemetry-ingestion)
 *   ✅ Edge Function p95 response time < 2s under load (04-api-throughput)
 *   ✅ Database connection pool does not exhaust at expected concurrency (05-db-connections)
 *   ✅ Alert evaluation pipeline processes 100+ rules without backlog (03-alert-evaluation)
 *
 * ⚠️  Production Load Test Warning:
 *   - Run these tests during low-traffic windows (off-peak hours)
 *   - Monitor the Platform Health dashboard during the test
 *   - Stop immediately if real user error rates spike
 *   - The DB saturation test (05) is the most invasive — run last
 *   - Use a dedicated test user/org to avoid polluting real data
 */
