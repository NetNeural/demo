# 🚀 NetNeural - Modern Supabase Platform

A clean, modern project management platform built with **Supabase + Next.js + React Native + Express**.

## 📁 Architecture Overview

```
development/
├── apps/
│   ├── web/          # Next.js 14 + Tailwind + Supabase Auth
│   ├── mobile/       # React Native + Expo + Supabase  
│   └── api/          # Express.js + Supabase (lightweight server)
├── packages/
│   ├── supabase/     # Supabase client + auth utilities
│   ├── types/        # Shared TypeScript types
│   ├── ui/           # Shared React components
│   └── utils/        # Utility functions
└── supabase/         # Database schema + migrations
```

## 🎯 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Supabase CLI (installed automatically)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
```bash
# Copy and configure environment files
cp .env.local.example .env.local
cp apps/web/.env.local.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# Update with your Supabase credentials
```

### 3. Start Development
```bash
# Start all services (recommended)
npm run dev:start

# OR setup local environment first
npm run setup:local

# OR start individually
npm run dev:supabase  # Supabase local instance
npm run dev:web       # Next.js frontend  
npm run dev:api       # Express API
npm run dev:mobile    # React Native app
```

## 🔗 Development URLs

- **Web App**: http://localhost:3000
- **API Server**: http://localhost:3001
- **Supabase Studio**: http://localhost:54323
- **Supabase API**: http://localhost:54321

## 📦 Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14 + Tailwind | Modern React with App Router |
| **Mobile** | React Native + Expo | Cross-platform mobile |
| **API** | Express.js + Supabase | Lightweight custom endpoints |
| **Database** | PostgreSQL + Supabase | Auto-generated REST API |
| **Auth** | Supabase Auth | OAuth + Email authentication |
| **Storage** | Supabase Storage | File management |
| **Real-time** | Supabase Realtime | WebSocket subscriptions |

## 🛠 Development Commands

```bash
# Package management
npm run build         # Build all packages
npm run clean         # Clean build artifacts
npm run test          # Run test suites
npm run lint          # Code linting

# Development
npm run dev           # Start all apps with Turbo
npm run dev:start     # Full development environment
npm run dev:web       # Web app only
npm run dev:api       # API server only
npm run dev:mobile    # Mobile app only
npm run dev:supabase  # Supabase local only
```

## 🚀 Deployment

### Local Docker Development
```bash
npm run docker:local:up    # Full local stack
npm run docker:local:down  # Stop local stack
```

### Unraid Server Deployment
```bash
npm run deploy:unraid      # Deploy to Unraid
npm run unraid:logs        # View deployment logs
npm run unraid:down        # Stop Unraid deployment
```

### Remote Docker Deployment
```bash
npm run deploy:remote      # Deploy to remote Docker host
npm run docker:remote:down # Stop remote deployment
```

## ⚙️ Environment Configuration

### Required Environment Variables

#### Root `.env.local`
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Deployment Configuration
DOCKER_HOST=tcp://192.168.1.45:2376  # For remote deployment
```

#### Web App `apps/web/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### API `apps/api/.env`
```env
PORT=3001
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CORS_ORIGIN=http://localhost:3000,http://localhost:19006
```

## 📚 Project Features

### ✅ Implemented
- **Authentication**: Email/password + OAuth (Google, GitHub)
- **UI Components**: Login forms, dashboard layout
- **Database**: User profiles, organizations, projects, tasks
- **Security**: Row Level Security (RLS) policies
- **Development**: Hot reload, TypeScript, Tailwind CSS

### 🔄 In Development
- **Project Management**: CRUD operations, task management
- **Real-time**: Live collaboration, notifications
- **File Storage**: Document uploads, image handling
- **Mobile App**: React Native implementation
- **Analytics**: User activity tracking

### 🎯 Planned
- **AI Integration**: Smart task suggestions, automation
- **Integrations**: Slack, GitHub, Jira connections
- **Advanced Auth**: SSO, team management
- **Performance**: Caching, optimization

## 🔒 Security

- **Database**: Row Level Security on all tables
- **Authentication**: Supabase Auth with JWT tokens
- **API**: CORS protection, helmet security headers
- **Environment**: Secure credential management
- **Network**: Docker network isolation

## 📖 Documentation

- **[Complete Documentation Index](./docs/README.md)** - Navigate all documentation
- **[Setup Guides](./docs/setup/)** - Environment setup and configuration
- **[Deployment Guides](./docs/deployment/)** - Production deployment
- **[Architecture Docs](./docs/architecture/)** - Technical architecture and decisions
- **[Scripts & Tools](./scripts/README.md)** - Development and deployment scripts

---

**Built with ❤️ by NetNeural Labs**

Ready to transform project management with AI! 🚀
