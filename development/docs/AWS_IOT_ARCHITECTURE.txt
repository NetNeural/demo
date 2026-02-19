# AWS IoT Core Integration Architecture

**Story #99** - AWS IoT Core Verification  
**Epic #95** - Revive NetNeural Integration Hub  
**Date**: 2025-11-13  
**Status**: ✅ Production Ready

---

## Overview

The AWS IoT Core integration enables NetNeural to connect with customer devices managed through AWS IoT services. AWS IoT Core provides secure device connectivity, device management via Things, and state management via Thing Shadows.

**Implementation**: `src/lib/integrations/aws-iot-integration-provider.ts` (381 lines)

---

## AWS IoT Core Concepts

### 1. **Thing** (Device Entity)
- Represents a physical device in AWS IoT
- Has a unique name (thingName)
- Can be assigned a Thing Type for categorization
- Contains custom attributes (metadata key-value pairs)

### 2. **Thing Shadow** (Device State)
- JSON document storing device state
- **Reported State**: Current state from device → cloud
- **Desired State**: Target state from cloud → device
- Includes metadata with timestamps for state changes

### 3. **Thing Type** (Device Classification)
- Groups Things with similar characteristics
- Used for organizing devices by model/category
- NetNeural maps to device tags

### 4. **Thing Registry** (Device Directory)
- Central registry of all Things
- Searchable by attributes
- Provides device inventory management

---

## Integration Implementation

### Authentication
```typescript
{
  "type": "aws-iot",
  "credentials": {
    "accessKeyId": "AKIA...",      // AWS Access Key
    "secretAccessKey": "...",       // AWS Secret Key
    "region": "us-east-1",          // AWS Region
    "endpoint": "a1b2c3...iot.us-east-1.amazonaws.com" // IoT Data Endpoint
  }
}
```

### Capabilities
| Feature | Supported | Notes |
|---------|-----------|-------|
| Real-time Status | ✅ Yes | Via Thing Shadows |
| Telemetry History | ❌ No | See ADR-AWS-001 below |
| Firmware Management | ✅ Yes | Via IoT Jobs |
| Remote Commands | ✅ Yes | Via Shadow desired state |
| Bidirectional Sync | ✅ Yes | Read/write Things and Shadows |
| Device Types | ✅ Yes | Via Thing Types |
| Pagination | ✅ Yes | Max 250 per page |

### API Operations

#### 1. **testConnection()**
- Validates AWS credentials and region
- Uses `ListThingsCommand` with limit=1
- Returns success/failure with message

#### 2. **listDevices()**
- Lists all Things via `ListThingsCommand`
- Fetches shadows for status and lastSeen
- Maps to generic `DeviceData` format
- Supports pagination (maxResults: 250)

#### 3. **getDevice(deviceId)**
- Gets specific Thing via `DescribeThingCommand`
- Fetches shadow for current state
- Returns name, type, attributes, status

#### 4. **getDeviceStatus(deviceId)**
- Retrieves Thing Shadow via `GetThingShadowCommand`
- Parses reported state
- Extracts connection state, firmware, health metrics
- Returns `DeviceStatus` with telemetry snapshot

#### 5. **updateDevice(deviceId, updates)**
- Updates Thing attributes via `UpdateThingCommand`
- Modifies metadata key-value pairs
- Returns updated device data

#### 6. **queryTelemetry()**
- **Returns empty array** (see ADR-AWS-001)
- AWS IoT Core doesn't provide telemetry history
- Requires AWS IoT Analytics integration

---

## Architecture Decision Record (ADR)

### ADR-AWS-001: No Built-in Telemetry History

**Context**: Customers request historical telemetry data from AWS IoT devices

**Decision**: `queryTelemetry()` returns empty array `[]`

**Rationale**:
AWS IoT Core is designed for **device connectivity and management**, not telemetry storage. Key points:

1. **Thing Shadows**: Store **current state only**, not time-series data
2. **Message Routing**: Telemetry messages route to other AWS services (IoT Analytics, Timestream, S3, etc.)
3. **By Design**: AWS separates connectivity (IoT Core) from storage (Analytics/Timestream)

**Customer Options**:

#### Option 1: AWS IoT Analytics (Recommended)
- Purpose-built for IoT telemetry storage and analysis
- SQL-like queries for time-series data
- Automatic data processing pipelines
- **Integration**: Customer configures IoT Rules to route messages to IoT Analytics
- **NetNeural Support**: Can integrate via AWS SDK `@aws-sdk/client-iotanalytics`

#### Option 2: Amazon Timestream
- Time-series database optimized for IoT
- Fast queries over billions of records
- Automatic data lifecycle management
- **Integration**: Customer configures IoT Rules → Timestream
- **NetNeural Support**: Can query via AWS SDK `@aws-sdk/client-timestream-query`

#### Option 3: Custom Storage (S3 + Athena)
- Store raw messages in S3
- Query with Athena (serverless SQL)
- Most flexible but requires setup
- **Integration**: Customer configures IoT Rules → S3
- **NetNeural Support**: Can query via S3 API

