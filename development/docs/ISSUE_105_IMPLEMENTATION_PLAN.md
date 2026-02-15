# Issue #105: Sensor Reading Details Page - Staged Implementation Plan

**Issue:** https://github.com/NetNeural/MonoRepo/issues/105  
**Date Created:** February 14, 2026  
**Status:** 📋 Planning Complete - Ready for Implementation  
**Estimated Total Effort:** 12-15 days (2-3 weeks)

---

## 🎯 Executive Summary

Build a comprehensive sensor details page with real-time monitoring, historical data visualization, and advanced analytics capabilities. The page will serve as the primary interface for monitoring individual sensors with immediate situational awareness and deep historical analysis.

**Key Deliverables:**
- Detailed sensor overview with live status
- Interactive 48-hour trend visualization
- Complete historical data access (table, graph, stats)
- Location mapping and device health monitoring
- Alert configuration and activity timeline
- Export capabilities (CSV, Excel, PDF, JSON)
- Mobile-optimized responsive design

---

## 📊 Stage Breakdown

### **Stage 1: Foundation & Core UI** (3-4 days)
**Priority:** 🔴 CRITICAL - 80% of user value  
**Goal:** Users can view sensor details and recent trends

#### Tasks:
1. **Create Sensor Details Page Route** (4 hours)
   - Create `/dashboard/sensors/[id]` page
   - Fetch sensor data from Supabase
   - Set up TypeScript types for sensor data
   - Implement loading/error states

2. **Sensor Overview Card** (6 hours)
   - Current reading with large font display
   - Status badges (Normal⚪/Warning🟡/Critical🔴)
   - Battery level indicator
   - Signal strength display
   - Last reading timestamp
   - Uptime calculation

3. **48-Hour Trend Graph** (8 hours)
   - Integrate recharts or similar library
   - Fetch 48-hour telemetry data
   - Line chart with current value marker
   - Time selector (24h/48h buttons)
   - Threshold lines display
   - Responsive design

4. **Basic Layout & Navigation** (2 hours)
   - Page header with sensor name
   - Back navigation
   - Card-based responsive layout
   - Mobile-first stacking

#### Deliverables:
- ✅ Functional sensor details page
- ✅ Real-time current readings
- ✅ 48-hour historical graph
- ✅ Mobile responsive layout

#### Files to Create:
```
src/app/dashboard/sensors/[id]/page.tsx
src/components/sensors/SensorOverviewCard.tsx
src/components/sensors/SensorTrendGraph.tsx
src/types/sensor-details.ts
```

#### Files to Modify:
```
src/components/sensors/SensorsList.tsx (add link to details)
```

---

### **Stage 2: Context & Health Monitoring** (2-3 days)
**Priority:** 🟡 HIGH - Essential context  
**Goal:** Users understand where devices are and if they're healthy

#### Tasks:
1. **Location Details Card** (6 hours)
   - Static map widget (Google Maps/Mapbox)
   - Full address display
   - Placement description field
   - GPS coordinates
   - Installation date
   - Assigned technician

2. **Device Health Card** (4 hours)
   - Uptime display (X days HH:MM)
   - Battery percentage with icon
   - Signal strength (dBm) with bars
   - Storage usage indicator
   - Firmware version
   - Last firmware update timestamp
   - Memory usage (if available)

3. **Recent Activity Timeline** (6 hours)
   - Fetch activity log from database
   - Timeline component with icons
   - Event types (alerts, updates, status changes)
   - Relative timestamps
   - Action buttons (View Logs, Reboot)

#### Deliverables:
- ✅ Location context with map
- ✅ Device health monitoring
- ✅ Activity timeline

#### Files to Create:
```
src/components/sensors/LocationDetailsCard.tsx
src/components/sensors/DeviceHealthCard.tsx
src/components/sensors/ActivityTimeline.tsx
```

#### Database Query Additions:
```sql
-- Fetch sensor with related data
SELECT 
  s.*,
  l.name as location_name,
  l.address,
  l.coordinates,
  u.name as assigned_to
FROM sensors s
LEFT JOIN locations l ON s.location_id = l.id
LEFT JOIN users u ON s.assigned_user_id = u.id
WHERE s.id = $1
```

