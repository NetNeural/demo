# Bundle Components Documentation

## Overview
Bundle components are modular, reusable software packages that provide specific functionality for IoT device integration, network discovery, security provisioning, and template-based development. These components can be integrated into various NetNeural services and external systems.

## Bundle Categories

### 🔌 API & Integration Bundles

#### bundle-api-provision-thread/
**Purpose**: API provisioning for Thread network integration

**Technology**: Go
**Key Features**:
- Thread network API provisioning
- Device commissioning workflows
- Network credential management
- Thread border router integration

**Usage**:
```go
import "github.com/NetNeural/bundle-api-provision-thread"

// Provision device on Thread network
err := thread.ProvisionDevice(deviceID, networkCredentials)
```

#### bundle-input-device-rest/
**Purpose**: REST API input handling for IoT devices

**Technology**: Go
**Key Features**:
- RESTful API endpoints for device data
- Input validation and sanitization
- Rate limiting and authentication
- Protocol translation

**API Endpoints**:
```
POST /devices/{id}/data     # Receive device data
PUT  /devices/{id}/config   # Update device configuration
GET  /devices/{id}/status   # Get device status
```

---

### 🏠 Device Administration

#### bundle-iot-device-admin/
**Purpose**: IoT device administration and management

**Technology**: Go
**Key Features**:
- Device lifecycle management
- Remote configuration updates
- Firmware update orchestration
- Device health monitoring

**Device Operations**:
```go
type DeviceAdmin struct {
    DeviceID string
    Status   DeviceStatus
    Config   DeviceConfig
}

// Administrative operations
func (d *DeviceAdmin) UpdateFirmware(version string) error
func (d *DeviceAdmin) ResetDevice() error
func (d *DeviceAdmin) GetDiagnostics() (*Diagnostics, error)
```

---

### 🌐 Network Discovery & Communication

#### bundle-mdns-core-python/
**Purpose**: Core mDNS (Multicast DNS) functionality in Python

**Technology**: Python
**Key Features**:
- Service discovery on local networks
- mDNS record publishing and resolution
- Network service advertisement
- Cross-platform compatibility

**Installation**:
```bash
cd bundle-mdns-core-python
pip install -r requirements.txt
```

**Usage**:
```python
from mdns_core import MDNSService

# Advertise service
service = MDNSService("NetNeural Device", "_http._tcp", 8080)
service.advertise()

# Discover services
services = MDNSService.discover("_netneural._tcp")
```

#### bundle-other-mdns-hub/
**Purpose**: mDNS hub functionality for device discovery

**Technology**: Java (Android)
**Key Features**:
- Centralized mDNS service management
- Device discovery aggregation
- Network topology mapping
- Service resolution caching

#### core-mdns-site-local-broadcast/
**Purpose**: Site-local mDNS broadcasting service

**Technology**: Go
**Key Features**:
- Site-local network broadcasting
- Service announcement coordination
- Network segment discovery
- Broadcast storm prevention

---

### 🔒 Security & Provisioning

#### bundle-provision-security-data-netneural/
**Purpose**: Security data provisioning for NetNeural devices

**Technology**: Go
**Key Features**:
- Cryptographic key provisioning
- Certificate management
- Secure device onboarding
- Trust establishment

**Security Operations**:
```go
type SecurityProvisioner struct {
    DeviceID    string
    Certificate *x509.Certificate
    PrivateKey  *rsa.PrivateKey
}

// Provision security credentials
func ProvisionDevice(deviceID string) (*SecurityProvisioner, error)
func ValidateCertificate(cert *x509.Certificate) error
func RevokeCredentials(deviceID string) error
```

---

### 📤 Output & Data Processing

#### bundle-output-netneural/
**Purpose**: NetNeural-specific output processing

**Technology**: Go
**Key Features**:
- Data formatting for NetNeural systems
- Output validation and transformation
- Integration with NetNeural APIs
- Custom data serialization

**Output Formats**:
```go
type OutputProcessor struct {
    Format OutputFormat // JSON, XML, Binary
    Target OutputTarget // API, File, Stream
}

// Process and route output
func (o *OutputProcessor) ProcessData(data interface{}) error
func (o *OutputProcessor) ValidateOutput(output []byte) error
```

---

### 📋 Development Templates

#### bundle-template-python/
**Purpose**: Python project template for NetNeural bundles

**Technology**: Python
**Features**:
- Standard project structure
- Dependency management setup
- Testing framework configuration
- Documentation templates
- CI/CD pipeline templates

**Project Structure**:
```
bundle-template-python/
├── src/
│   └── bundle_name/
│       ├── __init__.py
│       └── main.py
├── tests/
│   └── test_main.py
├── requirements.txt
├── setup.py
├── README.md
└── .github/
    └── workflows/
        └── ci.yml
```

#### bundle-template-cpp/
**Purpose**: C++ project template for NetNeural bundles

