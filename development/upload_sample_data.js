#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bldojxpockljyivldxwf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDAwNzM3NCwiZXhwIjoyMDQ5NTgzMzc0fQ.X5HLSXPzGS7hKA3FWZhkF2V8zVxJJY6nJEaW8-sJLjI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadSampleData() {
  console.log('🚀 Starting sample data upload to Supabase...');

  try {
    // Sample locations
    const locations = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Building A - Main Campus',
        address: '123 Corporate Blvd',
        city: 'Atlanta',
        state_province: 'GA',
        latitude: 33.7490,
        longitude: -84.3880,
        sensors_total: 8,
        sensors_online: 7,
        alerts_active: 1
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Building B - Research Lab',
        address: '456 Innovation Dr',
        city: 'Portland',
        state_province: 'OR',
        latitude: 45.5152,
        longitude: -122.6784,
        sensors_total: 6,
        sensors_online: 5,
        alerts_active: 0
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Warehouse C - Distribution',
        address: '789 Commerce Ave',
        city: 'Phoenix',
        state_province: 'AZ',
        latitude: 33.4484,
        longitude: -112.0740,
        sensors_total: 10,
        sensors_online: 8,
        alerts_active: 2
      }
    ];

    console.log('📍 Uploading locations...');
    const { error: locationsError } = await supabase
      .from('locations')
      .upsert(locations, { onConflict: 'id' });

    if (locationsError) {
      console.error('❌ Error uploading locations:', locationsError);
      return;
    }
    console.log('✅ Locations uploaded successfully!');

    // Sample sensors with current timestamps
    const now = new Date();
    const sensors = [
      // Building A sensors
      {
        id: '660e8400-e29b-41d4-a716-446655440001',
        name: 'Lobby Temperature Sensor',
        type: 'temperature',
        location: 'Building A - Main Campus',
        department: 'Facilities',
        status: 'online',
        current_value: 22.5,
        unit: '°C',
        battery_level: 85,
        last_reading: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 2 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440002',
        name: 'Conference Room Motion Detector',
        type: 'motion',
        location: 'Building A - Main Campus',
        department: 'IT',
        status: 'online',
        current_value: 0,
        unit: 'boolean',
        battery_level: 92,
        last_reading: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 1 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440003',
        name: 'Server Room Humidity Monitor',
        type: 'humidity',
        location: 'Building A - Main Campus',
        department: 'IT',
        status: 'online',
        current_value: 45.2,
        unit: '%RH',
        battery_level: 78,
        last_reading: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 3 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440004',
        name: 'Office Air Quality Sensor',
        type: 'air_quality',
        location: 'Building A - Main Campus',
        department: 'HR',
        status: 'warning',
        current_value: 85,
        unit: 'AQI',
        battery_level: 67,
        last_reading: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 5 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440005',
        name: 'Basement Pressure Monitor',
        type: 'pressure',
        location: 'Building A - Main Campus',
        department: 'Facilities',
        status: 'online',
        current_value: 1013.25,
        unit: 'hPa',
        battery_level: 91,
        last_reading: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 1 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440006',
        name: 'Reception Temperature Control',
        type: 'temperature',
        location: 'Building A - Main Campus',
        department: 'Reception',
        status: 'online',
        current_value: 23.1,
        unit: '°C',
        battery_level: 88,
        last_reading: new Date(now.getTime() - 0.5 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 0.5 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440007',
        name: 'Break Room Motion Sensor',
        type: 'motion',
        location: 'Building A - Main Campus',
        department: 'HR',
        status: 'online',
        current_value: 1,
        unit: 'boolean',
        battery_level: 95,
        last_reading: new Date(now.getTime() - 10 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 10 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440008',
        name: 'Storage Room Humidity',
        type: 'humidity',
        location: 'Building A - Main Campus',
        department: 'Facilities',
        status: 'offline',
        current_value: 0,
        unit: '%RH',
        battery_level: 12,
        last_reading: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
      },
      
      // Building B sensors
      {
        id: '660e8400-e29b-41d4-a716-446655440009',
        name: 'Lab Temperature Monitor',
        type: 'temperature',
        location: 'Building B - Research Lab',
        department: 'Research',
        status: 'online',
        current_value: 20.8,
        unit: '°C',
        battery_level: 76,
        last_reading: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 1 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440010',
        name: 'Clean Room Pressure',
        type: 'pressure',
        location: 'Building B - Research Lab',
        department: 'Research',
        status: 'online',
        current_value: 1015.2,
        unit: 'hPa',
        battery_level: 89,
        last_reading: new Date(now.getTime() - 0.5 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 0.5 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440011',
        name: 'Equipment Room Humidity',
        type: 'humidity',
        location: 'Building B - Research Lab',
        department: 'Research',
        status: 'online',
        current_value: 40.1,
        unit: '%RH',
        battery_level: 82,
        last_reading: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 2 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440012',
        name: 'Security Motion Detector',
        type: 'motion',
        location: 'Building B - Research Lab',
        department: 'Security',
        status: 'online',
        current_value: 0,
        unit: 'boolean',
        battery_level: 94,
        last_reading: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 5 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440013',
        name: 'Air Quality Monitor',
        type: 'air_quality',
        location: 'Building B - Research Lab',
        department: 'Research',
        status: 'online',
        current_value: 35,
        unit: 'AQI',
        battery_level: 71,
        last_reading: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 3 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440014',
        name: 'Entrance Temperature',
        type: 'temperature',
        location: 'Building B - Research Lab',
        department: 'Security',
        status: 'offline',
        current_value: 0,
        unit: '°C',
        battery_level: 5,
        last_reading: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()
      },

      // Warehouse C sensors
      {
        id: '660e8400-e29b-41d4-a716-446655440015',
        name: 'Loading Dock Temperature',
        type: 'temperature',
        location: 'Warehouse C - Distribution',
        department: 'Logistics',
        status: 'online',
        current_value: 28.3,
        unit: '°C',
        battery_level: 73,
        last_reading: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 1 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440016',
        name: 'Cold Storage Temp Monitor',
        type: 'temperature',
        location: 'Warehouse C - Distribution',
        department: 'Cold Storage',
        status: 'online',
        current_value: 2.1,
        unit: '°C',
        battery_level: 80,
        last_reading: new Date(now.getTime() - 0.5 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 0.5 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440017',
        name: 'Freezer Temperature Alert',
        type: 'temperature',
        location: 'Warehouse C - Distribution',
        department: 'Cold Storage',
        status: 'error',
        current_value: -15.2,
        unit: '°C',
        battery_level: 65,
        last_reading: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 10 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440018',
        name: 'Dock Motion Sensor',
        type: 'motion',
        location: 'Warehouse C - Distribution',
        department: 'Logistics',
        status: 'online',
        current_value: 1,
        unit: 'boolean',
        battery_level: 87,
        last_reading: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 2 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440019',
        name: 'Storage Humidity Monitor',
        type: 'humidity',
        location: 'Warehouse C - Distribution',
        department: 'Storage',
        status: 'online',
        current_value: 55.8,
        unit: '%RH',
        battery_level: 79,
        last_reading: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 1 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440020',
        name: 'Air Quality - Dock Area',
        type: 'air_quality',
        location: 'Warehouse C - Distribution',
        department: 'Logistics',
        status: 'warning',
        current_value: 95,
        unit: 'AQI',
        battery_level: 84,
        last_reading: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 3 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440021',
        name: 'Office Pressure Monitor',
        type: 'pressure',
        location: 'Warehouse C - Distribution',
        department: 'Administration',
        status: 'online',
        current_value: 1012.8,
        unit: 'hPa',
        battery_level: 92,
        last_reading: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 1 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440022',
        name: 'Security Motion - Perimeter',
        type: 'motion',
        location: 'Warehouse C - Distribution',
        department: 'Security',
        status: 'online',
        current_value: 0,
        unit: 'boolean',
        battery_level: 96,
        last_reading: new Date(now.getTime() - 0.5 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 0.5 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440023',
        name: 'Break Room Temperature',
        type: 'temperature',
        location: 'Warehouse C - Distribution',
        department: 'HR',
        status: 'offline',
        current_value: 0,
        unit: '°C',
        battery_level: 8,
        last_reading: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '660e8400-e29b-41d4-a716-446655440024',
        name: 'Shipping Humidity Control',
        type: 'humidity',
        location: 'Warehouse C - Distribution',
        department: 'Logistics',
        status: 'online',
        current_value: 48.3,
        unit: '%RH',
        battery_level: 81,
        last_reading: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
        last_seen: new Date(now.getTime() - 2 * 60 * 1000).toISOString()
      }
    ];

    console.log('📊 Uploading sensors...');
    const { error: sensorsError } = await supabase
      .from('sensors')
      .upsert(sensors, { onConflict: 'id' });

    if (sensorsError) {
      console.error('❌ Error uploading sensors:', sensorsError);
      return;
    }
    console.log('✅ Sensors uploaded successfully!');

    // Sample alerts
    const alerts = [
      {
        id: '770e8400-e29b-41d4-a716-446655440001',
        sensor_id: '660e8400-e29b-41d4-a716-446655440004',
        level: 'warning',
        title: 'Air Quality Warning',
        message: 'Air quality index above normal threshold (85 AQI)',
        is_active: true,
        triggered_at: new Date(now.getTime() - 25 * 60 * 1000).toISOString()
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440002',
        sensor_id: '660e8400-e29b-41d4-a716-446655440008',
        level: 'error',
        title: 'Sensor Offline',
        message: 'Humidity sensor has been offline for over 1 hour',
        is_active: true,
        triggered_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440003',
        sensor_id: '660e8400-e29b-41d4-a716-446655440017',
        level: 'critical',
        title: 'Critical Temperature Alert',
        message: 'Freezer temperature outside safe range (-15.2°C)',
        is_active: true,
        triggered_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString()
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440004',
        sensor_id: '660e8400-e29b-41d4-a716-446655440020',
        level: 'warning',
        title: 'Air Quality Degraded',
        message: 'Dock area air quality approaching unhealthy levels',
        is_active: true,
        triggered_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString()
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440005',
        sensor_id: '660e8400-e29b-41d4-a716-446655440014',
        level: 'error',
        title: 'Temperature Sensor Offline',
        message: 'Building B entrance sensor unresponsive',
        is_active: true,
        triggered_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440006',
        sensor_id: '660e8400-e29b-41d4-a716-446655440023',
        level: 'error',
        title: 'Break Room Sensor Down',
        message: 'Temperature sensor offline for extended period',
        is_active: true,
        triggered_at: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
      }
    ];

    console.log('🚨 Uploading alerts...');
    const { error: alertsError } = await supabase
      .from('alerts')
      .upsert(alerts, { onConflict: 'id' });

    if (alertsError) {
      console.error('❌ Error uploading alerts:', alertsError);
      return;
    }
    console.log('✅ Alerts uploaded successfully!');

    // Generate historical sensor readings for the last 24 hours
    console.log('📈 Generating historical sensor readings...');
    
    // Get online sensors for historical data
    const onlineSensors = sensors.filter(s => s.status === 'online');
    
    const readings = [];
    
    // Generate readings for each online sensor over the last 24 hours
    for (const sensor of onlineSensors) {
      for (let hour = 24; hour >= 1; hour--) {
        const readingTime = new Date(now.getTime() - hour * 60 * 60 * 1000);
        
        let value;
        switch (sensor.type) {
          case 'temperature':
            value = sensor.current_value + (Math.random() - 0.5) * 2;
            break;
          case 'humidity':
            value = sensor.current_value + (Math.random() - 0.5) * 5;
            break;
          case 'pressure':
            value = sensor.current_value + (Math.random() - 0.5) * 3;
            break;
          case 'air_quality':
            value = sensor.current_value + (Math.random() - 0.5) * 10;
            break;
          case 'motion':
            value = Math.round(Math.random());
            break;
          default:
            value = sensor.current_value;
        }
        
        readings.push({
          sensor_id: sensor.id,
          value: Math.max(0, value), // Ensure non-negative values
          unit: sensor.unit,
          reading_time: readingTime.toISOString()
        });
      }
    }

    // Upload readings in batches to avoid overwhelming the API
    const batchSize = 100;
    for (let i = 0; i < readings.length; i += batchSize) {
      const batch = readings.slice(i, i + batchSize);
      const { error: readingsError } = await supabase
        .from('sensor_readings')
        .upsert(batch, { onConflict: 'sensor_id,reading_time' });

      if (readingsError) {
        console.error(`❌ Error uploading readings batch ${Math.floor(i/batchSize) + 1}:`, readingsError);
        return;
      }
      console.log(`✅ Uploaded readings batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(readings.length/batchSize)}`);
    }

    console.log('🎉 Sample data upload completed successfully!');
    console.log(`📊 Uploaded:`);
    console.log(`   • ${locations.length} locations`);
    console.log(`   • ${sensors.length} sensors`);
    console.log(`   • ${alerts.length} alerts`);
    console.log(`   • ${readings.length} historical readings`);
    console.log('');
    console.log('🚀 Your IoT Dashboard now has comprehensive demo data!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

uploadSampleData();
