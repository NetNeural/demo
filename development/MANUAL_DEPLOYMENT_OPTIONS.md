# Manual Deployment Guide (No GitHub Secrets Required)

## Method 1: Local Build + GitHub Pages Manual Upload

### Step 1: Set up Local Environment Variables

Create a `.env.production` file in the `apps/web` directory:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDAwNzM3NCwiZXhwIjoyMDQ5NTgzMzc0fQ.X5HLSXPzGS7hKA3FWZhkF2V8zVxJJY6nJEaW8-sJLjI

# GitHub Pages Configuration
NEXT_PUBLIC_BASE_PATH=/MonoRepo
```

### Step 2: Manual Build and Deploy Commands

```bash
# Navigate to web app
cd apps/web

# Install dependencies
npm install

# Build for production
npm run build

# The built files will be in apps/web/out/
# Upload the contents of the 'out' folder to GitHub Pages
```

### Step 3: Enable GitHub Pages

1. Go to your GitHub repository: https://github.com/NetNeural/MonoRepo
2. Go to Settings > Pages
3. Set Source to "Deploy from a branch"
4. Select branch: `gh-pages` (we'll create this)
5. Set folder to `/ (root)`

### Step 4: Create gh-pages branch manually

```bash
# Create a new branch for GitHub Pages
git checkout --orphan gh-pages

# Remove all files
git rm -rf .

# Copy built files from apps/web/out/
# (You'll do this manually)

# Add and commit
git add .
git commit -m "Deploy IoT Dashboard"
git push origin gh-pages
```

## Method 2: Netlify/Vercel Deployment (Even Simpler)

### Option A: Netlify
1. Go to https://netlify.com
2. Connect your GitHub repository
3. Set build command: `cd development && npm run build:web`
4. Set publish directory: `development/apps/web/out`
5. Add environment variables in Netlify dashboard

### Option B: Vercel
1. Go to https://vercel.com
2. Import your GitHub repository
3. Set framework preset to "Next.js"
4. Set root directory to `development/apps/web`
5. Add environment variables in Vercel dashboard

## Method 3: Direct Static File Hosting

Build locally and upload to any static hosting service:
- AWS S3 + CloudFront
- Google Cloud Storage
- Azure Static Web Apps
- Surge.sh
- Firebase Hosting

Which method would you prefer to try?
