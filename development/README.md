# NetNeural IoT Platform - Development Project

A modern, full-stack IoT platform built with the latest web technologies and Supabase-first architecture.

## 🚀 Latest Technology Stack

### Core Framework

- **Next.js 15.0.x** - React framework with Turbopack bundler
- **React 18.3.x** - UI library with concurrent features
- **TypeScript 5.6.x** - Type-safe JavaScript with enhanced inference
- **Node.js 20.x LTS** - JavaScript runtime

### Backend & Database

- **Supabase Latest** - Backend-as-a-Service with PostgreSQL 15
- **Edge Functions** - Serverless functions with Deno 2.0 runtime
- **Real-time Database** - Live data synchronization
- **Row Level Security** - Database-level authorization

### Styling & UI

- **Tailwind CSS 3.4.x** - Utility-first CSS framework
- **Radix UI** - Headless component primitives
- **Lucide React** - Beautiful icon library
- **CSS Custom Properties** - Design token system

### Development Tools

- **Turbopack** - Next.js 15 native bundler (faster than Webpack)
- **ESLint 9.x** - Code linting with TypeScript integration
- **Prettier 3.x** - Code formatting
- **Husky** - Git hooks for quality gates

### Testing

- **Playwright** - Modern E2E testing framework
- **Jest 29.x** - Unit testing with React Testing Library
- **MSW** - API mocking for tests
- **V8 Coverage** - Code coverage reporting

## 🛠️ Quick Start

### Prerequisites

- **Node.js 20.x LTS**
- **Docker Desktop** (for Supabase)
- **Git**

### Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment setup**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. **Start Supabase locally**

   ```bash
   supabase start
   ```

4. **Generate TypeScript types**

   ```bash
   supabase gen types typescript --local > src/types/supabase.ts
   ```

5. **Start development server**

   ```bash
   npm run dev
   ```

6. **Open browser**
   ```
   http://localhost:3000
   ```

### 🎯 Development URLs

| Service             | URL                                 | Purpose              |
| ------------------- | ----------------------------------- | -------------------- |
| **Next.js App**     | http://localhost:3000               | Main application     |
| **Supabase Studio** | http://localhost:54323              | Database management  |
| **Supabase API**    | http://localhost:54321              | Backend API          |
| **Edge Functions**  | http://localhost:54321/functions/v1 | Serverless functions |

---

## 🏗️ Architecture Overview

### Supabase-First Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                   │
│  • App Router with static export                           │
│  • Client-side Supabase auth & real-time                   │
│  • NO API routes (all APIs via Edge Functions)             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Platform (ALL Backend)           │
│  🗄️ PostgreSQL  🔐 Auth  ⚡ Edge Functions  📁 Storage   │
│  📊 Real-time   📈 Analytics   🛡️ RLS   🔄 Webhooks      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   External Integrations                    │
│  • Golioth IoT Platform (via Edge Functions)               │
│  • MQTT Brokers (Edge Functions + Persistent Subscriber)   │
│  • Third-party APIs (via Edge Functions)                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Optional Standalone Services                  │
│  • MQTT Subscriber (Docker) - Persistent topic monitoring  │
│    Running at: services/mqtt-subscriber/                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **No Frontend API Routes**: All API logic in Supabase Edge Functions
2. **Static Export Only**: Optimized for GitHub Pages deployment
3. **Type Safety**: Auto-generated types from Supabase schema
4. **Real-time First**: Live updates via Supabase real-time
5. **Security by Default**: Row Level Security (RLS) enforced

---

## 📦 Latest Technology Stack

| Component           | Version | Purpose                             |
| ------------------- | ------- | ----------------------------------- |
| **Next.js**         | 15.0.x  | Frontend framework with Turbopack   |
| **React**           | 18.3.x  | UI library with concurrent features |
| **TypeScript**      | 5.6.x   | Type-safe JavaScript                |
| **Supabase**        | Latest  | Complete backend platform           |
| **Tailwind CSS**    | 3.4.x   | Utility-first CSS framework         |
| **Radix UI**        | Latest  | Accessible component primitives     |
| **React Query**     | 5.x     | Server state management             |
| **React Hook Form** | 7.x     | Form management                     |
| **Zod**             | 3.x     | Schema validation                   |

---

## 🔧 Development Scripts

### Essential Commands

```bash
# Development
npm run dev              # Start with Turbopack (fastest)
npm run dev:full         # Start Supabase + Next.js together
npm run dev:functions    # Start Edge Functions development

# Supabase Operations
npm run supabase:start   # Start local Supabase stack
npm run supabase:stop    # Stop local services
npm run supabase:reset   # Reset database with fresh schema
npm run supabase:types   # Generate TypeScript types
npm run supabase:studio  # Open Supabase Studio

# Edge Functions
npm run supabase:functions:serve   # Serve functions locally
npm run supabase:functions:deploy  # Deploy all functions
npm run supabase:functions:logs    # View function logs

# Building & Testing
npm run build            # Build for production (static export)
npm run start:static     # Test static build locally
npm run test             # Run unit tests
npm run test:e2e         # Run E2E tests with Playwright
npm run lint             # Code linting
npm run type-check       # TypeScript validation
```

