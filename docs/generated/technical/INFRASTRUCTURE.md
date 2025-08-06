# Infrastructure & DevOps Documentation

## Overview
NetNeural's infrastructure includes deployment templates, CI/CD automation, development tools, and Kubernetes configurations supporting the entire IoT platform ecosystem.

## Infrastructure Components

### 🐳 Container & Build Templates

#### docker-build-template/ - Docker Build Templates
**Purpose**: Standardized Docker build configurations for all NetNeural services

**Technology**: Docker, GitHub Actions
**Features**:
- Multi-stage builds for optimized container size
- Language-specific base images (Go, Node.js, Python)
- Security scanning integration
- Multi-architecture builds (AMD64, ARM64)
- Build caching strategies

**Template Structure**:
```dockerfile
# Multi-stage Dockerfile template
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
```

**GitHub Actions Workflow**:
```yaml
# .github/workflows/build.yml
name: Build and Push
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
      
    - name: Login to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
        
    - name: Build and push
      uses: docker/build-push-action@v4
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        tags: ghcr.io/netneural/${{ vars.DOCKER_IMAGE_NAME }}:latest
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

**Environment Variables**:
- `CONTAINER_GROUP`: Container registry group
- `DOCKER_IMAGE_NAME`: Specific image name
- `NN_TOKEN`: NetNeural private repository access token
- Build arguments for application-specific configuration

---

### ☸️ Kubernetes & Cloud Infrastructure

#### digital-ocean-k8s-setup/ - Kubernetes Setup Scripts
**Purpose**: Automated Kubernetes cluster setup on DigitalOcean

**Features**:
- Cluster provisioning automation
- Load balancer configuration
- Ingress controller setup
- SSL certificate management
- Monitoring and logging stack installation

**Setup Scripts**:
```bash
#!/bin/bash
# cluster-setup.sh

# Create DigitalOcean Kubernetes cluster
doctl kubernetes cluster create netneural-cluster \
  --region nyc1 \
  --node-pool "name=worker-pool;size=s-2vcpu-2gb;count=3;auto-scale=true;min-nodes=1;max-nodes=10"

# Install ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/do/deploy.yaml

# Install cert-manager for SSL
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml

# Apply NetNeural-specific configurations
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmaps.yaml
```

**Kubernetes Manifests**:
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: netneural
  labels:
    name: netneural

---
# k8s/sso-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sso-service
  namespace: netneural
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sso
  template:
    metadata:
      labels:
        app: sso
    spec:
      containers:
      - name: sso
        image: ghcr.io/netneural/sso:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: host
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5

---
# k8s/sso-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: sso-service
  namespace: netneural
spec:
  selector:
    app: sso
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: netneural-ingress
  namespace: netneural
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.netneural.com
    secretName: netneural-tls
  rules:
  - host: api.netneural.com
    http:
      paths:
      - path: /auth
        pathType: Prefix
        backend:
          service:
            name: sso-service
            port:
              number: 80
```

**Monitoring Stack**:
```yaml
# k8s/monitoring/prometheus.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: netneural
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        args:
        - --config.file=/etc/prometheus/prometheus.yml
        - --storage.tsdb.path=/prometheus/
        - --web.console.libraries=/etc/prometheus/console_libraries
        - --web.console.templates=/etc/prometheus/consoles
        - --web.enable-lifecycle
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: config-volume
          mountPath: /etc/prometheus/
        - name: storage-volume
          mountPath: /prometheus/
      volumes:
      - name: config-volume
        configMap:
          name: prometheus-config
      - name: storage-volume
        emptyDir: {}
```

---

### 🔧 Development Tools

#### action-get-latest-tag/ - GitHub Actions Utility
**Purpose**: GitHub Action for retrieving the latest Git tag

**Features**:
- Retrieves latest semantic version tag
- Supports pre-release filtering
- Compatible with GitHub Actions workflows
- Handles repository without tags gracefully

