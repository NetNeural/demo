# Production Deployment Guide

## Overview

This guide covers deploying the NetNeural IoT Platform to production with Supabase and Vercel.

## Prerequisites

- [ ] Production Supabase project created
- [ ] Vercel account and project setup
- [ ] GitHub repository access
- [ ] Domain configured (if custom domain needed)

---

## 1. Supabase Production Setup

### 1.1 Create New Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a region close to your users
3. Set a strong database password
4. Wait for project initialization (~2 minutes)

### 1.2 Get Production Credentials

From your Supabase project dashboard:

```bash
# Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-key

# Project Settings > Database
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres
```

### 1.3 Run Database Migrations

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to production project
cd development
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push

# Verify migrations
supabase db diff
```

### 1.4 Run Database Seed (First Time Only)

```bash
# Connect to production database
psql "$DATABASE_URL"

# Run seed script
\i supabase/seed.sql

# Verify seed data
SELECT email, role FROM users;
SELECT name FROM organizations;
```

### 1.5 Deploy Edge Functions

```bash
# Deploy all edge functions
supabase functions deploy alerts
supabase functions deploy create-super-admin
supabase functions deploy create-user
supabase functions deploy dashboard-stats
supabase functions deploy devices
supabase functions deploy device-sync
supabase functions deploy integrations
supabase functions deploy members
supabase functions deploy organizations

# Verify deployment
supabase functions list
```

### 1.6 Configure Edge Function Secrets

```bash
# Set environment variables for edge functions
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-key
supabase secrets set SUPABASE_ANON_KEY=your-anon-key

# Verify secrets
supabase secrets list
```

---

## 2. Vercel Deployment

### 2.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 2.2 Configure Environment Variables

In Vercel dashboard (or via CLI):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Application Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

### 2.3 Deploy to Vercel

**Option A: Via Dashboard**
1. Import GitHub repository
2. Select `development` as root directory
3. Framework: Next.js
4. Add environment variables
5. Deploy

**Option B: Via CLI**
```bash
cd development

# First deployment
vercel

# Production deployment
vercel --prod
```

### 2.4 Configure Custom Domain (Optional)

1. Go to Vercel project settings > Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Wait for SSL certificate provisioning

---

## 3. GitHub Secrets Setup

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

```bash
SUPABASE_ACCESS_TOKEN          # From Supabase account settings
SUPABASE_PROJECT_ID            # From project settings
SUPABASE_DB_PASSWORD           # Database password
VERCEL_TOKEN                   # From Vercel account settings
VERCEL_ORG_ID                  # From Vercel team settings
VERCEL_PROJECT_ID              # From Vercel project settings
```

---

## 4. Post-Deployment Verification

### 4.1 Health Checks

```bash
# Test API endpoints
curl https://your-domain.com/api/health

# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/

# Test edge functions
curl -X POST https://your-project.supabase.co/functions/v1/dashboard-stats \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

### 4.2 Create Super Admin

```bash
# Via edge function
curl -X POST https://your-project.supabase.co/functions/v1/create-super-admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{
    "email": "admin@yourdomain.com",
    "password": "SuperSecurePassword123!",
    "fullName": "Admin User"
  }'
```

### 4.3 Verify Application

1. Visit your production URL
2. Login with super admin credentials
3. Create a test organization
4. Add test devices
5. Verify all features work:
   - Dashboard displays data
   - Organizations CRUD
   - Members management
   - Device management
   - Alerts system
   - Settings and profile

---

## 5. Monitoring and Maintenance

### 5.1 Enable Monitoring

**Vercel:**
- Analytics enabled
- Error tracking configured
- Performance monitoring active

**Supabase:**
- Database pooling configured
- Query performance monitoring
- Edge function logs reviewed

### 5.2 Backup Strategy

```bash
# Automated daily backups (Supabase Pro)
# Or manual backups:
supabase db dump -f backup_$(date +%Y%m%d).sql

# Store backups securely
aws s3 cp backup_*.sql s3://your-backup-bucket/
```

### 5.3 Regular Maintenance

- [ ] Weekly: Review error logs
- [ ] Monthly: Check performance metrics
- [ ] Monthly: Review and optimize database queries
- [ ] Quarterly: Security audit
- [ ] Quarterly: Dependency updates

---

## 6. Rollback Procedure

If deployment fails:

```bash
# Revert database migrations
supabase db reset

# Rollback to previous Vercel deployment
vercel rollback

# Restore from backup if needed
psql "$DATABASE_URL" < backup_YYYYMMDD.sql
```

---

## 7. Environment Comparison

| Feature | Development | Production |
|---------|-------------|------------|
| Supabase | Local (Docker) | Cloud (supabase.com) |
| Database | PostgreSQL (local) | PostgreSQL (cloud) |
| Edge Functions | Local runtime | Supabase Edge Runtime |
| Frontend | localhost:3000 | Vercel (CDN) |
| Auth | Local | Production Supabase Auth |
| SSL | N/A | Automatic (Vercel) |

---

## 8. Troubleshooting

### Database Connection Issues
```bash
# Test connection
psql "$DATABASE_URL" -c "SELECT version();"

# Check connection pooling
supabase inspect db --pooler
```

### Edge Function Errors
```bash
# View logs
supabase functions logs <function-name> --tail 50

# Test locally first
supabase functions serve --debug
```

### Build Failures
```bash
# Check build logs in Vercel dashboard
# Or test build locally:
cd development
npm run build
```

---

## 9. Security Checklist

- [ ] All environment variables use secrets (not hardcoded)
- [ ] RLS policies enabled on all tables
- [ ] Service role key never exposed to client
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (React escaping)
- [ ] HTTPS enforced
- [ ] Session management secure

---

## 10. Performance Optimization

### Database
- [ ] Indexes created on frequently queried columns
- [ ] Connection pooling configured
- [ ] Query performance monitored

### Frontend
- [ ] Images optimized (Next.js Image component)
- [ ] Code splitting enabled
- [ ] Static generation where possible
- [ ] CDN caching configured

### Edge Functions
- [ ] Keep functions lightweight
- [ ] Use connection pooling
- [ ] Implement caching where appropriate

---

## Support

For issues during deployment:
- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Internal Documentation: `/development/docs/`

---

## Changelog

- 2025-10-14: Initial production deployment guide
- Added member management system
- Updated edge functions deployment
