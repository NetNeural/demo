import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

// Load environment variables from root directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.API_PORT || process.env.PORT || 3001;

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3002'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// IoT API routes
app.get('/api/organizations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select(`
        *,
        subsidiaries:subsidiaries(
          *,
          locations:locations(count)
        )
      `);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    
    res.json({ organizations: data });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/locations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select(`
        *,
        subsidiary:subsidiaries(name),
        departments:departments(
          *,
          sensors:sensors(status)
        )
      `);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    
    // Calculate sensor stats for each location
    const locationsWithStats = data?.map(location => {
      const allSensors = location.departments?.flatMap((dept: any) => dept.sensors || []) || [];
      const onlineSensors = allSensors.filter((sensor: any) => sensor.status === 'online');
      
      return {
        ...location,
        sensors_total: allSensors.length,
        sensors_online: onlineSensors.length,
        alerts_active: 0 // TODO: Calculate from alerts table
      };
    }) || [];
    
    res.json({ locations: locationsWithStats });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mock data for quick testing
const mockSensors = [
  {
    id: '1',
    name: 'Temperature Sensor A1',
    type: 'temperature',
    status: 'online',
    last_reading: 22.5,
    unit: '°C',
    location: 'Building A - Floor 1',
    department: 'Manufacturing',
    last_seen: new Date().toISOString(),
    battery_level: 85
  },
  {
    id: '2',
    name: 'Humidity Sensor B2',
    type: 'humidity',
    status: 'online',
    last_reading: 65.2,
    unit: '%',
    location: 'Building B - Floor 2',
    department: 'Quality Control',
    last_seen: new Date(Date.now() - 300000).toISOString(),
    battery_level: 92
  },
  {
    id: '3',
    name: 'Pressure Sensor C1',
    type: 'pressure',
    status: 'alert',
    last_reading: 1013.25,
    unit: 'hPa',
    location: 'Building C - Floor 1',
    department: 'Research',
    last_seen: new Date(Date.now() - 120000).toISOString(),
    battery_level: 45
  },
  {
    id: '4',
    name: 'Motion Detector D3',
    type: 'motion',
    status: 'offline',
    last_reading: 0,
    unit: 'count',
    location: 'Building D - Floor 3',
    department: 'Security',
    last_seen: new Date(Date.now() - 3600000).toISOString(),
    battery_level: 12
  }
];

const mockAlerts = [
  {
    id: '1',
    type: 'critical',
    title: 'Low Battery Warning',
    message: 'Motion Detector D3 battery level critically low (12%)',
    sensor_name: 'Motion Detector D3',
    location_name: 'Building D - Floor 3',
    department_name: 'Security',
    triggered_at: new Date(Date.now() - 1800000).toISOString(),
    is_active: true,
    acknowledged: false
  },
  {
    id: '2',
    type: 'warning',
    title: 'High Pressure Reading',
    message: 'Pressure reading above normal threshold (1013.25 hPa)',
    sensor_name: 'Pressure Sensor C1',
    location_name: 'Building C - Floor 1',
    department_name: 'Research',
    triggered_at: new Date(Date.now() - 900000).toISOString(),
    is_active: true,
    acknowledged: false
  },
  {
    id: '3',
    type: 'info',
    title: 'Maintenance Scheduled',
    message: 'Routine maintenance scheduled for humidity sensors',
    sensor_name: 'Humidity Sensor B2',
    location_name: 'Building B - Floor 2',
    department_name: 'Quality Control',
    triggered_at: new Date(Date.now() - 600000).toISOString(),
    is_active: true,
    acknowledged: true
  }
];

const mockLocations = [
  {
    id: '1',
    name: 'Building A - Manufacturing',
    address: '123 Industrial Ave, Factory District',
    latitude: 40.7128,
    longitude: -74.0060,
    sensors_total: 8,
    sensors_online: 7,
    alerts_active: 1
  },
  {
    id: '2',
    name: 'Building B - Quality Control',
    address: '456 Quality St, Testing Zone',
    latitude: 40.7589,
    longitude: -73.9851,
    sensors_total: 12,
    sensors_online: 11,
    alerts_active: 0
  },
  {
    id: '3',
    name: 'Building C - Research Lab',
    address: '789 Innovation Blvd, Tech Park',
    latitude: 40.7282,
    longitude: -73.7949,
    sensors_total: 15,
    sensors_online: 13,
    alerts_active: 2
  },
  {
    id: '4',
    name: 'Building D - Security Center',
    address: '321 Security Way, Central Hub',
    latitude: 40.6892,
    longitude: -74.0445,
    sensors_total: 6,
    sensors_online: 4,
    alerts_active: 1
  }
];

const mockSensorReadings: Record<string, Array<{id: string; value: number; unit: string; reading_time: string}>> = {
  '1': Array.from({ length: 24 }, (_, i) => ({
    id: `1-${i}`,
    value: 20 + Math.random() * 10 + Math.sin(i * 0.5) * 3,
    unit: '°C',
    reading_time: new Date(Date.now() - (23 - i) * 3600000).toISOString()
  })),
  '2': Array.from({ length: 24 }, (_, i) => ({
    id: `2-${i}`,
    value: 60 + Math.random() * 20 + Math.cos(i * 0.3) * 5,
    unit: '%',
    reading_time: new Date(Date.now() - (23 - i) * 3600000).toISOString()
  })),
  '3': Array.from({ length: 24 }, (_, i) => ({
    id: `3-${i}`,
    value: 1000 + Math.random() * 30 + Math.sin(i * 0.2) * 10,
    unit: 'hPa',
    reading_time: new Date(Date.now() - (23 - i) * 3600000).toISOString()
  })),
  '4': Array.from({ length: 24 }, (_, i) => ({
    id: `4-${i}`,
    value: Math.floor(Math.random() * 5),
    unit: 'count',
    reading_time: new Date(Date.now() - (23 - i) * 3600000).toISOString()
  }))
};

app.get('/api/sensors', async (req, res) => {
  try {
    // Return mock data for now
    res.json(mockSensors);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    // Return mock data for now
    res.json(mockAlerts);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/locations', async (req, res) => {
  try {
    // Return mock data for now
    res.json(mockLocations);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sensor-readings/:sensorId', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const readings = mockSensorReadings[sensorId] || [];
    res.json(readings);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    // In a real app, update the database
    res.json({ success: true, message: 'Alert acknowledged' });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Original database endpoints (replaced with mock data for quick development)
/*
app.get('/api/sensors', async (req, res) => {
  try {
    const { location_id } = req.query;
    
    let query = supabase
      .from('sensors')
      .select(`
        *,
        department:departments(name, location_id),
        gateway:gateways(name, status),
        latest_reading:sensor_readings(value, unit, reading_time)
      `)
      .order('created_at', { ascending: false });
    
    if (location_id) {
      query = query.eq('departments.location_id', location_id);
    }
    
    const { data, error } = await query.limit(100);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    
    res.json({ sensors: data });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    const { active_only = 'true' } = req.query;
    
    let query = supabase
      .from('alerts')
      .select(`
        *,
        sensor:sensors(name, department:departments(name, location:locations(name))),
        alert_rule:alert_rules(name, description)
      `)
      .order('triggered_at', { ascending: false });
    
    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    
    res.json({ alerts: data });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sensor-readings/:sensorId', async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { hours = '24' } = req.query;
    
    const hoursAgo = new Date(Date.now() - parseInt(hours as string) * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('*')
      .eq('sensor_id', sensorId)
      .gte('reading_time', hoursAgo)
      .order('reading_time', { ascending: true });
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    
    res.json({ readings: data });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard summary endpoint
app.get('/api/dashboard', async (req, res) => {
  try {
    // Get organizations with basic stats
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('*');
    
    // Get locations with sensor counts
    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select(`
        *,
        departments:departments(
          sensors:sensors(status)
        )
      `);
    
    // Get recent alerts
    const { data: alerts, error: alertError } = await supabase
      .from('alerts')
      .select(`
        *,
        sensor:sensors(
          name,
          department:departments(
            name,
            location:locations(name)
          )
        )
      `)
      .eq('is_active', true)
      .order('triggered_at', { ascending: false })
      .limit(10);
    
    if (orgError || locError || alertError) {
      console.error('Supabase errors:', { orgError, locError, alertError });
      return res.status(500).json({ error: 'Database query failed' });
    }
    
    // Process locations to add sensor stats
    const locationsWithStats = locations?.map(location => {
      const allSensors = location.departments?.flatMap((dept: any) => dept.sensors || []) || [];
      const onlineSensors = allSensors.filter((sensor: any) => sensor.status === 'online');
      
      return {
        ...location,
        sensors_total: allSensors.length,
        sensors_online: onlineSensors.length,
        alerts_active: alerts?.filter(alert => 
          alert.sensor?.department?.location?.name === location.name
        ).length || 0
      };
    }) || [];
    
    res.json({
      organizations: organizations || [],
      locations: locationsWithStats,
      alerts: alerts || [],
      stats: {
        total_locations: locations?.length || 0,
        total_sensors: locationsWithStats.reduce((sum, loc) => sum + loc.sensors_total, 0),
        online_sensors: locationsWithStats.reduce((sum, loc) => sum + loc.sensors_online, 0),
        active_alerts: alerts?.length || 0
      }
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy test endpoint
app.get('/api/test', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database connection failed' });
    }
    
    res.json({ 
      message: 'IoT API is working',
      supabase_connected: true,
      sample_data: data 
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`🚀 IoT API server running on http://localhost:${port}`);
  console.log(`📊 Supabase URL: ${supabaseUrl}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});
