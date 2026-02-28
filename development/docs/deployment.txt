# Deployment Guide - Supabase Infrastructure

This guide provides detailed instructions for deploying the NetNeural IoT Platform using **Supabase as the primary infrastructure** with GitHub Pages serving the static frontend.

## 🏗️ Deployment Overview

The NetNeural IoT Platform uses a **Supabase-first architecture**:

1. **Supabase Cloud** (Primary Infrastructure) - Database, Auth, Edge Functions, Storage, Real-time
2. **GitHub Pages** (Frontend Only) - Static site hosting for the React application

## 📋 Prerequisites

### Required Services
- **Supabase Project** - Primary backend infrastructure
- **Golioth Account** - IoT device management
- **GitHub Repository** - Source code hosting and frontend deployment
- **Domain** (Optional) - Custom domain configuration

### Environment Preparation
```bash
# Verify Node.js version
node --version  # Should be 20+

# Install Supabase CLI (primary development tool)
npm install -g supabase

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
```

## 🚀 Supabase + GitHub Pages Deployment (Primary)

### Initial Setup

1. **Create Supabase Project**
```bash
# Create new Supabase project
supabase projects create netneural-iot-prod

# Link local development to project
supabase link --project-ref your-project-ref
```

2. **Configure GitHub Repository**
```bash
# Repository: NetNeural/SoftwareMono
# Settings > Pages > Source: GitHub Actions
# Settings > Environments > Create 'production' environment
```

3. **Environment Variables**
Set the following secrets in GitHub Settings > Secrets and variables > Actions:

```bash
# Supabase Configuration (Primary Backend)
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_ACCESS_TOKEN=your-access-token
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Golioth Integration (via Supabase Edge Functions)
GOLIOTH_API_KEY=your-golioth-api-key
GOLIOTH_PROJECT_ID=your-project-id
```

4. **Supabase Project Setup**
```bash
# Set up database schema
supabase db push

# Deploy Edge Functions
supabase functions deploy device-sync
supabase functions deploy webhook-handler
supabase functions deploy notifications

# Configure storage buckets
supabase storage create device-images --public
supabase storage create documents --private
```

5. **Frontend Build Configuration**
```javascript
// next.config.js - Optimized for Supabase + GitHub Pages
const isProd = process.env.NODE_ENV === 'production'
const isGitHubPages = process.env.GITHUB_PAGES === 'true'

module.exports = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: isProd && isGitHubPages ? '/SoftwareMono' : '',
  assetPrefix: isProd && isGitHubPages ? '/SoftwareMono' : '',
  env: {
    GITHUB_PAGES: process.env.GITHUB_PAGES,
  },
  // Optimize for Supabase integration
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
}
```

### Deployment Workflow

The deployment is automated via GitHub Actions with Supabase-first approach:

```yaml
# .github/workflows/deploy.yml
name: Deploy Supabase + GitHub Pages

on:
  push:
    branches: [main]
    paths: ['development/**']
  workflow_dispatch:

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    outputs:
      deployment-status: ${{ steps.deploy.outcome }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: Link to Supabase project
        run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Deploy database migrations
        run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Deploy Edge Functions
        id: deploy
        run: supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          GOLIOTH_API_KEY: ${{ secrets.GOLIOTH_API_KEY }}
          GOLIOTH_PROJECT_ID: ${{ secrets.GOLIOTH_PROJECT_ID }}

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-backend
    if: needs.deploy-backend.outputs.deployment-status == 'success'
    defaults:
      run:
        working-directory: ./development
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: 'development/package-lock.json'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate Supabase types
        run: |
          npx supabase gen types typescript --project-id ${{ secrets.SUPABASE_PROJECT_REF }} > src/lib/database.types.ts
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Build static frontend
        run: npm run build
        env:
          GITHUB_PAGES: true
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NODE_ENV: production
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./development/out
          cname: platform.netneural.ai
```

### Manual Deployment

