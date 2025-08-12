# Netlify One-Click Deployment

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/NetNeural/MonoRepo)

## Quick Netlify Deployment Steps:

1. **Click the "Deploy to Netlify" button above**
2. **Connect your GitHub account** (if not already connected)
3. **Set these build settings:**
   - Build command: `cd development && npm install && cd apps/web && npm run build`
   - Publish directory: `development/apps/web/out`
   - Base directory: `/` (leave empty)

4. **Add Environment Variables** in Netlify dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://bldojxpockljyivldxwf.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDAwNzM3NCwiZXhwIjoyMDQ5NTgzMzc0fQ.X5HLSXPzGS7hKA3FWZhkF2V8zVxJJY6nJEaW8-sJLjI`

5. **Deploy!** - Your dashboard will be live in minutes

## Alternative: Manual Upload to Netlify

1. Run the manual deployment script: `./deploy-manual.sh` (or `.ps1` on Windows)
2. Go to https://app.netlify.com/drop
3. Drag and drop the `apps/web/out` folder
4. Your site will be live instantly!

## Vercel Alternative

1. Go to https://vercel.com
2. Import your GitHub repository
3. Set root directory to: `development/apps/web`
4. Add the same environment variables
5. Deploy!

**All these methods work without GitHub secrets and give you a live dashboard in minutes!**
