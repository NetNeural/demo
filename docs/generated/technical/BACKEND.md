# Backend Services Documentation

## Overview
The NetNeural platform consists of 30 Go-based microservices providing core functionality for IoT device management, data processing, authentication, and real-time communications.

## Technology Stack
- **Language**: Go 1.24+
- **Web Framework**: Gin (gin-gonic/gin)
- **Database**: PostgreSQL, MySQL (GORM ORM)
- **Authentication**: JWT (golang-jwt/jwt)
- **Messaging**: MQTT (Eclipse Paho)
- **Monitoring**: Prometheus metrics
- **API**: REST with OpenAPI specifications
- **Common Library**: `github.com/NetNeural/iot-common/v5`

## Service Categories

### 🔐 Core Authentication Services

#### sso/ - Single Sign-On Service
**Purpose**: Central authentication service for the entire platform

**Key Features**:
- JWT token generation and validation
- User authentication and authorization
- Session management
- Password security (bcrypt)

**Dependencies**:
- `iot-common/v5`: Common types and utilities
- `gin-gonic/gin`: Web framework
- `golang-jwt/jwt/v5`: JWT implementation
- `google/uuid`: UUID generation

**API Endpoints**:
```go
POST /auth/login     // User authentication
POST /auth/refresh   // Token refresh
POST /auth/logout    // Session termination
GET  /auth/validate  // Token validation
```

**Configuration**:
```bash
export JWT_SECRET="your-secret-key"
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="sso_db"
```

#### account-manager/ - Account Management
**Purpose**: User account lifecycle management

**Features**:
- User profile management
- Account creation and updates
- OpenAPI code generation
- Account verification

**Development**:
```bash
cd account-manager
go get -tool github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
go mod tidy
go run main.go
```

---

### 💾 Data Management Services

#### data-manager/ - Core Data Processing
**Purpose**: Central data processing and storage service

**Key Features**:
- Data ingestion pipeline
- Data transformation and validation
- Database operations
- Data archival

#### cloud-data-manager/ - Cloud Data Operations
**Purpose**: Cloud-specific data management operations

**Features**:
- Cloud storage integration
- Data synchronization
- Backup and recovery
- Multi-region data replication

#### device-ingress/ - Device Data Ingestion
**Purpose**: Handles incoming data from IoT devices

**Key Features**:
- High-throughput data ingestion
- Protocol translation (MQTT, HTTP, CoAP)
- Data validation and routing
- Rate limiting and buffering

**Data Flow**:
```
IoT Devices → device-ingress → data-manager → digital-twin
```

#### api-slurper/ - API Data Aggregation
**Purpose**: Aggregates data from external APIs

**Features**:
- External API integration
- Data normalization
- Scheduled data pulls
- Error handling and retry logic

#### mqtt2db/ - MQTT to Database Bridge
**Purpose**: Bridges MQTT messages to database storage

**Key Features**:
- MQTT topic subscription
- Message parsing and transformation
- Database insertion with batching
- Dead letter queue handling

#### recall-ingest/ - Recall Data Processing
**Purpose**: Processes device recall and safety data

---

### 🌐 Device & IoT Management

#### digital-twin/ - Digital Twin Implementation
**Purpose**: Maintains digital representations of physical devices

**Key Features**:
- Real-time device state synchronization
- Historical state tracking
- Device simulation capabilities
- Predictive analytics

**Architecture**:
```go
type DigitalTwin struct {
    DeviceID    string                 `json:"device_id"`
    State       map[string]interface{} `json:"state"`
    LastUpdated time.Time             `json:"last_updated"`
    Metadata    DeviceMetadata        `json:"metadata"`
}
```

#### cellular-manager/ - Cellular Device Management
**Purpose**: Manages cellular IoT devices

**Features**:
- Cellular modem configuration
- Signal strength monitoring
- Data usage tracking
- SIM card management

#### cellular-gateway/ - Cellular Communication Gateway
**Purpose**: Gateway for cellular device communications

**Features**:
- Protocol bridging
- Message routing
- Connection pooling
- Failover handling

#### edge-vmark-input/ - Edge Device Input Processing
**Purpose**: Processes input from edge computing devices

**Features**:
- Edge data preprocessing
- Local decision making
- Bandwidth optimization
- Offline operation support

---

### 🚨 Alert & Notification Systems

#### alert-listener/ - Alert Processing Service
**Purpose**: Central alert processing and routing

**Key Features**:
- Real-time alert processing
- Alert classification and prioritization
- Rule-based routing
- Integration with notification systems

**Alert Types**:
- Device offline alerts
- Threshold violations
- System health alerts
- Security incidents