---

### **Stage 3: Alerts & Statistics** (2-3 days)
**Priority:** 🟡 HIGH - Actionable insights  
**Goal:** Users can configure alerts and see performance metrics

#### Tasks:
1. **Alerts & Thresholds Card** (8 hours)
   - Display active alerts count
   - Threshold configuration UI
   - Slider/input for high/low thresholds
   - Alert history toggle
   - Notification settings
   - Save threshold changes to database

2. **Statistical Summary Card** (4 hours)
   - Calculate statistics from telemetry
   - Metrics grid display:
     - Average, Min, Max
     - Standard deviation
     - Total readings count
   - Data quality percentage
   - Date range selector

3. **Quick Actions Bar** (2 hours)
   - Reboot button (if supported)
   - Test connection
   - Configuration link
   - Share sensor URL
   - Icons for each action

#### Deliverables:
- ✅ Alert configuration interface
- ✅ Statistical overview
- ✅ Quick action buttons

#### Files to Create:
```
src/components/sensors/AlertsThresholdsCard.tsx
src/components/sensors/StatisticalSummaryCard.tsx
src/components/sensors/QuickActionsBar.tsx
```

#### Database Additions:
```sql
-- Create sensor_thresholds table
CREATE TABLE sensor_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID REFERENCES sensors(id),
  metric_type TEXT NOT NULL,
  high_threshold DECIMAL,
  low_threshold DECIMAL,
  alert_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### **Stage 4: Historical Data Access** (3-4 days)
**Priority:** 🟢 MEDIUM - Power user feature  
**Goal:** Deep analysis and data export capabilities

#### Tasks:
1. **Enhanced Time Range Selector** (4 hours)
   - Extend graph time ranges: 24H, 48H, 7D, 30D, 90D
   - Custom date range picker
   - Granularity adjustment logic
   - Efficient data fetching with pagination

2. **Historical Data Card - Graph View** (6 hours)
   - Interactive zoomable chart
   - Pan and zoom controls
   - Multiple Y-axes support
   - Event markers (alerts, maintenance)
   - Hover tooltips with full details
   - Range selector (drag to zoom)

3. **Historical Data Card - Table View** (6 hours)
   - Virtual scrolling table (react-window)
   - Column sorting and filtering
   - Bulk actions (delete, export selection)
   - Inline editing for notes
   - Search functionality
   - Pagination controls

4. **Historical Data Card - Stats View** (4 hours)
   - Advanced statistics calculation
   - Pattern detection (daily avg, peak hours)
   - Anomaly detection algorithm
   - Data quality metrics
   - Outlier highlighting

#### Deliverables:
- ✅ Extended time ranges (up to 90 days)
- ✅ Interactive data table
- ✅ Advanced statistics view
- ✅ Pattern recognition

#### Files to Create:
```
src/components/sensors/HistoricalDataCard.tsx
src/components/sensors/HistoricalGraph.tsx
src/components/sensors/HistoricalTable.tsx
src/components/sensors/HistoricalStats.tsx
src/lib/statistics/anomaly-detection.ts
src/lib/statistics/pattern-recognition.ts
```

#### API Endpoints Needed:
```typescript
// GET /api/sensors/[id]/telemetry
// Query params: startDate, endDate, granularity, limit, offset
interface TelemetryQuery {
  startDate: string;
  endDate: string;
  granularity: '5min' | '10min' | '30min' | '2hr' | '6hr';
  limit?: number;
  offset?: number;
}
```

---

### **Stage 5: Export & Reporting** (2 days)
**Priority:** 🟢 MEDIUM - Compliance and auditing  
**Goal:** Users can export data in multiple formats

#### Tasks:
1. **Export Functionality** (6 hours)
   - CSV export (raw data)
   - Excel export (formatted with charts)
   - PDF report generation
   - JSON export (API compatible)
   - Graph screenshot capture

2. **Export Configuration Dialog** (4 hours)
   - Date range selection
   - Column selection
   - Format options
   - Include charts toggle
   - Download progress indicator

3. **Batch Export Support** (2 hours)
   - Handle large datasets
   - Chunked downloads
   - Background processing
   - Email delivery option

#### Deliverables:
- ✅ Multiple export formats
- ✅ Configurable exports
- ✅ Large dataset handling

#### Files to Create:
```
src/components/sensors/ExportDialog.tsx
src/lib/export/csv-generator.ts
src/lib/export/excel-generator.ts
src/lib/export/pdf-generator.ts
src/lib/export/json-generator.ts
```

#### Dependencies:
- `xlsx` for Excel generation
- `jspdf` + `jspdf-autotable` for PDF
- `html2canvas` for graph screenshots

---

### **Stage 6: Power Features & Polish** (1-2 days)
**Priority:** 🔵 LOW - Nice to have  
**Goal:** Advanced features for power users

#### Tasks:
1. **Keyboard Shortcuts** (3 hours)
   - Implement hotkey system
   - Quick zoom (1-9 for hours)
   - Compare mode (Ctrl+C)
   - Anomaly detection (Ctrl+A)
   - Full export (Ctrl+E)

2. **Sensor Comparison Mode** (4 hours)
   - Toggle multiple sensors on graph
   - Side-by-side metrics
   - Correlation analysis
   - Shared time axis

3. **AI Insights (Optional)** (6 hours)
   - Trend analysis algorithm
   - Predictive alerts
   - Pattern suggestions
   - Natural language summaries

4. **QR Code Generation** (2 hours)
   - Generate QR code for mobile access
   - Deep link to sensor details
   - Print-friendly format

#### Deliverables:
- ✅ Keyboard shortcuts
- ✅ Comparison mode
- ✅ Optional AI insights
- ✅ QR code access

#### Files to Create:
```
src/hooks/useKeyboardShortcuts.ts
src/components/sensors/ComparisonMode.tsx
src/lib/ai/sensor-insights.ts
src/components/sensors/QRCodeDisplay.tsx
```

---

## 🗄️ Database Schema Changes

### New Tables:

```sql
-- Sensor thresholds configuration
CREATE TABLE sensor_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  high_threshold DECIMAL,
  low_threshold DECIMAL,
  alert_enabled BOOLEAN DEFAULT true,
  notification_channels TEXT[], -- ['email', 'sms', 'webhook']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE(sensor_id, metric_type)
);

