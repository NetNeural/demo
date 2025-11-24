# DevContainer Setup

This directory contains the development container configuration for GitHub Codespaces and local VS Code devcontainers.

## Quick Start

When your Codespace/devcontainer starts:

1. **Wait for setup to complete** (~1-2 minutes for npm install)
2. **Navigate to development directory:**
   ```bash
   cd development
   ```
3. **Use the quick-start script:**
   ```bash
   ./quick-start.sh
   ```
   Or manually:
   ```bash
   npx supabase start  # Takes 30-60 seconds
   npm run dev         # Start Next.js
   ```

## Why Supabase Doesn't Auto-Start

**Problem:** The `postCreateCommand` was hanging for 30-60 seconds while Supabase Docker containers started up, making Codespace creation feel slow.

**Solution:** We skip automatic Supabase startup and let developers start it when ready. This makes Codespace creation fast and predictable.

## Architecture

### Container Setup Lifecycle

1. **Image Build** → Base TypeScript/Node container with Docker-in-Docker
2. **postCreateCommand** → Runs `setup.sh` (npm install, env setup, skip Supabase)
3. **postStartCommand** → Shows quick start instructions
4. **postAttachCommand** → Shows ready message when you reconnect

### Files

- **devcontainer.json** - Main configuration (ports, extensions, commands)
- **setup.sh** - Initial setup script (runs once on creation)

### Key Features

- **Docker-in-Docker** - Runs Supabase stack inside the devcontainer
- **Port Forwarding** - Auto-forwards 3000, 54321-54324, 54329
- **VS Code Extensions** - Auto-installs ESLint, Prettier, Tailwind, etc.
- **Volume Mounts** - Persists `.next` and `.supabase` across rebuilds

## Troubleshooting

### Supabase won't start
```bash
# Check Docker is running
docker info

# Stop any existing Supabase
npx supabase stop

# Start fresh
npx supabase start
```

### npm install failed
```bash
cd development
rm -rf node_modules package-lock.json
npm install
```

### Port forwarding issues (Codespaces)
1. Open PORTS tab in VS Code
2. Right-click port 3000 → Port Visibility → Public
3. Click 🌐 globe icon to open in browser

### Reset everything
```bash
# Stop all services
npx supabase stop
docker stop $(docker ps -aq)

# Clean build
cd development
rm -rf node_modules .next
npm install

# Restart
./quick-start.sh
```

## Performance Tips

### Codespaces
- Use 4-core machine for better Docker performance
- Keep Codespace running (don't stop/start frequently)
- Use volume mounts for caching (already configured)

### Local DevContainer
- Allocate 4+ GB RAM to Docker Desktop
- Use WSL2 backend on Windows for better performance
- Close resource-heavy applications

## Manual Setup (If script fails)

```bash
# 1. Install dependencies
cd development
npm install

# 2. Create environment file
cp .env.local.template .env.local

# 3. Start Supabase
npx supabase start

# 4. Extract Supabase keys
npx supabase status
# Copy the "anon key" and "service_role key" into .env.local

# 5. Generate TypeScript types
npm run supabase:types

# 6. Start Next.js
npm run dev
```

## Development Workflow

### Daily Usage
```bash
cd development
npx supabase start  # If not already running
npm run dev         # Start Next.js with hot reload
```

### With Debugger
```bash
cd development
npx supabase start
# Press F5 in VS Code → "Next.js: debug full stack"
```

### Testing
```bash
npm test              # Jest unit tests
npm run test:e2e      # Playwright E2E tests
npm run test:coverage # Coverage report
```

### Database
```bash
npx supabase status        # Check services
npx supabase db reset      # Reset database
npx supabase migration new # Create migration
npm run supabase:types     # Regenerate TS types
```

## Environment Variables

The setup script automatically creates `.env.local` with:
- Local Supabase URLs (http://127.0.0.1:54321)
- Demo keys from local Supabase instance
- GitHub Secrets are **NOT** used locally (only in CI/CD)

For Codespaces, URLs are updated to use port forwarding:
- `NEXT_PUBLIC_SUPABASE_URL` → Codespaces forwarded URL
- Server-side still uses `http://127.0.0.1:54321`

## Architecture Guidance

- **Active Development:** `development/` directory (Next.js + Supabase)
- **Reference Only:** Root-level Go microservices (Architecture A)
- See `/.github/copilot-instructions.md` for full context

## Need Help?

- Check `development/README.md` for app-specific docs
- See `development/docs/` for detailed guides
- Run `./quick-start.sh` for automated setup