**Configuration**:
```yaml
alert_rules:
  - name: "device_offline"
    condition: "last_seen > 5m"
    severity: "warning"
    action: "notify"
```

#### alerts-bfu/ - Business Function Unit Alerts
**Purpose**: Business-specific alert processing

**Features**:
- Business rule evaluation
- Custom alert workflows
- Integration with business systems
- Compliance monitoring

#### cellular-alerts/ - Cellular-Specific Alerts
**Purpose**: Cellular device specific alerting

**Features**:
- Signal quality alerts
- Data usage warnings
- Connectivity issues
- Roaming notifications

#### notifications/ - Multi-Channel Notifications
**Purpose**: Delivers notifications across multiple channels

**Features**:
- Email notifications (SendGrid)
- SMS notifications
- Push notifications
- Webhook deliveries
- Notification templates

**Channels**:
```go
type NotificationChannel struct {
    Type     string            `json:"type"`     // email, sms, push
    Config   map[string]string `json:"config"`
    Template string            `json:"template"`
}
```

---

### 🌉 Gateway & Integration Services

#### vmark-cloud-gateway/ - Cloud Gateway Service
**Purpose**: Main gateway for cloud communications

**Features**:
- API gateway functionality
- Request routing and load balancing
- Authentication middleware
- Rate limiting

#### ui-dev-server/ - UI Development Server
**Purpose**: Development server for UI applications

**Features**:
- Hot reload support
- CORS handling
- Development middleware
- Asset serving

#### core-ui/ - Core UI Backend
**Purpose**: Backend services for UI applications

**Features**:
- UI-specific APIs
- Session management
- File uploads
- WebSocket connections

#### cloud-device-admin-mqtt/ - Cloud MQTT Device Admin
**Purpose**: MQTT-based device administration

**Features**:
- Remote device configuration
- Firmware update management
- Command execution
- Status monitoring

---

### 🔧 Infrastructure Services

#### hydrant/ - System Utilities
**Purpose**: System utilities and maintenance tools

**Features**:
- Database migrations
- System health checks
- Maintenance scripts
- Performance monitoring

#### merchandising/ - E-commerce Backend
**Purpose**: E-commerce functionality

**Features**:
- Product catalog management
- Order processing
- Inventory tracking
- Payment integration

---

## Shared Library: iot-common

**Location**: `./iot-common/`
**Purpose**: Common Go types, utilities, and middleware used across all services

### Key Components

#### Common Types
```go
// Device representation
type Device struct {
    ID          string                 `json:"id" gorm:"primaryKey"`
    Name        string                 `json:"name"`
    Type        string                 `json:"type"`
    Status      DeviceStatus          `json:"status"`
    Metadata    datatypes.JSON        `json:"metadata"`
    CreatedAt   time.Time             `json:"created_at"`
    UpdatedAt   time.Time             `json:"updated_at"`
}

// Alert structure
type Alert struct {
    ID          string     `json:"id" gorm:"primaryKey"`
    DeviceID    string     `json:"device_id"`
    Type        string     `json:"type"`
    Severity    Severity   `json:"severity"`
    Message     string     `json:"message"`
    Timestamp   time.Time  `json:"timestamp"`
    Resolved    bool       `json:"resolved"`
}
```

#### Authentication Middleware
```go
func JWTMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // JWT validation logic
    }
}
```

#### Database Utilities
```go
func SetupDatabase(config DatabaseConfig) (*gorm.DB, error) {
    // Database connection setup
}
```

#### MQTT Client
```go
func NewMQTTClient(config MQTTConfig) (mqtt.Client, error) {
    // MQTT client creation
}
```

### Usage in Services
```go
import (
    types "github.com/NetNeural/iot-common/v5"
)

func main() {
    // Use common types and utilities
    db, err := types.SetupDatabase(dbConfig)
    client, err := types.NewMQTTClient(mqttConfig)
}
```

## Development Setup

### Prerequisites
```bash
# Install Go 1.24+
go version

# Set up private repository access
export GOPRIVATE=github.com/NetNeural/*
git config --global url."ssh://git@github.com/".insteadOf "https://github.com/"
```

### Running Services

#### Individual Service
```bash
cd sso
go mod tidy
go run main.go
```

#### With Docker
```bash
cd sso
docker build -t netneural/sso .
docker run -p 8080:8080 netneural/sso
```

#### Development Environment
```bash
# Start dependencies (PostgreSQL, Redis, MQTT broker)
docker-compose up -d postgres redis mosquitto

# Run service
export DB_HOST=localhost
export DB_PORT=5432
export MQTT_BROKER=localhost:1883
go run main.go
```

## API Documentation

