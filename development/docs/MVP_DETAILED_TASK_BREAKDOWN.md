# 🎯 NetNeural MVP - Detailed User Stories & Task Breakdown

**Report Date**: August 12, 2025  
**Purpose**: Granular task breakdown for remaining 29% MVP work  
**Format**: User stories with acceptance criteria and implementation tasks  

---

## 📋 Document Structure

This document breaks down each remaining epic into:
- **User Stories** (business value perspective)
- **Acceptance Criteria** (definition of done)
- **Technical Tasks** (specific implementation work)
- **Dependencies** (what needs to be done first)
- **Testing Requirements** (validation criteria)

---

## 🚧 Epic 1: Hierarchical Data Management (10% Remaining)

### **Story 1.1: Enhanced Entity Validation**
```
As a system administrator,
I want comprehensive validation on all entity data entry,
So that our database maintains data integrity and business rules.
```

**Why This Is Missing:**
Currently, basic validation exists but lacks business rule enforcement and advanced field validation.

**What's Wrong Now:**
- No email format validation for contact fields
- No phone number format checking
- Can create unlimited locations per subsidiary (no capacity limits)
- Bulk operations not available (users must add entities one by one)

**Acceptance Criteria:**
- [ ] Email addresses must follow RFC 5322 format
- [ ] Phone numbers must follow E.164 international format
- [ ] Subsidiaries can have maximum 50 locations (configurable)
- [ ] Locations can have maximum 20 departments (configurable)
- [ ] Bulk import/export works for all entity types

**Technical Tasks:**

**Task 1.1.1: Advanced Field Validation**
```bash
Files to Modify:
├── account-manager/main.go
│   ├── Add email validation using regexp
│   ├── Add phone number validation
│   └── Add field length validation

├── account-manager/validation/
│   ├── email_validator.go (NEW)
│   ├── phone_validator.go (NEW)
│   └── business_rules.go (NEW)

Implementation Details:
├── Install validation library: go get github.com/go-playground/validator/v10
├── Create custom validation tags
├── Add validation middleware to API endpoints
└── Return detailed validation errors to frontend

Effort: 2 days
Developer: 1 Backend
```

**Task 1.1.2: Business Rules Engine**
```bash
Files to Modify:
├── account-manager/business_rules/
│   ├── capacity_limits.go (NEW)
│   ├── hierarchy_rules.go (NEW)
│   └── validation_engine.go (NEW)

├── Database Schema:
│   ├── ALTER TABLE subsidiaries ADD COLUMN max_locations INT DEFAULT 50
│   ├── ALTER TABLE locations ADD COLUMN max_departments INT DEFAULT 20
│   └── CREATE INDEX idx_hierarchy_counts ON locations(subsidiary_id)

Implementation Details:
├── Create configurable business rules
├── Add pre-save validation hooks
├── Implement capacity checking before entity creation
└── Add admin interface for rule configuration

Effort: 3 days
Developer: 1 Backend
```

**Task 1.1.3: Bulk Import/Export System**
```bash
Files to Modify:
├── account-manager/bulk/
│   ├── csv_importer.go (NEW)
│   ├── excel_exporter.go (NEW)
│   └── bulk_validator.go (NEW)

├── origin-ui/src/components/bulk/
│   ├── BulkImporter.tsx (NEW)
│   ├── BulkExporter.tsx (NEW)
│   └── ImportProgress.tsx (NEW)

API Endpoints to Add:
├── POST /api/entities/bulk-import
├── GET /api/entities/bulk-export
├── GET /api/entities/bulk-template
└── GET /api/entities/import-status/:jobId

Implementation Details:
├── CSV/Excel parsing with validation
├── Background job processing for large imports
├── Progress tracking and error reporting
├── Template generation for proper format
└── Rollback capability for failed imports

Effort: 5 days
Developer: 1 Backend + 1 Frontend
```

---

### **Story 1.2: Comprehensive Audit Trail**
```
As a compliance officer,
I want detailed change tracking for all entity modifications,
So that I can maintain audit compliance and investigate issues.
```

**Why This Is Missing:**
Basic audit logging exists but lacks detailed change tracking, user attribution, and rollback capabilities.

**What's Wrong Now:**
- Only logs "entity created/updated/deleted" without field-level changes
- No easy way to see what changed from old value to new value
- Cannot rollback changes if mistakes are made
- No audit reports for compliance

**Acceptance Criteria:**
- [ ] Track field-level changes (old value → new value)
- [ ] Record user who made each change with timestamp
- [ ] Provide rollback capability for critical entities
- [ ] Generate audit reports for date ranges
- [ ] Export audit logs for compliance

**Technical Tasks:**

**Task 1.2.1: Enhanced Change Tracking**
```bash
Files to Modify:
├── iot-common/audit/
│   ├── change_tracker.go (NEW)
│   ├── field_differ.go (NEW)
│   └── audit_logger.go (ENHANCE)

├── Database Schema:
│   ├── CREATE TABLE audit_changes (
│   │     id UUID PRIMARY KEY,
│   │     table_name VARCHAR(100),
│   │     record_id UUID,
│   │     field_name VARCHAR(100),
│   │     old_value TEXT,
│   │     new_value TEXT,
│   │     user_id UUID,
│   │     timestamp TIMESTAMP,
│   │     operation VARCHAR(20)
│   │   )
│   └── CREATE INDEX idx_audit_changes_record ON audit_changes(table_name, record_id)

Implementation Details:
├── Implement before/after comparison logic
├── JSON serialization for complex field changes
├── Automatic trigger generation for all entity tables
├── User context propagation to database layer
└── Efficient storage for large text fields

Effort: 3 days
Developer: 1 Backend
```

