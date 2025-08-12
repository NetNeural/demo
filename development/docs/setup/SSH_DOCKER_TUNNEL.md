# SSH Port Forwarding for Secure Remote Docker
*Secure Docker Connection via SSH Tunnel*

## 🔐 Why SSH Tunneling is Better
- **Secure**: All traffic encrypted through SSH
- **No exposed ports**: Docker API not exposed to network
- **Authentication**: Uses your SSH keys/credentials
- **Firewall friendly**: Only SSH port (22) needs to be open

---

## 🚀 Setup SSH Port Forwarding

### Method 1: Command Line SSH Tunnel
```bash
# Create SSH tunnel (run this first)
ssh -L 2376:localhost:2376 your-username@192.168.1.45

# In another terminal, use Docker normally
docker version
docker ps
```

### Method 2: Background SSH Tunnel
```bash
# Create persistent background tunnel
ssh -f -N -L 2376:localhost:2376 your-username@192.168.1.45

# Use Docker commands
docker version
docker-compose up --build
```

### Method 3: SSH Config File (Recommended)
Create/edit `~/.ssh/config`:
```
Host docker-server
    HostName 192.168.1.45
    User your-username
    LocalForward 2376 localhost:2376
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Then connect:
```bash
# Start tunnel
ssh docker-server

# In another terminal, use Docker
docker version
```

---

## 🔧 Configure Remote Server (Minimal)

**On your Ubuntu server, Docker just needs to listen locally:**

```bash
# Edit Docker daemon config
sudo nano /etc/docker/daemon.json
```

**Add this simple config:**
```json
{
  "hosts": [
    "unix:///var/run/docker.sock",
    "tcp://127.0.0.1:2376"
  ]
}
```

```bash
# Create systemd override
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo nano /etc/systemd/system/docker.service.d/override.conf
```

**Add:**
```ini
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd
```

```bash
# Restart Docker
sudo systemctl daemon-reload
sudo systemctl restart docker

# Verify (should show 127.0.0.1:2376)
sudo netstat -tlnp | grep 2376
```

---

## 💻 Windows Client Setup

### Update Environment Variable
```bash
# Remove remote host (we'll use local tunnel)
setx DOCKER_HOST "tcp://localhost:2376"

# Or for current session
export DOCKER_HOST=tcp://localhost:2376
```

### Create Batch Script for Easy Connection
Save as `connect-docker.bat`:
```batch
@echo off
echo Starting SSH tunnel to Docker server...
echo.
echo Press Ctrl+C to disconnect
echo.
ssh -L 2376:localhost:2376 your-username@192.168.1.45
```

---

## 🚀 Usage Workflow

### 1. Start SSH Tunnel
```bash
# Option A: Interactive
ssh your-username@192.168.1.45 -L 2376:localhost:2376

# Option B: Background
ssh -f -N -L 2376:localhost:2376 your-username@192.168.1.45

# Option C: Using config
ssh docker-server
```

### 2. Use Docker Normally (in another terminal)
```bash
export DOCKER_HOST=tcp://localhost:2376
docker version
docker ps
docker-compose up --build
npm run deploy:remote
```

### 3. Deploy Your Platform
```bash
# Set environment
cp .env.example .env

# Deploy through tunnel
docker-compose -f docker-compose.remote.yml up -d --build
```

---

## ✅ Benefits of This Approach

- **🔒 Secure**: All traffic encrypted
- **🚫 No exposed ports**: Docker API not on network
- **🔑 SSH authentication**: Uses your existing SSH setup
- **🔥 Firewall friendly**: Only SSH port needed
- **⚡ Fast**: Direct connection once tunnel established

---

## 📋 Quick Setup Checklist

1. **Configure server Docker** to listen on `127.0.0.1:2376`
2. **Set local DOCKER_HOST** to `tcp://localhost:2376`
3. **Create SSH tunnel** to forward port 2376
4. **Test connection**: `docker version`
5. **Deploy platform**: `npm run deploy:remote`

**This is the professional way to handle remote Docker securely!**
