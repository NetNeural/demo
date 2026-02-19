#!/usr/bin/env node
/**
 * Seed 42 industry-standard IoT device types
 * Based on ASHRAE 55, WHO Air Quality Guidelines, NIST/ANSI standards
 * 
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node seed-42-device-types.js
 */

const https = require('https');

const SUPABASE_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001'; // NetNeural main org

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// All 42 device types from seed-device-types.sql
const deviceTypes = [
  // ═══════════════════════════════════════════════════════════════════
  // Temperature Sensors (6)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Indoor Temperature (°C)',
    description: 'Standard indoor environment monitoring per ASHRAE 55',
    device_class: 'temperature',
    unit: '°C',
    lower_normal: 18.0,
    upper_normal: 26.0,
    lower_alert: 10.0,
    upper_alert: 35.0,
    precision_digits: 1
  },
  {
    name: 'Indoor Temperature (°F)',
    description: 'Standard indoor environment monitoring (imperial)',
    device_class: 'temperature',
    unit: '°F',
    lower_normal: 64.0,
    upper_normal: 79.0,
    lower_alert: 50.0,
    upper_alert: 95.0,
    precision_digits: 1
  },
  {
    name: 'Cold Storage Temperature',
    description: 'Food safety cold chain monitoring (FDA guidelines)',
    device_class: 'temperature',
    unit: '°C',
    lower_normal: 0.0,
    upper_normal: 4.0,
    lower_alert: -5.0,
    upper_alert: 10.0,
    precision_digits: 1
  },
  {
    name: 'Freezer Temperature',
    description: 'Deep freeze monitoring for food/pharma safety',
    device_class: 'temperature',
    unit: '°C',
    lower_normal: -25.0,
    upper_normal: -15.0,
    lower_alert: -35.0,
    upper_alert: -10.0,
    precision_digits: 1
  },
  {
    name: 'Server Room Temperature',
    description: 'Data center thermal management (ASHRAE TC 9.9)',
    device_class: 'temperature',
    unit: '°C',
    lower_normal: 18.0,
    upper_normal: 27.0,
    lower_alert: 15.0,
    upper_alert: 32.0,
    precision_digits: 1
  },
  {
    name: 'Industrial Process Temperature',
    description: 'High-temperature industrial monitoring',
    device_class: 'temperature',
    unit: '°C',
    lower_normal: 20.0,
    upper_normal: 80.0,
    lower_alert: 0.0,
    upper_alert: 120.0,
    precision_digits: 1
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // Humidity Sensors (4)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Indoor Humidity',
    description: 'Comfort range per ASHRAE 55 (30-60% RH)',
    device_class: 'humidity',
    unit: '% RH',
    lower_normal: 30.0,
    upper_normal: 60.0,
    lower_alert: 20.0,
    upper_alert: 80.0,
    precision_digits: 1
  },
  {
    name: 'Data Center Humidity',
    description: 'Server room humidity control (ASHRAE TC 9.9)',
    device_class: 'humidity',
    unit: '% RH',
    lower_normal: 40.0,
    upper_normal: 55.0,
    lower_alert: 20.0,
    upper_alert: 80.0,
    precision_digits: 1
  },
  {
    name: 'Museum Climate Control',
    description: 'Artifact preservation humidity (strict control)',
    device_class: 'humidity',
    unit: '% RH',
    lower_normal: 45.0,
    upper_normal: 55.0,
    lower_alert: 30.0,
    upper_alert: 70.0,
    precision_digits: 1
  },
  {
    name: 'Greenhouse Humidity',
    description: 'Agricultural greenhouse climate monitoring',
    device_class: 'humidity',
    unit: '% RH',
    lower_normal: 60.0,
    upper_normal: 80.0,
    lower_alert: 40.0,
    upper_alert: 95.0,
    precision_digits: 1
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // Air Quality Sensors (4)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'CO₂ Concentration',
    description: 'Indoor air quality (ASHRAE 62.1: <1000 ppm good)',
    device_class: 'air_quality',
    unit: 'ppm',
    lower_normal: 400.0,
    upper_normal: 1000.0,
    lower_alert: 300.0,
    upper_alert: 2000.0,
    precision_digits: 0
  },
  {
    name: 'VOC (Volatile Organic Compounds)',
    description: 'Indoor air pollutants per WHO guidelines',
    device_class: 'air_quality',
    unit: 'ppb',
    lower_normal: 0.0,
    upper_normal: 500.0,
    lower_alert: null,
    upper_alert: 1000.0,
    precision_digits: 0
  },
  {
    name: 'PM2.5 Particulate Matter',
    description: 'Fine particles per WHO Air Quality Guidelines',
    device_class: 'air_quality',
    unit: 'µg/m³',
    lower_normal: 0.0,
    upper_normal: 25.0,
    lower_alert: null,
    upper_alert: 75.0,
    precision_digits: 1
  },
  {
    name: 'PM10 Particulate Matter',
    description: 'Coarse particles per WHO Air Quality Guidelines',
    device_class: 'air_quality',
    unit: 'µg/m³',
    lower_normal: 0.0,
    upper_normal: 50.0,
    lower_alert: null,
    upper_alert: 150.0,
    precision_digits: 1
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // Light Sensors (3)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Office Illuminance',
    description: 'Workspace lighting per IESNA standards (500 lux)',
    device_class: 'illuminance',
    unit: 'lux',
    lower_normal: 300.0,
    upper_normal: 750.0,
    lower_alert: 100.0,
    upper_alert: 1500.0,
    precision_digits: 0
  },
  {
    name: 'Outdoor Light Level',
    description: 'Daylight/security monitoring (0-100k lux)',
    device_class: 'illuminance',
    unit: 'lux',
    lower_normal: 0.0,
    upper_normal: 100000.0,
    lower_alert: null,
    upper_alert: null,
    precision_digits: 0
  },
  {
    name: 'Warehouse Illuminance',
    description: 'Industrial warehouse lighting (200 lux minimum)',
    device_class: 'illuminance',
    unit: 'lux',
    lower_normal: 150.0,
    upper_normal: 300.0,
    lower_alert: 50.0,
    upper_alert: 750.0,
    precision_digits: 0
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // Pressure Sensors (3)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Atmospheric Pressure',
    description: 'Weather monitoring (sea level: ~1013 hPa)',
    device_class: 'pressure',
    unit: 'hPa',
    lower_normal: 980.0,
    upper_normal: 1040.0,
    lower_alert: 950.0,
    upper_alert: 1070.0,
    precision_digits: 1
  },
  {
    name: 'Clean Room Pressure Differential',
    description: 'Positive pressure monitoring for contamination control',
    device_class: 'pressure',
    unit: 'Pa',
    lower_normal: 5.0,
    upper_normal: 20.0,
    lower_alert: 0.0,
    upper_alert: 50.0,
    precision_digits: 1
  },
  {
    name: 'HVAC Duct Pressure',
    description: 'Building ventilation system monitoring',
    device_class: 'pressure',
    unit: 'Pa',
    lower_normal: 50.0,
    upper_normal: 500.0,
    lower_alert: 0.0,
    upper_alert: 1000.0,
    precision_digits: 0
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // Power & Battery Sensors (6)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Battery Level',
    description: 'Device battery state of charge',
    device_class: 'battery',
    unit: '%',
    lower_normal: 20.0,
    upper_normal: 100.0,
    lower_alert: 10.0,
    upper_alert: null,
    precision_digits: 0
  },
  {
    name: 'AC Voltage (120V)',
    description: 'North American mains voltage monitoring',
    device_class: 'voltage',
    unit: 'V',
    lower_normal: 114.0,
    upper_normal: 126.0,
    lower_alert: 108.0,
    upper_alert: 132.0,
    precision_digits: 1
  },
  {
    name: 'AC Voltage (230V)',
    description: 'European/International mains voltage',
    device_class: 'voltage',
    unit: 'V',
    lower_normal: 220.0,
    upper_normal: 240.0,
    lower_alert: 207.0,
    upper_alert: 253.0,
    precision_digits: 1
  },
  {
    name: 'DC Power Supply (12V)',
    description: 'Low-voltage DC power monitoring',
    device_class: 'voltage',
    unit: 'V',
    lower_normal: 11.5,
    upper_normal: 12.5,
    lower_alert: 10.0,
    upper_alert: 14.0,
    precision_digits: 2
  },
  {
    name: 'Current Draw',
    description: 'Electrical current consumption monitoring',
    device_class: 'current',
    unit: 'A',
    lower_normal: 0.0,
    upper_normal: 10.0,
    lower_alert: null,
    upper_alert: 15.0,
    precision_digits: 2
  },
  {
    name: 'Power Consumption',
    description: 'Active power usage monitoring',
    device_class: 'power',
    unit: 'W',
    lower_normal: 0.0,
    upper_normal: 1000.0,
    lower_alert: null,
    upper_alert: 2000.0,
    precision_digits: 1
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // Motion & Occupancy (2)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Occupancy Count',
    description: 'People counting for space utilization',
    device_class: 'occupancy',
    unit: 'people',
    lower_normal: 0.0,
    upper_normal: 50.0,
    lower_alert: null,
    upper_alert: 100.0,
    precision_digits: 0
  },
  {
    name: 'Motion Events (Hourly)',
    description: 'Motion detection frequency for security/analytics',
    device_class: 'motion',
    unit: 'events/hr',
    lower_normal: 0.0,
    upper_normal: 100.0,
    lower_alert: null,
    upper_alert: 500.0,
    precision_digits: 0
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // Water & Liquid Sensors (3)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Water Leak Detection',
    description: 'Binary leak sensor (0=dry, 1=wet)',
    device_class: 'leak_detection',
    unit: 'status',
    lower_normal: 0.0,
    upper_normal: 0.1,  // Small range to satisfy constraint (effectively binary)
    lower_alert: null,
    upper_alert: 1.0,
    precision_digits: 0
  },
  {
    name: 'Water Flow Rate',
    description: 'Liquid flow monitoring for pipes/systems',
    device_class: 'flow',
    unit: 'L/min',
    lower_normal: 0.0,
    upper_normal: 100.0,
    lower_alert: null,
    upper_alert: 200.0,
    precision_digits: 1
  },
  {
    name: 'Tank Level',
    description: 'Liquid storage tank level monitoring',
    device_class: 'level',
    unit: '%',
    lower_normal: 20.0,
    upper_normal: 100.0,
    lower_alert: 10.0,
    upper_alert: null,
    precision_digits: 1
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // Connectivity & Signal (2)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Signal Strength (RSSI)',
    description: 'Wireless signal quality (-30 dBm excellent, -90 dBm poor)',
    device_class: 'signal',
    unit: 'dBm',
    lower_normal: -80.0,
    upper_normal: -30.0,
    lower_alert: -100.0,
    upper_alert: null,
    precision_digits: 0
  },
  {
    name: 'Link Quality',
    description: 'Network connection quality percentage',
    device_class: 'signal',
    unit: '%',
    lower_normal: 70.0,
    upper_normal: 100.0,
    lower_alert: 30.0,
    upper_alert: null,
    precision_digits: 0
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // Environmental & Weather (4)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Wind Speed',
    description: 'Anemometer monitoring for weather stations',
    device_class: 'wind',
    unit: 'm/s',
    lower_normal: 0.0,
    upper_normal: 5.0,
    lower_alert: null,
    upper_alert: 20.0,
    precision_digits: 1
  },
  {
    name: 'Rainfall Rate',
    description: 'Precipitation measurement (hourly)',
    device_class: 'precipitation',
    unit: 'mm/hr',
    lower_normal: 0.0,
    upper_normal: 10.0,
    lower_alert: null,
    upper_alert: 50.0,
    precision_digits: 1
  },
  {
    name: 'Soil Moisture',
    description: 'Agricultural soil water content monitoring',
    device_class: 'moisture',
    unit: '%',
    lower_normal: 20.0,
    upper_normal: 60.0,
    lower_alert: 10.0,
    upper_alert: 80.0,
    precision_digits: 1
  },
  {
    name: 'UV Index',
    description: 'Ultraviolet radiation level (0-2 low, 11+ extreme)',
    device_class: 'radiation',
    unit: 'index',
    lower_normal: 0.0,
    upper_normal: 11.0,
    lower_alert: null,
    upper_alert: null,
    precision_digits: 1
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // Industrial & Specialized (5)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Vibration Level',
    description: 'Machinery condition monitoring (RMS acceleration)',
    device_class: 'vibration',
    unit: 'mm/s',
    lower_normal: 0.0,
    upper_normal: 4.5,
    lower_alert: null,
    upper_alert: 18.0,
    precision_digits: 2
  },
  {
    name: 'Sound Pressure Level',
    description: 'Noise monitoring (OSHA: 85 dB 8-hour limit)',
    device_class: 'sound',
    unit: 'dB',
    lower_normal: 30.0,
    upper_normal: 70.0,
    lower_alert: null,
    upper_alert: 90.0,
    precision_digits: 1
  },
  {
    name: 'Distance Measurement',
    description: 'Ultrasonic/laser distance sensor',
    device_class: 'distance',
    unit: 'cm',
    lower_normal: 0.0,
    upper_normal: 400.0,
    lower_alert: null,
    upper_alert: null,
    precision_digits: 1
  },
  {
    name: 'Weight/Load',
    description: 'Load cell or scale monitoring',
    device_class: 'weight',
    unit: 'kg',
    lower_normal: 0.0,
    upper_normal: 1000.0,
    lower_alert: null,
    upper_alert: 1500.0,
    precision_digits: 1
  },
  {
    name: 'Gas Concentration (Generic)',
    description: 'Generic gas sensor (calibrate per gas type)',
    device_class: 'gas',
    unit: 'ppm',
    lower_normal: 0.0,
    upper_normal: 50.0,
    lower_alert: null,
    upper_alert: 1000.0,
    precision_digits: 0
  }
];