**Technology**: C++
**Features**:
- CMake build system
- Standard library integrations
- Unit testing setup (Google Test)
- Cross-platform compilation
- Documentation generation

**Project Structure**:
```
bundle-template-cpp/
├── src/
│   ├── main.cpp
│   └── bundle.h
├── tests/
│   └── test_main.cpp
├── CMakeLists.txt
├── README.md
└── .github/
    └── workflows/
        └── ci.yml
```

#### bundle-template-java/
**Purpose**: Java project template for NetNeural bundles

**Technology**: Java (Android compatible)
**Features**:
- Gradle build system
- Android library support
- JUnit testing framework
- Maven repository publishing
- Android manifest templates

**Project Structure**:
```
bundle-template-java/
├── src/
│   ├── main/
│   │   └── java/
│   └── test/
│       └── java/
├── build.gradle
├── settings.gradle
├── AndroidManifest.xml
└── README.md
```

---

## Integration Patterns

### Bundle Integration in Go Services
```go
package main

import (
    "github.com/NetNeural/bundle-iot-device-admin"
    "github.com/NetNeural/bundle-api-provision-thread"
    "github.com/NetNeural/iot-common/v5"
)

func main() {
    // Initialize device admin bundle
    admin := deviceadmin.New(config)
    
    // Use thread provisioning bundle
    err := thread.ProvisionDevice(deviceID, credentials)
    
    // Integrate with common types
    device := types.Device{
        ID:   deviceID,
        Type: "thread",
    }
}
```

### Bundle Integration in Python Services
```python
import sys
sys.path.append('./bundle-mdns-core-python')

from mdns_core import MDNSService
from netneural_common import Device

def integrate_mdns():
    # Use mDNS bundle
    service = MDNSService("Device Service", "_netneural._tcp", 8080)
    service.advertise()
    
    # Discover other services
    discovered = MDNSService.discover("_netneural._tcp")
    return discovered
```

### Bundle Integration in Java/Android
```java
import com.netneural.bundle.mdns.hub.MDNSHub;
import com.netneural.bundle.template.BundleTemplate;

public class DeviceService {
    private MDNSHub mdnsHub;
    
    public DeviceService() {
        this.mdnsHub = new MDNSHub();
        this.mdnsHub.startDiscovery();
    }
    
    public List<Device> discoverDevices() {
        return mdnsHub.getDiscoveredDevices();
    }
}
```

## Development Guidelines

### Creating New Bundles

1. **Choose Template**:
   ```bash
   # Copy appropriate template
   cp -r bundle-template-go new-bundle-name
   cd new-bundle-name
   ```

2. **Update Configuration**:
   - Modify `go.mod` / `package.json` / `requirements.txt`
   - Update README.md with bundle-specific information
   - Configure CI/CD pipeline

3. **Implement Functionality**:
   - Follow established patterns from existing bundles
   - Use common interfaces where possible
   - Include comprehensive tests

4. **Documentation**:
   - API documentation
   - Usage examples
   - Integration guides

### Bundle Versioning
```bash
# Semantic versioning
git tag v1.0.0
git push origin v1.0.0

# Update go.mod in dependent services
go get github.com/NetNeural/bundle-name@v1.0.0
```

### Testing Bundles

#### Go Bundles
```bash
cd bundle-iot-device-admin
go test ./...
go test -race ./...
go test -bench=. ./...
```

#### Python Bundles
```bash
cd bundle-mdns-core-python
pytest tests/
pytest --cov=src tests/
```

#### Java Bundles
```bash
cd bundle-template-java
./gradlew test
./gradlew androidTest  # For Android bundles
```

### Bundle Publishing

#### Go Modules
```bash
# Tag release
git tag v1.2.3
git push origin v1.2.3

# Go will automatically serve from GitHub
```

#### Python Packages
```bash
cd bundle-mdns-core-python
python setup.py sdist bdist_wheel
twine upload dist/*
```

#### Java/Android Libraries
```bash
cd bundle-template-java
./gradlew publishToMavenLocal
./gradlew publish  # To configured repository
```

## Bundle Dependencies

### Common Dependencies

#### Go Bundles
```go
// Common dependencies across Go bundles
require (
    github.com/NetNeural/iot-common/v5 v5.13.1
    github.com/google/uuid v1.6.0
    github.com/stretchr/testify v1.10.0  // Testing
)
```

#### Python Bundles
```txt
# requirements.txt
requests>=2.28.0
asyncio>=3.4.3
pytest>=7.0.0        # Testing
pytest-cov>=4.0.0    # Coverage
```

#### Java Bundles
```gradle
dependencies {
    implementation 'com.google.code.gson:gson:2.10.1'
    implementation 'androidx.core:core:1.8.0'  // Android
    testImplementation 'junit:junit:4.13.2'
    testImplementation 'org.mockito:mockito-core:4.6.1'
}
```

