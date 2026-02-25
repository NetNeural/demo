# Troubleshooting Guide - Supabase Development

This guide covers common issues you might encounter while developing the NetNeural IoT Platform with **Supabase-first architecture** and their solutions.

## 🚀 Quick Start Issues

### Supabase Setup Problems

#### Supabase CLI Installation Issues
**Problem**: Supabase CLI not installing or working properly
```bash
Error: supabase command not found
```

**Solution**:
```bash
# Install Supabase CLI globally
npm install -g supabase

# Or use npx for one-time use
npx supabase --version

# Verify installation
supabase --version

# Alternative installation via Homebrew (macOS)
brew install supabase/tap/supabase

# Alternative installation via Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### Supabase Local Development Issues
**Problem**: Supabase services not starting properly
```bash
Error: Docker is not running
supabase start failed
```

**Solution**:
```bash
# Ensure Docker is running
docker --version
docker ps

# Start Docker if not running
# On Windows/macOS: Start Docker Desktop
# On Linux: sudo systemctl start docker

# Check Supabase status
supabase status

# Reset Supabase if stuck
supabase stop
supabase start

# If port conflicts occur
supabase start --debug
# Check which ports are in use and stop conflicting services
```

#### Database Migration Issues
**Problem**: Migrations not applying correctly
```bash
Error: migration failed
Error: relation already exists
```

**Solution**:
```bash
# Reset database completely
supabase db reset

# Apply migrations manually
supabase db push

# Check migration status
supabase migration list

# Repair migrations if needed
supabase migration repair --status applied 20250918000001

# Create new migration for fixes
supabase migration new fix_schema_issue
```

## 🗄️ Database Issues

### Supabase Database Problems

#### Database Connection Issues
**Problem**: Database connection timeouts or failures
```bash
Error: connect ETIMEDOUT
Error: Invalid API key or project URL
```

**Solution**:
```bash
# Check Supabase project status in dashboard
# 1. Verify project is not paused (free tier limitation)
# 2. Confirm database URL and API keys
# 3. Check project settings

# Test connection with Supabase CLI
supabase projects list
supabase status

# Verify environment variables
echo $SUPABASE_PROJECT_ID
echo $SUPABASE_URL

# If using local Supabase
supabase stop
supabase start
```

#### Row Level Security (RLS) Issues
**Problem**: Unable to read/write data due to RLS policies
```bash
Error: new row violates row-level security policy
```

**Solution**:
```bash
# Check RLS policies in Supabase dashboard
# 1. Go to Authentication > Policies
# 2. Verify policies exist for your tables
# 3. Test policies with different user roles

# Disable RLS temporarily for testing (NOT for production)
# In Supabase dashboard: Table Editor > [Table] > Settings > Row Level Security OFF

# Debug with service role key
# Use SUPABASE_SERVICE_ROLE_KEY for admin operations
# Never expose service role key in client-side code
```

### Row Level Security (RLS) Issues

#### Permission Denied Errors
**Problem**: RLS policies blocking legitimate operations
```bash
Error: new row violates row-level security policy for table "devices"
```

**Solution**:
1. Check if user is authenticated:
```javascript
// Verify user session
const { data: { user } } = await supabase.auth.getUser()
console.log('Current user:', user)
```

2. Review RLS policies in Supabase dashboard
3. Temporarily disable RLS for debugging (development only):
```sql
-- NEVER do this in production
ALTER TABLE devices DISABLE ROW LEVEL SECURITY;
```

## 🔗 External API Integration Issues

### Golioth IoT Platform Integration

#### Golioth Authentication Problems
**Problem**: Golioth API authentication failures
```bash
Error: 401 Unauthorized - Invalid API key
Error: 403 Forbidden - Insufficient permissions
```

**Solution**:
```bash
# Verify API key format and permissions
echo $GOLIOTH_API_KEY  # Should start with 'gol_'

# Test API connection
curl -H "Authorization: Bearer $GOLIOTH_API_KEY" \
     https://api.golioth.io/v1/projects

# Check API key permissions in Golioth console
# 1. Go to Access Management > API Keys
# 2. Verify key has required scopes
# 3. Generate new key if needed

# Store in Supabase Edge Function secrets
supabase secrets set GOLIOTH_API_KEY=your_api_key
```

#### Device Data Sync Issues
**Problem**: IoT device data not syncing to Supabase
```bash
Error: Failed to sync device telemetry
```

**Solution**:
```bash
# Check Edge Function logs
supabase functions logs iot-data-sync

# Verify webhook endpoint
# 1. Check Golioth webhook configuration
# 2. Ensure URL points to Edge Function
# 3. Verify webhook secret matches

# Test data flow manually
supabase functions invoke iot-data-sync \
  --data '{"device_id":"test","telemetry":{"temp":25}}'

# Check database for received data
# Use Supabase dashboard > Table Editor
```
## 🎨 Frontend Issues

### Next.js Static Export Problems

#### Build Errors for GitHub Pages
**Problem**: Static export fails during build
```bash
Error: Image optimization is not compatible with output: 'export'
Error: Dynamic imports not supported with static export
```

**Solution**:
```javascript
// next.config.js - Ensure proper configuration
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Remove any dynamic imports in static pages
  // Use next/dynamic with ssr: false for client-only components
}