#### Option 4: Real-time Only (Current Implementation)
- Use Thing Shadows for current state
- No historical telemetry
- Suitable for status/control use cases
- **NetNeural Support**: ✅ Fully implemented

**Impact**:
- ✅ Integration provides full device management
- ✅ Real-time status via shadows
- ❌ Historical telemetry requires customer-configured storage
- ✅ Similar to Azure IoT Hub design (see AZURE_IOT_ARCHITECTURE.md)

**Recommendation for Customers**:
- **Device Management Only**: Current implementation is sufficient
- **Need Telemetry History**: Enable AWS IoT Analytics in their AWS account
- **Custom Requirements**: Contact NetNeural for IoT Analytics integration

---

## Data Mapping

### AWS Thing → NetNeural DeviceData
```typescript
{
  id: thingName,                        // "device-001"
  name: attributes.name || thingName,   // "Sensor 001"
  externalId: thingName,                // AWS Thing name
  status: 'online' | 'offline' | 'unknown', // From shadow.reported.connected
  hardwareIds: [attributes.serialNumber], // If available
  tags: [thingTypeName],                // Thing Type as tag
  metadata: {
    ...attributes,                       // All Thing attributes
    thingType: thingTypeName,
    version: version,
    shadow: shadow.state                 // Full shadow state
  },
  lastSeen: shadowMetadata.timestamp,   // Last shadow update
  createdAt: new Date(),                // AWS doesn't provide creation time
  updatedAt: new Date()
}
```

### AWS Shadow → NetNeural DeviceStatus
```typescript
{
  connectionState: reported.connected ? 'online' : 'offline',
  lastActivity: new Date(shadow.timestamp * 1000),
  firmware: {
    version: reported.firmware,
    updateAvailable: false
  },
  telemetry: shadow.state.reported,     // Current state snapshot
  health: {
    battery: reported.battery,          // If present
    signalStrength: reported.rssi,      // If present
    temperature: reported.temperature    // If present
  }
}
```

---

## Testing

### Manual Test Script
`scripts/test-aws-iot.js` - Manual integration test requiring AWS credentials

**Usage**:
```bash
cd development
node ../scripts/test-aws-iot.js
```

**Tests**:
1. Connection validation
2. List all Things
3. Get specific Thing details
4. Get Thing Shadow (status)
5. Query telemetry (verifies empty response)

**Requirements**:
- AWS Access Key ID and Secret Access Key
- AWS IoT Core region
- IoT Data endpoint (e.g., `a1b2c3...iot.us-east-1.amazonaws.com`)
- At least one Thing created in AWS IoT

---

## Error Handling

### Common Errors
| Error | Cause | Solution |
|-------|-------|----------|
| InvalidClientTokenException | Invalid AWS credentials | Verify Access Key ID and Secret Key |
| ResourceNotFoundException | Thing doesn't exist | Check thingName spelling |
| UnauthorizedException | Insufficient IAM permissions | Grant `iot:*` and `iot-data:*` permissions |
| ThrottlingException | Rate limit exceeded | Implement exponential backoff |
| InvalidRequestException | Malformed shadow JSON | Validate shadow document format |

### IAM Permissions Required
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:ListThings",
        "iot:DescribeThing",
        "iot:UpdateThing",
        "iot:CreateThing",
        "iot:DeleteThing",
        "iot-data:GetThingShadow",
        "iot-data:UpdateThingShadow"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Comparison: AWS IoT vs Azure IoT Hub

| Feature | AWS IoT Core | Azure IoT Hub |
|---------|--------------|---------------|
| Device Entity | Thing | Device |
| State Management | Thing Shadow | Device Twin |
| Telemetry Storage | ❌ Requires IoT Analytics | ❌ Requires IoT Central/TSI |
| Device Types | ✅ Thing Types | ❌ (use tags) |
| Pagination | 250 per page | 1000 per page |
| Real-time Status | ✅ Shadows | ✅ Twins |
| Firmware Updates | ✅ Jobs | ✅ Device Management |
| Message Routing | Rules Engine | Event Grid |

**Similarities**:
- Both separate connectivity from telemetry storage
- Both use "digital twin" concept (Shadow/Twin)
- Both require external services for historical data

---

## Customer Guidance

### When to Use AWS IoT Integration
✅ **Good Fit**:
- Customer already uses AWS IoT Core
- Device management and control needed
- Real-time status monitoring
- Firmware updates via Jobs

❌ **Not Ideal For**:
- Historical telemetry analysis (use IoT Analytics first)
- Customers without AWS infrastructure
- Real-time event streaming (use MQTT directly)

### Integration Setup Steps
1. **Get AWS Credentials**:
   - Access Key ID and Secret Access Key
   - Ensure IAM user has `iot:*` and `iot-data:*` permissions
   
2. **Get IoT Endpoint**:
   - Navigate to AWS IoT Core console
   - Go to Settings
   - Copy "Endpoint" (e.g., `a1b2c3.iot.us-east-1.amazonaws.com`)

3. **Configure in NetNeural**:
   - Go to Integrations → Add Integration → AWS IoT Core
   - Enter Access Key ID, Secret Key, Region, Endpoint
   - Test connection

