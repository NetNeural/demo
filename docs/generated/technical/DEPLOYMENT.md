# Deployment Guide

## Overview
This guide covers deployment strategies, environment setup, and operational procedures for the NetNeural platform across development, staging, and production environments.

## 🏗️ Architecture Overview

### Deployment Architecture
```
┌─────────────────────────────────────────────────┐
│                 Load Balancer                   │
├─────────────────────────────────────────────────┤
│                 API Gateway                     │
├─────────────────────────────────────────────────┤
│  Frontend Apps  │  Backend Services  │  Mobile  │
│  ┌────────────┐  │  ┌──────────────┐  │   APIs   │
│  │ origin-ui  │  │  │     sso      │  │          │
│  │ sso-ui     │  │  │ device-mgmt  │  │          │
│  │cellular-ui │  │  │    alerts    │  │          │
│  └────────────┘  │  │     data     │  │          │
│                  │  └──────────────┘  │          │
├─────────────────────────────────────────────────┤
│              Message Queue (MQTT)               │
├─────────────────────────────────────────────────┤
│    PostgreSQL    │    Redis Cache    │  Metrics │
│    Databases     │                   │  Storage │
└─────────────────────────────────────────────────┘
```

## 🌍 Environment Strategy

### Environment Tiers

#### Development Environment
- **Purpose**: Local development and testing
- **Infrastructure**: Docker Compose
- **Database**: Local PostgreSQL
- **Authentication**: Simplified JWT
- **Monitoring**: Basic logging

#### Staging Environment
- **Purpose**: Integration testing and QA
- **Infrastructure**: Kubernetes on DigitalOcean
- **Database**: Managed PostgreSQL
- **Authentication**: Full SSO implementation
- **Monitoring**: Prometheus + Grafana

#### Production Environment
- **Purpose**: Live user traffic
- **Infrastructure**: Multi-zone Kubernetes
- **Database**: High-availability PostgreSQL cluster
- **Authentication**: Production SSO with 2FA
- **Monitoring**: Full observability stack

---

## 🚀 Deployment Methods

### 1. Local Development Deployment

#### Prerequisites
```bash
# Install required tools
docker --version
docker-compose --version
git --version
make --version
```

#### Quick Start
```bash
# Clone the monorepo
git clone https://github.com/NetNeural/SoftwareMono.git
cd SoftwareMono

# Start local infrastructure
make dev-infra-up

# Build and start all services
make dev-start

# Access applications
echo "Origin UI: http://localhost:3000"
echo "SSO UI: http://localhost:3001"
echo "API Gateway: http://localhost:8080"
```

#### Docker Compose Configuration
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # Infrastructure
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: netneural_dev
      POSTGRES_USER: netneural
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
      
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./config/mosquitto.conf:/mosquitto/config/mosquitto.conf
      
  # Backend Services
  sso:
    build: ./sso
    ports:
      - "8081:8080"
    environment:
      - DB_HOST=postgres
      - DB_PASSWORD=dev_password
      - JWT_SECRET=dev_secret
    depends_on:
      - postgres
      - redis
      
  device-ingress:
    build: ./device-ingress
    ports:
      - "8082:8080"
    environment:
      - DB_HOST=postgres
      - MQTT_BROKER=mosquitto:1883
    depends_on:
      - postgres
      - mosquitto
      
  # Frontend Applications
  origin-ui:
    build: 
      context: ./origin-ui
      target: development
    ports:
      - "3000:3000"
    volumes:
      - ./origin-ui/src:/app/src
    environment:
      - VITE_API_BASE_URL=http://localhost:8080
      
volumes:
  postgres_data:
```

#### Makefile Commands
```makefile
# Makefile
.PHONY: dev-infra-up dev-infra-down dev-start dev-stop dev-logs

dev-infra-up:
	docker-compose -f docker-compose.dev.yml up -d postgres redis mosquitto

dev-infra-down:
	docker-compose -f docker-compose.dev.yml down

dev-start:
	docker-compose -f docker-compose.dev.yml up -d

dev-stop:
	docker-compose -f docker-compose.dev.yml down

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

dev-clean:
	docker-compose -f docker-compose.dev.yml down -v
	docker system prune -f
```

---

### 2. Staging Deployment

#### Infrastructure Setup
```bash
# Create DigitalOcean Kubernetes cluster
doctl kubernetes cluster create netneural-staging \
  --region nyc3 \
  --node-pool "name=staging-nodes;size=s-2vcpu-4gb;count=2"

# Configure kubectl
doctl kubernetes cluster kubeconfig save netneural-staging

