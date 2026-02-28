# Integration Types - Complete Guide

## Overview
This document explains each integration type, its purpose, configuration requirements, and expected behavior.

---

## 🌐 Golioth
**Type:** `golioth`  
**Category:** IoT Device Platform

### Purpose
Connect devices to Golioth's IoT platform for comprehensive device management, over-the-air (OTA) updates, and cloud services integration.

### What it Does
- **Device Provisioning**: Automatically register and authenticate IoT devices
- **OTA Updates**: Deploy firmware updates remotely to connected devices
- **Remote Configuration**: Push configuration changes to devices in real-time
- **Device Monitoring**: Track device status, health, and telemetry data
- **Cloud Sync**: Synchronize device data with Golioth cloud services

### Configuration Fields
| Field | Required | Description |
|-------|----------|-------------|
| API Key | ✅ Yes | Your Golioth API authentication key |
| Project ID | ✅ Yes | Golioth project identifier |
| Base URL | ❌ No | Custom endpoint (uses default if not specified) |

### Expected Behavior
- Devices will register with Golioth platform upon connection
- Device telemetry automatically syncs to Golioth cloud
- OTA update deployments trigger through Golioth console
- Device shadows and configuration managed via Golioth API

### Use Cases
- IoT device fleet management
- Remote firmware updates for deployed devices
- Real-time device monitoring and diagnostics
- Edge computing with cloud backend

---

## ☁️ AWS IoT Core
**Type:** `aws_iot`  
**Category:** Cloud IoT Platform

### Purpose
Integrate with Amazon Web Services IoT Core for enterprise-scale device connectivity and AWS service integration.

### What it Does
- **Device Shadows**: Maintain virtual representations of physical devices
- **Rules Engine**: Route device data to other AWS services (Lambda, S3, DynamoDB)
- **Fleet Management**: Manage large-scale device deployments
- **Device Defender**: Monitor and secure your IoT fleet
- **Jobs**: Deploy software updates and configurations to devices

### Configuration Fields
| Field | Required | Description |
|-------|----------|-------------|
| AWS Region | ✅ Yes | AWS region (e.g., us-east-1, eu-west-1) |
| Access Key ID | ✅ Yes | AWS IAM access key identifier |
| Secret Access Key | ✅ Yes | AWS IAM secret access key |
| IoT Endpoint | ❌ No | Custom IoT endpoint (auto-detected if not specified) |

### Expected Behavior
- Devices authenticate using AWS IoT certificates or credentials
- Device data flows through AWS IoT Core message broker
- Integration with AWS Lambda, S3, DynamoDB, and other services
- Device shadows sync state between cloud and devices
- Alerts trigger CloudWatch alarms and notifications

### Use Cases
- Enterprise IoT deployments at scale
- Integration with existing AWS infrastructure
- Advanced analytics with AWS analytics services
- Secure device authentication with AWS Certificate Manager

---

## 🔵 Azure IoT Hub
**Type:** `azure_iot`  
**Category:** Cloud IoT Platform

### Purpose
Connect to Microsoft Azure IoT Hub for enterprise-grade IoT solutions with Azure service integration.

### What it Does
- **Device Twins**: Maintain device metadata and state synchronization
- **Direct Methods**: Execute commands on devices remotely
- **File Upload**: Enable devices to upload files to Azure Storage
- **Message Routing**: Route device telemetry to Azure services
- **Device Provisioning Service**: Automate device registration

### Configuration Fields
| Field | Required | Description |
|-------|----------|-------------|
| Connection String | ✅ Yes | IoT Hub connection string from Azure Portal |
| Hub Name | ❌ No | IoT Hub name for reference |

### Expected Behavior
- Devices connect via AMQP, MQTT, or HTTPS protocols
- Device-to-cloud messages route to Azure services
- Cloud-to-device commands execute on target devices
- Device twins sync configuration and reported properties
- Integration with Azure Stream Analytics, Azure Functions, and Event Hubs

### Use Cases
- Enterprise IoT with Azure cloud services
- Industrial IoT (IIoT) solutions
- Remote device management and monitoring
- Integration with Azure AI and Machine Learning services

