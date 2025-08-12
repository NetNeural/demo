# 📚 NetNeural Documentation Index

Welcome to NetNeural's comprehensive documentation! This guide will help you navigate through all available documentation organized by category.

## 🚀 Quick Start

- **[Main README](../README.md)** - Project overview and quick start guide
- **[Setup Local Environment](setup/DOCKER_CLI_ONLY_SETUP.md)** - Local development setup
- **[Environment Configuration](../scripts/setup-local.sh)** - Automated local setup script

## 📁 Documentation Structure

### 🏗️ **Architecture & Planning**
*Technical architecture decisions and project evolution*

- **[Infrastructure MVP Alignment](architecture/INFRASTRUCTURE_MVP_ALIGNMENT.md)** - Analysis of current vs. planned architecture
- **[Supabase Compatibility Analysis](architecture/SUPABASE_COMPATIBILITY_ANALYSIS.md)** - Detailed analysis of Supabase integration
- **[Modern Development Framework](architecture/MODERN_DEVELOPMENT_FRAMEWORK.md)** - Framework overview and decisions
- **[Infrastructure Plan](architecture/NETNEURAL_INFRASTRUCTURE_PLAN.md)** - Complete infrastructure strategy
- **[Development Strategy](architecture/REVISED_DEVELOPMENT_STRATEGY.md)** - Current development approach
- **[Transformation Complete](architecture/TRANSFORMATION_COMPLETE.md)** - Project transformation summary
- **[Cleanup Audit](architecture/CLEANUP_AUDIT.md)** - Architecture cleanup documentation
- **[Root Directory Audit](architecture/ROOT_DIRECTORY_AUDIT_COMPLETE.md)** - Directory structure audit
- **[Root Cleanup Complete](architecture/ROOT_CLEANUP_COMPLETE.md)** - Final directory cleanup summary
- **[README Archive](architecture/README_OLD.md)** - Previous README for reference

### 🛠️ **Setup & Installation**
*Environment setup and configuration guides*

- **[Docker CLI Setup](setup/DOCKER_CLI_ONLY_SETUP.md)** - Docker-only installation approach
- **[Remote Docker Setup](setup/REMOTE_DOCKER_SETUP.md)** - Remote Docker configuration
- **[SSH Docker Tunnel](setup/SSH_DOCKER_TUNNEL.md)** - SSH tunnel setup for remote Docker
- **[Configure Remote Docker](setup/CONFIGURE_REMOTE_DOCKER.md)** - Remote Docker detailed configuration
- **[Docker Install Alternatives](setup/DOCKER_INSTALL_ALTERNATIVES.md)** - Alternative Docker installation methods

### 🚀 **Deployment**
*Production and staging deployment guides*

- **[Deployment Ready Guide](deployment/DEPLOYMENT_READY.md)** - Remote deployment setup
- **[Unraid Deployment Script](../deployment/deploy-unraid.sh)** - Automated Unraid deployment
- **[Docker Configurations](../docker/)** - All Docker Compose configurations

### 📋 **Historical Documentation**
*Project planning and legacy documentation*

- **[24-Hour Visual MVP Plan](mvp-implementation/24-HOUR_VISUAL_MVP_PLAN_UPDATED.md)** - Current modular MVP strategy
- **[Original MVP Plan](mvp-implementation/24-HOUR_VISUAL_MVP_PLAN.md)** - Original standalone MVP approach
- **[Framework Planning](framework/)** - Framework decision documentation
- **[MVP Implementation](mvp-implementation/)** - MVP development notes
- **[MVP Legacy Integration](mvp-legacy-integration/)** - Legacy system integration
- **[Project Planning](project-planning/)** - Project planning documents
- **[Lessons Learned](lessons-learned/)** - Development lessons and insights
- **[Visual Mockups](visual-mockups/)** - UI/UX design mockups
- **[Mockups](mockups/)** - Additional design assets

## 🎯 **Common Tasks**

### Development Setup
1. **First-time setup**: Follow [Main README](../README.md) → Quick Start
2. **Local development**: Run `npm run setup:local` or use [setup script](../scripts/setup-local.sh)
3. **Docker issues**: Check [Docker CLI Setup](setup/DOCKER_CLI_ONLY_SETUP.md)

### Deployment
1. **Unraid deployment**: Use `npm run deploy:unraid` or [deploy script](../deployment/deploy-unraid.sh)
2. **Remote deployment**: Follow [Remote Docker Setup](setup/REMOTE_DOCKER_SETUP.md)
3. **SSH tunneling**: Use [SSH Docker Tunnel](setup/SSH_DOCKER_TUNNEL.md) guide

### Architecture Understanding
1. **Current architecture**: See [Transformation Complete](architecture/TRANSFORMATION_COMPLETE.md)
2. **Supabase integration**: Read [Supabase Compatibility Analysis](architecture/SUPABASE_COMPATIBILITY_ANALYSIS.md)
3. **Infrastructure overview**: Review [Infrastructure Plan](architecture/NETNEURAL_INFRASTRUCTURE_PLAN.md)

## 🔧 **Scripts & Tools**

### Available Scripts
- `npm run setup:local` - Automated local environment setup
- `npm run deploy:unraid` - Deploy to Unraid server
- `npm run dev:start` - Start development environment
- `npm run docker:local:up` - Start local Docker services

### Script Locations
- **Setup Scripts**: `scripts/` directory
- **Deployment Scripts**: `deployment/` directory
- **Docker Configs**: `docker/` directory

## 📊 **Project Status**

**Current Phase**: ✅ Clean Supabase-first architecture implemented  
**Architecture**: Modern monorepo with Supabase backend  
**Status**: Ready for active development  

### Tech Stack
- **Frontend**: Next.js 14 + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **API**: Express.js for custom logic
- **Mobile**: React Native + Expo
- **Infrastructure**: Docker + Docker Compose
- **Monorepo**: Turborepo with shared packages

## 🆘 **Need Help?**

1. **Setup issues**: Check [Setup & Installation](#🛠️-setup--installation) section
2. **Deployment problems**: Review [Deployment](#🚀-deployment) guides
3. **Architecture questions**: Read [Architecture & Planning](#🏗️-architecture--planning) docs
4. **Historical context**: Browse [Historical Documentation](#📋-historical-documentation)

---

**Last Updated**: Current session  
**Documentation Status**: ✅ Organized and up-to-date  
**Next Review**: As needed based on development progress