**Task 1.2.2: Rollback System**
```bash
Files to Modify:
├── account-manager/rollback/
│   ├── rollback_engine.go (NEW)
│   ├── snapshot_manager.go (NEW)
│   └── rollback_validator.go (NEW)

API Endpoints to Add:
├── GET /api/entities/{id}/history
├── POST /api/entities/{id}/rollback/{timestamp}
├── GET /api/entities/{id}/snapshot/{timestamp}
└── POST /api/entities/rollback/preview

Implementation Details:
├── Create entity snapshots before major changes
├── Validate rollback operations for dependencies
├── Preview rollback changes before execution
├── Rollback approval workflow for critical entities
└── Cascade rollback handling for related entities

Effort: 4 days
Developer: 1 Backend
```

**Task 1.2.3: Audit Reporting Interface**
```bash
Files to Modify:
├── origin-ui/src/components/audit/
│   ├── AuditReportDashboard.tsx (NEW)
│   ├── ChangeHistory.tsx (NEW)
│   ├── AuditFilters.tsx (NEW)
│   └── AuditExporter.tsx (NEW)

Features to Implement:
├── Date range filtering for audit reports
├── User-specific change tracking
├── Entity-specific audit trails
├── Change visualization (before/after comparison)
├── PDF/CSV export for compliance reports

Implementation Details:
├── Advanced filtering and search capabilities
├── Change diff visualization component
├── Pagination for large audit datasets
├── Real-time audit log updates
└── Role-based audit data access

Effort: 3 days
Developer: 1 Frontend
```

---

## 🚧 Epic 2: Golioth IoT Integration (51% Remaining) - CRITICAL PATH

### **Story 2.1: Real IoT Device Connectivity**
```
As an IoT technician,
I want to connect real sensors through Golioth platform,
So that we can manage actual IoT deployments instead of mock data.
```

**Why This Is Missing:**
Currently the system only works with mock sensor data. No real IoT devices can be connected.

**What's Wrong Now:**
- All sensor data is generated by mock functions
- No way to provision real IoT devices
- Cannot connect to Golioth cloud platform
- No real-time data from actual sensors

**Acceptance Criteria:**
- [ ] Connect to Golioth Management API
- [ ] Provision real IoT devices with certificates
- [ ] Receive real sensor data through LightDB Stream
- [ ] Monitor device connectivity status
- [ ] Handle device offline/online events

**Technical Tasks:**

**Task 2.1.1: Golioth SDK Integration**
```bash
Files to Create:
├── golioth-integration/
│   ├── main.go
│   ├── client/
│   │   ├── golioth_client.go
│   │   ├── auth_manager.go
│   │   └── device_manager.go
│   ├── models/
│   │   ├── device.go
│   │   ├── certificate.go
│   │   └── stream_data.go
│   └── config/
│       ├── golioth_config.go
│       └── environment.go

Dependencies to Add:
├── go.mod: Add Golioth SDK
├── docker-compose.yml: Add golioth-integration service
├── .env: Add Golioth API credentials
└── helm/: Add golioth-integration deployment

What This Solves:
├── Establishes connection to Golioth cloud
├── Provides authentication for device operations
├── Creates foundation for all IoT functionality
└── Enables real device management

Implementation Details:
├── Install Golioth Go SDK
├── Configure API authentication
├── Create connection pooling for multiple devices
├── Add error handling and retry logic
├── Implement rate limiting for API calls

Effort: 1 week
Developer: 1 Senior Backend (IoT experience required)
```

**Task 2.1.2: Device Provisioning Workflow**
```bash
Files to Modify:
├── golioth-integration/provisioning/
│   ├── device_provisioner.go (NEW)
│   ├── certificate_manager.go (NEW)
│   └── provisioning_workflow.go (NEW)

├── origin-ui/src/components/devices/
│   ├── DeviceProvisioning.tsx (NEW)
│   ├── CertificateUpload.tsx (NEW)
│   └── ProvisioningStatus.tsx (NEW)

Database Changes:
├── CREATE TABLE golioth_devices (
│   │   id UUID PRIMARY KEY,
│   │   golioth_device_id VARCHAR(255),
│   │   certificate_id VARCHAR(255),
│   │   device_name VARCHAR(255),
│   │   provisioning_status VARCHAR(50),
│   │   last_seen TIMESTAMP,
│   │   created_at TIMESTAMP
│   )
└── ALTER TABLE sensors ADD COLUMN golioth_device_id UUID

What This Solves:
├── Allows adding real IoT devices to the system
├── Manages device certificates and security
├── Tracks device provisioning status
└── Links Golioth devices to our sensor entities

API Endpoints to Add:
├── POST /api/devices/provision
├── GET /api/devices/provisioning-status/{id}
├── PUT /api/devices/{id}/certificate
├── DELETE /api/devices/{id}/deprovision
└── GET /api/devices/available

Implementation Steps:
1. Create device provisioning API
2. Build certificate management system
3. Add provisioning UI workflow
4. Implement status tracking
5. Add device decommissioning

Effort: 1 week
Developer: 1 Backend + 1 Frontend
```