# Install required components
kubectl apply -f k8s/staging/namespace.yaml
kubectl apply -f k8s/staging/secrets.yaml
kubectl apply -f k8s/staging/configmaps.yaml
```

#### Kubernetes Manifests

##### Namespace and Base Configuration
```yaml
# k8s/staging/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: netneural-staging
  labels:
    environment: staging

---
# k8s/staging/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: database-secret
  namespace: netneural-staging
type: Opaque
stringData:
  host: "staging-postgres.internal"
  username: "netneural_staging"
  password: "staging_secure_password"
  database: "netneural_staging"

---
apiVersion: v1
kind: Secret
metadata:
  name: jwt-secret
  namespace: netneural-staging
type: Opaque
stringData:
  secret: "staging_jwt_secret_key_very_long"
```

##### Database Deployment
```yaml
# k8s/staging/postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: netneural-staging
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_DB
          value: netneural_staging
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "512Mi"
            cpu: "200m"
          limits:
            memory: "1Gi"
            cpu: "500m"
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi

---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: netneural-staging
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

##### Service Deployments
```yaml
# k8s/staging/sso.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sso
  namespace: netneural-staging
spec:
  replicas: 2
  selector:
    matchLabels:
      app: sso
  template:
    metadata:
      labels:
        app: sso
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: sso
        image: ghcr.io/netneural/sso:staging
        ports:
        - containerPort: 8080
        env:
        - name: ENVIRONMENT
          value: "staging"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: host
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: password
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
apiVersion: v1
kind: Service
metadata:
  name: sso
  namespace: netneural-staging
spec:
  selector:
    app: sso
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

#### Deployment Script
```bash
#!/bin/bash
# scripts/deploy-staging.sh

set -e

NAMESPACE="netneural-staging"
IMAGE_TAG=${1:-latest}

echo "Deploying to staging environment..."

# Update image tags
kubectl set image deployment/sso sso=ghcr.io/netneural/sso:$IMAGE_TAG -n $NAMESPACE
kubectl set image deployment/device-ingress device-ingress=ghcr.io/netneural/device-ingress:$IMAGE_TAG -n $NAMESPACE

# Wait for rollouts
kubectl rollout status deployment/sso -n $NAMESPACE
kubectl rollout status deployment/device-ingress -n $NAMESPACE

# Run database migrations
kubectl run migration-job --image=ghcr.io/netneural/migrations:$IMAGE_TAG \
  --restart=Never --rm -i -n $NAMESPACE \
  --env="DB_HOST=postgres" \
  --env="DB_NAME=netneural_staging"

echo "Staging deployment completed!"
```

---

### 3. Production Deployment

#### High Availability Setup
```yaml
# k8s/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: netneural-prod

resources:
- namespace.yaml
- secrets.yaml
- postgres-cluster.yaml
- redis-cluster.yaml
- ingress.yaml
- services/

patchesStrategicMerge:
- production-overrides.yaml

images:
- name: ghcr.io/netneural/sso
  newTag: v1.2.3
- name: ghcr.io/netneural/device-ingress
  newTag: v1.2.3
```

#### Production PostgreSQL Cluster
```yaml
# k8s/production/postgres-cluster.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres-cluster
  namespace: netneural-prod
spec:
  instances: 3
  
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "256MB"
      effective_cache_size: "1GB"
      
  bootstrap:
    initdb:
      database: netneural_prod
      owner: netneural
      secret:
        name: postgres-credentials
        
  storage:
    size: 100Gi
    storageClass: do-block-storage
    
  monitoring:
    enabled: true
    
  backup:
    retentionPolicy: "30d"
    barmanObjectStore:
      destinationPath: "s3://netneural-backups/postgres"
      s3Credentials:
        accessKeyId:
          name: backup-credentials
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: backup-credentials
          key: SECRET_ACCESS_KEY
      wal:
        retention: "7d"
      data:
        retention: "30d"
