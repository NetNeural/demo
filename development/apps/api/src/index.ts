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

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/dashboard', async (req, res) => {
  try {
    res.json({
      totalSensors: mockSensors.length,
      onlineSensors: mockSensors.filter(s => s.status === 'online').length,
      activeAlerts: mockAlerts.filter(a => a.is_active && !a.acknowledged).length,
      recentAlerts: mockAlerts.slice(0, 5),
      sensorsByType: {
        temperature: mockSensors.filter(s => s.type === 'temperature').length,
        humidity: mockSensors.filter(s => s.type === 'humidity').length,
        pressure: mockSensors.filter(s => s.type === 'pressure').length,
        motion: mockSensors.filter(s => s.type === 'motion').length,
      }
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sensors', async (req, res) => {
  try {
    res.json(mockSensors);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    res.json(mockAlerts);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/locations', async (req, res) => {
  try {
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
