# Configure Remote Docker Server (192.168.1.45)
*Commands to run on your Ubuntu server*

## 🔧 SSH into your Ubuntu server and run these commands:

### 1. Create Docker daemon configuration
```bash
sudo mkdir -p /etc/docker
sudo nano /etc/docker/daemon.json
```

### 2. Add this content to daemon.json:
```json
{
  "hosts": [
    "unix:///var/run/docker.sock",
    "tcp://0.0.0.0:2376"
  ],
  "tls": false
}
```

### 3. Create systemd override (required for newer Docker versions)
```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo nano /etc/systemd/system/docker.service.d/override.conf
```

### 4. Add this content to override.conf:
```ini
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd
```

### 5. Reload and restart Docker
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 6. Open firewall port
```bash
sudo ufw allow 2376
sudo ufw status
```

### 7. Verify Docker is listening
```bash
sudo netstat -tlnp | grep 2376
# Should show Docker listening on 0.0.0.0:2376
```

### 8. Test locally on server
```bash
docker -H tcp://localhost:2376 version
```

---

## 🚨 Security Note
This configuration disables TLS for simplicity. For production use, enable TLS certificates.

## ✅ Once configured, test from Windows:
```bash
docker version
docker ps
```