```

#### Auto-scaling Configuration
```yaml
# k8s/production/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: sso-hpa
  namespace: netneural-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: sso
  minReplicas: 3
  maxReplicas: 20
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
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Production Pipeline
```yaml
# .github/workflows/production-deploy.yml
name: Production Deployment

on:
  push:
    tags:
      - 'v*'

env:
  REGISTRY: ghcr.io

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Run security scan
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
        
    - name: Upload scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'
        
  build-and-test:
    runs-on: ubuntu-latest
    needs: security-scan
    strategy:
      matrix:
        service: [sso, device-ingress, data-manager, alert-listener]
        
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.24'
        
    - name: Run tests
      run: |
        cd ${{ matrix.service }}
        go test -v -race -coverprofile=coverage.out ./...
        
    - name: Build and push image
      uses: docker/build-push-action@v4
      with:
        context: ./${{ matrix.service }}
        push: true
        tags: ${{ env.REGISTRY }}/netneural/${{ matrix.service }}:${{ github.ref_name }}
        
  deploy-production:
    runs-on: ubuntu-latest
    needs: build-and-test
    environment: production
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure kubectl
      uses: azure/k8s-set-context@v1
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG_PROD }}
        
    - name: Deploy with Kustomize
      run: |
        cd k8s/production
        kustomize edit set image ghcr.io/netneural/sso:${{ github.ref_name }}
        kustomize edit set image ghcr.io/netneural/device-ingress:${{ github.ref_name }}
        kubectl apply -k .
        
    - name: Wait for rollout
      run: |
        kubectl rollout status deployment/sso -n netneural-prod
        kubectl rollout status deployment/device-ingress -n netneural-prod
        
    - name: Run smoke tests
      run: |
        kubectl run smoke-test --image=ghcr.io/netneural/smoke-tests:${{ github.ref_name }} \
          --restart=Never --rm -i -n netneural-prod
```

---

## 📊 Monitoring and Alerting

### Prometheus Configuration
```yaml
# monitoring/prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      
    alerting:
      alertmanagers:
      - static_configs:
        - targets:
          - alertmanager:9093
          
    rule_files:
    - "/etc/prometheus/rules/*.yml"
    
    scrape_configs:
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
          - netneural-prod
          - netneural-staging
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
```

### Alert Rules
```yaml
# monitoring/alert-rules.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alert-rules
  namespace: monitoring
data:
  netneural.yml: |
    groups:
    - name: netneural.rules
      rules:
      - alert: ServiceDown
        expr: up{job="kubernetes-pods"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.kubernetes_pod_name }} is down"
          
      - alert: HighMemoryUsage
        expr: (container_memory_usage_bytes / container_spec_memory_limit_bytes) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.pod }}"
          
      - alert: DatabaseConnectionFailure
        expr: increase(database_connection_errors_total[5m]) > 5
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failures detected"
```

---

## 🔒 Security Deployment

### Network Policies
```yaml
# k8s/security/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: netneural-network-policy
  namespace: netneural-prod
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
      port: 5432
    - protocol: TCP
      port: 1883
```

### Pod Security Standards
```yaml
# k8s/security/pod-security.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: netneural-prod
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Service Account and RBAC
```yaml
# k8s/security/rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: netneural-service-account
  namespace: netneural-prod

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: netneural-role
  namespace: netneural-prod
rules:
- apiGroups: [""]
  resources: ["secrets", "configmaps"]
  verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: netneural-role-binding
  namespace: netneural-prod
subjects:
- kind: ServiceAccount
  name: netneural-service-account
  namespace: netneural-prod
roleRef:
  kind: Role
  name: netneural-role
  apiGroup: rbac.authorization.k8s.io
```

---

## 🔧 Operational Procedures

### Database Migrations
```bash
#!/bin/bash
# scripts/run-migrations.sh

ENVIRONMENT=${1:-staging}
NAMESPACE="netneural-${ENVIRONMENT}"

echo "Running database migrations for ${ENVIRONMENT}..."

kubectl run db-migration-$(date +%s) \
  --image=ghcr.io/netneural/migrations:latest \
  --restart=Never \
  --rm -i \
  --namespace=$NAMESPACE \
  --env="ENVIRONMENT=${ENVIRONMENT}" \
  -- migrate up

echo "Migrations completed!"
```

### Rolling Updates
```bash
#!/bin/bash
# scripts/rolling-update.sh

SERVICE=$1
VERSION=$2
ENVIRONMENT=${3:-production}
NAMESPACE="netneural-${ENVIRONMENT}"

if [ -z "$SERVICE" ] || [ -z "$VERSION" ]; then
  echo "Usage: $0 <service> <version> [environment]"
  exit 1
fi

echo "Rolling update of $SERVICE to version $VERSION in $ENVIRONMENT..."

# Update deployment
kubectl set image deployment/$SERVICE $SERVICE=ghcr.io/netneural/$SERVICE:$VERSION -n $NAMESPACE

# Wait for rollout
kubectl rollout status deployment/$SERVICE -n $NAMESPACE --timeout=300s

# Verify deployment
kubectl get pods -n $NAMESPACE -l app=$SERVICE

echo "Rolling update completed!"
```

### Backup Procedures
```bash
#!/bin/bash
# scripts/backup.sh

ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/backups"

echo "Creating backup for ${ENVIRONMENT} environment..."

