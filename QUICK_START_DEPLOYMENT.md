# 🚀 NetNeural Deployment - Quick Start Guide

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **Supabase account** and project created
- [ ] **GitHub repository** with the code
- [ ] **Node.js 18+** and **npm** installed
- [ ] **Supabase CLI** installed (`npm install -g supabase`)
- [ ] **Git** configured with your GitHub account

## 📋 Step-by-Step Deployment

### Step 1: Get Your Supabase Information

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project** (or create one)
3. **Collect these values**:
   - Go to Settings > API:
     - Project URL → Copy this
     - anon/public key → Copy this
     - service_role key → Copy this
   - Go to Settings > General:
     - Reference ID → Copy this
   - Go to Account > Access Tokens:
     - Create new token → Copy this

### Step 2: Set Up Environment Variables

Create `.env` file in the `development` directory:

```bash
cd development
cp .env.example .env  # If example exists, or create new file
```

Add your Supabase values to `.env`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ACCESS_TOKEN=your-access-token
SUPABASE_PROJECT_REF=your-project-ref
```

### Step 3: Set Up GitHub Repository Secrets

1. **Go to your GitHub repository**
2. **Settings > Secrets and variables > Actions**
3. **Add these Repository Secrets**:
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_PROJECT_REF`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_PASSWORD`

### Step 4: Link Supabase Project

```bash
cd development
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 5: Deploy Database

```bash
# Push your database schema and data
supabase db push

# Generate TypeScript types
supabase gen types typescript --linked > packages/types/src/supabase.ts
```

### Step 6: Test Local Build

```bash
# Install dependencies
npm ci

# Test the build
npm run build:web
```

### Step 7: Deploy via GitHub Actions

```bash
# Commit and push your changes
git add .
git commit -m "feat: add deployment configuration"
git push origin main
```

**GitHub Actions will automatically**:
- Deploy database to Supabase
- Build and deploy frontend to GitHub Pages
- Run health checks

### Step 8: Verify Deployment

1. **Check GitHub Actions**: Go to your repository's Actions tab
2. **Wait for completion**: Usually takes 3-5 minutes
3. **Access your dashboard**: `https://[your-username].github.io/SoftwareMono/`

## 🎯 Quick Commands Reference

```bash
# Manual deployment (from project root)
./scripts/deploy.sh

# PowerShell version (Windows)
.\scripts\deploy.ps1

# Deploy only Supabase
npm run deploy:supabase

# Deploy only web app
npm run deploy:web

# Check deployment status
npm run deploy:check
```

## 🔧 Troubleshooting

### Common Issues:

1. **"supabase: command not found"**
   ```bash
   npm install -g supabase
   ```

2. **Build fails with environment errors**
   - Check all environment variables are set
   - Verify Supabase keys are correct

3. **GitHub Pages not updating**
   - Check Actions tab for errors
   - Ensure repository has Pages enabled
   - Verify branch is set to `gh-pages`

4. **Database connection issues**
   - Verify project is linked: `supabase status`
   - Check database migrations: `supabase db diff`

### Get Help:

1. **Check deployment logs** in GitHub Actions
2. **Review Supabase logs** in dashboard
3. **Test locally** with `npm run dev`

## 🎉 Success!

Once deployed, your dashboard will be available at:
- **Frontend**: `https://[your-username].github.io/SoftwareMono/`
- **Backend**: Your Supabase project URL

## 🔄 Future Deployments

After initial setup, deployments are automatic:
1. Make changes to your code
2. Commit and push to `main` branch
3. GitHub Actions handles the rest!

```bash
git add .
git commit -m "feat: new dashboard feature"
git push origin main
# ✨ Automatic deployment starts!
```

---

## 📞 Need Help?

If you encounter issues:
1. Check the detailed [Deployment Guide](./DEPLOYMENT_GUIDE.md)
2. Review the [Environment Setup](./ENVIRONMENT_SETUP.md)
3. Look at GitHub Actions logs for specific errors