-- Sensor activity log
CREATE TABLE sensor_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'alert', 'firmware_update', 'reboot', 'config_change'
  description TEXT,
  metadata JSONB,
  severity TEXT, -- 'info', 'warning', 'critical'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_sensor_thresholds_sensor ON sensor_thresholds(sensor_id);
CREATE INDEX idx_sensor_activity_sensor ON sensor_activity(sensor_id);
CREATE INDEX idx_sensor_activity_created ON sensor_activity(created_at DESC);
```

### Existing Table Modifications:

```sql
-- Add fields to devices table (if not already present)
ALTER TABLE devices 
  ADD COLUMN IF NOT EXISTS placement TEXT,
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS installation_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS uptime_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_used_mb INTEGER,
  ADD COLUMN IF NOT EXISTS memory_used_mb INTEGER;
```

---

## 📡 API Endpoints Required

### 1. Sensor Details
```typescript
GET /api/sensors/[id]
Response: {
  sensor: Sensor,
  location: Location,
  assignedUser: User,
  currentReading: Reading,
  thresholds: Threshold[]
}
```

### 2. Telemetry Data
```typescript
GET /api/sensors/[id]/telemetry
Query: { startDate, endDate, granularity, limit, offset }
Response: {
  data: Reading[],
  total: number,
  hasMore: boolean
}
```

### 3. Statistics
```typescript
GET /api/sensors/[id]/statistics
Query: { startDate, endDate }
Response: {
  average: number,
  min: { value, timestamp },
  max: { value, timestamp },
  stdDev: number,
  totalReadings: number,
  dataQuality: number,
  anomalies: number
}
```

### 4. Activity Log
```typescript
GET /api/sensors/[id]/activity
Query: { limit, offset, type }
Response: {
  activities: Activity[],
  total: number
}
```

### 5. Thresholds Configuration
```typescript
PUT /api/sensors/[id]/thresholds
Body: {
  metricType: string,
  highThreshold: number,
  lowThreshold: number,
  alertEnabled: boolean
}
Response: { success: boolean }
```

### 6. Export Data
```typescript
POST /api/sensors/[id]/export
Body: {
  format: 'csv' | 'excel' | 'pdf' | 'json',
  startDate: string,
  endDate: string,
  includeCharts: boolean
}
Response: { downloadUrl: string }
```

---

## 🎨 UI Component Library Decisions

### Charting Library: **Recharts**
- ✅ React-native, TypeScript support
- ✅ Responsive and customizable
- ✅ Good documentation
- ✅ Compatible with Next.js

### Map Integration: **Mapbox GL**
- ✅ Free tier available
- ✅ Better customization than Google Maps
- ✅ Modern API

### Table: **TanStack Table v8**
- ✅ Headless UI (full control)
- ✅ Virtual scrolling built-in
- ✅ Column sorting, filtering
- ✅ TypeScript first

### Date Picker: **react-day-picker**
- ✅ Lightweight
- ✅ Accessible
- ✅ Already using in project

---

## 📱 Mobile Optimization Strategy

### Responsive Breakpoints:
- **Mobile:** 0-768px (Single column, stacked cards)
- **Tablet:** 768-1024px (2 columns)
- **Desktop:** 1024px+ (3 columns with grid)

### Mobile-Specific Features:
- Full-width graph with pinch-zoom
- Bottom sheet for filters/actions
- Swipe navigation between time ranges
- Progressive disclosure (show less initially)
- Touch-optimized controls

### Performance:
- Lazy load cards below fold
- Virtualized scrolling for tables
- Debounced graph interactions
- Service worker for offline viewing

---

## 🧪 Testing Strategy

### Unit Tests:
- Statistical calculations
- Anomaly detection algorithms
- Export generators
- Data formatters

### Component Tests:
- Each card renders correctly
- Graph interactions work
- Table sorting/filtering
- Alert threshold validation

### Integration Tests:
- Full page data flow
- API endpoint responses
- Export pipeline
- Mobile responsive behavior

### E2E Tests:
- User views sensor details
- User changes time range
- User configures thresholds
- User exports data

---

## 🚀 Deployment Plan

### Stage 1 Deployment (Week 1):
1. Create database migration
2. Deploy API endpoints
3. Deploy UI components
4. Feature flag enabled for testing
5. Internal testing with 5 sensors
6. Gather feedback

### Stage 2-3 Deployment (Week 2):
1. Deploy additional cards
2. Test alert configuration
3. Validate statistics calculations
4. Beta release to 10 users

### Stage 4-6 Deployment (Week 3):
1. Deploy historical data features
2. Enable export functionality
3. Final polish and bug fixes
4. Full release to all users

### Rollback Plan:
- Keep old sensor list view functional
- Feature flag can disable new page
- Database migrations are reversible
- Document known issues

---

## ✅ Success Criteria

### User Experience:
- [ ] Users can view sensor status in <2 seconds
- [ ] Graph loads and renders in <3 seconds
- [ ] Mobile experience is smooth (60fps)
- [ ] Export completes in <10 seconds for 30 days

### Functionality:
- [ ] All cards display accurate data
- [ ] Thresholds save and trigger alerts
- [ ] Historical data accessible for 90+ days
- [ ] Export works for all formats

### Performance:
- [ ] Page load time <3s (desktop)
- [ ] Page load time <5s (mobile)
- [ ] No hydration errors
- [ ] Lighthouse score >90

### Accessibility:
- [ ] WCAG 2.1 AA compliant
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast meets standards

---

## 📦 Dependencies to Install

```json
{
  "dependencies": {
    "recharts": "^2.10.0",
    "mapbox-gl": "^3.0.0",
    "@tanstack/react-table": "^8.11.0",
    "react-window": "^1.8.10",
    "xlsx": "^0.18.5",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.0",
    "html2canvas": "^1.4.1",
    "qrcode.react": "^3.1.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "@types/mapbox-gl": "^3.0.0",
    "@types/react-window": "^1.8.8"
  }
}
```

---

## 🎯 Priority Implementation Order

### Must Have (Stages 1-3): **7-10 days**
1. ✅ Sensor Overview + 48H Graph
2. ✅ Location + Device Health
3. ✅ Alerts + Statistics

**Value:** 90% of user needs  
**Risk:** Low  
**Dependencies:** Minimal

### Should Have (Stage 4): **3-4 days**
4. ✅ Historical Data (Graph, Table, Stats)

**Value:** Advanced users, compliance  
**Risk:** Medium (performance concerns)  
**Dependencies:** Database optimization

### Nice to Have (Stages 5-6): **3-4 days**
5. ✅ Export & Reporting
6. ✅ Power Features

**Value:** 10% power users  
**Risk:** Low  
**Dependencies:** Core features complete

---

## 🤝 Team Assignment Recommendations

### Frontend Developer (Primary):
- Stages 1, 2, 3 (UI components)
- Stage 6 (polish)

### Full-Stack Developer:
- Stage 4 (historical data + API)
- Stage 5 (export pipeline)

### Backend/Database:
- Database migrations
- API endpoint optimization
- Statistical algorithms

### QA/Testing:
- E2E test scenarios
- Performance testing
- Mobile device testing

---

## 📞 Stakeholder Communication

### Week 1 Update:
"✅ Core sensor details page complete! Users can now view real-time status, 48-hour trends, and device health."

### Week 2 Update:
"✅ Alert configuration and statistics added. Users can now set thresholds and view performance metrics."

### Week 3 Update:
"✅ Full historical data access and export features complete. Ready for production release."

---

## 🔄 Future Enhancements (Post-Launch)

### Phase 2 Ideas:
- **Collaborative annotations:** Add notes on graph events
- **Sensor groups:** Compare multiple sensors simultaneously
- **Scheduled reports:** Auto-email daily/weekly summaries
- **Predictive maintenance:** ML-based failure prediction
- **Live streaming:** Real-time websocket updates
- **Custom dashboards:** User-configurable layouts
- **API access:** GraphQL endpoint for third-party integrations

---

## 📝 Implementation Checklist

### Pre-Development:
- [ ] Review and approve this plan
- [ ] Assign developers to stages
- [ ] Set up feature flag
- [ ] Create GitHub project board
- [ ] Document API contracts

### Stage 1:
- [ ] Create database migration
- [ ] Set up page route
- [ ] Build Sensor Overview Card
- [ ] Build 48H Trend Graph
- [ ] Deploy to staging
- [ ] Internal testing

### Stage 2:
- [ ] Build Location Details Card
- [ ] Build Device Health Card
- [ ] Build Activity Timeline
- [ ] Test with real sensors
- [ ] Deploy to staging

### Stage 3:
- [ ] Build Alerts & Thresholds Card
- [ ] Build Statistical Summary
- [ ] Build Quick Actions Bar
- [ ] Configure alert system
- [ ] Deploy to staging

### Stage 4:
- [ ] Optimize telemetry queries
- [ ] Build Historical Data Card
- [ ] Implement all 3 views
- [ ] Performance test with large datasets
- [ ] Deploy to staging

### Stage 5:
- [ ] Build export functionality
- [ ] Test all export formats
- [ ] Handle large exports
- [ ] Deploy to staging

### Stage 6:
- [ ] Implement keyboard shortcuts
- [ ] Build comparison mode
- [ ] Add AI insights (optional)
- [ ] Generate QR codes
- [ ] Final polish

### Post-Launch:
- [ ] Monitor performance metrics
- [ ] Gather user feedback
- [ ] Fix bugs
- [ ] Plan Phase 2 enhancements

---

## 🎉 Conclusion

This implementation plan provides a clear, staged approach to building a comprehensive sensor details page. By prioritizing the most valuable features first (Stages 1-3), we deliver 90% of the user value in the first 7-10 days, with additional power features following incrementally.

**Recommended Start Date:** As soon as approved  
**Target Completion:** 2-3 weeks from start  
**Next Step:** Review with team → assign developers → begin Stage 1

---

**Prepared By:** GitHub Copilot  
**Date:** February 14, 2026  
**Status:** ✅ Ready for Implementation  
**Approval Required:** Engineering Manager, Product Owner