**Task 2.1.3: LightDB Stream Integration**
```bash
Files to Modify:
├── golioth-integration/streaming/
│   ├── lightdb_client.go (NEW)
│   ├── stream_processor.go (NEW)
│   ├── data_transformer.go (NEW)
│   └── real_time_updater.go (NEW)

├── data-manager/ (MAJOR CHANGES)
│   ├── Replace mock data generation
│   ├── Add Golioth stream consumption
│   ├── Add data validation for real sensors
│   └── Add real-time data pipeline

What This Solves:
├── Replaces mock sensor data with real readings
├── Provides real-time updates from actual sensors
├── Enables live dashboard updates
└── Supports historical data collection

Current Problem:
// Current mock data in UnifiedDashboard.tsx
const generateMockSensorReadings = () => {
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${23 - i}:00`,
    value: Math.round(20 + Math.random() * 10)
  }));
};

New Implementation:
// Real data from Golioth LightDB Stream
const fetchRealSensorData = async (deviceId: string) => {
  const response = await fetch(`/api/golioth/devices/${deviceId}/stream`);
  return response.json();
};

Technical Implementation:
├── WebSocket connection to LightDB Stream
├── Data transformation from Golioth format to our schema
├── Real-time database updates
├── Conflict resolution for simultaneous updates
├── Data validation and error handling

Effort: 1.5 weeks
Developer: 2 Backend developers
```

---

### **Story 2.2: IoT Pipeline Configuration**
```
As an IoT administrator,
I want to configure data processing pipelines for different sensor types,
So that I can customize how sensor data is processed and stored.
```

**Why This Is Missing:**
Currently there's no way to configure how sensor data flows through the system or apply custom processing rules.

**What's Wrong Now:**
- All sensor data processed the same way regardless of type
- No custom alerts or thresholds per sensor type
- Cannot route data to different destinations
- No way to transform data before storage

**Acceptance Criteria:**
- [ ] Visual pipeline editor for data flow
- [ ] Custom processing rules per sensor type
- [ ] Data routing to different storage/alert systems
- [ ] Pipeline testing and validation
- [ ] Pipeline monitoring and debugging

**Technical Tasks:**

**Task 2.2.1: Pipeline Configuration Engine**
```bash
Files to Create:
├── pipeline-config/
│   ├── main.go
│   ├── engine/
│   │   ├── pipeline_engine.go
│   │   ├── rule_processor.go
│   │   ├── data_router.go
│   │   └── transformation_engine.go
│   ├── models/
│   │   ├── pipeline.go
│   │   ├── rule.go
│   │   └── transformation.go
│   └── handlers/
│       ├── pipeline_handler.go
│       ├── rule_handler.go
│       └── testing_handler.go

Database Schema:
├── CREATE TABLE pipelines (
│   │   id UUID PRIMARY KEY,
│   │   name VARCHAR(255),
│   │   sensor_type VARCHAR(100),
│   │   configuration JSONB,
│   │   is_active BOOLEAN,
│   │   created_by UUID,
│   │   created_at TIMESTAMP
│   )
├── CREATE TABLE pipeline_rules (
│   │   id UUID PRIMARY KEY,
│   │   pipeline_id UUID,
│   │   rule_type VARCHAR(50),
│   │   conditions JSONB,
│   │   actions JSONB,
│   │   order_index INTEGER
│   )
└── CREATE TABLE pipeline_executions (
│       id UUID PRIMARY KEY,
│       pipeline_id UUID,
│       input_data JSONB,
│       output_data JSONB,
│       execution_time_ms INTEGER,
│       status VARCHAR(50),
│       executed_at TIMESTAMP
│     )

What This Solves:
├── Configurable data processing per sensor type
├── Custom business logic for different use cases
├── Scalable rule engine for complex scenarios
└── Audit trail for pipeline executions

Effort: 2 weeks
Developer: 1 Senior Backend
```

**Task 2.2.2: Visual Pipeline Editor**
```bash
Files to Create:
├── origin-ui/src/components/pipelines/
│   ├── PipelineEditor.tsx (NEW)
│   ├── PipelineDiagram.tsx (NEW)
│   ├── RuleBuilder.tsx (NEW)
│   ├── TransformationEditor.tsx (NEW)
│   └── PipelineTestRunner.tsx (NEW)

Dependencies to Add:
├── npm install react-flow-renderer (for visual pipeline editing)
├── npm install monaco-editor (for rule/transformation editing)
├── npm install react-json-editor-ajrm (for JSON configuration)

Features to Implement:
├── Drag-and-drop pipeline component creation
├── Visual data flow representation
├── Rule condition builder (if/then/else logic)
├── Data transformation editor
├── Pipeline testing with sample data
├── Real-time pipeline execution monitoring

What This Solves:
├── Non-technical users can configure pipelines
├── Visual representation makes complex flows understandable
├── Testing prevents pipeline errors in production
└── Monitoring helps debug pipeline issues

Example Pipeline Configuration:
```json
{
  "name": "Temperature Sensor Pipeline",
  "sensorType": "temperature",
  "steps": [
    {
      "type": "validation",
      "rules": {
        "minValue": -40,
        "maxValue": 85,
        "unit": "celsius"
      }
    },
    {
      "type": "transformation",
      "convert": "fahrenheit",
      "formula": "(celsius * 9/5) + 32"
    },
    {
      "type": "alert",
      "conditions": {
        "if": "value > 80",
        "then": "trigger_high_temp_alert"
      }
    },
    {
      "type": "storage",
      "destinations": ["timeseries_db", "data_lake"]
    }
  ]
}
```

