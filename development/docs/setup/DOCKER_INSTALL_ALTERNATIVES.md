# Docker CLI Installation - Alternative Methods

## ❌ Chocolatey Failed (Needs Admin Rights)
The Chocolatey installation failed because it requires administrator privileges.

---

## 🚀 Alternative Installation Methods

### Option 1: Run PowerShell as Administrator
1. **Right-click PowerShell** → **"Run as Administrator"**
2. Run: `choco install docker-cli -y`
3. Set environment: `[Environment]::SetEnvironmentVariable("DOCKER_HOST", "tcp://192.168.1.45:2376", "User")`

### Option 2: Manual Download (No Admin Required)
1. **Download Docker CLI**: https://download.docker.com/win/static/stable/x86_64/docker-27.3.1.zip
2. **Extract** to folder: `C:\Users\kaidr\docker-cli\`
3. **Add to PATH**: Add `C:\Users\kaidr\docker-cli` to your user PATH
4. **Test**: Open new terminal → `docker --version`

### Option 3: Scoop Package Manager (User-Level)
```bash
# Install Scoop (if not installed)
iwr -useb get.scoop.sh | iex

# Install Docker CLI via Scoop (no admin needed)
scoop install docker

# Set environment variable
setx DOCKER_HOST "tcp://192.168.1.45:2376"
```

### Option 4: WSL2 Method
```bash
# In WSL2 Ubuntu
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Don't start daemon locally
sudo systemctl stop docker
sudo systemctl disable docker

# Set environment
echo 'export DOCKER_HOST=tcp://192.168.1.45:2376' >> ~/.bashrc
```

---

## 🎯 Recommended: Manual Download Method

**Step-by-step instructions:**

1. **Download Docker CLI binary:**
   - Go to: https://download.docker.com/win/static/stable/x86_64/
   - Download latest `docker-XX.X.X.zip`

2. **Extract and setup:**
   ```cmd
   # Create directory
   mkdir C:\Users\kaidr\docker-cli
   
   # Extract docker.exe to this folder
   # Add C:\Users\kaidr\docker-cli to your PATH
   ```

3. **Set environment variable:**
   ```cmd
   setx DOCKER_HOST "tcp://192.168.1.45:2376"
   ```

4. **Test connection:**
   ```cmd
   # Restart terminal
   docker --version
   docker -H tcp://192.168.1.45:2376 version
   ```

**This method requires no admin rights and gives you exactly what you need!**
