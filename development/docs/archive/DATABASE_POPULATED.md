# Database Populated with Test Devices

## Summary
Successfully populated the database with **20 diverse IoT devices** for frontend testing!

## Device Inventory

### Total Devices: 20
- **Online**: 15 devices
- **Offline**: 2 devices
- **Warning**: 3 devices

### Device Types & Count:
1. **Temperature Sensors** (2) - TS-2000 models
2. **Humidity Sensors** (2) - HS-1500 models
3. **Pressure Sensors** (2) - PS-3000 models
4. **Motion Detectors** (2) - MD-400 models
5. **Light Sensor** (1) - LS-800
6. **Vibration Monitor** (1) - VM-600
7. **CO2 Monitor** (1) - AQ-200
8. **Door Sensor** (1) - DS-100
9. **Water Level Sensor** (1) - WL-300 ⚠️ Warning
10. **Energy Meter** (1) - PM-500
11. **Smoke Detector** (1) - SD-700
12. **Flow Meter** (1) - FM-400 ⚠️ Offline
13. **Gateway Device** (1) - GW-1000
14. **Tank Level Monitor** (1) - TL-250 ⚠️ Warning
15. **HVAC Controller** (1) - HC-2000
16. **Security Camera** (1) - CAM-HD

## Device Details

### Online Devices (15)
| Name | Type | Battery | Signal | Location |
|------|------|---------|--------|----------|
| Temperature Sensor 1 | temperature_sensor | 87% | -45 dBm | Production Floor |
| Temperature Sensor 2 | temperature_sensor | 95% | -42 dBm | Production Floor |
| Humidity Sensor 1 | humidity_sensor | 92% | -38 dBm | Production Floor |
| Humidity Sensor 2 | humidity_sensor | 88% | -40 dBm | Quality Control |
| Light Level Sensor | light_sensor | 78% | -48 dBm | Storage Area |
| Vibration Monitor | vibration_sensor | 82% | -43 dBm | Production Floor |
| CO2 Monitor | air_quality_sensor | 91% | -39 dBm | Quality Control |
| Door Sensor A1 | door_sensor | 97% | -35 dBm | Production Floor |
| Energy Meter 1 | power_meter | 100% | -36 dBm | Production Floor |
| Smoke Detector B2 | smoke_detector | 89% | -41 dBm | Storage Area |
| Motion Detector 2 | motion_sensor | 76% | -46 dBm | Quality Control |
| Gateway Device | gateway | N/A | -30 dBm | Production Floor |
| Pressure Sensor 2 | pressure_sensor | 84% | -44 dBm | Quality Control |
| HVAC Controller | hvac_controller | N/A | -37 dBm | Production Floor |
| Security Camera 1 | camera | N/A | -33 dBm | Production Floor |

### Warning Devices (3)
| Name | Type | Issue | Battery | Last Seen |
|------|------|-------|---------|-----------|
| Pressure Sensor 1 | pressure_sensor | Low Battery | 45% | 15 min ago |
| Water Level Sensor | level_sensor | Low Battery & Weak Signal | 35% | 20 min ago |
| Tank Level Monitor | level_sensor | Low Battery | 28% | 25 min ago |

### Offline Devices (2)
| Name | Type | Last Seen | Battery |
|------|------|-----------|---------|
| Motion Detector 1 | motion_sensor | 2 hours ago | 12% |
| Flow Meter 1 | flow_sensor | 45 min ago | 8% |

## Alerts Generated: 7

1. **Critical**: Device Offline - Motion Detector 1 (2 hours)
2. **Critical**: Critical Battery Level - Water Level Sensor (35%)
3. **High**: Low Battery Warning - Pressure Sensor 1 (45%)
4. **High**: Device Offline - Flow Meter 1 (45 minutes)
5. **Medium**: Temperature Alert - Temperature Sensor 1 (above threshold)
6. **Medium**: Low Tank Level - Tank Level Monitor (25% capacity)
7. **Low**: Weak Signal - Water Level Sensor (-60 dBm)

## Sensor Data Points

The database now includes recent sensor readings for:
- **Temperature**: Real-time readings from 2 sensors
- **Humidity**: Current humidity levels from 2 sensors
- **Pressure**: PSI readings from 2 sensors
- **Light Level**: Lux measurements
- **CO2**: Air quality (ppm)
- **Power**: Watts, Amps, Voltage readings

## Locations & Organization

### Locations:
1. **Main Facility** - Production floor and Quality Control
2. **Warehouse A** - Storage operations

### Organization:
- **NetNeural Demo** (ID: 00000000-0000-0000-0000-000000000001)
- Integration: **Golioth Integration** (active)

## How to View the Data

### Option 1: Restart Edge Functions & Dev Server

```bash
# Terminal 1: Start edge functions
cd "c:\Development\NetNeural\SoftwareMono\development"
npm run supabase:functions:serve

# Terminal 2: Start dev server
cd "c:\Development\NetNeural\SoftwareMono\development"
npm run dev
```

Then visit:
- Dashboard: `http://localhost:3000/dashboard`
- Devices List: `http://localhost:3000/dashboard/devices`
- Alerts: `http://localhost:3000/dashboard/alerts`
- Settings: `http://localhost:3000/dashboard/settings`

### Option 2: Supabase Studio

```bash
npm run supabase:studio
```

Visit `http://localhost:54323` to browse the database directly.

### Option 3: Test Edge Functions

```bash
# Get all devices
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  http://localhost:54321/functions/v1/devices

# Get alerts
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  http://localhost:54321/functions/v1/alerts

# Get dashboard stats
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  http://localhost:54321/functions/v1/dashboard-stats
```

## What You Can Test Now

### Dashboard Stats Card
- Total devices: 20
- Online devices: 15
- Offline devices: 2
- Active alerts: 7
- Connectivity rate: 75%

### Device Status Card
- Mix of online, offline, and warning devices
- Battery levels ranging from 8% to 100%
- Signal strengths from -85 to -30 dBm
- Various device types and models

### Alerts Card
- 7 active alerts
- Mix of critical, high, medium, and low severity
- Different alert types: battery, offline, signal, level
- Real device associations

### Devices List
- 20 diverse devices
- Filter by status (online/offline/warning)
- Sort by various fields
- Real locations and departments

### Settings Page
- 1 organization (NetNeural Demo)
- 1 active integration (Golioth)
- Device count: 20
- Alert count: 7

## Database Reset Command

If you need to reset the data again:

```bash
npm run supabase:reset
```

This will:
1. Drop all tables
2. Run all migrations
3. Reload seed data with 20 devices
4. Create sample alerts and sensor data

## Next Steps

1. ✅ **Database populated** with 20 diverse devices
2. ✅ **Alerts created** for testing
3. ✅ **Sensor data added** for charts
4. 🔄 **Restart servers** to see the data
5. 🎯 **Test frontend** with real database data

Enjoy testing with realistic IoT device data! 🚀