Effort: 2 weeks
Developer: 1 Frontend + 1 Backend
```

---

### **Story 2.3: Device Health Monitoring**
```
As an IoT operations manager,
I want real-time monitoring of device connectivity and health,
So that I can proactively address device issues before they impact operations.
```

**Why This Is Missing:**
Currently no way to monitor if devices are actually online, offline, or having connectivity issues.

**What's Wrong Now:**
- Device status is just mock "online/offline" flags
- No connectivity quality metrics
- Cannot detect devices that are struggling with network issues
- No alerts when devices go offline unexpectedly

**Acceptance Criteria:**
- [ ] Real-time connectivity status for all devices
- [ ] Network quality metrics (signal strength, latency)
- [ ] Automatic offline device detection
- [ ] Connectivity alerts and notifications
- [ ] Historical connectivity reporting

**Technical Tasks:**

**Task 2.3.1: Device Heartbeat System**
```bash
Files to Modify:
├── golioth-integration/monitoring/
│   ├── heartbeat_monitor.go (NEW)
│   ├── connectivity_tracker.go (NEW)
│   └── health_checker.go (NEW)

├── alert-listener/ (ENHANCE)
│   ├── Add connectivity alert rules
│   ├── Add device offline detection
│   └── Add network quality alerts

Database Changes:
├── CREATE TABLE device_heartbeats (
│   │   device_id UUID,
│   │   timestamp TIMESTAMP,
│   │   signal_strength INTEGER,
│   │   battery_level INTEGER,
│   │   network_latency_ms INTEGER,
│   │   data_usage_bytes BIGINT
│   )
├── CREATE TABLE connectivity_events (
│   │   id UUID PRIMARY KEY,
│   │   device_id UUID,
│   │   event_type VARCHAR(50), -- 'connected', 'disconnected', 'reconnected'
│   │   timestamp TIMESTAMP,
│   │   metadata JSONB
│   )
└── CREATE INDEX idx_heartbeats_device_time ON device_heartbeats(device_id, timestamp)

What This Solves:
├── Proactive device issue detection
├── Network quality monitoring
├── Automated offline device alerts
└── Historical connectivity analysis

Implementation Logic:
// Heartbeat processing
func ProcessHeartbeat(deviceID string, data HeartbeatData) {
    // Store heartbeat data
    storeHeartbeat(deviceID, data)
    
    // Check for connectivity issues
    if data.SignalStrength < SIGNAL_THRESHOLD {
        triggerLowSignalAlert(deviceID)
    }
    
    // Update device online status
    updateDeviceStatus(deviceID, "online")
    
    // Schedule offline check
    scheduleOfflineCheck(deviceID, HEARTBEAT_INTERVAL * 2)
}

Effort: 1 week
Developer: 1 Backend
```

---

## 🚧 Epic 7: Business Intelligence & Reporting (85% Remaining) - HIGH PRIORITY

### **Story 7.1: Comprehensive Sensor Health Dashboard**
```
As a facility manager,
I want detailed health reports for all sensors in my locations,
So that I can make data-driven decisions about maintenance and operations.
```

**Why This Is Missing:**
Currently there's no business intelligence or reporting beyond basic dashboard charts.

**What's Wrong Now:**
- Cannot generate reports for management
- No way to analyze sensor performance over time
- No maintenance scheduling based on sensor health
- Cannot compare performance across locations

**Acceptance Criteria:**
- [ ] Sensor uptime and reliability reports
- [ ] Performance trending and analysis
- [ ] Predictive maintenance recommendations
- [ ] Location and department performance comparison
- [ ] Automated health scoring for sensors

**Technical Tasks:**

**Task 7.1.1: Health Analytics Engine**
```bash
Files to Create:
├── reporting-engine/
│   ├── main.go
│   ├── analytics/
│   │   ├── health_calculator.go
│   │   ├── trend_analyzer.go
│   │   ├── performance_scorer.go
│   │   └── predictive_maintenance.go
│   ├── reports/
│   │   ├── sensor_health_report.go
│   │   ├── location_comparison.go
│   │   └── maintenance_recommendations.go
│   └── data/
│       ├── aggregator.go
│       ├── time_series_processor.go
│       └── statistical_analyzer.go

Database Schema:
├── CREATE TABLE sensor_health_scores (
│   │   sensor_id UUID,
│   │   date DATE,
│   │   uptime_percentage DECIMAL(5,2),
│   │   data_quality_score DECIMAL(5,2),
│   │   performance_score DECIMAL(5,2),
│   │   overall_health_score DECIMAL(5,2),
│   │   maintenance_risk VARCHAR(20)
│   )
├── CREATE TABLE performance_trends (
│   │   id UUID PRIMARY KEY,
│   │   sensor_id UUID,
│   │   metric_name VARCHAR(100),
│   │   time_period VARCHAR(20), -- 'daily', 'weekly', 'monthly'
│   │   trend_direction VARCHAR(20), -- 'improving', 'stable', 'declining'
│   │   trend_strength DECIMAL(5,2),
│   │   calculated_at TIMESTAMP
│   )
└── CREATE VIEW sensor_health_summary AS
    SELECT s.id, s.name, s.location,
           AVG(shs.overall_health_score) as avg_health,
           MAX(shs.maintenance_risk) as highest_risk
    FROM sensors s
    LEFT JOIN sensor_health_scores shs ON s.id = shs.sensor_id
    WHERE shs.date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY s.id, s.name, s.location;

What This Solves:
├── Objective health scoring for all sensors
├── Trend analysis for performance optimization
├── Predictive maintenance scheduling
└── Data-driven decision making

