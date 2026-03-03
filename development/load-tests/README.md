# NetNeural Load Tests

k6-based load test scenarios for pre-launch performance validation.

## Prerequisites

```bash
# Install k6: https://k6.io/docs/get-started/installation/
# macOS
brew install k6

# Windows (winget)
winget install k6 --source winget
```

## Scenarios

### 1. Concurrent Users (`scenario-concurrent-users.js`)
Simulates 50 simultaneous user sessions — login, dashboard load, API calls.

```bash
k6 run \
  -e BASE_URL=https://sentinel.netneural.ai \
  -e SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co \
  -e ANON_KEY=<prod_anon_key> \
  -e TEST_EMAIL=loadtest@netneural.ai \
  -e TEST_PASSWORD=LoadTest123! \
  scenario-concurrent-users.js
```

**Thresholds:**
- `p95 < 2000ms` overall
- `p95 login < 3000ms`
- Error rate `< 1%`

---

### 2. Telemetry Ingestion (`scenario-telemetry-ingestion.js`)
Simulates 500 devices sending telemetry every 60 seconds.

```bash
k6 run \
  -e SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co \
  -e ANON_KEY=<prod_anon_key> \
  -e SERVICE_KEY=<service_role_key> \
  scenario-telemetry-ingestion.js
```

**Thresholds:**
- Ingest `p95 < 2000ms`
- Success rate `> 99%`

---

### 3. Edge Functions (`scenario-edge-functions.js`)
Tests response times for all key edge functions under load.

```bash
k6 run \
  -e SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co \
  -e ANON_KEY=<prod_anon_key> \
  -e ACCESS_TOKEN=<user_jwt> \
  scenario-edge-functions.js
```

**Thresholds:**
- All edge functions `p95 < 2000ms`
- Success rate `> 95%`

---

## Run All Scenarios

```bash
cd development/load-tests

k6 run scenario-concurrent-users.js
k6 run scenario-telemetry-ingestion.js
k6 run scenario-edge-functions.js
```

## Results

Results are written to `load-tests/results/` as JSON files after each run.
Run against **staging** first, then **production** once staging passes.

## Interpreting Results

| Metric | Target | Action if failing |
|--------|--------|-------------------|
| p95 latency | < 2s | Check DB query plans, add indexes, optimize edge functions |
| Error rate | < 1% | Check Supabase logs for DB errors, EF timeouts |
| Telemetry success | > 99% | Check `ingest-telemetry` EF logs, DB connection pool |
| DB connections | < 80% pool | Increase Supabase connection pool size or add PgBouncer |
