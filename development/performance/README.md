# Performance Testing

This directory contains load tests and database profiling scripts for the NetNeural IoT Platform.

## Directory Structure

```
performance/
├── load-tests/          # k6 load testing scripts
│   ├── dashboard.js     # Dashboard load test (50 concurrent users)
│   ├── devices.js       # Device list load test
│   ├── alerts.js        # Alert list load test
│   └── api-stress.js    # API stress test (100 concurrent users)
│
└── db-profiling/        # Database query profiling
    ├── profile_queries.sql  # Query profiling and analysis
    └── add_indexes.sql      # Database index creation
```

## Running Load Tests

### Prerequisites

1. **Install k6**

macOS:

```bash
brew install k6
```

Linux (Debian/Ubuntu):

```bash
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

2. **Start Local Development Environment**

```bash
# Start Supabase and Next.js
npm run dev
```

3. **Get Authentication Token**

Login to the app and get your JWT token from browser DevTools (Application > Local Storage > supabase.auth.token)

### Run Tests

**Dashboard Load Test:**

```bash
k6 run performance/load-tests/dashboard.js
```

**Device List Load Test:**

```bash
export AUTH_TOKEN="your-jwt-token"
export SUPABASE_ANON_KEY="your-anon-key"
k6 run performance/load-tests/devices.js
```

**Alert List Load Test:**

```bash
k6 run performance/load-tests/alerts.js
```

**API Stress Test (100 concurrent users):**

```bash
k6 run performance/load-tests/api-stress.js
```

### Generate HTML Report

```bash
k6 run --out json=results.json performance/load-tests/dashboard.js
```

## Database Profiling

### Profile Queries

Run this to identify slow queries:

```bash
psql -h localhost -U postgres -d postgres -f performance/db-profiling/profile_queries.sql
```

Or via Supabase CLI:

```bash
npm run supabase db execute -- --file=performance/db-profiling/profile_queries.sql
```

### Add Database Indexes

Run this to add missing indexes:

```bash
psql -h localhost -U postgres -d postgres -f performance/db-profiling/add_indexes.sql
```

Or via Supabase CLI:

```bash
npm run supabase db execute -- --file=performance/db-profiling/add_indexes.sql
```

## Performance Targets

| Metric                              | Target  | Status     |
| ----------------------------------- | ------- | ---------- |
| Dashboard Load Time                 | < 3s    | 🔍 Testing |
| Device List Render (200 devices)    | < 2s    | 🔍 Testing |
| Alert List Render (100 alerts)      | < 2s    | 🔍 Testing |
| API Response Time (95th percentile) | < 500ms | 🔍 Testing |
| Concurrent Users                    | 50+     | 🔍 Testing |

## Next Steps

1. Run baseline load tests and record metrics
2. Add missing database indexes
3. Profile slow queries and optimize
4. Implement React Query for client-side caching
5. Set up Lighthouse CI for continuous performance monitoring

See [PERFORMANCE.md](../PERFORMANCE.md) for comprehensive performance testing guide.
