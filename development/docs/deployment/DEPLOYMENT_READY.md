# NetNeural Supabase Remote Deployment

## Quick Start Commands

After setting up the SSH tunnel, test your Docker connection:

```bash
# Check Docker connection through tunnel
docker version

# List running containers on remote server
docker ps

# Build and deploy the NetNeural Supabase platform
docker-compose -f docker-compose.remote.yml up -d --build
```

## Environment Setup Status

✅ **Completed:**
- Docker CLI installed via Chocolatey
- DOCKER_HOST configured for SSH tunnel (localhost:2376)
- SSH tunnel scripts created (connect-docker.bat/sh)
- Supabase-based deployment configuration ready

🔄 **Next Steps:**
1. Configure Docker daemon on Ubuntu server (192.168.1.45)
2. Run SSH tunnel connection script
3. Test Docker commands through tunnel
4. Deploy NetNeural platform

## Remote Server Configuration Required

On your Ubuntu server (192.168.1.45), run:

```bash
# Configure Docker daemon to listen on localhost:2376
sudo mkdir -p /etc/systemd/system/docker.service.d/
sudo tee /etc/systemd/system/docker.service.d/override.conf << 'EOF'
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://127.0.0.1:2376
EOF

# Reload and restart Docker
sudo systemctl daemon-reload
sudo systemctl restart docker

# Verify Docker is listening
sudo netstat -tlnp | grep :2376
```

## Testing Connection

1. **Start SSH Tunnel** (from Windows):
   ```bash
   # Use the provided script
   ./connect-docker.bat
   # OR manually:
   # ssh -L 2376:localhost:2376 your-username@192.168.1.45
   ```

2. **Test Docker Commands**:
   ```bash
   docker version
   docker info
   docker ps
   ```

3. **Deploy NetNeural**:
   ```bash
   # Build and deploy all services
   docker-compose -f docker-compose.remote.yml up -d --build
   
   # Check deployment status
   docker-compose -f docker-compose.remote.yml ps
   
   # View logs
   docker-compose -f docker-compose.remote.yml logs -f
   ```

## Security Notes

- SSH tunnel encrypts all Docker communication
- No Docker API ports exposed to external network
- Uses SSH key authentication (recommended)
- Tunnel automatically closes when SSH session ends

## Troubleshooting

If connection fails:
1. Verify SSH access to 192.168.1.45
2. Check Docker daemon configuration on remote server
3. Ensure port 2376 is not already in use locally
4. Verify DOCKER_HOST environment variable: `echo $DOCKER_HOST`

## Access URLs (After Deployment)

**NetNeural Supabase Services:**
- **Web App**: http://192.168.1.45:4000
- **Supabase Studio**: http://192.168.1.45:4001
- **PostgREST API**: http://192.168.1.45:4434
- **Supabase Auth**: http://192.168.1.45:4433
- **Storage API**: http://192.168.1.45:4436
- **Realtime**: ws://192.168.1.45:4435
- **PostgreSQL**: 192.168.1.45:4432 (internal network only)

Ready to connect and deploy with Supabase! 🚀