---

## 🔷 Google Cloud IoT
**Type:** `google_iot`  
**Category:** Cloud IoT Platform

### Purpose
Integrate with Google Cloud IoT Core for device management and Google Cloud Platform service integration.

### What it Does
- **Device Registry**: Centralized device registration and management
- **Pub/Sub Integration**: Device telemetry flows to Google Cloud Pub/Sub
- **Device Configuration**: Push configuration updates to devices
- **State Management**: Track device state and metadata
- **Analytics Integration**: Connect to BigQuery, Dataflow, and AI services

### Configuration Fields
| Field | Required | Description |
|-------|----------|-------------|
| Project ID | ✅ Yes | Google Cloud Platform project identifier |
| Region | ✅ Yes | GCP region (e.g., us-central1, europe-west1) |
| Registry ID | ✅ Yes | IoT device registry identifier |
| Service Account Key | ✅ Yes | GCP service account credentials (JSON format) |

### Expected Behavior
- Devices authenticate using JWT tokens
- Telemetry data publishes to Cloud Pub/Sub topics
- Configuration updates push from cloud to devices
- Integration with BigQuery for analytics
- AI/ML processing via Google Cloud AI Platform

### Use Cases
- IoT data analytics with BigQuery
- Machine learning on device data
- Integration with Google Cloud services
- Real-time telemetry processing

---

## 📧 Email (SMTP)
**Type:** `email`  
**Category:** Notifications

### Purpose
Send email notifications and alerts via SMTP server for device events, system status, and user notifications.

### What it Does
- **Alert Notifications**: Send emails when device alerts or thresholds are triggered
- **Status Reports**: Daily/weekly summary emails of device status
- **User Notifications**: Notify users of important events
- **Incident Reports**: Automated email reports for system incidents
- **Custom Templates**: HTML email templates with device data

### Configuration Fields
| Field | Required | Description |
|-------|----------|-------------|
| SMTP Host | ✅ Yes | SMTP server address (e.g., smtp.gmail.com) |
| SMTP Port | ✅ Yes | Port number (587 for TLS, 465 for SSL, 25 for plain) |
| Username | ✅ Yes | SMTP authentication username |
| Password | ✅ Yes | SMTP authentication password |
| From Address | ❌ No | Email sender address |
| TLS/SSL | ❌ No | Enable encryption (recommended) |

### Expected Behavior
- Emails sent when alert rules are triggered
- Scheduled reports delivered to configured recipients
- Retry logic for failed email deliveries
- HTML and plain text email formats supported
- Attachment support for reports and logs

### Use Cases
- Critical device alert notifications
- Daily/weekly device status summaries
- Compliance reporting via email
- User registration and password reset emails
- Incident notification to operations team

### Common SMTP Providers
- **Gmail**: smtp.gmail.com:587 (requires App Password)
- **Outlook**: smtp.office365.com:587
- **SendGrid**: smtp.sendgrid.net:587
- **Amazon SES**: email-smtp.us-east-1.amazonaws.com:587

---

## 💬 Slack
**Type:** `slack`  
**Category:** Team Messaging

### Purpose
Send real-time notifications to Slack channels for team collaboration on device events and system status.

### What it Does
- **Real-time Alerts**: Instant Slack messages when events occur
- **Channel Notifications**: Post to specific channels for team visibility
- **Rich Formatting**: Interactive messages with buttons and attachments
- **Thread Conversations**: Group related alerts in Slack threads
- **Mentions**: Tag team members for urgent issues

