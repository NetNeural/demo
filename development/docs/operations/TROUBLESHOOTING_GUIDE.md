# 🛠️ NetNeural Development Environment Troubleshooting
*Docker SSH Tunnel & Setup Issues*  
*Created: August 11, 2025*

## ✅ SETUP SUCCESS LOG

### **SSH Tunnel Configuration - RESOLVED**
**Issue**: Port conflicts and incorrect remote Docker port assumptions
**Solution**: Auto-discovery script that detects Docker daemon port
- ✅ Remote Docker daemon confirmed running on port **2375** (not 2376)
- ✅ SSH tunnel established: `localhost:2375 -> 192.168.1.45:2375`
- ✅ Docker connectivity confirmed: 14 containers running

### **Docker Compose Installation - RESOLVED**  
**Issue**: Docker Compose V2 vs V1 confusion
**Solution**: Docker Compose V2 is integrated into Docker CLI
- ✅ Command: `docker compose version` (space, not hyphen)
- ✅ Version: Docker Compose version v2.39.2
- ✅ No separate installation needed

### **Current Status**: 
- ✅ SSH tunnel: Working
- ✅ Docker connectivity: Working  
- ✅ Docker Compose: Working
- 🔄 Build process: In progress (buildx filesystem issue)

---

## 🚨 COMMON ISSUES & SOLUTIONS

### **Issue 1: Port 2376 Already in Use**
**Symptoms:**
- SSH tunnel fails with "Address already in use"
- `netstat -ano | findstr :2376` shows existing connection
- Docker connection fails or returns "connection forcibly closed"

**Root Cause:**
- Previous SSH tunnel didn't properly close
- Orphaned SSH process holding the port
- Windows Git Bash path interpretation issues with process killing

**Solutions:**

#### **Method 1: Kill Process by PID (PowerShell)**
```powershell
# Find the PID
netstat -ano | findstr :2376

# Kill using PowerShell (not Git Bash)
powershell "Stop-Process -Id <PID> -Force"
```

#### **Method 2: Kill All SSH Tunnels**
```bash
# Kill all SSH processes (nuclear option)
pkill -f "ssh.*2376"

# Or on Windows
taskkill /F /IM ssh.exe
```

#### **Method 3: Use Different Port**
```bash
# Edit connect-docker.sh to use different port
LOCAL_PORT="2377"  # Change from 2376

# Update DOCKER_HOST accordingly
export DOCKER_HOST="tcp://localhost:2377"
```

#### **Method 4: Restart Network Stack (Windows)**
```cmd
# As Administrator
netsh int ip reset
# Then reboot
```

---

### **Issue 2: SSH Connection Fails**
**Symptoms:**
- "SSH connectivity failed"
- Connection timeout to 192.168.1.45
- Authentication errors

**Solutions:**

#### **Check SSH Key Setup**
```bash
# Test SSH connection manually
ssh -v root@192.168.1.45

# Check SSH key
ssh-add -l

# Add key if needed
ssh-add ~/.ssh/id_rsa
```

#### **Check Remote Docker Daemon**
```bash
# SSH to remote and check Docker
ssh root@192.168.1.45 "systemctl status docker"
ssh root@192.168.1.45 "docker info"
```

#### **Network Connectivity**
```bash
# Test basic connectivity
ping 192.168.1.45
telnet 192.168.1.45 22
```

---

### **Issue 3: Docker Services Won't Start**
**Symptoms:**
- Docker Compose fails to start containers
- "No such image" errors
- Container health check failures

**Solutions:**

#### **Check Docker Connection**
```bash
export DOCKER_HOST="tcp://localhost:2376"
docker info
docker ps
```

#### **Clean Up Containers**
```bash
# Stop all NetNeural containers
docker-compose -f docker/docker-compose.local.yml down --remove-orphans

# Remove dangling containers
docker container prune -f

# Remove unused images
docker image prune -f
```

#### **Rebuild Images**
```bash
# Force rebuild all images
docker-compose -f docker/docker-compose.local.yml build --no-cache

# Pull base images first
docker pull node:18-alpine
docker pull postgres:15
docker pull redis:7-alpine
```

---

### **Issue 4: Supabase Services Not Responding**
**Symptoms:**
- Supabase Studio shows 502 error
- PostgREST API not accessible
- Database connection refused

**Solutions:**

#### **Check Service Startup Order**
```bash
# Start database first
docker-compose -f docker/docker-compose.local.yml up -d netneural-db

# Wait for DB to be ready
sleep 10

# Start other services
docker-compose -f docker/docker-compose.local.yml up -d
```

#### **Check Database Initialization**
```bash
# Check database logs
docker logs netneural-postgres

# Connect to database directly
docker exec -it netneural-postgres psql -U postgres -d netneural
```

#### **Reset Supabase Configuration**
```bash
# Remove Supabase volumes
docker volume rm netneural_db_data
docker volume rm netneural_storage_data

# Restart with fresh data
docker-compose -f docker/docker-compose.local.yml up -d --force-recreate
```

---