module.exports = nextConfig
```

#### Supabase Client Issues in Static Export
**Problem**: Supabase client not working in static build
```bash
Error: supabase client not initialized
```

**Solution**:
```javascript
// lib/supabase.js - Client-side only initialization
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Use dynamic imports for Supabase components
import dynamic from 'next/dynamic'

const DashboardComponent = dynamic(
  () => import('../components/Dashboard'),
  { ssr: false }
)
```

### GitHub Pages Deployment Issues

#### Asset Path Problems
**Problem**: Static assets not loading on GitHub Pages
```bash
404 errors for CSS, JS, and image files
```

**Solution**:
```javascript
// next.config.js - Add proper base path for GitHub Pages
const isProduction = process.env.NODE_ENV === 'production'
const repoName = 'SoftwareMono' // Your GitHub repository name

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isProduction ? `/${repoName}` : '',
  assetPrefix: isProduction ? `/${repoName}` : '',
}

module.exports = nextConfig
```

#### Supabase Environment Variables in GitHub Pages
**Problem**: Environment variables not available in static export
```bash
Error: NEXT_PUBLIC_SUPABASE_URL is undefined
```

**Solution**:
```bash
# 1. Ensure variables are prefixed with NEXT_PUBLIC_
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 2. Add to GitHub Actions workflow
# .github/workflows/deploy.yml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

# 3. Store secrets in GitHub repository settings
# Settings > Secrets and variables > Actions
```
  () => import('../components/ClientOnlyComponent'),
  { ssr: false }
)

// Or use useEffect for client-only logic
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
if (!mounted) return null
```

### React State Management Issues

#### State Update Batching
**Problem**: State updates not batching correctly
```javascript
// This might not work as expected
setCount(count + 1)
setCount(count + 1)  // Still uses old count value
```

**Solution**:
```javascript
// Use functional updates
setCount(prev => prev + 1)
setCount(prev => prev + 1)

// Or batch updates manually (React 18)
import { unstable_batchedUpdates } from 'react-dom'

unstable_batchedUpdates(() => {
  setCount(count + 1)
  setName('New Name')
})
```

## 🧪 Testing Issues

### Supabase Testing Problems

#### Local Testing with Supabase
**Problem**: Tests failing due to Supabase configuration
```bash
Error: Invalid API URL or key in tests
```

**Solution**:
```javascript
// jest.setup.js
import { createClient } from '@supabase/supabase-js'

// Use test-specific Supabase instance
const supabaseUrl = process.env.SUPABASE_TEST_URL || 'http://localhost:54321'
const supabaseKey = process.env.SUPABASE_TEST_ANON_KEY || 'test-key'

global.supabase = createClient(supabaseUrl, supabaseKey)

// Reset database before each test suite
beforeAll(async () => {
  // Use Supabase test database reset
  await fetch(`${supabaseUrl}/rest/v1/rpc/reset_test_data`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    }
  })
})
```

#### Edge Functions Testing
**Problem**: Testing Edge Functions locally
```bash
Error: Function not found or not deployed
```

**Solution**:
```bash
# Start Edge Functions for testing
supabase functions serve

# Test function with curl
curl -X POST http://localhost:54321/functions/v1/your-function \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Or test with Supabase CLI
supabase functions invoke your-function \
  --data '{"test": "data"}'
```
```

**Solution**:
```bash
# Install browsers
npx playwright install

# Install system dependencies (Linux)
npx playwright install-deps

# Run specific browser
npx playwright test --browser=chromium
```

## 🚀 Deployment Issues

### GitHub Pages Deployment

#### Build Failures
**Problem**: CI/CD build failing
```bash
Error: Failed to build Next.js application
```

**Solution**:
1. Check GitHub Actions logs for specific errors
2. Verify environment variables are set in GitHub Settings > Secrets
3. Test build locally:
```bash
npm run build
npm run export
```

#### Path Issues
**Problem**: Assets not loading on GitHub Pages
```bash
Failed to load resource: 404 (Not Found)
```

**Solution**:
```javascript
// next.config.js
const isProd = process.env.NODE_ENV === 'production'