### OpenAPI Specifications
Many services use OpenAPI/Swagger for API documentation:

```bash
# Generate API documentation
cd account-manager
go generate ./...
```

### Common API Patterns

#### Health Check
```
GET /health
Response: {"status": "ok", "timestamp": "2025-01-01T00:00:00Z"}
```

#### Authentication
```
POST /auth/login
Body: {"username": "user", "password": "pass"}
Response: {"token": "jwt-token", "expires": "2025-01-01T01:00:00Z"}
```

#### Device Operations
```
GET    /devices           # List devices
GET    /devices/{id}      # Get device
POST   /devices           # Create device
PUT    /devices/{id}      # Update device
DELETE /devices/{id}      # Delete device
```

## Database Schema

### Common Tables
```sql
-- Devices table
CREATE TABLE devices (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Alerts table
CREATE TABLE alerts (
    id VARCHAR(255) PRIMARY KEY,
    device_id VARCHAR(255) REFERENCES devices(id),
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    message TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE
);

-- Users table (SSO service)
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Configuration Management

### Environment Variables
Each service uses environment variables for configuration:

```bash
# Database
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=service_db
export DB_USER=service_user
export DB_PASSWORD=secret

# MQTT
export MQTT_BROKER=localhost:1883
export MQTT_USERNAME=mqtt_user
export MQTT_PASSWORD=mqtt_pass

# JWT
export JWT_SECRET=your-secret-key
export JWT_EXPIRY=24h

# Service-specific
export SERVICE_PORT=8080
export LOG_LEVEL=info
```

### Configuration Files
Some services use YAML configuration:

```yaml
# config.yaml
database:
  host: ${DB_HOST}
  port: ${DB_PORT}
  name: ${DB_NAME}
  
mqtt:
  broker: ${MQTT_BROKER}
  topics:
    - "devices/+/telemetry"
    - "devices/+/commands"

logging:
  level: ${LOG_LEVEL}
  format: json
```

## Monitoring & Observability

### Prometheus Metrics
All services expose Prometheus metrics:

```go
import "github.com/zsais/go-gin-prometheus"

// Add metrics middleware
p := ginprometheus.NewPrometheus("service_name")
p.Use(router)
```

**Common Metrics**:
- HTTP request duration
- Request count by status code
- Database connection pool metrics
- MQTT message throughput
- Alert processing metrics

### Health Checks
```go
router.GET("/health", func(c *gin.Context) {
    c.JSON(200, gin.H{
        "status": "ok",
        "timestamp": time.Now(),
        "version": version,
    })
})
```

### Logging
Structured logging with logrus:

```go
import "github.com/sirupsen/logrus"

logrus.WithFields(logrus.Fields{
    "service": "sso",
    "user_id": userID,
}).Info("User authenticated successfully")
```

## Testing

### Unit Testing
```bash
cd sso
go test ./...
go test -cover ./...
```

### Integration Testing
```bash
# Start test dependencies
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
go test -tags=integration ./...
```

### Load Testing
```bash
# Using k6 or similar
k6 run load-test.js
```

## Deployment

### Docker Deployment
```dockerfile
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
CMD ["./main"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sso-service
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
        image: netneural/sso:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_HOST
          value: postgres-service
```

## Security Best Practices

### Authentication
- JWT tokens with short expiry
- Refresh token rotation
- Strong password policies
- Multi-factor authentication support

### API Security
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS configuration
- HTTPS enforcement

### Database Security
- Connection encryption
- Prepared statements to prevent SQL injection
- Database user with minimal privileges
- Regular security updates

## Troubleshooting

### Common Issues

1. **Module Resolution**:
   ```bash
   go clean -modcache
   go mod tidy
   ```

2. **Database Connection**:
   ```bash
   # Test database connectivity
   telnet localhost 5432
   ```

3. **MQTT Connection**:
   ```bash
   # Test MQTT broker
   mosquitto_pub -h localhost -t test -m "hello"
   ```

4. **Memory Issues**:
   ```bash
   # Profile memory usage
   go tool pprof http://localhost:8080/debug/pprof/heap
   ```

### Performance Optimization
- Connection pooling for databases
- MQTT client connection reuse
- Goroutine pool for concurrent processing
- Caching frequently accessed data
- Database query optimization

## Future Enhancements

### Planned Features
- **gRPC APIs**: High-performance internal communication
- **Event Sourcing**: Better audit trails and state management
- **Circuit Breakers**: Improved resilience
- **Distributed Tracing**: Better observability across services

### Architecture Evolution
- **Service Mesh**: Istio for service-to-service communication
- **Event-Driven Architecture**: More asynchronous processing
- **CQRS**: Command Query Responsibility Segregation for better scalability