### Advanced Development

```bash
# Full setup from scratch
npm run setup:fresh      # Clean install + fresh database

# Code quality
npm run check            # Run all checks (types, lint, tests)
npm run format           # Format code with Prettier

# Performance analysis
npm run build:analyze    # Analyze bundle size
```

---

## 🗄️ Database & Migrations

### Schema Management

```bash
# Create new migration
supabase migration new add_feature_name

# Apply migrations locally
supabase db push

# Reset to clean state
supabase db reset

# Generate types after schema changes
npm run supabase:types
```

### Edge Functions Development

```bash
# Create new Edge Function
supabase functions new my-function

# Deploy specific function
supabase functions deploy my-function

# View function logs
supabase functions logs my-function --follow
```

### MQTT Subscriber Service (Optional)

For persistent MQTT subscriptions:

```bash
# Navigate to service
cd services/mqtt-subscriber

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start service
./start.sh

# Check status
./status.sh

# View logs
./logs.sh

# Stop service
./stop.sh
```

**Use cases**:

- Persistent MQTT topic subscriptions
- Inbound device messages via MQTT protocol
- Multi-broker monitoring

**Note**: Not needed if using HTTP push model (mqtt-ingest Edge Function)

---

## 🔐 Environment Configuration

### Local Development (.env.local)

```bash
# Use local Supabase (default)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-development-key

# Add your Golioth API key
GOLIOTH_API_KEY=your-golioth-api-key
```

### Production Environment

```bash
# Replace with your Supabase project values
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 📁 Project Structure

```
development/
├── src/
│   ├── app/                 # Next.js 15 App Router
│   │   ├── (auth)/         # Authentication pages
│   │   ├── (dashboard)/    # Protected dashboard pages
│   │   └── globals.css     # Global styles
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── auth/          # Auth components
│   │   └── dashboard/     # Dashboard components
│   ├── lib/               # Utilities & configurations
│   │   ├── supabase/      # Supabase client setup
│   │   ├── database.types.ts  # Auto-generated types
│   │   └── utils.ts       # Helper functions
│   └── hooks/             # Custom React hooks
├── supabase/
│   ├── migrations/        # Database schema versions
│   ├── functions/         # Edge Functions (Deno)
│   │   ├── _shared/       # Shared utilities
│   │   ├── device-sync/   # Golioth integration
│   │   ├── mqtt-ingest/   # MQTT HTTP push endpoint
│   │   ├── mqtt-hybrid/   # MQTT operations
│   │   ├── integration-test/ # Integration testing
│   │   └── notifications/ # Alert system
│   └── config.toml        # Supabase configuration
├── services/
│   └── mqtt-subscriber/   # Persistent MQTT subscriber
│       ├── src/           # TypeScript source code
│       ├── Dockerfile     # Container definition
│       ├── docker-compose.yml  # Deployment config
│       └── *.sh           # Management scripts
├── package.json           # Latest dependencies
├── next.config.js         # Next.js 15 configuration
└── tailwind.config.js     # Tailwind CSS setup
```

---

## 🧪 Testing Strategy

### Unit Tests

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### E2E Tests

```bash
# Run Playwright tests
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui
```

### Edge Function Testing

```bash
# Test functions locally
supabase functions serve
curl -X POST http://localhost:54321/functions/v1/device-sync
```

---

## 🚀 Deployment

### GitHub Pages (Production)

```bash
# Build static export
npm run build

# Deploy automatically via GitHub Actions
git push origin main
```

### Supabase Deployment

```bash
# Deploy database changes
supabase db push

# Deploy Edge Functions
npm run supabase:functions:deploy
```

### ⚠️ One-Time Setup: Supabase Edge Cron

Auto-sync functionality requires a **one-time** Supabase Edge Cron configuration:

1. See [docs/SUPABASE_EDGE_CRON_SETUP.md](./docs/SUPABASE_EDGE_CRON_SETUP.md) for detailed instructions
2. Quick setup: Dashboard → Functions → `auto-sync-cron` → Cron tab → Enable with `* * * * *`
3. This is **project-level infrastructure** (not per integration)
4. Run script for checklist: `./scripts/setup-supabase-cron.sh`

**Note:** This setup is done ONCE per Supabase project. All Golioth integrations will automatically use the same cron job.

---

## 🔍 Troubleshooting

### Common Issues

1. **Supabase not starting**: Ensure Docker is running
2. **Type errors**: Run `npm run supabase:types` after schema changes
3. **Build failures**: Check Next.js 15 static export compatibility
4. **Edge Function errors**: Check Deno runtime compatibility

### Debug Commands

```bash
# Check Supabase status
supabase status

# View detailed logs
supabase logs

# Reset everything
npm run clean && npm run setup:fresh
```

---

## 📚 Additional Resources

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Turbopack Guide](https://turbo.build/pack/docs)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Golioth API Documentation](https://docs.golioth.io/)

---

**Need Help?** Check our [troubleshooting guide](./docs/troubleshooting.md) or create an issue.# Trigger deploy Mon 26 Jan 2026 05:18:51 PM UTC

# Force deployment - NODE_ENV=production fix
