# 🚀 Quick Start for GitHub Codespaces

This development environment is **pre-configured** to work seamlessly in GitHub Codespaces with automatic public URL configuration.

## ✨ Automatic Setup

When your Codespace starts, it automatically:

1. ✅ Configures `.env.local` with your **public Codespaces URLs**
2. ✅ Configures `supabase/config.toml` with the **correct API endpoints**
3. ✅ Makes ports **3000**, **54321**, **54323** publicly accessible
4. ✅ Ready to develop immediately!

## 🎯 One-Command Start

```bash
cd development
npm run dev:codespaces
```

This command will:

- Auto-configure environment for Codespaces
- Start Supabase (if not running)
- Start Next.js development server
- Show your public app URL

## 📱 Your Public URLs

After starting, your app will be available at:

- **Next.js App**: `https://[codespace-name]-3000.app.github.dev`
- **Supabase Studio**: `https://[codespace-name]-54323.app.github.dev`
- **Supabase API**: `https://[codespace-name]-54321.app.github.dev`

## 🔧 Manual Commands

If you prefer manual control:

```bash
cd development

# 1. Configure environment (automatic on Codespace start)
bash ../.devcontainer/configure-env.sh

# 2. Start Supabase
npx supabase start

# 3. Start Next.js
npm run dev
```

## 🛠️ Other Useful Commands

```bash
# View Supabase status and URLs
npx supabase status

# Stop Supabase
npx supabase stop

# Regenerate TypeScript types from database
npm run supabase:types

# Run tests
npm test

# Build for production
npm run build
```

## 📊 Viewing Logs

- **Next.js logs**: Shown in terminal where you ran `npm run dev`
- **Supabase logs**: Run `docker logs [container-name]`
- **Edge Function logs**: Check Supabase Studio → Edge Functions

## 🔄 Restarting Services

If you need to restart:

```bash
# Restart Supabase
npx supabase stop && npx supabase start

# Restart Next.js (Ctrl+C in terminal, then)
npm run dev
```

## 🌐 Port Configuration

All ports are automatically forwarded and made public:

| Port  | Service          | Visibility |
| ----- | ---------------- | ---------- |
| 3000  | Next.js          | Public     |
| 54321 | Supabase API     | Public     |
| 54322 | PostgreSQL       | Private    |
| 54323 | Supabase Studio  | Public     |
| 54324 | Email (Inbucket) | Public     |

## 🔐 Environment Variables

The `.env.local` file is automatically updated with:

- `NEXT_PUBLIC_SUPABASE_URL` - Points to your public Supabase API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Demo anon key (local dev only)
- `SUPABASE_SERVICE_ROLE_KEY` - Demo service role key (local dev only)

## ⚡ Performance Tips

1. **Sentry is disabled** in Codespaces for faster startup
2. **Turbopack** is enabled for fast HMR
3. **Docker volumes** persist data between restarts

## 🐛 Troubleshooting

### "Failed to fetch organizations" error

The auto-configuration script should fix this. If you still see errors:

```bash
# Re-run configuration
bash ../.devcontainer/configure-env.sh

# Restart Next.js
# Press Ctrl+C, then
npm run dev
```

### Ports showing as "private"

```bash
# Make ports public
bash ../.devcontainer/make-ports-public.sh
```

### Supabase not responding

```bash
# Check status
npx supabase status

# Restart if needed
npx supabase stop
npx supabase start
```

## 📚 More Information

- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)
- [Next.js Documentation](https://nextjs.org/docs)
- [GitHub Codespaces Docs](https://docs.github.com/en/codespaces)

---

**🎉 Happy Coding!** Your environment is ready to go. Just run `npm run dev:codespaces` and start building!
