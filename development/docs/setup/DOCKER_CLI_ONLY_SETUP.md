# Docker CLI Only Setup (No Desktop Required)
*Lightweight Remote Docker Connection*

## 🎯 Goal: Docker CLI Only (No Local Daemon)

You want to connect to your remote Docker server without running Docker services locally to save system resources.

---

## 📦 Installation Options

### Option 1: Chocolatey (Recommended for Windows)
```bash
# Install Chocolatey first (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Docker CLI only (no daemon)
choco install docker-cli
```

### Option 2: Manual Installation
1. Download Docker CLI from: https://download.docker.com/win/static/stable/x86_64/
2. Extract `docker.exe` to a folder in your PATH
3. No Docker Desktop installation needed

### Option 3: WSL2 + Docker CLI
```bash
# In WSL2 Ubuntu
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Don't start Docker daemon locally
sudo systemctl stop docker
sudo systemctl disable docker
```

---

## 🔧 Configuration for Remote-Only Usage

### Set Environment Variables
```bash
# Windows Command Prompt
set DOCKER_HOST=tcp://192.168.1.45:2376

# Windows PowerShell
$env:DOCKER_HOST="tcp://192.168.1.45:2376"

# Git Bash / WSL
export DOCKER_HOST=tcp://192.168.1.45:2376
```

### Make it Permanent
**Windows:**
- Add `DOCKER_HOST=tcp://192.168.1.45:2376` to System Environment Variables

**Git Bash:**
```bash
echo 'export DOCKER_HOST=tcp://192.168.1.45:2376' >> ~/.bashrc
source ~/.bashrc
```

---

## 🚀 Verify Remote Connection

```bash
# Test connection (no local Docker needed)
docker version
docker ps
docker info
```

**Expected output:**
- Client: Shows local Docker CLI version
- Server: Shows remote server (192.168.1.45) Docker info

---

## 📋 Updated Development Workflow

### Docker Compose Commands
```bash
# All commands run on remote server
docker-compose up --build        # Start on remote
docker-compose down              # Stop on remote
docker-compose ps                # List remote containers
docker-compose logs web          # View remote logs
```

### Build and Deploy
```bash
# Build images on remote server
docker-compose build

# Deploy to remote server
docker-compose up -d

# Scale services on remote
docker-compose up -d --scale web=2
```

---

## ⚡ Benefits of CLI-Only Approach

### ✅ Advantages:
- **No local resource usage** (no Docker daemon)
- **Faster startup** (no Docker Desktop boot time)
- **Lighter system impact** (just CLI tools)
- **Same functionality** for remote operations
- **No Hyper-V conflicts** on Windows

### ❌ Limitations:
- **Can't build locally** (all builds happen on remote)
- **No Docker Desktop GUI** (command line only)
- **Network dependent** (need connection to remote server)

---

## 🔧 Quick Setup Script

Save as `setup-remote-docker.bat`:
```batch
@echo off
echo Setting up Docker CLI for remote server...

REM Install Docker CLI via Chocolatey
choco install docker-cli -y

REM Set environment variable
setx DOCKER_HOST "tcp://192.168.1.45:2376"

echo Docker CLI configured for remote server 192.168.1.45
echo Restart your terminal and test with: docker version
pause
```

---

## 🎯 Immediate Next Steps

1. **Install Docker CLI only** (not Desktop)
2. **Set DOCKER_HOST environment variable**
3. **Configure remote server** (enable Docker API)
4. **Test connection**: `docker version`
5. **Deploy**: `npm run deploy:remote`

**You'll have all Docker functionality without any local resource usage!**