```bash
# Deploy Supabase backend
cd development
supabase link --project-ref your-project-ref
supabase db push
supabase functions deploy

# Build and deploy frontend
export GITHUB_PAGES=true
npm run build
# Files in 'out' directory are deployed via GitHub Actions
```

### Supabase Edge Functions

The platform uses Supabase Edge Functions for serverless backend logic:

```typescript
// supabase/functions/device-sync/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  // Golioth device synchronization logic
  const goliothResponse = await fetch('https://api.golioth.io/v1/devices', {
    headers: {
      'Authorization': `Bearer ${Deno.env.get('GOLIOTH_API_KEY')}`,
    },
  })
  
  const devices = await goliothResponse.json()
  
  // Sync with Supabase database
  const { data, error } = await supabase
    .from('devices')
    .upsert(devices)
  
  return new Response(JSON.stringify({ success: !error, data }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### Custom Domain Setup

1. **Add CNAME file**
```bash
# development/public/CNAME
iot.netneural.ai
```

2. **Configure DNS**
```bash
# A Records for GitHub Pages
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153

# CNAME Record
www.iot.netneural.ai -> netneural.github.io
```

3. **Update Environment Variables**
```bash
NEXT_PUBLIC_BASE_URL=https://iot.netneural.ai
```

## 🔧 Environment-Specific Configuration

### Development Environment (Supabase Local)

```bash
# .env.local
NODE_ENV=development
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key

# Golioth (via Edge Functions)
GOLIOTH_API_KEY=your-development-api-key
GOLIOTH_PROJECT_ID=your-development-project-id

# Development URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Staging Environment (Supabase Cloud)

```bash
# .env.staging
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key

# Golioth (via Edge Functions)
GOLIOTH_API_KEY=your-staging-api-key
GOLIOTH_PROJECT_ID=your-staging-project-id

# Staging URLs
NEXT_PUBLIC_BASE_URL=https://staging.iot.netneural.ai
```

### Production Environment (Supabase Cloud)

```bash
# .env.production
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# Golioth (via Edge Functions)
GOLIOTH_API_KEY=your-production-api-key
GOLIOTH_PROJECT_ID=your-production-project-id

# Production URLs
NEXT_PUBLIC_BASE_URL=https://iot.netneural.ai
```

## 📊 Monitoring and Health Checks

### Supabase Dashboard Monitoring

```typescript
// Health check through Supabase Edge Function
// supabase/functions/health-check/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const healthcheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'checking',
      storage: 'checking',
      functions: 'healthy'
    }
  }

  try {
    // Test database connection
    const { data, error } = await supabase
      .from('organizations')
      .select('count')
      .limit(1)
    
    healthcheck.services.database = error ? 'unhealthy' : 'healthy'

    // Test storage access
    const { data: buckets } = await supabase.storage.listBuckets()
    healthcheck.services.storage = buckets ? 'healthy' : 'unhealthy'

    const allHealthy = Object.values(healthcheck.services).every(s => s === 'healthy')
    healthcheck.status = allHealthy ? 'healthy' : 'degraded'

  } catch (error) {
    healthcheck.status = 'unhealthy'
  }

  return new Response(JSON.stringify(healthcheck), {
    status: healthcheck.status === 'healthy' ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### Supabase Monitoring Features

```typescript
// Monitoring configuration
interface SupabaseMonitoring {
  dashboard: {
    logs: 'Real-time Edge Function logs';
    metrics: 'Database performance, API usage';
    alerts: 'Email notifications for errors';
    analytics: 'User analytics and usage patterns';
  };
  
  database: {
    performance: 'Query performance insights';
    connections: 'Connection pool monitoring';
    storage: 'Database size and growth tracking';
  };
  
  functions: {
    invocations: 'Function call metrics';
    errors: 'Error tracking and stack traces';
    performance: 'Execution time monitoring';
  };
  
