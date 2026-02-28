# Quick Fix Summary - Storage Error 42P17

## You Have 3 Options (Pick the Easiest)

### ⚡ 1. GitHub Actions - One Click (FASTEST)

1. Go here: https://github.com/NetNeural/MonoRepo-Staging/actions/workflows/fix-storage-42p17.yml
2. Click "Run workflow" → select "staging" → Click green button
3. Done! (takes 30 seconds)

### 📝 2. Supabase SQL Editor - Copy/Paste

1. Open: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql
2. Copy all SQL from: `/workspaces/MonoRepo/development/scripts/fix-storage-42p17.sql`
3. Paste and click "Run"

### 🔧 3. Push Migrations (If You Have DB Credentials)

```bash
cd /workspaces/MonoRepo/development
npx supabase db push --db-url "postgresql://postgres:[SERVICE_KEY]@db.atgbmxicqikmapfqouco.supabase.co:5432/postgres"
```

---

## What This Fixes

- ✅ Creates storage bucket for organization logos
- ✅ Adds upload permissions for org owners
- ✅ Fixes "database error, code: 42P17"

## Bonus: Fix Favicon Warning (Optional)

The 404 for favicon.ico is harmless but annoying. Add a favicon later:

```bash
# Download any favicon.ico to:
/workspaces/MonoRepo/development/public/favicon.ico
```

---

**Need Help?** See full docs: [FIX_STORAGE_ERROR_42P17.md](docs/FIX_STORAGE_ERROR_42P17.md)