## 🔧 NETNEURAL-SPECIFIC FIXES

### **Remote Docker Host Configuration**
```bash
# NetNeural uses specific remote Docker setup
REMOTE_HOST="192.168.1.45"
REMOTE_USER="root"
LOCAL_PORT="2376"
REMOTE_PORT="2376"

# Environment variables needed
export DOCKER_HOST="tcp://localhost:2376"
export DOCKER_TLS_VERIFY=""
export DOCKER_CERT_PATH=""
```

### **NetNeural Service Ports**
```
Application Ports (Local Access):
- Web App: 4000
- Supabase Studio: 4001  
- Database: 4432
- PostgREST API: 4434
- Auth (GoTrue): 4433
- Realtime: 4435
- Storage: 4436
- API: 4437
- Redis: 4379
- Traefik: 4080

Internal Docker Network:
- All services use netneural-network bridge
- Database: netneural-db:5432
- Redis: netneural-redis:6379
```

### **NetNeural Database Schema**
```sql
-- Essential tables for MVP
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  permissions JSONB,
  customer_config JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'offline',
  config JSONB,
  owner_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES devices(id),
  sensor_type TEXT,
  value NUMERIC,
  unit TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### **NetNeural Volume Cleanup**
```bash
# NetNeural specific volumes
docker volume ls | grep netneural

# Remove all NetNeural volumes (DESTRUCTIVE)
docker volume rm $(docker volume ls -q | grep netneural)

# Selective cleanup
docker volume rm netneural_db_data        # Database data
docker volume rm netneural_storage_data   # File uploads
docker volume rm netneural_redis_data     # Cache/sessions
```

---

## 📝 SETUP SCRIPT IMPROVEMENTS NEEDED

### **1. Better Port Conflict Detection**
```bash
# Add to setup script
check_port_conflict() {
    if netstat -ano | grep -q ":$LOCAL_PORT.*LISTENING"; then
        echo "⚠️ Port $LOCAL_PORT is in use. Attempting to free it..."
        # Kill specific SSH processes
        pkill -f "ssh.*$LOCAL_PORT:localhost:$REMOTE_PORT" 2>/dev/null
        sleep 2
    fi
}
```

### **2. Improved Error Handling**
```bash
# Add retry logic
retry_command() {
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if "$@"; then
            return 0
        fi
        echo "Attempt $attempt failed, retrying in 5 seconds..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo "Command failed after $max_attempts attempts"
    return 1
}
```

### **3. Health Check Validation**
```bash
# Add comprehensive health checks
validate_services() {
    local services=(
        "localhost:4432:Database"
        "localhost:4001:Supabase Studio" 
        "localhost:4434:PostgREST API"
        "localhost:4433:Auth Service"
    )
    
    for service in "${services[@]}"; do
        IFS=':' read -r host port name <<< "$service"
        if nc -z "$host" "$port" 2>/dev/null; then
            echo "✅ $name is responding"
        else
            echo "❌ $name is not responding on $host:$port"
        fi
    done
}
```

### **4. Environment Variable Persistence**
```bash
# Add to setup script - persist DOCKER_HOST
echo "export DOCKER_HOST=tcp://localhost:$LOCAL_PORT" >> ~/.bashrc
echo "🔧 DOCKER_HOST persisted to ~/.bashrc"
```

---

## 🚀 RECOVERY PROCEDURES

### **Complete Environment Reset**
```bash
# 1. Stop everything
docker-compose -f docker/docker-compose.local.yml down --remove-orphans

# 2. Kill SSH tunnels
pkill -f "ssh.*2376"

# 3. Remove all NetNeural containers and images
docker container prune -f
docker image rm $(docker images | grep netneural | awk '{print $3}')

# 4. Remove volumes (optional - loses data)
docker volume rm $(docker volume ls -q | grep netneural)

# 5. Restart from scratch
./scripts/setup-local-with-remote-docker.sh
```

### **Quick Service Restart**
```bash
# Restart specific service
docker-compose -f docker/docker-compose.local.yml restart netneural-web

# Restart all services
docker-compose -f docker/docker-compose.local.yml restart

# Rebuild and restart
docker-compose -f docker/docker-compose.local.yml up -d --force-recreate --build
```

---

## 📋 MONITORING & DIAGNOSTICS

### **Service Status Check**
```bash
# All containers
docker ps --filter "name=netneural"

# Service logs
docker-compose -f docker/docker-compose.local.yml logs -f

# Specific service logs
docker logs -f netneural-web
docker logs -f netneural-postgres
```

### **Network Diagnostics**
```bash
# Check Docker network
docker network ls | grep netneural
docker network inspect netneural-local

# Port accessibility
for port in 4000 4001 4432 4434 4433; do
    echo -n "Port $port: "
    if nc -z localhost $port 2>/dev/null; then
        echo "OPEN"
    else  
        echo "CLOSED"
    fi
done
```

### **Resource Usage**
```bash
# Container resource usage
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Disk usage
docker system df
```

---

**💡 Remember**: Always document any new issues encountered and update this troubleshooting guide for future environment recreations!