Health Score Calculation:
```go
type HealthMetrics struct {
    UptimePercentage    float64 // % time online in period
    DataQualityScore    float64 // Valid readings / total readings
    ResponseTimeAvg     float64 // Average response time
    BatteryHealth       float64 // Battery degradation rate
    ErrorRate           float64 // Failed readings / total readings
}

func CalculateOverallHealthScore(metrics HealthMetrics) float64 {
    // Weighted scoring algorithm
    weights := map[string]float64{
        "uptime":      0.30,
        "quality":     0.25,
        "response":    0.20,
        "battery":     0.15,
        "errors":      0.10,
    }
    
    score := (metrics.UptimePercentage * weights["uptime"]) +
             (metrics.DataQualityScore * weights["quality"]) +
             ((100 - metrics.ResponseTimeAvg/10) * weights["response"]) +
             (metrics.BatteryHealth * weights["battery"]) +
             ((100 - metrics.ErrorRate) * weights["errors"])
             
    return math.Min(100, math.Max(0, score))
}
```

Effort: 1.5 weeks
Developer: 1 Backend + 1 Data Analyst
```

**Task 7.1.2: Interactive Health Dashboard**
```bash
Files to Create:
├── origin-ui/src/components/health/
│   ├── SensorHealthDashboard.tsx (NEW)
│   ├── HealthScoreCard.tsx (NEW)
│   ├── TrendChart.tsx (NEW)
│   ├── MaintenanceSchedule.tsx (NEW)
│   ├── PerformanceComparison.tsx (NEW)
│   └── HealthFilters.tsx (NEW)

Features to Implement:
├── Real-time health score display
├── Interactive trend charts
├── Maintenance recommendation alerts
├── Location performance heatmaps
├── Drill-down capability from overview to sensor detail
├── Health score history graphs

What This Solves:
├── Visual representation of sensor health
├── Easy identification of problem sensors
├── Maintenance planning interface
└── Executive-level performance overview

Dashboard Layout:
```tsx
const SensorHealthDashboard = () => {
  return (
    <div className="health-dashboard">
      {/* Overview Cards */}
      <div className="health-overview">
        <HealthScoreCard title="Overall Health" score={87} trend="up" />
        <HealthScoreCard title="Critical Sensors" score={3} trend="down" />
        <HealthScoreCard title="Maintenance Due" score={12} trend="stable" />
      </div>
      
      {/* Interactive Charts */}
      <div className="health-charts">
        <TrendChart 
          title="Health Trends (30 days)"
          data={healthTrendData}
          metrics={['uptime', 'quality', 'battery']}
        />
        <PerformanceComparison 
          title="Location Performance"
          data={locationComparisonData}
        />
      </div>
      
      {/* Maintenance Recommendations */}
      <MaintenanceSchedule 
        recommendations={maintenanceData}
        onSchedule={handleMaintenanceScheduling}
      />
      
      {/* Detailed Sensor List */}
      <SensorHealthTable 
        sensors={sensorHealthData}
        onDrillDown={handleSensorDrillDown}
      />
    </div>
  );
};
```

Effort: 1 week
Developer: 1 Frontend
```

---

### **Story 7.2: Comprehensive Business Reports**
```
As a business analyst,
I want to generate detailed reports about sensor operations and performance,
So that I can provide insights to management and stakeholders.
```

**Why This Is Missing:**
No way to generate formal business reports for management, compliance, or stakeholder presentations.

**What's Wrong Now:**
- Cannot export data for presentations
- No standardized report formats
- No way to schedule automatic reports
- No compliance reporting capabilities

**Acceptance Criteria:**
- [ ] PDF report generation with company branding
- [ ] CSV/Excel export for data analysis
- [ ] Scheduled report delivery via email
- [ ] Custom report templates
- [ ] Compliance reports (uptime, data quality, incidents)

**Technical Tasks:**

**Task 7.2.1: Report Generation Engine**
```bash
Files to Create:
├── report-generator/
│   ├── main.go
│   ├── templates/
│   │   ├── sensor_performance_report.html
│   │   ├── compliance_report.html
│   │   ├── executive_summary.html
│   │   └── maintenance_report.html
│   ├── generators/
│   │   ├── pdf_generator.go
│   │   ├── excel_generator.go
│   │   ├── csv_generator.go
│   │   └── template_processor.go
│   ├── schedulers/
│   │   ├── report_scheduler.go
│   │   ├── email_sender.go
│   │   └── delivery_manager.go
│   └── data/
│       ├── report_data_collector.go
│       ├── chart_generator.go
│       └── table_formatter.go

Dependencies to Add:
├── go get github.com/jung-kurt/gofpdf (PDF generation)
├── go get github.com/360EntSecGroup-Skylar/excelize/v2 (Excel generation)
├── go get github.com/robfig/cron/v3 (Report scheduling)

Database Schema:
├── CREATE TABLE report_templates (
│   │   id UUID PRIMARY KEY,
│   │   name VARCHAR(255),
│   │   description TEXT,
│   │   template_type VARCHAR(50), -- 'performance', 'compliance', 'executive'
│   │   template_content TEXT,
│   │   created_by UUID,
│   │   created_at TIMESTAMP
│   )
├── CREATE TABLE scheduled_reports (
│   │   id UUID PRIMARY KEY,
│   │   template_id UUID,
│   │   name VARCHAR(255),
│   │   schedule_cron VARCHAR(100),
│   │   recipients TEXT[], -- email addresses
│   │   parameters JSONB,
│   │   is_active BOOLEAN,
│   │   last_generated TIMESTAMP
│   )
└── CREATE TABLE report_history (
│       id UUID PRIMARY KEY,
│       scheduled_report_id UUID,
│       generated_at TIMESTAMP,
│       file_path VARCHAR(500),
│       file_size BIGINT,
│       generation_time_ms INTEGER,
│       status VARCHAR(50)
│     )

