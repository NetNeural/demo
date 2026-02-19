# Azure IoT Hub Integration Architecture

**Date**: February 19, 2026  
**Status**: Production-Ready (with limitations)
**Related Story**: #98 - Azure IoT Hub Verification

---

## Executive Summary

NetNeural's Azure IoT Hub integration enables device management, status tracking, and remote commands using Azure's managed IoT platform. The integration is designed for maximum compatibility with Azure's Device Registry and Device Twin model, but **telemetry storage is not included by default** (by Azure design).

---

## Key Capabilities
- ✅ Device listing, status, and metadata management (Device Registry, Device Twin)
- ✅ Remote commands and firmware updates (Device Twin desired properties, direct methods)
- ✅ Activity logging and integration with NetNeural UI
- ⚠️ Telemetry query returns empty (requires additional Azure services)

---

## Architecture Decision Record (ADR)

### Context
Azure IoT Hub is a fully managed cloud service for device connectivity, management, and messaging. Unlike MQTT or Golioth, **Azure IoT Hub does not store device telemetry by default**. Telemetry is routed to other Azure services for storage and analytics.

### Decision
- **Device management**: Fully supported via Device Registry and Device Twin APIs
- **Telemetry**: Not stored in IoT Hub; must be routed to:
  - Azure IoT Central (managed telemetry storage)
  - Azure Time Series Insights
  - Azure Data Explorer
  - Custom Event Hub/Stream Analytics pipeline
- **queryTelemetry()**: Returns empty array unless customer configures telemetry storage

### Rationale
- **Azure's design**: IoT Hub is a message broker, not a database
- **Separation of concerns**: Telemetry analytics handled by downstream Azure services
- **NetNeural's role**: Provide device management, status, and command interface; document telemetry options

### Consequences
- **Positive**: Clean separation of device management and telemetry analytics; leverages Azure's scalable analytics stack
- **Negative**: Out-of-the-box telemetry queries not possible; requires customer to set up additional Azure services
- **Neutral**: Aligns with Azure best practices

---

## System Components

### 1. Integration Provider (TypeScript)
**File**: `src/lib/integrations/azure-iot-integration-provider.ts` (366 lines)
- Uses `azure-iothub` SDK
- Implements:
  - Device listing (`listDevices`)
  - Device status (`getDeviceStatus`)
  - Device metadata updates (`updateDevice`)
  - Remote commands (via Device Twin)
  - Connection test (`testConnection`)
  - Telemetry query (`queryTelemetry` returns empty)
- Registered in provider factory

### 2. UI Configuration Dialog
**File**: `src/components/integrations/AzureIotConfigDialog.tsx` (337 lines)
- Allows user to configure connection string, hub name, etc.
- Supports test connection, status display, and activity log

### 3. Database Schema
- No custom tables required for Azure IoT Hub integration
- Device and integration records stored in standard NetNeural tables

---

## Telemetry Storage Options

Azure IoT Hub customers must configure one of the following to store/query telemetry:

1. **Azure IoT Central**
   - Managed SaaS for device telemetry and dashboards
   - Easiest path for most customers
2. **Azure Time Series Insights**
   - Scalable time-series database for telemetry analytics
3. **Azure Data Explorer**
   - Advanced analytics and ad-hoc queries
4. **Custom Event Hub + Stream Analytics**
   - Flexible, for custom pipelines

**NetNeural Guidance:**
- Document these options in onboarding
- Provide sample queries for each
- Recommend IoT Central for most use cases

---

## Security
- Connection string stored encrypted in integration settings
- No device credentials stored in NetNeural
- All operations use Azure SDK with customer-provided credentials
- No persistent secrets in codebase

---

## Operational Considerations
- **Testing**: Requires Azure subscription and IoT Hub instance
- **Limitations**: No telemetry query unless customer configures storage
- **Monitoring**: Activity logging integrated with NetNeural dashboard
- **Scalability**: Handled by Azure IoT Hub and downstream services

---

## Migration Guide
- For customers migrating from MQTT or Golioth, device management is similar
- Telemetry analytics require Azure service configuration
- NetNeural UI will show device status, metadata, and activity, but not telemetry graphs unless configured

---

## Testing
- **Manual**: Use Azure Portal to create IoT Hub, register device, and test connection via NetNeural UI
- **Automated**: Not possible without Azure credentials (customer-provided)

---

## Changelog
- **2026-02-19**: Initial architecture document created (Story #98)

---

**Maintained by**: NetNeural Platform Team  
**Last Updated**: February 19, 2026  
**Status**: Production-Ready (with limitations)
