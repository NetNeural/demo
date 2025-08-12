# 🔧 NetNeural Scripts Directory

This directory contains all development and deployment scripts for NetNeural.

## 📁 Available Scripts

### 🚀 **Development Scripts**
- **`setup-local.sh`** - Complete local development environment setup
- **`start-dev.sh`** - Start development services (web, API, mobile)

### 🐳 **Docker Scripts**
- **`connect-docker.sh`** - Connect to remote Docker via SSH tunnel (Linux/Mac)
- **`connect-docker.bat`** - Connect to remote Docker via SSH tunnel (Windows)
- **`setup-docker-cli.bat`** - Install Docker CLI tools (Windows)

## 🛠️ **Usage Examples**

### Local Development
```bash
# Setup complete local environment
./scripts/setup-local.sh

# Start development services
./scripts/start-dev.sh
```

### Remote Docker Connection
```bash
# Linux/Mac
./scripts/connect-docker.sh

# Windows
./scripts/connect-docker.bat
```

### NPM Script Shortcuts
```bash
# Use NPM scripts from root directory
npm run setup:local      # Runs scripts/setup-local.sh
npm run dev:start        # Runs scripts/start-dev.sh
```

## 📝 **Script Requirements**

### Prerequisites
- **setup-local.sh**: Docker, Docker Compose, Node.js 18+
- **start-dev.sh**: Development environment already set up
- **connect-docker.sh/bat**: SSH access to remote Docker host
- **setup-docker-cli.bat**: Windows with Chocolatey (optional)

### Environment Files
- `.env.local` - Local development configuration
- `.env.unraid` - Unraid deployment configuration
- `apps/web/.env.local` - Web app configuration
- `apps/api/.env` - API configuration

## 🔒 **Permissions**

Make sure scripts are executable:
```bash
chmod +x scripts/*.sh
```

## 📚 **Related Documentation**

- [Setup Guides](../docs/setup/) - Detailed setup documentation
- [Deployment](../docs/deployment/) - Deployment guides
- [Docker Configs](../docker/) - Docker Compose configurations
