# NetNeural IoT Platform - Hot Reload Development Guide

## 🔥 Hot Reload Status: FULLY OPTIMIZED

The NetNeural IoT Platform is **already configured for optimal hot reload** without requiring service restarts for most changes.

## ✅ What Auto-Reloads (No Restart Needed)

### 1. **React Components** - Next.js Fast Refresh ⚡
- **Location**: `apps/web/src/components/**`
- **Technology**: Next.js Fast Refresh
- **Behavior**: Instant component updates, preserves component state
- **Test**: Edit any `.tsx` file in components directory

### 2. **API Routes & Server Code** - tsx watch 🔄  
- **Location**: `apps/api/src/**`
- **Technology**: tsx watch mode
- **Behavior**: Auto-restart server on file changes
- **Test**: Edit API endpoints in `apps/api/src/routes/`

### 3. **Shared Packages** - TypeScript Watch 👀
- **Packages**: `@netneural/supabase`, `@netneural/types`, `@netneural/ui`, `@netneural/utils`
- **Technology**: TypeScript compiler in watch mode
- **Behavior**: Auto-rebuild on package changes, dependents auto-update
- **Test**: Edit files in `packages/*/src/`

### 4. **Styles & CSS** - Tailwind JIT 🎨
- **Location**: Any component with Tailwind classes
- **Technology**: Tailwind CSS Just-In-Time compilation
- **Behavior**: Instant style updates
- **Test**: Add/modify Tailwind classes

## ⚡ Current Hot Reload Configuration

### Next.js (Web App)
```javascript
// next.config.js - Optimized for hot reload
experimental: {
  optimizePackageImports: ['@netneural/supabase', '@netneural/types', '@netneural/ui', '@netneural/utils'],
  externalDir: true,
},
reactStrictMode: true,
swcMinify: true,
```

### API Server
```json
// package.json
"scripts": {
  "dev": "tsx watch src/index.ts"  // Auto-restart on changes
}
```

### Shared Packages
```json
// All packages have:
"scripts": {
  "dev": "tsc --watch"  // Watch mode compilation
}
```

### Turbo Configuration
```json
// turbo.json - Optimized for development
"dev": {
  "cache": false,          // No caching in dev
  "persistent": true,      // Keep processes running
  "dependsOn": ["^dev"]    // Package dependency watching
}
```

## 🚫 What Requires Restart

### Environment Variables
- **Files**: `.env`, `.env.local`, `.env.development`
- **Reason**: Environment variables are loaded at process start
- **Solution**: Restart affected services only

### Package.json Changes
- **Files**: `package.json`, `turbo.json` 
- **Reason**: Dependency and build configuration changes
- **Solution**: `npm install` and restart

### Supabase Schema Changes
- **Files**: `supabase/migrations/*.sql`
- **Reason**: Database schema modifications
- **Solution**: `npx supabase db reset` (if needed)

## 🎯 Development Workflow

### Starting Development (First Time)
```bash
./startup.sh  # Starts all services with hot reload
```

### Ongoing Development (No Restarts Needed)
```bash
# Just start coding! Changes auto-reload:
# - Edit React components → Instant update
# - Modify API routes → Auto-restart
# - Update packages → Auto-rebuild
# - Add Tailwind styles → Instant styling
```

### Hot Reload Test Script
```bash
./dev-mode.sh  # Check status & start with hot reload optimization
```

## 🔧 Development Commands

```bash
# Start all services with hot reload (if not running)
npm run dev:hot

# Individual service development
npm run dev:web      # Next.js with Fast Refresh
npm run dev:api      # API with tsx watch
npm run dev:supabase # Supabase local

# Package development (run in packages/*)
npm run dev          # TypeScript watch mode
```

## 💡 Hot Reload Tips

1. **Component Changes**: Save and see instant updates in browser
2. **API Changes**: Server auto-restarts, test endpoints immediately  
3. **Package Changes**: Dependents automatically rebuild and update
4. **Style Changes**: Tailwind classes update instantly
5. **No Manual Refreshing**: Fast Refresh preserves component state
6. **Error Recovery**: Fast Refresh recovers from syntax errors automatically

## 🚀 Performance Optimizations

- **Parallel Execution**: Turbo runs tasks in parallel
- **Dependency Optimization**: Only rebuilds what changed
- **Fast Refresh**: React state preservation during updates
- **SWC Minification**: Faster compilation
- **External Directory Support**: Monorepo package watching

## ✅ Verification

The platform is **already optimally configured**. You can:

1. Edit any React component → See instant changes
2. Modify API routes → Server auto-restarts  
3. Update shared packages → Auto-rebuild and update
4. Add styles → Instant visual updates

**No additional configuration needed!** 🎉