module.exports = {
## 🔧 Development Tools Issues

### Supabase CLI Problems

#### CLI Installation Issues
**Problem**: Supabase CLI not installing or running
```bash
Error: command not found: supabase
Error: permission denied
```

**Solution**:
```bash
# Method 1: NPM global install
npm install -g supabase

# Method 2: Use npx (no global install)
npx supabase --version

# Method 3: Platform-specific install
# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# macOS (Homebrew)
brew install supabase/tap/supabase

# Verify installation
supabase --version
which supabase
```

#### Docker Issues with Supabase
**Problem**: Docker not starting Supabase services
```bash
Error: Docker daemon not running
Error: Port already in use
```

**Solution**:
```bash
# Check Docker status
docker --version
docker ps

# Start Docker (platform specific)
# Windows/macOS: Start Docker Desktop
# Linux: sudo systemctl start docker

# Check for port conflicts
netstat -tulpn | grep :54321  # Supabase API
netstat -tulpn | grep :54322  # Supabase Studio

# Stop conflicting services
supabase stop
# Kill processes using ports if needed
```

### VS Code Integration

#### Supabase Extension Issues
**Problem**: Supabase VS Code extension not working
```bash
Error: Could not connect to Supabase project
```

**Solution**:
1. Install official Supabase extension
2. Run `Ctrl+Shift+P` → "Supabase: Login"
3. Verify project connection: `Ctrl+Shift+P` → "Supabase: Open Dashboard"
4. Check workspace settings for Supabase project ID
```json
// .vscode/settings.json
{
  "supabase.projectId": "your-project-id"
}
```

#### ESLint Configuration
**Problem**: Conflicting linting rules
```bash
Parsing error: Unexpected token
```

**Solution**:
```javascript
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  }
}
```

## 📊 Performance Troubleshooting

### Supabase Performance Issues

#### Slow Database Queries
**Problem**: Database operations taking too long
```bash
Query timeout after 30 seconds
```

**Solution**:
```sql
-- Check query performance in Supabase dashboard
-- 1. Go to Logs > Database
-- 2. Enable slow query logging
-- 3. Add database indexes for frequently queried columns

-- Example: Add index for device queries
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_created_at ON devices(created_at DESC);

-- Use EXPLAIN for query analysis
EXPLAIN ANALYZE SELECT * FROM devices WHERE user_id = 'uuid';
```

#### Edge Function Cold Starts
**Problem**: Edge Functions slow on first request
```bash
Function timeout or slow response
```

**Solution**:
```javascript
// Minimize dependencies in Edge Functions
// Import only what you need
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Keep functions warm with periodic health checks
// Add to your frontend
setInterval(() => {
  fetch('/api/health-check')
}, 5 * 60 * 1000) // Every 5 minutes

// Optimize function code
const handler = async (req: Request): Promise<Response> => {
  // Cache frequently used data
  // Use connection pooling for database operations
  // Return early for simple operations
}
```

### Frontend Performance

#### Slow Page Loads with Supabase
**Problem**: Pages loading slowly due to Supabase calls
```bash
Large CLS, slow LCP metrics
```

**Solution**:
```javascript
// Use Supabase real-time for instant updates
const [devices, setDevices] = useState([])

useEffect(() => {
  // Initial load
  const loadDevices = async () => {
    const { data } = await supabase.from('devices').select('*')
    setDevices(data)
  }
  loadDevices()

  // Real-time updates
  const subscription = supabase
    .channel('devices-changes')
    .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'devices' }, 
        (payload) => {
          // Update state with real-time changes
          setDevices(prev => /* update logic */)
        })
    .subscribe()

  return () => subscription.unsubscribe()
}, [])
```

## 🆘 Getting Help

### Debug Information Collection

When reporting Supabase-related issues, include:

```bash
# Supabase information
supabase --version
supabase status
supabase projects list

# System information
node --version
npm --version
docker --version

# Project information
npm list @supabase/supabase-js
cat package.json | grep -E "(supabase|next)"

# Environment variables (sanitized)
env | grep -E "(SUPABASE_|NEXT_PUBLIC_)" | sed 's/=.*/=***/'

# Supabase local logs
supabase logs
supabase functions logs [function-name]

# Recent commits
git log --oneline -10
```

### Common Debug Commands

```bash
# Check Supabase project health
supabase status
supabase projects api-keys

# Test database connection
supabase db ping

# Check Edge Functions
supabase functions list
supabase functions logs

# Reset local environment
supabase stop
supabase start

# Check GitHub Pages deployment
npm run build
npm run start:static
```

### Support Resources

- **Supabase Documentation**: https://supabase.com/docs
- **Supabase Community**: https://supabase.com/discord
- **GitHub Issues**: Create issue with debug information
- **Supabase Dashboard**: Check logs and metrics
- **Edge Function Logs**: Monitor real-time function execution

```bash
# Clear all caches
npm run clean
rm -rf .next node_modules package-lock.json
npm install

# Reset development database
npm run db:reset

# Verbose logging
DEBUG=* npm run dev

# Test specific component
npm test -- --testNamePattern="Button"

# Check for security vulnerabilities
npm audit
npm audit fix
```

### Support Channels

1. **GitHub Issues**: Create detailed bug reports
2. **Documentation**: Check [`README.md`](../README.md) and [`TECHNICAL_SPECIFICATION.md`](./TECHNICAL_SPECIFICATION.md)
3. **Code Review**: Ask in pull request comments
4. **Community**: Check GitHub Discussions

### Creating Good Bug Reports

Include:
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Environment details** (OS, Node version, browser)
- **Error messages** and stack traces
- **Code samples** that demonstrate the issue
- **Screenshots** if applicable

---

For additional help, refer to the [`contributing.md`](./contributing.md) guide or create an issue with detailed information about your problem.