4. **Verify Devices**:
   - Check that Things appear in NetNeural device list
   - Verify status shows correctly from shadows
   - Test device updates

### Telemetry Setup (Optional)
If customer needs historical telemetry:
1. Enable AWS IoT Analytics in their AWS account
2. Create IoT Rule to route messages to Analytics
3. Contact NetNeural for IoT Analytics integration
4. Alternative: Use Timestream or S3+Athena

---

## Architecture Diagrams

### Device Data Flow
```
AWS IoT Core
    │
    ├─ Thing Registry ─────┐
    │   (Device metadata)  │
    │                      │
    ├─ Thing Shadows ──────┤
    │   (Current state)    │──► NetNeural Integration Provider
    │                      │    │
    ├─ IoT Rules ──────────┤    ├─ listDevices()
    │   (Message routing)  │    ├─ getDevice()
    │                      │    ├─ getDeviceStatus()
    └─ IoT Jobs ───────────┘    ├─ updateDevice()
        (Firmware updates)      └─ queryTelemetry() → [] (empty)
                                 
                                 ↓
                                 
                          NetNeural Database
                          (Device registry)
```

### Telemetry Flow (Customer Managed)
```
Device ──MQTT──> AWS IoT Core ──Rules Engine──┬──> IoT Analytics (storage)
                                               ├──> Timestream (time-series DB)
                                               ├──> S3 (raw data)
                                               └──> Lambda (processing)
                                               
                                                    ↓
                                                    
                                              Customer's Telemetry Store
                                              (Not accessed by NetNeural)
```

---

## Security Considerations

### Credentials Storage
- ✅ AWS Access Keys stored encrypted in NetNeural database
- ✅ Uses Story #96 API key encryption (AES-256-GCM)
- ✅ Never logged or exposed in client-side code
- ✅ Transmitted over HTTPS only

### IAM Best Practices (Customer Responsibility)
1. **Principle of Least Privilege**: Grant only IoT and IoT-Data permissions
2. **Separate User**: Create dedicated IAM user for NetNeural
3. **Key Rotation**: Rotate Access Keys every 90 days
4. **CloudTrail**: Enable logging for IoT API calls
5. **MFA**: Require MFA for IAM users managing IoT

### Data Privacy
- ✅ NetNeural only reads device metadata and current state
- ✅ Telemetry data remains in customer's AWS account
- ✅ No data stored outside customer's Supabase instance
- ✅ GDPR/SOC2 compliant (see SOC2_COMPLIANCE_CHECKLIST.md)

---

## Performance Considerations

### Rate Limits (AWS IoT Core)
- **ListThings**: 100 requests/second per account
- **DescribeThing**: 100 requests/second per account
- **GetThingShadow**: 100 requests/second per account
- **UpdateThingShadow**: 100 requests/second per account

### NetNeural Optimizations
1. **Batch Fetching**: `listDevices()` fetches shadows in parallel
2. **Pagination**: Respects AWS limit of 250 per page
3. **Caching**: Device data cached in Supabase (reduces API calls)
4. **Error Recovery**: Graceful degradation if shadow fetch fails

### Scaling Recommendations
- **< 100 devices**: No special configuration needed
- **100-1,000 devices**: Enable device caching (default: 5 min TTL)
- **> 1,000 devices**: Consider AWS IoT Device Defender for fleet monitoring

---

## Future Enhancements

### Planned (Epic #95)
- ✅ Story #99: AWS IoT Core verification **COMPLETE**
- ⏳ Story #100: UI integration flow improvements
- ⏳ Story #102: AWS IoT Analytics integration (telemetry history)

### Potential Features
- AWS IoT Jobs integration (firmware updates)
- AWS IoT Device Defender integration (security insights)
- AWS IoT Events integration (event detection)
- Custom Shadow document parsing (device-specific schemas)

---

## References

### AWS Documentation
- [AWS IoT Core Developer Guide](https://docs.aws.amazon.com/iot/latest/developerguide/)
- [Thing Shadows](https://docs.aws.amazon.com/iot/latest/developerguide/iot-device-shadows.html)
- [AWS IoT Analytics](https://docs.aws.amazon.com/iotanalytics/latest/userguide/)
- [AWS IoT Core Limits](https://docs.aws.amazon.com/general/latest/gr/iot-core.html)

### NetNeural Documentation
- [Integration Provider Guide](INTEGRATION_PROVIDER_GUIDE.md)
- [Azure IoT Architecture](AZURE_IOT_ARCHITECTURE.md) (similar design)
- [MQTT Architecture](MQTT_ARCHITECTURE.md)
- [Secrets Management](SECRETS_INVENTORY.md)

### Related Stories
- Story #96: API Key Encryption (90% complete)
- Story #97: MQTT Broker Integration (✅ complete)
- Story #98: Azure IoT Hub Integration (✅ complete)
- Story #99: AWS IoT Core Integration (✅ complete)

---

**Last Updated**: 2025-11-13  
**Maintainer**: NetNeural Engineering Team  
**Version**: 1.0.0