**Action Definition**:
```yaml
# action.yml
name: 'Get Latest Tag'
description: '✨ GitHub Action to get a latest Git tag'
branding:
  icon: 'tag'
  color: 'blue'

inputs:
  semver_only:
    description: 'Whether to get only semantic version tags'
    required: false
    default: 'false'
  initial_version:
    description: 'Initial version if no tags exist'
    required: false
    default: 'v0.0.0'

outputs:
  tag:
    description: 'The latest tag'
    value: ${{ steps.get-tag.outputs.tag }}

runs:
  using: 'composite'
  steps:
  - id: get-tag
    run: |
      if [ "${{ inputs.semver_only }}" = "true" ]; then
        tag=$(git tag -l | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
      else
        tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "${{ inputs.initial_version }}")
      fi
      echo "tag=${tag}" >> $GITHUB_OUTPUT
    shell: bash
```

**Usage Example**:
```yaml
# In any workflow
- name: Get Latest Tag
  id: tag
  uses: NetNeural/action-get-latest-tag@v1
  with:
    semver_only: 'true'
    initial_version: 'v1.0.0'

- name: Use Tag
  run: echo "Latest tag is ${{ steps.tag.outputs.tag }}"
```

#### test-stripe-backend/ - Payment Testing Backend
**Purpose**: Backend service for testing Stripe payment integration

**Technology**: Node.js, Express, Stripe API
**Features**:
- Stripe webhook handling
- Payment intent creation and confirmation
- Test payment scenarios
- Payment method management
- Subscription testing

**API Endpoints**:
```javascript
// routes/payments.js
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// Create payment intent
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency,
      metadata: {
        order_id: req.body.order_id
      }
    });
    
    res.send({
      client_secret: paymentIntent.client_secret
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Handle Stripe webhooks
router.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed.`);
  }
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Payment succeeded:', paymentIntent.id);
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Payment failed:', failedPayment.id);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  res.json({received: true});
});

module.exports = router;
```

---

### 🔗 Integration & Development Services

#### dev-coap-server-californium/ - CoAP Server Development
**Purpose**: CoAP (Constrained Application Protocol) server for IoT development

**Technology**: Java, Eclipse Californium
**Features**:
- CoAP protocol implementation
- Resource discovery and observation
- DTLS security support
- Blockwise transfer
- Integration with NetNeural IoT devices

**CoAP Server Implementation**:
```java
// CoAPServer.java
import org.eclipse.californium.core.CoapServer;
import org.eclipse.californium.core.server.resources.CoapExchange;
import org.eclipse.californium.core.server.resources.Resource;

public class NetNeuralCoapServer extends CoapServer {
    
    public NetNeuralCoapServer() {
        // Add resources
        add(new DeviceResource("devices"));
        add(new TelemetryResource("telemetry"));
        add(new CommandResource("commands"));
    }
    
    class DeviceResource extends Resource {
        public DeviceResource(String name) {
            super(name);
            setObservable(true);
        }
        
        @Override
        public void handleGET(CoapExchange exchange) {
            // Return device list
            String deviceList = getDeviceList();
            exchange.respond(deviceList);
        }
        