// Helper function to make HTTPS requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: body ? JSON.parse(body) : null });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function seedDeviceTypes() {
  try {
    console.log('🌱 Seeding 42 industry-standard IoT device types...\n');
    
    // Step 1: Delete existing device types for this org
    console.log('📝 Step 1: Clearing existing device types...');
    await makeRequest(
      'DELETE',
      `/rest/v1/device_types?organization_id=eq.${ORG_ID}`
    );
    console.log('✅ Existing device types cleared\n');
    
    // Step 2: Insert all 42 device types
    console.log('📝 Step 2: Inserting 42 device types...');
    const deviceTypesWithOrg = deviceTypes.map(dt => ({
      organization_id: ORG_ID,
      ...dt
    }));
    
    const result = await makeRequest(
      'POST',
      '/rest/v1/device_types',
      deviceTypesWithOrg
    );
    
    console.log('✅ Successfully inserted 42 device types!\n');
    
    // Step 3: Verify
    console.log('📝 Step 3: Verifying...');
    const verification = await makeRequest(
      'GET',
      `/rest/v1/device_types?organization_id=eq.${ORG_ID}&select=id,name,device_class,unit`
    );
    
    console.log(`✅ Verified: ${verification.body.length} device types in database\n`);
    
    // Group by device class for summary
    const byClass = verification.body.reduce((acc, dt) => {
      acc[dt.device_class] = (acc[dt.device_class] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Device Types by Class:');
    Object.entries(byClass).sort((a, b) => b[1] - a[1]).forEach(([cls, count]) => {
      console.log(`   ${cls.padEnd(20)} ${count}`);
    });
    
    console.log('\n✅ Seeding complete! All 42 industry-standard device types are ready.\n');
    
  } catch (error) {
    console.error('❌ Error seeding device types:', error.message);
    process.exit(1);
  }
}

// Run the seed
seedDeviceTypes();