### Configuration Fields
| Field | Required | Description |
|-------|----------|-------------|
| Webhook URL | ✅ Yes | Slack Incoming Webhook URL |
| Channel | ✅ Yes | Target Slack channel (e.g., #alerts, #iot-status) |
| Username | ❌ No | Bot username displayed in messages |
| Icon | ❌ No | Custom emoji or image for bot avatar |

### Expected Behavior
- Instant messages appear in Slack when events trigger
- Rich message formatting with device details
- Clickable links to device dashboards
- Alert severity indicated by emoji and color coding
- Thread replies for follow-up on specific alerts

### Use Cases
- Real-time device alert notifications to ops team
- System health monitoring in dedicated Slack channel
- Incident response coordination via Slack
- Daily summary messages of device metrics
- Critical threshold breach notifications

### Setup Steps
1. Create Slack Incoming Webhook in your workspace
2. Copy the webhook URL
3. Configure target channel in integration settings
4. Test with sample notification

---

## 🔗 Custom Webhook
**Type:** `webhook`  
**Category:** Integration & Automation

### Purpose
Send HTTP POST requests to custom endpoints for event-driven integrations with external systems.

### What it Does
- **Event Forwarding**: POST device events to external APIs
- **Custom Automation**: Trigger workflows in third-party systems
- **Data Pipelines**: Stream device data to analytics platforms
- **Integration Hub**: Connect to Zapier, IFTTT, or custom services
- **Signature Verification**: HMAC signing for webhook authenticity

### Configuration Fields
| Field | Required | Description |
|-------|----------|-------------|
| Webhook URL | ✅ Yes | HTTP/HTTPS endpoint to receive POST requests |
| Secret Key | ❌ No | Shared secret for HMAC signature verification |
| Headers | ❌ No | Custom HTTP headers (JSON format) |
| Retry Policy | ❌ No | Number of retry attempts on failure |

### Expected Behavior
- POST request sent to webhook URL when events occur
- JSON payload includes event type, device data, and timestamp
- HMAC-SHA256 signature in `X-Signature` header (if secret key configured)
- Automatic retries on HTTP errors (3 attempts with exponential backoff)
- Timeout after 30 seconds

### Payload Format
```json
{
  "event": "device.alert",
  "timestamp": "2025-10-26T12:00:00Z",
  "device": {
    "id": "device-123",
    "name": "Temperature Sensor 1",
    "type": "sensor"
  },
  "data": {
    "temperature": 85.5,
    "threshold": 75.0,
    "severity": "warning"
  },
  "organization_id": "org-456"
}
```

### Use Cases
- Integration with Zapier, IFTTT, or n8n workflows
- Custom notification systems
- Data forwarding to analytics platforms
- Triggering automation in home automation systems
- CRM integration for customer device alerts

### Signature Verification (if secret key used)
```python
import hmac
import hashlib

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode(), 
        payload.encode(), 
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

---

## 📡 MQTT Broker
**Type:** `mqtt`  
**Category:** Device Messaging

### Purpose
Connect to MQTT broker for publish/subscribe messaging with IoT devices in real-time.

### What it Does
- **Pub/Sub Messaging**: Publish and subscribe to MQTT topics
- **Real-time Communication**: Low-latency device messaging
- **Command & Control**: Send commands to devices via MQTT
- **Telemetry Streaming**: Stream sensor data to cloud
- **QoS Support**: Guaranteed message delivery with QoS levels

### Configuration Fields
| Field | Required | Description |
|-------|----------|-------------|
| Broker URL | ✅ Yes | MQTT broker address (mqtt:// or mqtts://) |
| Port | ✅ Yes | Broker port (1883=MQTT, 8883=MQTTS, 80/443=WebSockets) |
| Username | ❌ No | MQTT authentication username |
| Password | ❌ No | MQTT authentication password |
| Client ID | ❌ No | Unique client identifier |
| TLS/SSL | ❌ No | Enable encrypted connection |
| Topics | ❌ No | Subscribe/publish topic patterns |

### Expected Behavior
- Maintain persistent connection to MQTT broker
- Subscribe to configured topic patterns
- Publish device events to MQTT topics
- Handle reconnection on network failures
- QoS 1 delivery guarantee (at least once)

### Topic Structure
```
netneural/{organization_id}/devices/{device_id}/telemetry
netneural/{organization_id}/devices/{device_id}/commands
netneural/{organization_id}/devices/{device_id}/status
netneural/{organization_id}/alerts/{alert_type}
```

### Use Cases
- Real-time device telemetry streaming
- Command and control for connected devices
- Integration with existing MQTT infrastructure
- Low-bandwidth device communication
- Edge computing with local MQTT broker

### Common MQTT Brokers
- **Mosquitto**: Open-source MQTT broker
- **HiveMQ**: Enterprise MQTT platform
- **AWS IoT Core**: MQTT over AWS
- **Azure IoT Hub**: MQTT protocol support
- **EMQX**: Scalable MQTT broker for IoT

---

## Integration Selection Guide

### Choose **Golioth** if you need:
- Turnkey IoT platform for embedded devices
- OTA firmware update capabilities
- Simple device provisioning and management

### Choose **AWS IoT Core** if you need:
- Integration with AWS ecosystem
- Enterprise-scale IoT deployments
- Advanced rules engine and analytics

### Choose **Azure IoT Hub** if you need:
- Microsoft Azure cloud integration
- Enterprise device management
- Azure AI/ML service integration

### Choose **Google Cloud IoT** if you need:
- Google Cloud Platform services
- BigQuery analytics on device data
- Google AI/ML capabilities

### Choose **Email (SMTP)** if you need:
- Simple email notifications
- Scheduled reports
- Wide recipient distribution

### Choose **Slack** if you need:
- Real-time team notifications
- Collaborative incident response
- Quick visibility into alerts

### Choose **Custom Webhook** if you need:
- Integration with custom systems
- Zapier/IFTTT automation
- Flexible event forwarding

### Choose **MQTT Broker** if you need:
- Real-time device messaging
- Low-latency communication
- Publish/subscribe patterns

---

## Testing Integrations

### Test Button Behavior
When you click "Test" on an active integration:

1. **Golioth**: Validates API key and lists connected devices
2. **AWS IoT Core**: Tests AWS credentials and connectivity
3. **Azure IoT Hub**: Validates connection string and hub access
4. **Google Cloud IoT**: Tests service account permissions
5. **Email (SMTP)**: Sends test email to configured address
6. **Slack**: Posts test message to configured channel
7. **Custom Webhook**: Sends test POST request with sample payload
8. **MQTT Broker**: Attempts connection and topic subscription

### Expected Test Results
- ✅ **Success**: Green toast notification with "Test successful"
- ❌ **Failure**: Red toast with specific error message
- Connection errors, authentication failures, or timeout issues displayed

---

## Security Best Practices

1. **API Keys & Credentials**: Never commit credentials to code repositories
2. **Encryption**: Use TLS/SSL for all integrations (MQTTS, HTTPS, SMTPS)
3. **Webhook Signatures**: Always configure secret keys for webhook verification
4. **Least Privilege**: Use IAM roles with minimum required permissions
5. **Rotation**: Regularly rotate API keys and access credentials
6. **Monitoring**: Enable logging and monitor for unusual integration activity

---

## Troubleshooting

### Integration shows "Not Configured" status
- Complete all required configuration fields
- Click "Save Configuration" after entering values

### Integration shows "Inactive" status
- Check credentials are valid and not expired
- Verify network connectivity to integration endpoint
- Review firewall rules and IP whitelist settings

### Integration shows "Error" status
- Click "Edit" to view error details
- Check service status of third-party platform
- Verify configuration values are correct
- Test connectivity from server to endpoint

### No data flowing to integration
- Verify integration is "Active" status
- Check alert rules are configured to use this integration
- Review integration logs for errors
- Confirm devices are sending telemetry data

---

## Integration Limits

| Integration | Rate Limit | Max Concurrent | Payload Size |
|-------------|------------|----------------|--------------|
| Golioth | 100 req/min | 50 connections | 256 KB |
| AWS IoT Core | 300 msg/sec | 500 connections | 128 KB |
| Azure IoT Hub | 100 msg/sec | 1000 connections | 256 KB |
| Google Cloud IoT | 100 msg/sec | 100 connections | 256 KB |
| Email (SMTP) | 10 emails/min | 5 connections | 10 MB |
| Slack | 1 msg/sec | 1 connection | 4 KB |
| Custom Webhook | 50 req/min | 10 connections | 1 MB |
| MQTT Broker | 1000 msg/sec | 100 connections | 256 KB |

*Limits are default values and may vary based on your plan and integration provider settings.*