## Integration Examples

### Device Onboarding Workflow
```go
// Combines multiple bundles for complete device onboarding
func OnboardDevice(deviceInfo DeviceInfo) error {
    // 1. Security provisioning
    provisioner, err := security.ProvisionDevice(deviceInfo.ID)
    if err != nil {
        return err
    }
    
    // 2. Thread network provisioning
    err = thread.ProvisionDevice(deviceInfo.ID, networkCreds)
    if err != nil {
        return err
    }
    
    // 3. Device administration setup
    admin := deviceadmin.New(deviceInfo.ID)
    err = admin.Initialize()
    if err != nil {
        return err
    }
    
    // 4. mDNS service advertisement
    service := mdns.NewService(deviceInfo.Name, "_netneural._tcp", 8080)
    return service.Advertise()
}
```

### Cross-Platform Service Discovery
```python
# Python service using mDNS bundle
from bundle_mdns_core_python import MDNSService
import requests

class ServiceDiscovery:
    def __init__(self):
        self.mdns = MDNSService()
    
    def find_netneural_services(self):
        services = self.mdns.discover("_netneural._tcp")
        return [self.validate_service(s) for s in services]
    
    def validate_service(self, service):
        try:
            response = requests.get(f"http://{service.host}:{service.port}/health")
            return response.status_code == 200
        except:
            return False
```

## Best Practices

### Bundle Design Principles

1. **Single Responsibility**: Each bundle should have one clear purpose
2. **Loose Coupling**: Minimal dependencies between bundles
3. **High Cohesion**: Related functionality grouped together
4. **Interface Stability**: Maintain backward compatibility
5. **Comprehensive Testing**: Unit, integration, and performance tests

### Error Handling
```go
// Standard error handling pattern
type BundleError struct {
    Code    string
    Message string
    Cause   error
}

func (e *BundleError) Error() string {
    return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Cause)
}

// Usage
func ProvisionDevice(deviceID string) error {
    if deviceID == "" {
        return &BundleError{
            Code:    "INVALID_DEVICE_ID",
            Message: "Device ID cannot be empty",
            Cause:   nil,
        }
    }
    // ... implementation
}
```

### Configuration Management
```go
// Standard configuration pattern
type BundleConfig struct {
    Enabled     bool          `json:"enabled" yaml:"enabled"`
    Timeout     time.Duration `json:"timeout" yaml:"timeout"`
    MaxRetries  int          `json:"max_retries" yaml:"max_retries"`
    Endpoints   []string     `json:"endpoints" yaml:"endpoints"`
}

func LoadConfig(path string) (*BundleConfig, error) {
    // Configuration loading logic
}
```

### Logging Standards
```go
import "github.com/sirupsen/logrus"

func (b *Bundle) processRequest(req Request) error {
    logger := logrus.WithFields(logrus.Fields{
        "bundle":     "device-admin",
        "device_id":  req.DeviceID,
        "operation":  req.Operation,
    })
    
    logger.Info("Processing device request")
    
    if err := b.validate(req); err != nil {
        logger.WithError(err).Error("Request validation failed")
        return err
    }
    
    logger.Info("Request processed successfully")
    return nil
}
```

## Performance Considerations

### Memory Management
- Use object pools for frequently allocated objects
- Implement proper cleanup in defer statements
- Monitor goroutine leaks in Go bundles

### Network Optimization
- Connection pooling for HTTP clients
- Keep-alive connections where appropriate
- Implement circuit breakers for external calls

### Caching Strategies
- In-memory caching for frequently accessed data
- TTL-based cache invalidation
- Distributed caching for multi-instance deployments

## Troubleshooting

### Common Issues

1. **Import Path Issues** (Go):
   ```bash
   go mod tidy
   go clean -modcache
   ```

2. **Version Conflicts**:
   ```bash
   # Check dependency tree
   go mod graph
   # Update specific dependency
   go get -u github.com/NetNeural/bundle-name@latest
   ```

3. **Cross-Platform Issues**:
   - Test on all target platforms
   - Use build tags for platform-specific code
   - Avoid platform-specific dependencies

### Debugging
```go
// Enable debug logging
logrus.SetLevel(logrus.DebugLevel)

// Add debug information to errors
func debugError(err error, context string) error {
    return fmt.Errorf("%s: %w", context, err)
}
```

## Future Enhancements

### Planned Features
- **Bundle Registry**: Centralized registry for bundle discovery
- **Dependency Management**: Advanced dependency resolution
- **Runtime Loading**: Dynamic bundle loading and unloading
- **Bundle Marketplace**: Community-contributed bundles

### Architecture Evolution
- **Plugin Architecture**: Hot-swappable bundle system
- **WebAssembly Support**: Cross-language bundle execution
- **Containerized Bundles**: Docker-based bundle isolation
