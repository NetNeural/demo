# Remote Docker Deployment Setup Guide
*Deploying to 192.168.1.45 Docker Server*

## 🐳 Current Situation
- **Local Machine**: Windows (no Docker installed)
- **Remote Server**: 192.168.1.45 (Docker server)
- **Goal**: Deploy NetNeural platform to remote Docker server

---

## 🛠️ Setup Options

### Option 1: Install Docker Desktop (Recommended for Development)

**Install Docker Desktop on Windows:**
1. Download from: https://www.docker.com/products/docker-desktop/
2. Install and restart your machine
3. Configure Docker to connect to remote daemon

**Configure Remote Connection:**
```bash
# Set environment variable to use remote Docker
export DOCKER_HOST=tcp://192.168.1.45:2376
# or for secure connection:
export DOCKER_HOST=tcp://192.168.1.45:2376
export DOCKER_TLS_VERIFY=1
export DOCKER_CERT_PATH=/path/to/certs
```

### Option 2: Docker Context (Clean Approach)
```bash
# Create remote context
docker context create remote --docker "host=tcp://192.168.1.45:2376"
# Use remote context
docker context use remote
# Deploy to remote
docker-compose up --build
```

### Option 3: SSH Tunnel + Docker (Secure)
```bash
# Create SSH tunnel to remote Docker
ssh -L 2376:localhost:2376 user@192.168.1.45
# Then use local tunnel
export DOCKER_HOST=tcp://localhost:2376
```

---

## 🔧 Remote Server Configuration

**On your Ubuntu server (192.168.1.45), you need:**

### 1. Enable Docker Remote API
```bash
# Edit Docker daemon configuration
sudo nano /etc/docker/daemon.json
```

**Add this configuration:**
```json
{
  "hosts": [
    "unix:///var/run/docker.sock",
    "tcp://0.0.0.0:2376"
  ],
  "tls": false
}
```

### 2. Restart Docker Service
```bash
sudo systemctl restart docker
```

### 3. Open Firewall Port
```bash
sudo ufw allow 2376
```

**⚠️ Security Warning**: This opens Docker API without TLS. For production, use TLS certificates.

---

## 🚀 Updated Development Workflow

### Modified package.json Scripts
```json
{
  "scripts": {
    "docker:remote": "DOCKER_HOST=tcp://192.168.1.45:2376 docker-compose up --build",
    "docker:remote-down": "DOCKER_HOST=tcp://192.168.1.45:2376 docker-compose down",
    "deploy:remote": "DOCKER_HOST=tcp://192.168.1.45:2376 docker-compose -f docker-compose.prod.yml up -d"
  }
}
```

### Environment Configuration
Create `.env.remote`:
```bash
DOCKER_HOST=tcp://192.168.1.45:2376
DATABASE_URL=postgresql://postgres:postgres@192.168.1.45:5432/netneural
REDIS_URL=redis://192.168.1.45:6379
```

---

## 🔒 Secure Setup (Production Ready)

### 1. Generate TLS Certificates
```bash
# On remote server
mkdir -p /etc/docker/certs
cd /etc/docker/certs

# Generate CA key
openssl genrsa -aes256 -out ca-key.pem 4096

# Generate CA certificate
openssl req -new -x509 -days 365 -key ca-key.pem -sha256 -out ca.pem

# Generate server key
openssl genrsa -out server-key.pem 4096

# Generate server certificate
openssl req -subj "/CN=192.168.1.45" -sha256 -new -key server-key.pem -out server.csr
openssl x509 -req -days 365 -sha256 -in server.csr -CA ca.pem -CAkey ca-key.pem -out server-cert.pem
```

### 2. Configure Secure Docker Daemon
```json
{
  "hosts": [
    "unix:///var/run/docker.sock",
    "tcp://0.0.0.0:2376"
  ],
  "tls": true,
  "tlscert": "/etc/docker/certs/server-cert.pem",
  "tlskey": "/etc/docker/certs/server-key.pem",
  "tlsverify": true,
  "tlscacert": "/etc/docker/certs/ca.pem"
}
```

---

## 🎯 Immediate Next Steps

### For Quick Testing (Less Secure):
1. Configure Docker daemon on 192.168.1.45 without TLS
2. Install Docker Desktop on your Windows machine
3. Set `DOCKER_HOST=tcp://192.168.1.45:2376`
4. Run `docker-compose up --build`

### For Production (Secure):
1. Set up TLS certificates
2. Configure secure Docker daemon
3. Use Docker contexts for clean management
4. Implement proper firewall rules

---

## 📋 Commands to Test Connection

```bash
# Test connection (after Docker Desktop installation)
docker -H tcp://192.168.1.45:2376 version

# List remote containers
docker -H tcp://192.168.1.45:2376 ps

# Deploy your stack
DOCKER_HOST=tcp://192.168.1.45:2376 docker-compose up --build
```

Would you like me to help you implement any of these options?