What This Solves:
├── Professional reports for management
├── Automated compliance reporting
├── Data export for external analysis
└── Branded company reports

Example Report Generation:
```go
type ReportData struct {
    Title           string
    GeneratedAt     time.Time
    DateRange       DateRange
    LocationSummary []LocationSummary
    SensorMetrics   []SensorMetric
    Charts          []ChartData
    Recommendations []string
}

func GeneratePDFReport(template string, data ReportData) (*bytes.Buffer, error) {
    pdf := gofpdf.New("P", "mm", "A4", "")
    
    // Add company logo and branding
    addCompanyHeader(pdf)
    
    // Add report title and metadata
    addReportHeader(pdf, data.Title, data.GeneratedAt)
    
    // Add executive summary
    addExecutiveSummary(pdf, data.LocationSummary)
    
    // Add detailed metrics tables
    addMetricsTables(pdf, data.SensorMetrics)
    
    // Add charts and visualizations
    addChartsSection(pdf, data.Charts)
    
    // Add recommendations
    addRecommendations(pdf, data.Recommendations)
    
    return getPDFBuffer(pdf), nil
}
```

Effort: 2 weeks
Developer: 1 Backend
```

**Task 7.2.2: Report Builder Interface**
```bash
Files to Create:
├── origin-ui/src/components/reports/
│   ├── ReportBuilder.tsx (NEW)
│   ├── TemplateEditor.tsx (NEW)
│   ├── ReportScheduler.tsx (NEW)
│   ├── ReportLibrary.tsx (NEW)
│   ├── ReportPreview.tsx (NEW)
│   └── ReportHistory.tsx (NEW)

Features to Implement:
├── Drag-and-drop report section builder
├── Live report preview
├── Template management system
├── Scheduled report configuration
├── Report history and re-generation
├── Custom branding options

What This Solves:
├── Non-technical users can create reports
├── Consistent report formatting
├── Self-service reporting capability
└── Automated report distribution

Report Builder Interface:
```tsx
const ReportBuilder = () => {
  const [reportSections, setReportSections] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  return (
    <div className="report-builder">
      <div className="builder-sidebar">
        <h3>Report Sections</h3>
        <DraggableSection type="executive-summary" />
        <DraggableSection type="sensor-metrics" />
        <DraggableSection type="performance-charts" />
        <DraggableSection type="maintenance-schedule" />
        <DraggableSection type="recommendations" />
      </div>
      
      <div className="builder-canvas">
        <ReportCanvas 
          sections={reportSections}
          onSectionAdd={handleSectionAdd}
          onSectionRemove={handleSectionRemove}
          onSectionEdit={handleSectionEdit}
        />
      </div>
      
      <div className="builder-properties">
        <ReportProperties 
          template={selectedTemplate}
          onTemplateChange={handleTemplateChange}
        />
        <ReportScheduling 
          onScheduleUpdate={handleScheduleUpdate}
        />
      </div>
      
      <div className="builder-actions">
        <button onClick={handlePreview}>Preview Report</button>
        <button onClick={handleGenerate}>Generate Report</button>
        <button onClick={handleSaveTemplate}>Save Template</button>
      </div>
    </div>
  );
};
```

Effort: 2 weeks
Developer: 1 Frontend + 1 Backend
```

---

## 🧪 Cross-Cutting: Testing & Quality Assurance (75% Remaining)

### **Story QA.1: Comprehensive Testing Framework**
```
As a development team lead,
I want comprehensive automated testing across all services,
So that we can deploy confidently and maintain code quality.
```

**Why This Is Missing:**
Currently no automated testing framework exists, making deployments risky and code quality uncertain.

**What's Wrong Now:**
- No unit tests for Go services
- No integration tests between services
- No frontend component testing
- Manual testing only, which is error-prone and slow

**Acceptance Criteria:**
- [ ] 80% code coverage across all Go services
- [ ] Unit tests for all React components
- [ ] Integration tests for service communication
- [ ] End-to-end tests for critical workflows
- [ ] Automated test execution in CI/CD

**Technical Tasks:**

**Task QA.1.1: Go Services Unit Testing**
```bash
Files to Create (Per Service):
├── account-manager/
│   ├── handlers_test.go
│   ├── business_logic_test.go
│   ├── validation_test.go
│   └── integration_test.go

├── device-ingress/
│   ├── ingestion_test.go
│   ├── data_processing_test.go
│   ├── api_handlers_test.go
│   └── integration_test.go

├── alert-listener/
│   ├── alert_processing_test.go
│   ├── notification_test.go
│   ├── rule_engine_test.go
│   └── integration_test.go

Testing Framework Setup:
├── go.mod: Add testing dependencies
│   ├── github.com/stretchr/testify
│   ├── github.com/DATA-DOG/go-sqlmock
│   ├── github.com/golang/mock
│   └── github.com/onsi/ginkgo/v2

├── Makefile: Add test commands
│   ├── test: Run all unit tests
│   ├── test-integration: Run integration tests
│   ├── test-coverage: Generate coverage reports
│   └── test-bench: Run benchmark tests

