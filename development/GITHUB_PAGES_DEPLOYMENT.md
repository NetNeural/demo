# GitHub Pages Deployment Guide

This Next.js application is configured for **static export** to GitHub Pages with Supabase Edge Functions for backend API calls.

## Architecture

### Frontend (GitHub Pages)
- **Static HTML/CSS/JS** - All pages pre-rendered at build time
- **Client-side routing** - Next.js App Router handles navigation
- **Client-side auth** - Supabase Auth handles authentication in the browser

### Backend (Supabase)
- **Edge Functions** - All API logic (`/functions/v1/*`)
- **PostgreSQL Database** - With Row Level Security (RLS)
- **Authentication** - JWT tokens, session management
- **Real-time** - WebSocket subscriptions

## Security Model

Since GitHub Pages serves **static files only**, security is handled by:

### ✅ What Protects Your App:
1. **Supabase Row Level Security (RLS)** - Database-level permissions on all tables
2. **JWT Authentication** - All API calls require valid Supabase tokens
3. **Edge Function Auth** - Server-side validation of user sessions
4. **HTTPS by Default** - GitHub Pages enforces HTTPS
5. **Client-side Guards** - React components check auth state before rendering

### ❌ What Doesn't Work (Limitations of Static Export):
1. **Next.js Middleware** - Runs client-side only, no server-side redirects
2. **Security Headers** - Can't be set on static files (GitHub Pages limitation)
3. **API Routes** - No Next.js API routes (we use Supabase Edge Functions instead)
4. **Server-side Auth Checks** - All auth is client-side (protected by RLS)

## Build & Deploy

### Local Development
```bash
# Run with full Next.js features (no static export)
npm run dev

# This gives you:
# - Fast Refresh
# - Server components (if any)
# - Better error messages
```

### Production Build (GitHub Pages)
```bash
# Build for static export
npm run build

# Output goes to /out directory
# Deploy /out to GitHub Pages
```

### Environment Variables

Create `.env.local` for development:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-token
```

For GitHub Pages, set these in **GitHub Secrets** and reference in your Actions workflow.

## GitHub Actions Workflow

Example `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_SENTRY_DSN: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN }}
        run: npm run build
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out
```

## Client-Side Routing on GitHub Pages

GitHub Pages doesn't natively support SPAs. We handle this with:

1. **404.html** - Redirects all unknown paths to index.html
2. **Session Storage** - Preserves the intended path
3. **App Router** - Navigates to the correct route after load

This means:
- ✅ Direct links work (after a brief redirect)
- ✅ Browser back/forward works
- ✅ Deep links work
- ⚠️ Slight delay on first load of deep links

## API Calls Flow

```
User Browser (GitHub Pages)
    ↓ (HTTPS)
    ↓ Supabase Client
    ↓ (JWT Token)
Supabase Edge Functions
    ↓ (Auth Check)
    ↓ (RLS Policies)
PostgreSQL Database
```

Every API call:
1. Includes JWT token from Supabase Auth
2. Validated by Edge Function
3. RLS policies enforce permissions
4. Data returned to client

## Testing Locally

```bash
# 1. Start Supabase locally
npx supabase start

# 2. Run dev server
npm run dev

# 3. Access at http://localhost:3000
```

## Testing Production Build Locally

```bash
# 1. Build for production
npm run build

# 2. Serve the static files
npx serve out

# 3. Access at http://localhost:3000
```

## Troubleshooting

### Issue: "Session not found" errors
**Cause**: Supabase URL mismatch between build and runtime  
**Fix**: Ensure `NEXT_PUBLIC_SUPABASE_URL` is set correctly

### Issue: 404 on page refresh
**Cause**: GitHub Pages doesn't know about client-side routes  
**Fix**: The 404.html handles this automatically

### Issue: API calls fail with CORS
**Cause**: Supabase Edge Functions need CORS headers  
**Fix**: All edge functions include CORS headers already

### Issue: Build warnings about middleware/headers
**Cause**: Static export doesn't support these features  
**Fix**: This is expected and documented - security is handled by Supabase RLS

## Performance Optimization

1. **CDN**: GitHub Pages uses Fastly CDN globally
2. **Caching**: Static assets are cached aggressively
3. **Bundle Size**: Analyze with `ANALYZE=true npm run build`
4. **Code Splitting**: Next.js automatically splits by route

## Security Best Practices

1. **Never commit secrets** - Use GitHub Secrets
2. **Use RLS on all tables** - Database-level security
3. **Validate on server** - Edge Functions validate all inputs
4. **Rotate keys regularly** - Update Supabase anon key periodically
5. **Monitor with Sentry** - Track errors and security issues

## Why This Setup Works

✅ **Scalable**: GitHub Pages CDN + Supabase serverless  
✅ **Secure**: RLS + JWT + HTTPS  
✅ **Fast**: Static files + global CDN  
✅ **Free**: GitHub Pages + Supabase free tier  
✅ **Simple**: No servers to manage  

## Limitations to Be Aware Of

❌ **No server-side redirects** - Must be client-side  
❌ **No custom headers** - Can't set security headers on static files  
❌ **No middleware protection** - Routes are public until JS loads  
❌ **SEO limitations** - Client-side rendering only  

For an enterprise production app requiring server-side features, consider:
- Vercel (same Next.js, full features, free tier)
- Netlify (similar to Vercel)
- Cloudflare Pages (fast, free tier)

But for your use case (authenticated IoT dashboard with Supabase), **GitHub Pages works great**!
