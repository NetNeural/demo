#!/bin/bash
# NetNeural Docker SSH Tunnel Connection Script with Auto-Discovery

# Configuration
REMOTE_HOST="192.168.1.45"
REMOTE_USER="root"
LOCAL_PORT="2375"  # Use standard Docker port locally

echo "==============================================="
echo "NetNeural Docker SSH Tunnel Setup"
echo "==============================================="

# Function to discover Docker port on remote server
discover_docker_port() {
    echo "🔍 Discovering Docker daemon port on remote server..."
    
    # SSH to remote and find Docker daemon port
    REMOTE_PORT=$(ssh -o ConnectTimeout=10 $REMOTE_USER@$REMOTE_HOST \
        "ps aux | grep dockerd | grep -o 'tcp://[^:]*:[0-9]*' | head -1 | cut -d: -f3" 2>/dev/null)
    
    if [ -z "$REMOTE_PORT" ]; then
        echo "❌ Could not discover Docker port. Trying alternative method..."
        
        # Alternative: check netstat for Docker daemon
        REMOTE_PORT=$(ssh -o ConnectTimeout=10 $REMOTE_USER@$REMOTE_HOST \
            "netstat -tlnp | grep dockerd | grep tcp | head -1 | awk '{print \$4}' | cut -d: -f2" 2>/dev/null)
    fi
    
    if [ -z "$REMOTE_PORT" ]; then
        echo "❌ Could not auto-discover Docker port. Falling back to standard port 2375"
        REMOTE_PORT="2375"
    else
        echo "✅ Discovered Docker daemon on port: $REMOTE_PORT"
    fi
}

# Function to check if SSH tunnel is already running
check_tunnel() {
    if lsof -i:$LOCAL_PORT > /dev/null 2>&1; then
        echo "✅ SSH tunnel already running on port $LOCAL_PORT"
        return 0
    elif netstat -ano | grep ":$LOCAL_PORT.*LISTENING" > /dev/null 2>&1; then
        echo "✅ SSH tunnel already running on port $LOCAL_PORT"
        return 0
    else
        return 1
    fi
}

# Function to establish SSH tunnel
establish_tunnel() {
    echo "🔗 Establishing SSH tunnel to Docker daemon..."
    echo "   Local:  localhost:$LOCAL_PORT"
    echo "   Remote: $REMOTE_HOST:$REMOTE_PORT"
    echo ""
    
    # Test SSH connectivity first
    echo "🧪 Testing SSH connectivity..."
    if ssh -o ConnectTimeout=5 -o BatchMode=yes $REMOTE_USER@$REMOTE_HOST echo "SSH OK" 2>/dev/null; then
        echo "✅ SSH connectivity confirmed"
    else
        echo "❌ SSH connectivity failed. Please check:"
        echo "   - SSH access to $REMOTE_USER@$REMOTE_HOST"
        echo "   - SSH keys are set up correctly"
        echo "   - Remote host is accessible"
        return 1
    fi
    
    # Check if Docker is actually running on discovered port
    echo "🐳 Verifying Docker daemon on remote port $REMOTE_PORT..."
    if ssh -o ConnectTimeout=10 $REMOTE_USER@$REMOTE_HOST "curl -s http://localhost:$REMOTE_PORT/version" >/dev/null 2>&1; then
        echo "✅ Docker daemon confirmed on port $REMOTE_PORT"
    else
        echo "⚠️ Docker daemon verification failed, but continuing..."
    fi
    
    # Establish tunnel in background
    echo "🚀 Starting SSH tunnel in background..."
    ssh -f -N -L $LOCAL_PORT:localhost:$REMOTE_PORT $REMOTE_USER@$REMOTE_HOST
    
    if [ $? -eq 0 ]; then
        sleep 2
        if check_tunnel; then
            echo "✅ SSH tunnel established successfully"
            
            # Set DOCKER_HOST environment variable
            export DOCKER_HOST="tcp://localhost:$LOCAL_PORT"
            echo "🔧 DOCKER_HOST set to: $DOCKER_HOST"
            
            # Test Docker connectivity
            echo "🧪 Testing Docker connectivity through tunnel..."
            if docker info > /dev/null 2>&1; then
                echo "✅ Docker connection successful!"
                echo "   Server: $(docker info 2>/dev/null | grep 'Server Version' | cut -d: -f2 | xargs)"
                echo "   Containers: $(docker ps -q | wc -l) running"
                return 0
            else
                echo "❌ Docker connection failed through tunnel"
                echo "💡 Try: export DOCKER_HOST=tcp://localhost:$LOCAL_PORT"
                return 1
            fi
        else
            echo "❌ SSH tunnel failed to establish"
            return 1
        fi
    else
        echo "❌ SSH tunnel command failed"
        return 1
    fi
}

# Function to stop existing tunnel
stop_tunnel() {
    echo "🛑 Stopping existing SSH tunnel..."
    
    # Kill SSH processes for this specific tunnel
    pkill -f "ssh.*$LOCAL_PORT:localhost:" 2>/dev/null || \
    powershell "Get-Process | Where-Object {$_.ProcessName -eq 'ssh' -and $_.CommandLine -like '*$LOCAL_PORT:localhost:*'} | Stop-Process -Force" 2>/dev/null || \
    taskkill /F /IM ssh.exe 2>/dev/null
    
    sleep 1
    if ! check_tunnel; then
        echo "✅ SSH tunnel stopped"
    else
        echo "⚠️ SSH tunnel may still be running"
    fi
}

# Function to check tunnel and Docker status
check_status() {
    echo "📊 Checking tunnel and Docker status..."
    
    if check_tunnel; then
        echo "✅ SSH tunnel is active on port $LOCAL_PORT"
        
        # Test Docker connectivity
        export DOCKER_HOST="tcp://localhost:$LOCAL_PORT"
        if docker info > /dev/null 2>&1; then
            echo "✅ Docker is accessible through tunnel"
            echo "   Containers running: $(docker ps -q 2>/dev/null | wc -l)"
            echo "   Images available: $(docker images -q 2>/dev/null | wc -l)"
        else
            echo "❌ Docker not accessible through tunnel"
            echo "💡 Try running: export DOCKER_HOST=tcp://localhost:$LOCAL_PORT"
        fi
    else
        echo "❌ SSH tunnel is not active"
    fi
}

# Main execution
case "${1:-start}" in
    "start")
        # Always discover the port first
        discover_docker_port
        
        if check_tunnel; then
            echo "ℹ️ SSH tunnel already active"
            export DOCKER_HOST="tcp://localhost:$LOCAL_PORT"
            echo "🔧 DOCKER_HOST set to: $DOCKER_HOST"
            check_status
        else
            establish_tunnel
        fi
        ;;
    "stop")
        stop_tunnel
        ;;
    "restart")
        discover_docker_port
        stop_tunnel
        sleep 2
        establish_tunnel
        ;;
    "status")
        check_status
        ;;
    "discover")
        discover_docker_port
        echo "Remote Docker port: $REMOTE_PORT"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|discover}"
        echo ""
        echo "Commands:"
        echo "  start    - Discover Docker port and start SSH tunnel (default)"
        echo "  stop     - Stop SSH tunnel"
        echo "  restart  - Discover port and restart SSH tunnel"
        echo "  status   - Check tunnel and Docker status"
        echo "  discover - Just discover and display Docker port"
        exit 1
        ;;
esac