Example Test Implementation:
```go
// account-manager/handlers_test.go
func TestCreateSubsidiary(t *testing.T) {
    // Setup
    db, mock, err := sqlmock.New()
    require.NoError(t, err)
    defer db.Close()
    
    handler := &SubsidiaryHandler{db: db}
    
    // Test cases
    tests := []struct {
        name           string
        input          CreateSubsidiaryRequest
        mockSetup      func()
        expectedStatus int
        expectedError  string
    }{
        {
            name: "Valid subsidiary creation",
            input: CreateSubsidiaryRequest{
                Name:    "Test Corp",
                Address: "123 Test St",
                Contact: "test@test.com",
            },
            mockSetup: func() {
                mock.ExpectExec("INSERT INTO subsidiaries").
                    WithArgs("Test Corp", "123 Test St", "test@test.com").
                    WillReturnResult(sqlmock.NewResult(1, 1))
            },
            expectedStatus: 201,
        },
        {
            name: "Invalid email format",
            input: CreateSubsidiaryRequest{
                Name:    "Test Corp",
                Address: "123 Test St",
                Contact: "invalid-email",
            },
            expectedStatus: 400,
            expectedError:  "invalid email format",
        },
    }
    
    // Execute tests
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if tt.mockSetup != nil {
                tt.mockSetup()
            }
            
            // Create request
            reqBody, _ := json.Marshal(tt.input)
            req := httptest.NewRequest("POST", "/subsidiaries", bytes.NewBuffer(reqBody))
            w := httptest.NewRecorder()
            
            // Execute
            handler.CreateSubsidiary(w, req)
            
            // Assert
            assert.Equal(t, tt.expectedStatus, w.Code)
            if tt.expectedError != "" {
                assert.Contains(t, w.Body.String(), tt.expectedError)
            }
        })
    }
}
```

Coverage Requirements by Service:
├── account-manager: 85% (critical business logic)
├── device-ingress: 80% (data processing)
├── alert-listener: 85% (critical notifications)
├── sso: 90% (security critical)
├── data-manager: 75% (data transformation)
└── golioth-integration: 80% (new critical component)

Effort: 3 weeks
Developer: 2 Backend + 1 DevOps
```

**Task QA.1.2: Frontend Component Testing**
```bash
Files to Create:
├── origin-ui/src/components/__tests__/
│   ├── UnifiedDashboard.test.tsx
│   ├── SensorCard.test.tsx
│   ├── AlertPanel.test.tsx
│   ├── SensorAnalytics.test.tsx
│   └── MetricCard.test.tsx

├── origin-ui/src/utils/__tests__/
│   ├── mockDataGenerators.test.ts
│   ├── formatters.test.ts
│   └── validators.test.ts

Testing Setup:
├── package.json: Add testing dependencies
│   ├── @testing-library/react
│   ├── @testing-library/jest-dom
│   ├── @testing-library/user-event
│   ├── jest-environment-jsdom
│   └── msw (for API mocking)

├── jest.config.js: Configure Jest
├── setupTests.ts: Global test setup
└── __mocks__/: Mock implementations

Example Component Test:
```tsx
// UnifiedDashboard.test.tsx
describe('UnifiedDashboard', () => {
  const mockSensors = [
    {
      id: '1',
      name: 'Temperature Sensor',
      type: 'temperature',
      status: 'online' as const,
      value: 22.5,
      unit: '°C',
      location: 'Room 101'
    }
  ];

  beforeEach(() => {
    // Mock API calls
    server.use(
      rest.get('/api/sensors', (req, res, ctx) => {
        return res(ctx.json({ sensors: mockSensors }));
      })
    );
  });

  it('renders sensor data correctly', async () => {
    render(<UnifiedDashboard mode="demo" />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument();
    });
    
    // Check sensor value display
    expect(screen.getByText('22.5°C')).toBeInTheDocument();
    
    // Check status badge
    expect(screen.getByText('online')).toBeInTheDocument();
    expect(screen.getByText('online')).toHaveClass('status-online');
  });

  it('handles sensor click for analytics', async () => {
    const user = userEvent.setup();
    render(<UnifiedDashboard mode="demo" />);
    
    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument();
    });
    
    // Click on sensor
    await user.click(screen.getByText('Temperature Sensor'));
    
    // Check if analytics panel opens
    expect(screen.getByText('Sensor Analytics')).toBeInTheDocument();
    expect(screen.getByText('Recent Readings')).toBeInTheDocument();
  });

  it('switches between demo and production modes', () => {
    const { rerender } = render(<UnifiedDashboard mode="demo" />);
    
    // Check demo mode elements
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    
    // Switch to production mode
    rerender(<UnifiedDashboard mode="production" />);
    
    // Analytics tab should not be visible in production
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });
});
```

Test Coverage Requirements:
├── Components: 80% line coverage
├── Utilities: 90% line coverage
├── Hooks: 85% line coverage
├── Integration: 70% line coverage

Effort: 2 weeks
Developer: 1 Frontend + 1 QA
```

**Task QA.1.3: Integration & E2E Testing**
```bash
Files to Create:
├── tests/
│   ├── integration/
│   │   ├── auth_flow_test.go
│   │   ├── device_management_test.go
│   │   ├── data_pipeline_test.go
│   │   └── notification_flow_test.go
│   ├── e2e/
│   │   ├── user_onboarding.spec.ts
│   │   ├── sensor_management.spec.ts
│   │   ├── alert_configuration.spec.ts
│   │   └── report_generation.spec.ts
│   └── load/
│       ├── sensor_data_load_test.js
│       ├── api_performance_test.js
│       └── dashboard_load_test.js

Tools Setup:
├── Playwright: For E2E testing
├── k6: For load testing
├── Testcontainers: For integration testing
├── Docker Compose: Test environment

