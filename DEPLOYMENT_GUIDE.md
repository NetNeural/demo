# NetNeural MonoRepo - Deployment Guide

## Overview
This guide covers deploying the NetNeural IoT Dashboard to both GitHub Pages (static frontend) and Supabase (backend database and API).

## Architecture
- **Frontend**: Next.js app deployed to GitHub Pages
- **Backend**: Supabase hosted database with migrations
- **CI/CD**: GitHub Actions for automated deployments

## Prerequisites

### 1. Supabase Setup
- [ ] Supabase account created
- [ ] New Supabase project created
- [ ] Supabase CLI installed locally
- [ ] Project linked to remote Supabase instance

### 2. GitHub Setup
- [ ] Repository pushed to GitHub
- [ ] GitHub Pages enabled
- [ ] Repository secrets configured

### 3. Environment Variables
Required for deployment:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_PASSWORD=your-db-password

# Deployment Configuration
GITHUB_TOKEN=your-github-token
SUPABASE_ACCESS_TOKEN=your-supabase-access-token
```

## Step-by-Step Deployment

### Phase 1: Supabase Project Setup

#### 1.1 Create Supabase Project
```bash
# Login to Supabase
supabase login

# Link local project to remote
supabase link --project-ref YOUR_PROJECT_REF
```

#### 1.2 Push Database Schema
```bash
# Push migrations to remote database
supabase db push

# Generate TypeScript types
supabase gen types typescript --linked > packages/types/src/supabase.ts
```

### Phase 2: GitHub Pages Setup

#### 2.1 Configure Next.js for Static Export
Create/update `apps/web/next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: process.env.NODE_ENV === 'production' ? '/SoftwareMono' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/SoftwareMono/' : '',
}

module.exports = nextConfig
```

#### 2.2 Add Build Scripts
Update `apps/web/package.json`:
```json
{
  "scripts": {
    "build:static": "next build",
    "export": "next export"
  }
}
```

### Phase 3: GitHub Repository Secrets

Add these secrets in GitHub Settings > Secrets and variables > Actions:

1. `SUPABASE_ACCESS_TOKEN` - From Supabase dashboard
2. `SUPABASE_PROJECT_REF` - Your project reference ID
3. `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
4. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
5. `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
6. `SUPABASE_DB_PASSWORD` - Your database password

### Phase 4: Environment Configuration

#### 4.1 Production Environment File
Create `apps/web/.env.production`:
```env
NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

## Deployment Commands

### Manual Deployment

#### Deploy to Supabase
```bash
# From project root
cd development
supabase db push
supabase functions deploy
```

#### Deploy to GitHub Pages
```bash
# Build static site
npm run build:web
cd apps/web
npm run build:static

# Deploy (automated via GitHub Actions)
```

### Automated Deployment
GitHub Actions will automatically deploy on:
- Push to `main` branch
- Pull request merge
- Manual workflow dispatch

## Monitoring & Troubleshooting

### Check Deployment Status
1. **GitHub Pages**: Repository Settings > Pages
2. **Supabase**: Supabase Dashboard > Project Overview
3. **GitHub Actions**: Repository Actions tab

### Common Issues

#### Build Failures
- Check Node.js version compatibility
- Verify all dependencies are installed
- Check TypeScript compilation errors

#### Supabase Connection Issues
- Verify environment variables
- Check database migration status
- Confirm API keys are valid

#### GitHub Pages Issues
- Ensure static export is properly configured
- Check base path configuration
- Verify all assets are properly referenced

## Post-Deployment Verification

### 1. Frontend Verification
- [ ] Site loads at GitHub Pages URL
- [ ] Dashboard displays correctly
- [ ] All components render properly
- [ ] No console errors

### 2. Backend Verification
- [ ] Database connection successful
- [ ] API endpoints responding
- [ ] Sensor data loading
- [ ] Real-time updates working

### 3. Integration Testing
- [ ] Sensor analytics display
- [ ] Location filtering works
- [ ] Dashboard interactions functional
- [ ] Data persistence verified

## Maintenance

### Regular Tasks
1. **Weekly**: Check deployment logs
2. **Monthly**: Update dependencies
3. **Quarterly**: Review security settings
4. **As needed**: Database migrations

### Monitoring Setup
- GitHub Actions notifications
- Supabase project alerts
- Performance monitoring

## Rollback Procedures

### GitHub Pages Rollback
```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

### Supabase Rollback
```bash
# Reset to previous migration
supabase db reset
supabase db push
```

## Security Considerations

1. **Environment Variables**: Never commit secrets to repository
2. **API Keys**: Use appropriate key types (anon vs service role)
3. **Database Access**: Configure Row Level Security (RLS)
4. **CORS**: Properly configure allowed origins

## Performance Optimization

1. **Static Assets**: Optimize images and fonts
2. **Code Splitting**: Implement proper Next.js code splitting
3. **Database**: Index frequently queried columns
4. **Caching**: Configure appropriate cache headers

## Support & Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
