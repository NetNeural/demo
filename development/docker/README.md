# 🐳 Docker Configurations

This directory contains all Docker Compose configurations for different environments.

## 📁 Configuration Files

### 🏠 **Local Development**
- **`docker-compose.local.yml`** - Local development with Supabase stack
  - Supabase services (DB, Auth, Storage, Realtime, Studio)
  - Local ports: 4000-4437
  - Development-friendly configuration

### 🌐 **Remote Deployment**
- **`docker-compose.remote.yml`** - Remote server deployment
  - Production-ready configuration
  - Remote Docker host deployment
  - SSH tunnel compatible

### 🗄️ **Unraid Server**
- **`docker-compose.unraid.yml`** - Unraid-specific deployment
  - Dedicated ports (4000-4437) to avoid conflicts
  - SynapticDrift-compatible (no port conflicts)
  - Optimized for Unraid environment

## 🚀 **Usage**

### Local Development
```bash
# Using NPM scripts (recommended)
npm run docker:local:up
npm run docker:local:down
npm run docker:local:logs

# Direct docker-compose
docker-compose -f docker/docker-compose.local.yml up -d
docker-compose -f docker/docker-compose.local.yml down
```

### Remote Deployment
```bash
# Set up SSH tunnel first
./scripts/connect-docker.sh

# Deploy
npm run deploy:remote
# OR
docker-compose -f docker/docker-compose.remote.yml up -d --build
```

### Unraid Deployment
```bash
# Using deployment script (recommended)
npm run deploy:unraid
# OR
./deployment/deploy-unraid.sh
```

## 🔧 **Service Ports**

### Local Development Ports
- **Web App**: 4000
- **Supabase Studio**: 4001
- **PostgreSQL**: 4432
- **Supabase Auth**: 4433
- **PostgREST API**: 4434
- **Realtime**: 4435
- **Storage**: 4436
- **Redis**: 4379
- **Traefik**: 4080

### Port Mapping Strategy
- **4000-4437**: NetNeural services
- **No conflicts** with SynapticDrift (3000, 5432, 6379, 9090, 9999)
- **Consistent** across all environments

## 🌐 **Network Configuration**

All configurations use:
- **Custom networks** for service isolation
- **Internal communication** between services
- **External access** only where needed
- **Security-first** approach with minimal exposure

## 📚 **Related Documentation**

- [Deployment Guide](../docs/deployment/DEPLOYMENT_READY.md)
- [Setup Scripts](../scripts/)
- [Unraid Deployment](../deployment/deploy-unraid.sh)