Example Integration Test:
```go
// integration/device_management_test.go
func TestDeviceManagementFlow(t *testing.T) {
    // Setup test environment
    testDB := setupTestDatabase()
    defer testDB.Close()
    
    testServices := startTestServices(testDB)
    defer testServices.Stop()
    
    client := &APIClient{BaseURL: testServices.APIEndpoint}
    
    t.Run("Complete device lifecycle", func(t *testing.T) {
        // 1. Create subsidiary
        subsidiary := createTestSubsidiary(t, client)
        
        // 2. Create location
        location := createTestLocation(t, client, subsidiary.ID)
        
        // 3. Provision device
        device := provisionTestDevice(t, client, location.ID)
        
        // 4. Verify device appears in dashboard
        sensors := getSensors(t, client, location.ID)
        require.Len(t, sensors, 1)
        assert.Equal(t, device.ID, sensors[0].DeviceID)
        
        // 5. Simulate sensor data
        sendTestSensorData(t, client, device.ID)
        
        // 6. Verify data appears in dashboard
        readings := getSensorReadings(t, client, sensors[0].ID)
        require.NotEmpty(t, readings)
        
        // 7. Test alert trigger
        sendAlertThresholdData(t, client, device.ID)
        
        // 8. Verify alert generated
        alerts := getAlerts(t, client, location.ID)
        require.Len(t, alerts, 1)
        assert.Equal(t, "critical", alerts[0].Severity)
    })
}
```

Example E2E Test:
```typescript
// e2e/sensor_management.spec.ts
test.describe('Sensor Management', () => {
  test('complete sensor configuration workflow', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'admin@test.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    
    // Navigate to sensors page
    await page.click('[data-testid=sensors-nav]');
    await expect(page).toHaveURL('/sensors');
    
    // Add new sensor
    await page.click('[data-testid=add-sensor-button]');
    await page.fill('[data-testid=sensor-name]', 'Test Temperature Sensor');
    await page.selectOption('[data-testid=sensor-type]', 'temperature');
    await page.fill('[data-testid=sensor-location]', 'Room 101');
    await page.click('[data-testid=save-sensor]');
    
    // Verify sensor appears in list
    await expect(page.locator('[data-testid=sensor-list]')).toContainText('Test Temperature Sensor');
    
    // Configure alerts
    await page.click('[data-testid=configure-alerts]');
    await page.fill('[data-testid=high-threshold]', '30');
    await page.fill('[data-testid=low-threshold]', '10');
    await page.click('[data-testid=save-alerts]');
    
    // Verify configuration saved
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();
  });
});
```

Test Environment Setup:
├── Docker Compose test stack
├── Test data seeding scripts
├── CI/CD integration
├── Performance benchmarks

Effort: 2.5 weeks
Developer: 1 DevOps + 1 QA Engineer
```

---

## 📅 **Summary: Total Effort Estimation**

### **By Epic Priority:**
```
Epic 2 (Golioth Integration) - CRITICAL
├── Task 2.1.1: Golioth SDK Integration (1 week, 1 senior backend)
├── Task 2.1.2: Device Provisioning (1 week, 1 backend + 1 frontend)
├── Task 2.1.3: LightDB Stream Integration (1.5 weeks, 2 backend)
├── Task 2.2.1: Pipeline Configuration Engine (2 weeks, 1 senior backend)
├── Task 2.2.2: Visual Pipeline Editor (2 weeks, 1 frontend + 1 backend)
├── Task 2.3.1: Device Health Monitoring (1 week, 1 backend)
└── Total: 8.5 weeks effort, 3-4 weeks with parallel development

Epic 7 (Business Intelligence) - HIGH PRIORITY
├── Task 7.1.1: Health Analytics Engine (1.5 weeks, 1 backend + 1 data analyst)
├── Task 7.1.2: Interactive Health Dashboard (1 week, 1 frontend)
├── Task 7.2.1: Report Generation Engine (2 weeks, 1 backend)
├── Task 7.2.2: Report Builder Interface (2 weeks, 1 frontend + 1 backend)
└── Total: 6.5 weeks effort, 2-3 weeks with parallel development

Cross-Cutting QA - HIGH PRIORITY
├── Task QA.1.1: Go Services Unit Testing (3 weeks, 2 backend + 1 DevOps)
├── Task QA.1.2: Frontend Component Testing (2 weeks, 1 frontend + 1 QA)
├── Task QA.1.3: Integration & E2E Testing (2.5 weeks, 1 DevOps + 1 QA)
└── Total: 7.5 weeks effort, 3-4 weeks with parallel development

All Other Epics (1,3,4,5,6) - MEDIUM PRIORITY
└── Total: 3 weeks effort, 2 weeks with parallel development
```

### **Recommended Team & Timeline:**
```
Team Composition:
├── 1 Senior Backend Developer (IoT/Golioth expertise)
├── 2 Backend Developers
├── 1 Frontend Developer
├── 1 DevOps Engineer
├── 1 QA Engineer
└── 1 Data Analyst (part-time)

Timeline: 6-8 weeks total
├── Weeks 1-4: Golioth Integration (Critical Path)
├── Weeks 3-6: Business Intelligence (Parallel)
├── Weeks 5-8: Testing & Quality Assurance (Parallel)
└── Weeks 7-8: Final Integration & Validation
```

This detailed breakdown provides you with specific, actionable tasks that can be assigned to developers, estimated, and tracked. Each task has clear deliverables, acceptance criteria, and implementation details.
