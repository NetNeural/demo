# Golioth Integration Bundle

This bundle provides comprehensive integration with the Golioth IoT platform, enabling seamless device management, real-time data streaming, and secure device authentication.

## Features

### Device Management
- Device provisioning and credential management
- Pre-shared key (PSK) and certificate-based authentication
- Device state management via LightDB State
- Over-the-air (OTA) firmware updates

### Real-time Data Streaming
- LightDB Stream for time-series data
- WebSocket real-time connections
- Device activity monitoring
- Data aggregation and querying

### Fleet Management
- Project and organization management
- Device grouping with tags and cohorts
- Access control and policy management
- API key management

### Integration Features
- REST API proxy to Golioth Management API
- CoAP gateway integration for device communication
- Device data ingestion and routing
- Real-time event processing

## Architecture

```
bundle-golioth-integration/
├── src/
│   ├── handlers/           # HTTP handlers for API endpoints
│   ├── services/          # Business logic services
│   ├── models/            # Data models and types
│   ├── auth/             # Authentication middleware
│   ├── websocket/        # Real-time WebSocket handlers
│   └── coap/             # CoAP client for device communication
├── config/               # Configuration files
├── docker/              # Docker configuration
└── helm/                # Kubernetes deployment charts
```

## API Endpoints

### Management API Proxy
- `GET /api/v1/projects` - List projects
- `GET /api/v1/projects/{id}/devices` - List devices
- `POST /api/v1/projects/{id}/devices` - Create device
- `GET /api/v1/projects/{id}/devices/{deviceId}/stream` - Device stream data
- `GET /api/v1/projects/{id}/devices/{deviceId}/state` - Device state

### Device Provisioning
- `POST /api/v1/provision` - Provision new device
- `POST /api/v1/credentials` - Generate device credentials
- `GET /api/v1/certificates` - List certificates

### Real-time Data
- `WS /ws/devices/{deviceId}/stream` - Real-time device data
- `WS /ws/projects/{projectId}/events` - Project-wide events
- `GET /api/v1/stream/query` - Query historical data

## Configuration

Environment variables:
- `GOLIOTH_API_URL` - Golioth Management API base URL
- `GOLIOTH_API_KEY` - API key for Golioth Management API
- `GOLIOTH_PROJECT_ID` - Default project ID
- `COAP_GATEWAY_URL` - CoAP gateway endpoint
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection for caching and real-time features

## Getting Started

1. Set environment variables
2. Build and run: `go run main.go`
3. Access API at `http://localhost:8080`
4. WebSocket endpoints at `ws://localhost:8080/ws/...`

## Dependencies

- Existing `iot-common` types for device management
- `cloud-data-manager` for data persistence
- Supabase for authentication and authorization
- Redis for real-time features and caching
