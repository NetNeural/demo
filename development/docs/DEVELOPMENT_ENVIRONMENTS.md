# NetNeural SoftwareMono - Development Environment Setup

## Development Environments

### 1. Local Development (Docker Desktop)
- Supabase CLI manages the full stack via Docker
- Your apps run in Docker Compose
- Both connect via shared Docker networks

### 2. Remote Development (Unraid)
- Same Supabase stack deployed via Docker Compose
- Your apps connect to remote Supabase instance
- SSH tunneling for development access

### 3. Production (GitHub Pages + Supabase Cloud)
- Static site deployment via GitHub Actions
- Supabase Cloud for backend services
- No Docker containers in production

## Local Development Workflow

### Option A: Supabase CLI + Docker Compose (Recommended)
```bash
# Start Supabase stack (handles 6+ containers automatically)
npx supabase start

# Start your apps (connects to running Supabase)
docker compose up web api
```

### Option B: All-in-one Docker Compose
```bash
# Start everything including Supabase services
docker compose --profile development up
```

## Remote Development Workflow

```bash
# Deploy Supabase + Apps to Unraid
./scripts/deploy-remote-dev.sh

# Or deploy just your apps (Supabase already running)
./scripts/deploy-apps.sh
```

## Key URLs (Local)
- **Supabase Studio**: http://localhost:54323
- **Supabase API**: http://localhost:54321  
- **PostgreSQL**: postgresql://postgres:postgres@localhost:54322/postgres
- **Your Web App**: http://localhost:3000
- **Your API**: http://localhost:3001
- **Mailpit (Email testing)**: http://localhost:54324