# Database backup
kubectl exec -n netneural-${ENVIRONMENT} postgres-cluster-1 -- \
  pg_dump -U postgres netneural_${ENVIRONMENT} > ${BACKUP_DIR}/db_${ENVIRONMENT}_${TIMESTAMP}.sql

# Upload to S3
aws s3 cp ${BACKUP_DIR}/db_${ENVIRONMENT}_${TIMESTAMP}.sql \
  s3://netneural-backups/${ENVIRONMENT}/database/

# Clean up local backup
rm ${BACKUP_DIR}/db_${ENVIRONMENT}_${TIMESTAMP}.sql

echo "Backup completed and uploaded to S3"
```

### Disaster Recovery
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

ENVIRONMENT=${1:-production}
BACKUP_DATE=${2:-latest}

echo "Starting disaster recovery for ${ENVIRONMENT}..."

# Restore database from backup
if [ "$BACKUP_DATE" = "latest" ]; then
  BACKUP_FILE=$(aws s3 ls s3://netneural-backups/${ENVIRONMENT}/database/ | sort | tail -n 1 | awk '{print $4}')
else
  BACKUP_FILE="db_${ENVIRONMENT}_${BACKUP_DATE}.sql"
fi

echo "Restoring from backup: $BACKUP_FILE"

# Download backup
aws s3 cp s3://netneural-backups/${ENVIRONMENT}/database/$BACKUP_FILE /tmp/

# Restore database
kubectl exec -i -n netneural-${ENVIRONMENT} postgres-cluster-1 -- \
  psql -U postgres netneural_${ENVIRONMENT} < /tmp/$BACKUP_FILE

# Restart services
kubectl rollout restart deployment -n netneural-${ENVIRONMENT}

echo "Disaster recovery completed!"
```

---

## 📋 Deployment Checklist

### Pre-deployment Checklist
- [ ] All tests passing in CI/CD pipeline
- [ ] Security scans completed with no critical issues
- [ ] Database migrations tested in staging
- [ ] Configuration secrets updated
- [ ] Monitoring alerts configured
- [ ] Backup procedures verified
- [ ] Rollback plan prepared

### Deployment Steps
1. **Tag Release**: Create git tag for version
2. **CI/CD Pipeline**: Automated build and test
3. **Security Review**: Final security validation
4. **Database Migration**: Run migrations if needed
5. **Service Deployment**: Rolling update of services
6. **Health Checks**: Verify all services healthy
7. **Smoke Tests**: Run production smoke tests
8. **Monitor**: Watch metrics and logs

### Post-deployment Checklist
- [ ] All services responding to health checks
- [ ] Key metrics within normal ranges
- [ ] No error spikes in logs
- [ ] Database connections stable
- [ ] External integrations working
- [ ] User-facing features functional
- [ ] Backup verification completed

---

## 🚨 Troubleshooting

### Common Deployment Issues

#### Pod Startup Failures
```bash
# Check pod status
kubectl get pods -n netneural-prod

# Describe problematic pod
kubectl describe pod <pod-name> -n netneural-prod

# Check logs
kubectl logs <pod-name> -n netneural-prod --previous
```

#### Service Discovery Issues
```bash
# Check services
kubectl get svc -n netneural-prod

# Check endpoints
kubectl get endpoints -n netneural-prod

# Test service connectivity
kubectl run debug --image=nicolaka/netshoot --rm -it -n netneural-prod -- nslookup sso
```

#### Database Connection Issues
```bash
# Check database pod
kubectl get pods -n netneural-prod -l app=postgres

# Test database connection
kubectl run pgclient --image=postgres:15 --rm -it -n netneural-prod -- \
  psql -h postgres -U netneural -d netneural_prod
```

#### Performance Issues
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n netneural-prod

# Check HPA status
kubectl get hpa -n netneural-prod

# Scale manually if needed
kubectl scale deployment sso --replicas=5 -n netneural-prod
```

---

## 📈 Performance Optimization

### Resource Tuning
```yaml
# Optimized resource requests/limits
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Database Optimization
```sql
-- Common PostgreSQL optimizations
-- In postgresql.conf
shared_buffers = '256MB'
effective_cache_size = '1GB'
maintenance_work_mem = '64MB'
checkpoint_completion_target = 0.9
wal_buffers = '16MB'
default_statistics_target = 100
```

### Caching Strategy
```yaml
# Redis configuration for caching
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
data:
  redis.conf: |
    maxmemory 256mb
    maxmemory-policy allkeys-lru
    save 900 1
    save 300 10
    save 60 10000
```

This comprehensive deployment guide covers all aspects of deploying and maintaining the NetNeural platform across different environments. It includes practical scripts, configurations, and procedures for successful operations.
