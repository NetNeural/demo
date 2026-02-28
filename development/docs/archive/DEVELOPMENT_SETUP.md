# Development Environment Setup Guide

## Overview

This guide provides step-by-step instructions for setting up the NetNeural IoT Platform development environment with the latest technology stack.

## Technology Stack (Latest Versions)

### Core Framework

- **Next.js**: 15.0.x with Turbopack bundler
- **React**: 18.3.x with concurrent features
- **TypeScript**: 5.6.x with enhanced type inference
- **Node.js**: 20.x LTS (recommended)

### Backend & Database

- **Supabase**: Latest platform with PostgreSQL 15
- **Edge Functions**: Deno 2.0 runtime
- **Real-time**: WebSocket and Server-Sent Events
- **Auth**: Multi-provider authentication

### Styling & UI

- **Tailwind CSS**: 3.4.x with latest utilities
- **Radix UI**: Latest component primitives
- **Lucide React**: Modern icon library
- **CSS Custom Properties**: Design tokens

### Development Tools

- **Turbopack**: Next.js 15 native bundler
- **ESLint**: 9.x with TypeScript integration
- **Prettier**: 3.x with enhanced formatting
- **Husky**: Git hooks automation

### Testing

- **Playwright**: Latest E2E testing framework
- **Jest**: 29.x with React Testing Library
- **MSW**: API mocking for tests
- **Coverage**: V8 provider

## Prerequisites

### Required Software

1. **Node.js 20.x LTS**

   ```bash
   # Install via Node Version Manager (recommended)
   nvm install 20
   nvm use 20

   # Verify installation
   node --version  # Should show v20.x.x
   npm --version   # Should show 10.x.x
   ```

2. **Git**

   ```bash
   # Verify installation
   git --version
   ```

3. **Docker Desktop** (for Supabase local development)

   ```bash
   # Verify installation
   docker --version
   docker-compose --version
   ```

4. **Supabase CLI** (latest)

   ```bash
   # Install via npm
   npm install -g supabase@latest

   # Verify installation
   supabase --version
   ```

### Optional Tools

1. **Visual Studio Code** with extensions:
   - TypeScript and JavaScript Language Features
   - Tailwind CSS IntelliSense
   - Prettier - Code formatter
   - ESLint
   - Supabase Snippets

2. **GitHub CLI** (for deployment)
   ```bash
   # Install and authenticate
   gh auth login
   ```

## Project Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/NetNeural/SoftwareMono.git
cd SoftwareMono/development

# Install dependencies
npm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables
# Required variables for local development:
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3. Supabase Local Setup

```bash
# Initialize Supabase (if not already done)
supabase init

# Start local Supabase stack
supabase start

# Generate TypeScript types
supabase gen types typescript --local > src/types/supabase.ts

# Apply database migrations (if any)
supabase db reset
```

### 4. Development Server

```bash
# Start development server with Turbopack
npm run dev

# Alternative: Start with specific port
npm run dev -- --port 3001

# Open in browser
# Navigate to http://localhost:3000
```

## Development Workflow

### Code Quality Tools

```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# All quality checks
npm run quality
```

### Testing

```bash
# Unit tests with Jest
npm run test
npm run test:watch
npm run test:coverage

# E2E tests with Playwright
npm run test:e2e
npm run test:e2e:ui

# Install Playwright browsers (first time)
npx playwright install
```

### Building

```bash
# Build for production
npm run build

# Build and analyze bundle
npm run build:analyze

# Export static site
npm run export
```

## Supabase Development

### Local Database Management

```bash
# Reset database
supabase db reset

# Create new migration
supabase migration new migration_name

# Apply migrations
supabase db push

# Generate types after schema changes
supabase gen types typescript --local > src/types/supabase.ts
```

### Edge Functions Development

```bash
# Create new Edge Function
supabase functions new function-name

# Serve Edge Functions locally
supabase functions serve

# Deploy specific function
supabase functions deploy function-name

# View function logs
supabase functions logs function-name
```

### Real-time Features

```bash
# Test real-time subscriptions
supabase db reset
# Add test data via Supabase Studio
# Test real-time updates in browser
```

## Project Structure

```
development/
├── src/
│   ├── app/                 # Next.js 15 App Router
│   ├── components/          # React components
│   ├── lib/                 # Utilities and configurations
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript type definitions
│   └── styles/             # Global styles and Tailwind
├── supabase/
│   ├── functions/          # Edge Functions (Deno 2.0)
│   ├── migrations/         # Database migrations
│   └── config.toml         # Local configuration
├── tests/
│   ├── e2e/               # Playwright E2E tests
│   └── unit/              # Jest unit tests
├── public/                # Static assets
└── docs/                  # Project documentation
```

## Common Issues & Solutions

### Node.js Version Issues

```bash
# Use correct Node.js version
nvm use 20

# Clear npm cache if needed
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Supabase Connection Issues

```bash
# Check Supabase status
supabase status

# Restart Supabase stack
supabase stop
supabase start

# Reset if corrupted
supabase db reset --linked
```

### TypeScript Errors

```bash
# Regenerate types
supabase gen types typescript --local > src/types/supabase.ts

# Clear TypeScript cache
rm -rf .next
npm run dev
```

### Build Issues

```bash
# Clear all caches
rm -rf .next out dist
npm run build

# Check for circular dependencies
npx madge --circular src/
```

## Performance Optimization

### Development Mode

1. **Turbopack**: Enabled by default in Next.js 15
2. **Hot Reload**: Instant updates with React Fast Refresh
3. **Type Checking**: Parallel TypeScript checking
4. **Bundle Analysis**: Use `npm run build:analyze`

### Production Build

1. **Static Export**: Optimized for GitHub Pages
2. **Tree Shaking**: Unused code elimination
3. **Image Optimization**: Next.js Image component
4. **Code Splitting**: Automatic route-based splitting

## Deployment

### GitHub Pages (Automatic)

The project is configured for automatic deployment to GitHub Pages via GitHub Actions:

1. **Push to main branch** triggers deployment
2. **Build with latest Next.js 15** and static export
3. **Deploy to GitHub Pages** with custom domain support

### Manual Deployment

```bash
# Build and export
npm run build
npm run export

# Deploy to custom hosting
# Upload 'out' directory to your hosting provider
```

## Environment Variables

### Local Development

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production

```bash
# Production environment variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://netneural.github.io/SoftwareMono
```

## Additional Resources

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript 5.6 Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Playwright Testing](https://playwright.dev/docs/intro)

## Support

For development issues or questions:

1. Check this documentation first
2. Review [project issues](https://github.com/NetNeural/SoftwareMono/issues)
3. Create new issue with detailed description
4. Join our development Discord server

---

**Last Updated**: December 2024  
**Next.js Version**: 15.0.x  
**Node.js Version**: 20.x LTS  
**Supabase CLI**: Latest