        @Override
        public void handlePOST(CoapExchange exchange) {
            // Register new device
            String deviceData = exchange.getRequestText();
            boolean success = registerDevice(deviceData);
            
            if (success) {
                exchange.respond(ResponseCode.CREATED, "Device registered");
            } else {
                exchange.respond(ResponseCode.BAD_REQUEST, "Registration failed");
            }
        }
    }
}
```

#### merchandising/ - E-commerce Backend
**Purpose**: E-commerce functionality for NetNeural product sales

**Technology**: Go, Gin, GORM
**Features**:
- Product catalog management
- Order processing
- Inventory tracking
- Payment integration
- Shipping calculations

**Product Management**:
```go
// models/product.go
type Product struct {
    ID          string  `json:"id" gorm:"primaryKey"`
    Name        string  `json:"name"`
    Description string  `json:"description"`
    Price       float64 `json:"price"`
    SKU         string  `json:"sku" gorm:"unique"`
    Stock       int     `json:"stock"`
    Category    string  `json:"category"`
    Images      []Image `json:"images" gorm:"foreignKey:ProductID"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

// handlers/products.go
func GetProducts(c *gin.Context) {
    var products []Product
    db.Preload("Images").Find(&products)
    c.JSON(200, products)
}

func CreateProduct(c *gin.Context) {
    var product Product
    if err := c.ShouldBindJSON(&product); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    db.Create(&product)
    c.JSON(201, product)
}
```

#### hydrant/ - System Utilities
**Purpose**: System maintenance and utility tools

**Technology**: Go
**Features**:
- Database migration scripts
- Health check utilities
- Performance monitoring tools
- Data cleanup routines
- System diagnostics

**Database Migration Tool**:
```go
// migrations/migrator.go
package migrations

import (
    "fmt"
    "gorm.io/gorm"
)

type Migration struct {
    ID          uint   `gorm:"primaryKey"`
    Version     string `gorm:"unique"`
    Description string
    AppliedAt   time.Time
}

type Migrator struct {
    db *gorm.DB
}

func NewMigrator(db *gorm.DB) *Migrator {
    return &Migrator{db: db}
}

func (m *Migrator) RunMigrations() error {
    // Ensure migration table exists
    m.db.AutoMigrate(&Migration{})
    
    migrations := []struct {
        Version string
        Desc    string
        Func    func(*gorm.DB) error
    }{
        {"20250101_001", "Create users table", createUsersTable},
        {"20250101_002", "Create devices table", createDevicesTable},
        {"20250101_003", "Add indexes", addIndexes},
    }
    
    for _, migration := range migrations {
        if !m.isApplied(migration.Version) {
            if err := migration.Func(m.db); err != nil {
                return fmt.Errorf("failed to apply migration %s: %v", migration.Version, err)
            }
            
            m.recordMigration(migration.Version, migration.Desc)
            fmt.Printf("Applied migration: %s - %s\n", migration.Version, migration.Desc)
        }
    }
    
    return nil
}
```

## CI/CD Pipelines

### GitHub Actions Workflows

#### Standard Service Pipeline
```yaml
# .github/workflows/service-ci.yml
name: Service CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.24'
        
    - name: Cache Go modules
      uses: actions/cache@v3
      with:
        path: ~/go/pkg/mod
        key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
        
    - name: Download dependencies
      run: go mod download
      
    - name: Run tests
      run: go test -v -race -coverprofile=coverage.out ./...
      env:
        DB_HOST: localhost
        DB_PORT: 5432
        DB_NAME: postgres
        DB_USER: postgres
        DB_PASSWORD: postgres
        
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.out
        
  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      
    steps:
    - name: Checkout repository
      uses: actions/checkout@v3
      
    - name: Get latest tag
      id: tag
      uses: NetNeural/action-get-latest-tag@v1
      
    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
        
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}},value=${{ steps.tag.outputs.tag }}
          type=semver,pattern={{major}}.{{minor}},value=${{ steps.tag.outputs.tag }}
          
    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        
  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - name: Deploy to Kubernetes
      uses: azure/k8s-deploy@v1
      with:
        manifests: |
          k8s/deployment.yaml
          k8s/service.yaml
        images: |
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
        kubeconfig: ${{ secrets.KUBE_CONFIG }}
```

#### Frontend Pipeline
```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run linting
      run: npm run lint
      
    - name: Run tests
      run: npm test -- --coverage --watchAll=false
      
    - name: Build application
      run: npm run build
      
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: build-files
        path: dist/
        
  build-storybook:
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.modified, 'src/components/')
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build Storybook
      run: npm run build-storybook
      
    - name: Deploy Storybook
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./storybook-static
        destination_dir: storybook
```

## Monitoring & Observability

### Prometheus Configuration
```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
  - static_configs:
    - targets:
      - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
    - targets: ['localhost:9090']
    
  - job_name: 'netneural-services'
    kubernetes_sd_configs:
    - role: pod
      namespaces:
        names:
        - netneural
    relabel_configs:
    - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
      action: keep
      regex: true
    - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
      action: replace
      target_label: __metrics_path__
      regex: (.+)
    - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
      action: replace
      regex: ([^:]+)(?::\d+)?;(\d+)
      replacement: $1:$2
      target_label: __address__
    - action: labelmap
      regex: __meta_kubernetes_pod_label_(.+)
    - source_labels: [__meta_kubernetes_namespace]
      action: replace
      target_label: kubernetes_namespace
    - source_labels: [__meta_kubernetes_pod_name]
      action: replace
      target_label: kubernetes_pod_name
```

### Grafana Dashboards
```json
{
  "dashboard": {
    "title": "NetNeural Services Overview",
    "panels": [
      {
        "title": "Service Health",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"netneural-services\"}",
            "legendFormat": "{{kubernetes_pod_name}}"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(gin_requests_total[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(gin_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(gin_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      }
    ]
  }
}
```

### Alerting Rules
```yaml
# prometheus/rules/netneural.yml
groups:
- name: netneural.rules
  rules:
  - alert: ServiceDown
    expr: up{job="netneural-services"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Service {{ $labels.kubernetes_pod_name }} is down"
      description: "Service {{ $labels.kubernetes_pod_name }} has been down for more than 1 minute."
      
  - alert: HighErrorRate
    expr: rate(gin_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors per second."
      
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(gin_request_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }} seconds."
```

## Security & Compliance

### Security Scanning
```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  security-scan:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
        
    - name: Upload Trivy scan results to GitHub Security tab
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'
        
    - name: Run Gosec Security Scanner
      uses: securecodewarrior/github-action-gosec@master
      with:
        args: ./...
```

### Network Policies
```yaml
# k8s/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: netneural-network-policy
  namespace: netneural
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    - podSelector:
        matchLabels:
          app: prometheus
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
  - to: []
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 1883  # MQTT
```

## Backup & Disaster Recovery

### Database Backup
```bash
#!/bin/bash
# scripts/backup-database.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="netneural"

# Create backup
kubectl exec -n netneural postgres-0 -- pg_dump -U postgres $DB_NAME > $BACKUP_DIR/db_backup_$TIMESTAMP.sql

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/db_backup_$TIMESTAMP.sql s3://netneural-backups/database/

# Cleanup old backups (keep last 30 days)
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +30 -delete
```

### Kubernetes Backup
```yaml
# k8s/backup/velero-backup.yaml
apiVersion: velero.io/v1
kind: Backup
metadata:
  name: netneural-backup
  namespace: velero
spec:
  includedNamespaces:
  - netneural
  excludedResources:
  - events
  - events.events.k8s.io
  storageLocation: default
  volumeSnapshotLocations:
  - default
  ttl: 720h0m0s  # 30 days
```

## Performance Optimization

### Resource Optimization
```yaml
# k8s/resource-optimization.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: netneural-limits
  namespace: netneural
spec:
  limits:
  - default:
      cpu: "200m"
      memory: "256Mi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
    type: Container
    
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: netneural-pdb
  namespace: netneural
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: sso
```

### Horizontal Pod Autoscaler
```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: sso-hpa
  namespace: netneural
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: sso-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Troubleshooting & Debugging

### Common Issues

1. **Pod Startup Issues**:
   ```bash
   kubectl describe pod -n netneural <pod-name>
   kubectl logs -n netneural <pod-name> --previous
   ```

2. **Service Discovery Issues**:
   ```bash
   kubectl get endpoints -n netneural
   kubectl exec -n netneural <pod-name> -- nslookup <service-name>
   ```

3. **Resource Constraints**:
   ```bash
   kubectl top nodes
   kubectl top pods -n netneural
   ```

4. **Network Issues**:
   ```bash
   kubectl exec -n netneural <pod-name> -- curl <service-name>:80/health
   kubectl get networkpolicies -n netneural
   ```

### Debug Tools
```bash
# Deploy debug pod
kubectl run debug --image=nicolaka/netshoot -n netneural --rm -it -- /bin/bash

# Port forwarding for local debugging
kubectl port-forward -n netneural svc/sso-service 8080:80

# Access logs
kubectl logs -n netneural deployment/sso-service -f
```

## Future Enhancements

### Planned Infrastructure Improvements
- **Service Mesh**: Istio implementation for advanced traffic management
- **GitOps**: ArgoCD for declarative configuration management
- **Multi-Cloud**: Support for AWS, Azure, and GCP deployments
- **Edge Computing**: K3s clusters for edge device management
- **AI/ML Pipeline**: Kubeflow for machine learning workflows

### Automation Enhancements
- **Infrastructure as Code**: Terraform modules for cloud resources
- **Policy as Code**: Open Policy Agent (OPA) for governance
- **Chaos Engineering**: Chaos Monkey for resilience testing
- **Cost Optimization**: Automated resource scaling based on usage patterns
