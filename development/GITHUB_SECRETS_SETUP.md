# GitHub Repository Secrets Setup

You need to add these secrets to your GitHub repository for the automated deployment to work.

## How to Add Secrets:

1. Go to your GitHub repository: https://github.com/NetNeural/MonoRepo
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret** for each secret below

## Required Secrets:

### Supabase Configuration
- **Name:** `SUPABASE_URL`
- **Value:** `https://bldojxpockljyivldxwf.supabase.co`

- **Name:** `SUPABASE_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDAwNzM3NCwiZXhwIjoyMDQ5NTgzMzc0fQ.X5HLSXPzGS7hKA3FWZhkF2V8zVxJJY6nJEaW8-sJLjI`

- **Name:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM0MDA3Mzc0LCJleHAiOjIwNDk1ODMzNzR9.OtwjXBc7bL4RhMBg85MX3rNKOUWL9KM8L5ZgKKCxQ-E`

### Supabase CLI Configuration (for migrations)
- **Name:** `SUPABASE_ACCESS_TOKEN`
- **Value:** `sbp_dd6febe82d4b5b1a8b06a3c90ad7c4c5cfeecb45`

- **Name:** `SUPABASE_DB_PASSWORD`
- **Value:** `w5sUW@w*TnIjNnK@8B9Y`

- **Name:** `SUPABASE_PROJECT_ID`
- **Value:** `bldojxpockljyivldxwf`

## Verification:

After adding all secrets, your Actions secrets page should show:
- ✅ SUPABASE_URL
- ✅ SUPABASE_ANON_KEY  
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ SUPABASE_ACCESS_TOKEN
- ✅ SUPABASE_DB_PASSWORD
- ✅ SUPABASE_PROJECT_ID

## Next Steps:

Once you've added all the secrets:
1. The GitHub Actions workflow will automatically deploy on every push to `main`
2. Your dashboard will be available at: `https://netneural.github.io/MonoRepo/`
3. The backend will use your Supabase project for data

## Manual Seed Data (Optional):

If you want to populate your dashboard with sample data, run the `seed_data.sql` script in your Supabase SQL Editor.