  auth: {
    users: 'User authentication metrics';
    sessions: 'Active session tracking';
    security: 'Failed login attempt monitoring';
  };
}
```

## 🔒 Security Considerations

### Supabase Security Features

```typescript
// Security configuration through Supabase
interface SupabaseSecurity {
  authentication: {
    jwt: 'Automatic JWT token management';
    providers: 'OAuth, Email, Magic Link, Phone';
    mfa: '2FA support built-in';
    sessions: 'Secure session management';
  };
  
  database: {
    rls: 'Row Level Security policies';
    encryption: 'AES-256 encryption at rest';
    ssl: 'TLS 1.3 in transit';
    backups: 'Encrypted daily backups';
  };
  
  api: {
    cors: 'Configurable CORS policies';
    rate_limiting: 'Built-in rate limiting';
    api_keys: 'Service role key protection';
    webhooks: 'Webhook signature verification';
  };
  
  storage: {
    bucket_policies: 'Fine-grained access control';
    file_scanning: 'Malware detection';
    cdn: 'Global CDN with DDoS protection';
    transformations: 'Secure image processing';
  };
}
```

### Row Level Security Policies

```sql
-- Example RLS policies for multi-tenant security
-- These are deployed via Supabase migrations

-- Organizations table
CREATE POLICY "Users can only access their organization" ON organizations
  FOR ALL USING (
    id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Devices table  
CREATE POLICY "Users can only access organization devices" ON devices
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Role-based policies
CREATE POLICY "Only admins can manage users" ON users
  FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'owner')
  );
```

## 🚨 Rollback Procedures

### Supabase Rollback

```bash
# Database rollback
supabase db reset --linked
supabase db push --migration-version previous

# Edge Function rollback
supabase functions deploy --project-ref $PROJECT_REF --version previous

# Check Supabase dashboard for previous deployments
```

### GitHub Pages Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or force deploy specific commit
git checkout <commit-hash>
git push --force origin main
```

### Environment Rollback Strategy

```typescript
// Rollback strategy configuration
interface RollbackStrategy {
  database: {
    method: 'migration_rollback';
    backup: 'point_in_time_recovery';
    timeframe: '7_days_available';
  };
  
  functions: {
    method: 'version_rollback';
    deployment: 'atomic_deployment';
    fallback: 'previous_version_maintained';
  };
  
  frontend: {
    method: 'git_revert';
    deployment: 'github_pages_redeploy';
    downtime: 'minimal_5_minutes';
  };
  
  data: {
    consistency: 'maintained_across_rollback';
    user_sessions: 'preserved_during_rollback';
    real_time: 'automatically_reconnects';
  };
}
```

## 📈 Performance Optimization

### Supabase Performance Features

```typescript
// Performance optimization through Supabase
interface SupabasePerformance {
  database: {
    connection_pooling: 'Built-in PgBouncer';
    read_replicas: 'Available on Pro plan';
    query_optimization: 'Query performance insights';
    indexing: 'Automatic index suggestions';
  };
  
  cdn: {
    global_edge: 'Worldwide CDN for static assets';
    image_optimization: 'On-the-fly image transforms';
    caching: 'Intelligent edge caching';
  };
  
  functions: {
    cold_start: 'Optimized with V8 isolates';
    global_deployment: 'Edge regions worldwide';
    streaming: 'Response streaming support';
  };
  
  real_time: {
    websockets: 'Persistent WebSocket connections';
    multiplexing: 'Single connection for multiple channels';
    compression: 'Message compression enabled';
  };
}
```

### Frontend Optimization

```javascript
// next.config.js - Optimized for Supabase
module.exports = {
  experimental: {
    optimizeCss: true,
    modularizeImports: {
      'lucide-react': {
        transform: 'lucide-react/dist/esm/icons/{{member}}',
      },
    },
  },
  
  // Optimize for Supabase client
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },
  
  // Static export optimization
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
    domains: ['your-project.supabase.co'],
  },
}
```

---

For troubleshooting deployment issues, refer to the [`troubleshooting.md`](./troubleshooting.md) guide.