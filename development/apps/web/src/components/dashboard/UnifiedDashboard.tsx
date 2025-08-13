'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import { SimpleIcons } from '../icons/SimpleIcons';
import { SensorCard } from '../sensors/SensorCard';
import { LocationMap } from '../maps/LocationMap';
import { AlertPanel } from '../alerts/AlertPanel';
import { SensorTypeAnalytics } from '../analytics/SensorTypeAnalytics';
import { MetricCard } from './MetricCard';
import { StatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';

// Unified interfaces
interface Sensor {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'alert' | 'warning' | 'error';
  last_reading?: number;
  value?: number;
  unit: string;
  location: string;
  department?: string;
  last_seen?: string;
  lastUpdate?: Date;
  battery_level?: number;
  batteryLevel?: number;
}

interface Alert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  message?: string;
  description?: string;
  sensor_name?: string;
  location_name?: string;
  department_name?: string;
  triggered_at?: string;
  timestamp?: Date;
  location?: string;
  sensor?: string;
  is_active?: boolean;
  acknowledged?: boolean;
  resolved?: boolean;
  severity?: 'high' | 'medium' | 'low';
}

interface Location {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  sensors_total?: number;
  sensors_online?: number;
  alerts_active?: number;
  sensorCount?: number;
  onlineSensors?: number;
  alertCount?: number;
  coordinates?: { lat: number; lng: number };
}

interface SensorReading {
  id: string;
  value: number;
  unit: string;
  timestamp?: string;
}

interface UnifiedDashboardProps {
  mode?: 'production' | 'demo';
  title?: string;
  currentPage?: 'dashboard' | 'mvp';
}

// Mock data generators for demo mode
const generateMockSensors = (): Sensor[] => [
  {
    id: '1',
    name: 'Temperature Sensor A1',
    type: 'temperature',
    value: 22.5 + Math.random() * 5,
    unit: '°C',
    status: Math.random() > 0.9 ? 'warning' : 'online',
    location: 'Building A - Floor 1',
    department: 'Operations',
    lastUpdate: new Date(Date.now() - Math.random() * 300000),
    batteryLevel: 85 + Math.random() * 15
  },
  {
    id: '2',
    name: 'Humidity Monitor B2',
    type: 'humidity',
    value: 45 + Math.random() * 20,
    unit: '%',
    status: 'online',
    location: 'Building B - Floor 2',
    department: 'Storage',
    lastUpdate: new Date(Date.now() - Math.random() * 200000),
    batteryLevel: 92 + Math.random() * 8
  },
  {
    id: '3',
    name: 'Motion Detector C3',
    type: 'motion',
    value: Math.random() > 0.7 ? 1 : 0, // Binary: 1 = motion detected, 0 = no motion
    unit: 'detected',
    status: 'online',
    location: 'Building C - Entrance',
    department: 'Security',
    lastUpdate: new Date(Date.now() - Math.random() * 60000),
    batteryLevel: 78 + Math.random() * 22
  },
  {
    id: '4',
    name: 'Air Quality Monitor D4',
    type: 'air_quality',
    value: 25 + Math.random() * 75, // AQI scale 0-100+
    unit: 'AQI',
    status: 'online',
    location: 'Building D - Office Area',
    department: 'Facilities',
    lastUpdate: new Date(Date.now() - Math.random() * 400000),
    batteryLevel: 88 + Math.random() * 12
  },
  {
    id: '5',
    name: 'Pressure Sensor E5',
    type: 'pressure',
    value: 1013 + Math.random() * 40 - 20, // Barometric pressure in hPa
    unit: 'hPa',
    status: Math.random() > 0.95 ? 'warning' : 'online',
    location: 'Building E - Laboratory',
    department: 'Research',
    lastUpdate: new Date(Date.now() - Math.random() * 180000),
    batteryLevel: 91 + Math.random() * 9
  },
  {
    id: '6',
    name: 'Sound Level Monitor F6',
    type: 'sound',
    value: 35 + Math.random() * 50, // dB levels
    unit: 'dB',
    status: 'online',
    location: 'Building F - Manufacturing',
    department: 'Production',
    lastUpdate: new Date(Date.now() - Math.random() * 120000),
    batteryLevel: 76 + Math.random() * 24
  },
  {
    id: '7',
    name: 'Light Sensor G7',
    type: 'light',
    value: 200 + Math.random() * 800, // Lux levels
    unit: 'lux',
    status: 'online',
    location: 'Building G - Office Space',
    department: 'Administration',
    lastUpdate: new Date(Date.now() - Math.random() * 90000),
    batteryLevel: 94 + Math.random() * 6
  },
  {
    id: '8',
    name: 'Vibration Monitor H8',
    type: 'vibration',
    value: 0.1 + Math.random() * 2.0, // Vibration intensity
    unit: 'mm/s',
    status: Math.random() > 0.8 ? 'alert' : 'online',
    location: 'Building H - Machine Room',
    department: 'Maintenance',
    lastUpdate: new Date(Date.now() - Math.random() * 150000),
    batteryLevel: 83 + Math.random() * 17
  }
];

const generateMockLocations = (): Location[] => [
  {
    id: '1',
    name: 'Building A',
    sensorCount: 12,
    onlineSensors: 11,
    alertCount: 1,
    coordinates: { lat: 40.7128, lng: -74.0060 }
  },
  {
    id: '2',
    name: 'Building B', 
    sensorCount: 8,
    onlineSensors: 8,
    alertCount: 0,
    coordinates: { lat: 40.7130, lng: -74.0058 }
  },
  {
    id: '3',
    name: 'Building C',
    sensorCount: 15,
    onlineSensors: 14,
    alertCount: 2,
    coordinates: { lat: 40.7125, lng: -74.0062 }
  }
];

const generateMockAlerts = (): Alert[] => [
  {
    id: '1',
    title: 'High Temperature Alert',
    description: 'Temperature sensor A1 reading exceeds normal range',
    severity: 'high',
    type: 'critical',
    timestamp: new Date(Date.now() - 1800000),
    location: 'Building A - Floor 1',
    sensor: 'Temperature Sensor A1',
    resolved: false,
    acknowledged: false,
    is_active: true
  },
  {
    id: '2',
    title: 'Motion Detected After Hours',
    description: 'Unexpected motion detected in restricted area',
    severity: 'medium',
    type: 'warning',
    timestamp: new Date(Date.now() - 3600000),
    location: 'Building C - Entrance',
    sensor: 'Motion Detector C1',
    resolved: false,
    acknowledged: false,
    is_active: true
  },
  {
    id: '3',
    title: 'Low Battery Warning',
    description: 'Pressure gauge battery level below 20%',
    severity: 'low',
    type: 'warning',
    timestamp: new Date(Date.now() - 7200000),
    location: 'Building A - Floor 3',
    sensor: 'Pressure Gauge A3',
    resolved: true,
    acknowledged: true,
    is_active: false
  }
];

export default function UnifiedDashboard({ 
  mode = 'production', 
  title = 'IoT Dashboard',
  currentPage = 'dashboard'
}: UnifiedDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [sensorStatusFilter, setSensorStatusFilter] = useState<'all' | 'online' | 'issues'>('all');
  const [sensorReadings, setSensorReadings] = useState<SensorReading[]>([]);
  // Generate mock sensor readings for demo mode
  const generateMockSensorReadings = (sensorType: string, sensorId: string) => {
    const now = new Date();
    const readings = [];
    
    // Generate 24 hours of readings (one every hour)
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      let value: number;
      let unit: string;
      
      // Generate realistic data patterns based on sensor type
      switch (sensorType.toLowerCase()) {
        case 'temperature':
          // Daily temperature pattern: cooler at night, warmer during day
          const hour = time.getHours();
          const baseTemp = 20 + Math.sin((hour - 6) * Math.PI / 12) * 8; // Peak at 2 PM
          value = baseTemp + (Math.random() - 0.5) * 3;
          unit = '°C';
          break;
          
        case 'humidity':
          // Humidity inversely related to temperature + random variation
          const tempValue = 20 + Math.sin((time.getHours() - 6) * Math.PI / 12) * 8;
          const baseHumidity = 70 - (tempValue - 20) * 2; // Inverse relationship
          value = Math.max(20, Math.min(80, baseHumidity + (Math.random() - 0.5) * 10));
          unit = '%';
          break;
          
        case 'motion':
          // Motion detection: higher activity during business hours
          const businessHour = time.getHours() >= 8 && time.getHours() <= 18;
          const probability = businessHour ? 0.7 : 0.1;
          value = Math.random() < probability ? 1 : 0;
          unit = 'detected';
          break;
          
        case 'air_quality':
        case 'air quality':
          // AQI: varies throughout day, higher during rush hours
          const rushHour = (time.getHours() >= 7 && time.getHours() <= 9) || 
                          (time.getHours() >= 17 && time.getHours() <= 19);
          const baseAQI = rushHour ? 60 : 40;
          value = Math.max(10, baseAQI + (Math.random() - 0.5) * 30);
          unit = 'AQI';
          break;
          
        case 'pressure':
        case 'barometric':
          // Atmospheric pressure: slow changes with weather patterns
          const basePressure = 1013 + Math.sin(time.getTime() / (1000 * 60 * 60 * 24)) * 15;
          value = basePressure + (Math.random() - 0.5) * 5;
          unit = 'hPa';
          break;
          
        case 'sound':
          // Sound levels: higher during day, lower at night
          const isDay = time.getHours() >= 6 && time.getHours() <= 22;
          const baseSound = isDay ? 45 : 25;
          value = baseSound + Math.random() * 20;
          unit = 'dB';
          break;
          
        case 'light':
          // Light levels: follow sun pattern
          const sunHour = time.getHours();
          let lightValue = 0;
          if (sunHour >= 6 && sunHour <= 18) {
            const sunIntensity = Math.sin((sunHour - 6) * Math.PI / 12);
            lightValue = sunIntensity * 800 + Math.random() * 100;
          } else {
            lightValue = Math.random() * 50; // Artificial lighting
          }
          value = Math.max(0, lightValue);
          unit = 'lux';
          break;
          
        case 'vibration':
          // Vibration: higher during operational hours
          const operational = time.getHours() >= 7 && time.getHours() <= 19;
          const baseVibration = operational ? 0.5 : 0.1;
          value = baseVibration + Math.random() * 0.3;
          unit = 'mm/s';
          break;
          
        default:
          // Fallback for unknown sensor types
          value = 50 + Math.random() * 100;
          unit = 'units';
      }
      
      readings.push({
        id: `reading-${sensorId}-${i}`,
        value: parseFloat(value.toFixed(2)),
        unit: unit,
        timestamp: time.toISOString(),
      });
    }
    
    return readings.reverse(); // Return in chronological order
  };

  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch or generate data based on mode
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        if (mode === 'demo') {
          // Use mock data for demo mode
          setSensors(generateMockSensors());
          setLocations(generateMockLocations());
          setAlerts(generateMockAlerts());
          setLastUpdate(new Date());
        } else {
          // Try to fetch real data for production mode using direct Supabase calls
          const supabase = createClient();
          
          // If Supabase is not available, fall back to demo mode
          if (!supabase) {
            console.warn('⚠️ Supabase not available, falling back to demo mode');
            setSensors(generateMockSensors());
            setLocations(generateMockLocations());
            setAlerts(generateMockAlerts());
            setLastUpdate(new Date());
            return;
          }
          
          try {
            // Fetch sensors
            const { data: sensorsData, error: sensorsError } = await supabase
              .from('sensors')
              .select('*')
              .order('name');

            if (sensorsError) {
              console.error('Error fetching sensors:', sensorsError);
              throw sensorsError; // Will trigger fallback to demo mode
            } else {
              setSensors(sensorsData || []);
            }

            // Fetch alerts
            const { data: alertsData, error: alertsError } = await supabase
              .from('alerts')
              .select('*')
              .order('created_at', { ascending: false });

            if (alertsError) {
              console.error('Error fetching alerts:', alertsError);
            } else {
              setAlerts(alertsData || []);
            }

            // Fetch locations
            const { data: locationsData, error: locationsError } = await supabase
              .from('locations')
              .select('*')
              .order('name');

            if (locationsError) {
              console.error('Error fetching locations:', locationsError);
            } else {
              setLocations(locationsData || []);
            }
          } catch (error) {
            console.error('Error fetching data from Supabase:', error);
            console.warn('⚠️ Falling back to demo mode due to Supabase error');
            // Fallback to mock data if Supabase fails
            setSensors(generateMockSensors());
            setLocations(generateMockLocations());
            setAlerts(generateMockAlerts());
            setLastUpdate(new Date());
          }
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Fallback to mock data on error
        setSensors(generateMockSensors());
        setLocations(generateMockLocations());
        setAlerts(generateMockAlerts());
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Set up real-time updates for demo mode
    if (mode === 'demo') {
      const interval = setInterval(() => {
        setSensors(generateMockSensors());
        setLastUpdate(new Date());
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  // Fetch sensor readings when a sensor is selected
  useEffect(() => {
    if (selectedSensor && mode === 'production') {
      const fetchSensorReadings = async () => {
        try {
          const supabase = createClient();
          
          // If Supabase is not available, skip sensor readings
          if (!supabase) {
            console.warn('⚠️ Supabase not available, skipping sensor readings fetch');
            setSensorReadings([]);
            return;
          }
          
          // Calculate the time range
          let hoursBack = 24;
          switch (timeRange) {
            case '1h':
              hoursBack = 1;
              break;
            case '24h':
              hoursBack = 24;
              break;
            case '7d':
              hoursBack = 24 * 7;
              break;
            case '30d':
              hoursBack = 24 * 30;
              break;
            default:
              hoursBack = 24;
          }
          
          const timeAgo = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
          
          const { data: readings, error } = await supabase
            .from('sensor_readings')
            .select('*')
            .eq('sensor_id', selectedSensor)
            .gte('timestamp', timeAgo)
            .order('timestamp', { ascending: true });

          if (error) {
            console.error('Supabase error:', error);
            return;
          }

          setSensorReadings(readings || []);
        } catch (error) {
          console.error('Error fetching sensor readings:', error);
          console.warn('⚠️ Setting empty sensor readings due to error');
          setSensorReadings([]);
        }
      };

      fetchSensorReadings();
    }
  }, [selectedSensor, timeRange, mode]);

  // Utility functions
  const formatSensorValue = (sensor: Sensor) => {
    const value = sensor.value ?? sensor.last_reading ?? 0;
    if (sensor.type === 'motion') {
      return value === 1 ? 'Motion Detected' : 'No Motion';
    }
    return `${value.toFixed(1)} ${sensor.unit}`;
  };

  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'temperature':
        return <SimpleIcons.FireIcon className="icon icon-sm" />;
      case 'humidity':
        return <SimpleIcons.WifiIcon className="icon icon-sm" />;
      case 'motion':
        return <SimpleIcons.EyeIcon className="icon icon-sm" />;
      case 'pressure':
        return <SimpleIcons.SignalIcon className="icon icon-sm" />;
      case 'light':
        return <SimpleIcons.BoltIcon className="icon icon-sm" />;
      default:
        return <SimpleIcons.CpuChipIcon className="icon icon-sm" />;
    }
  };

  const normalizeStatus = (status: string): 'online' | 'offline' | 'warning' | 'error' => {
    switch (status) {
      case 'alert':
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'offline':
        return 'offline';
      default:
        return 'online';
    }
  };

  const handleSensorSelect = (sensorId: string) => {
    setSelectedSensor(sensorId);
  };

  const handleAlertAcknowledge = async (alertId: string) => {
    if (mode === 'production') {
      try {
        const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
          method: 'POST',
        });

        if (response.ok) {
          setAlerts(alerts.map(alert => 
            alert.id === alertId ? { ...alert, acknowledged: true } : alert
          ));
        }
      } catch (error) {
        console.error('Error acknowledging alert:', error);
      }
    } else {
      // Demo mode - just update state
      setAlerts(alerts.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true, resolved: true } : alert
      ));
    }
  };

  const handleLocationClick = (locationId: string) => {
    if (selectedLocation === locationId) {
      // If clicking the same location, clear the filter
      setSelectedLocation(null);
    } else {
      // Set the selected location to filter sensors
      setSelectedLocation(locationId);
    }
    // Clear selected sensor when changing location filter
    setSelectedSensor(null);
  };

  // Filter sensors based on selected location and status
  const filteredSensors = sensors
    .filter(s => {
      // Location filter
      if (selectedLocation) {
        const locationMatch = s.location.includes(selectedLocation) || 
                             s.location.toLowerCase().includes(selectedLocation.toLowerCase());
        if (!locationMatch) return false;
      }
      
      // Status filter
      if (sensorStatusFilter === 'online') {
        return normalizeStatus(s.status) === 'online';
      } else if (sensorStatusFilter === 'issues') {
        const status = normalizeStatus(s.status);
        return status === 'warning' || status === 'error' || status === 'offline';
      }
      
      // 'all' filter - no status filtering
      return true;
    });

  // Calculate metrics
  const onlineSensors = sensors.filter(s => normalizeStatus(s.status) === 'online').length;
  const totalSensors = sensors.length;
  const activeAlerts = alerts.filter(a => 
    mode === 'demo' ? !a.resolved : (a.is_active && !a.acknowledged)
  ).length;
  const systemHealth = totalSensors > 0 ? Math.round((onlineSensors / totalSensors) * 100) : 100;

  if (loading) {
    return (
      <div className="page flex items-center justify-center">
        <div className="text-center">
          <div className="loading"></div>
          <p className="mt-4">Loading {title}...</p>
        </div>
      </div>
    );
  }

  const selectedSensorData = selectedSensor ? sensors.find(s => s.id === selectedSensor) : null;

  // Transform sensor data for SensorCard component
  const transformSensorForCard = (sensor: Sensor) => ({
    ...sensor,
    status: normalizeStatus(sensor.status) as 'online' | 'offline' | 'alert',
    lastReading: {
      value: sensor.value ?? sensor.last_reading ?? 0,
      unit: sensor.unit,
      timestamp: sensor.last_seen ?? sensor.lastUpdate?.toISOString() ?? new Date().toISOString(),
    },
    department: sensor.department ?? 'General',
  });

  // Transform locations for LocationMap component
  const transformLocationsForMap = (locations: Location[]) =>
    locations.map(location => ({
      ...location,
      address: location.address ?? '',
      sensors_total: location.sensors_total ?? location.sensorCount ?? 0,
      sensors_online: location.sensors_online ?? location.onlineSensors ?? 0,
      alerts_active: location.alerts_active ?? location.alertCount ?? 0,
    }));

  // Transform alerts for AlertPanel component
  const transformAlertsForPanel = (alerts: Alert[]) =>
    alerts.map(alert => ({
      ...alert,
      message: alert.message ?? alert.description ?? '',
      sensor_name: alert.sensor_name ?? alert.sensor ?? '',
      location_name: alert.location_name ?? alert.location ?? '',
      department_name: alert.department_name ?? '',
      triggered_at: alert.triggered_at ?? alert.timestamp?.toISOString() ?? new Date().toISOString(),
      is_active: alert.is_active ?? !alert.resolved,
      acknowledged: alert.acknowledged ?? alert.resolved ?? false,
    }));

  // Transform sensor readings
  const transformSensorReadings = (readings: SensorReading[]) =>
    readings.map(reading => ({
      ...reading,
      reading_time: reading.timestamp ?? new Date().toISOString(),
    }));

  return (
    <div className="page">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <div className="nav-links">
            <Link href="/" className="nav-link">← Home</Link>
            <Link href="/dashboard" className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}>
              Dashboard
            </Link>
            <Link href="/mvp" className={`nav-link ${currentPage === 'mvp' ? 'active' : ''}`}>
              MVP Demo
            </Link>
          </div>
          <div className="text-small">
            {title} {mode === 'demo' && '(Demo Mode)'}
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="header-title">NetNeural {title}</h1>
              <p className="header-subtitle">
                Real-time monitoring and management of your IoT infrastructure
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-sm text-muted">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </div>
              <div className="flex items-center gap-4">
                <div className="badge badge-success">
                  {onlineSensors} sensors online
                </div>
                <div className="badge badge-error">
                  {activeAlerts} active alerts
                </div>
                <StatusBadge 
                  status={systemHealth > 90 ? "online" : systemHealth > 70 ? "warning" : "error"} 
                  showLabel={false}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="section bg-light">
        <div className="container">
          <div className="tabs">
            <button 
              className={activeTab === 'overview' ? 'tab tab-active' : 'tab'}
              onClick={() => setActiveTab('overview')}
            >
              <SimpleIcons.ChartBarIcon className="icon icon-sm mr-2" />
              Overview
            </button>
            <button 
              className={activeTab === 'sensors' ? 'tab tab-active' : 'tab'}
              onClick={() => setActiveTab('sensors')}
            >
              <SimpleIcons.CpuChipIcon className="icon icon-sm mr-2" />
              Sensors ({totalSensors})
            </button>
            <button 
              className={activeTab === 'locations' ? 'tab tab-active' : 'tab'}
              onClick={() => setActiveTab('locations')}
            >
              <SimpleIcons.MapPinIcon className="icon icon-sm mr-2" />
              Locations ({locations.length})
            </button>
            <button 
              className={activeTab === 'alerts' ? 'tab tab-active' : 'tab'}
              onClick={() => setActiveTab('alerts')}
            >
              <SimpleIcons.ExclamationTriangleIcon className="icon icon-sm mr-2" />
              Alerts ({activeAlerts})
            </button>
            {mode === 'demo' && (
              <button 
                className={activeTab === 'analytics' ? 'tab tab-active' : 'tab'}
                onClick={() => setActiveTab('analytics')}
              >
                <SimpleIcons.ChartBarIcon className="icon icon-sm mr-2" />
                Analytics
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="section">
        <div className="container">
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-8">
              {/* Key Metrics */}
              <div className="grid grid-4 gap-6">
                <MetricCard
                  title="Total Sensors"
                  value={totalSensors}
                  change={mode === 'demo' ? "+2 this week" : undefined}
                  trend="up"
                  status="info"
                  icon={<SimpleIcons.CpuChipIcon />}
                />
                <MetricCard
                  title="Online Sensors"
                  value={onlineSensors}
                  unit={`/ ${totalSensors}`}
                  status="success"
                  icon={<SimpleIcons.SignalIcon />}
                />
                <MetricCard
                  title="Active Alerts"
                  value={activeAlerts}
                  status={activeAlerts > 0 ? "warning" : "success"}
                  icon={<SimpleIcons.ExclamationTriangleIcon />}
                />
                <MetricCard
                  title="System Health"
                  value={systemHealth}
                  unit="%"
                  status={systemHealth > 90 ? "success" : systemHealth > 70 ? "warning" : "error"}
                  icon={<SimpleIcons.ChartBarIcon />}
                />
              </div>

              {/* System Health Progress */}
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <h3 className="card-title">System Health Overview</h3>
                    <StatusBadge 
                      status={systemHealth > 90 ? "online" : systemHealth > 70 ? "warning" : "error"} 
                    />
                  </div>
                </div>
                <div className="card-body">
                  <ProgressBar
                    value={systemHealth}
                    label="Overall System Health"
                    variant={systemHealth > 90 ? "success" : systemHealth > 70 ? "warning" : "error"}
                    size="lg"
                  />
                </div>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-2 gap-6">
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Recent Sensor Data</h3>
                  </div>
                  <div className="card-body">
                    <div className="flex flex-col gap-4">
                      {sensors.slice(0, 3).map((sensor) => (
                        <div key={sensor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            {getSensorIcon(sensor.type)}
                            <div>
                              <p className="font-medium">{sensor.name}</p>
                              <p className="text-sm text-muted">{sensor.location}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatSensorValue(sensor)}</p>
                            <StatusBadge status={normalizeStatus(sensor.status)} size="sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Active Alerts</h3>
                  </div>
                  <div className="card-body">
                    <div className="flex flex-col gap-4">
                      {alerts.filter(a => mode === 'demo' ? !a.resolved : (a.is_active && !a.acknowledged)).slice(0, 3).map((alert) => (
                        <div key={alert.id} className={`alert ${
                          alert.severity === 'high' || alert.type === 'critical' ? 'alert-error' :
                          alert.severity === 'medium' || alert.type === 'warning' ? 'alert-warning' : 'alert-info'
                        }`}>
                          <div className="flex items-start">
                            <SimpleIcons.ExclamationTriangleIcon className="icon icon-sm mt-0.5 flex-shrink-0" />
                            <div className="ml-3 flex-1">
                              <h4 className="font-medium">{alert.title}</h4>
                              <p className="text-sm mt-1">{alert.description || alert.message}</p>
                              <p className="text-xs mt-2 opacity-75">
                                {alert.location} • {
                                  alert.timestamp ? alert.timestamp.toLocaleTimeString() :
                                  alert.triggered_at ? new Date(alert.triggered_at).toLocaleTimeString() :
                                  'Unknown time'
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sensors' && (
            <div className="grid grid-3 gap-6">
              {/* Left Column - Sensors and Map */}
              <div className="grid-span-2 flex flex-col gap-6">
                {/* Location Map - Hidden for now, will redesign later
                <div className="card">
                  <div className="card-header">
                    <div className="flex items-center justify-between">
                      <h2 className="card-title">Location Overview</h2>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-dark">{filteredSensors.filter(s => s.status === 'online').length} Online</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <span className="text-dark">{filteredSensors.filter(s => s.status === 'warning' || s.status === 'alert').length} Alerts</span>
                        </div>
                        <span className="text-gray-500">
                          {locations.length} Locations • {filteredSensors.length}/{sensors.length} Sensors
                          {selectedLocation && <span className="text-blue-600 ml-2">• Filtered by {selectedLocation}</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="h-32">
                      <LocationMap 
                        locations={transformLocationsForMap(locations)} 
                        onLocationSelect={handleLocationClick}
                      />
                    </div>
                  </div>
                </div>
                */}

                {/* Sensors Grid */}
                <div className="card">
                  <div className="card-header">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h2 className="card-title">Sensors</h2>
                        {selectedLocation && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">
                              📍 {selectedLocation}
                            </span>
                            <button 
                              onClick={() => setSelectedLocation(null)}
                              className="text-gray-400 hover:text-gray-600 text-sm"
                              title="Clear location filter"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {filteredSensors.length} of {sensors.length}
                        </span>
                        <button 
                          onClick={() => setSensorStatusFilter('all')}
                          className={`btn btn-sm ${sensorStatusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          All
                        </button>
                        <button 
                          onClick={() => setSensorStatusFilter('online')}
                          className={`btn btn-sm ${sensorStatusFilter === 'online' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          Online
                        </button>
                        <button 
                          onClick={() => setSensorStatusFilter('issues')}
                          className={`btn btn-sm ${sensorStatusFilter === 'issues' ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          Issues
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="grid grid-2 gap-4">
                      {filteredSensors.map((sensor) => (
                        <div
                          key={sensor.id}
                          className={`cursor-pointer transition-all border rounded-lg p-4 ${
                            selectedSensor === sensor.id 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleSensorSelect(sensor.id)}
                        >
                          <SensorCard sensor={transformSensorForCard(sensor)} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Analytics */}
              <div className="flex flex-col gap-6">
                {selectedSensorData ? (
                  <div className="card">
                    <div className="card-header">
                      <h2 className="card-title">Analytics: {selectedSensorData.name}</h2>
                      <p className="text-sm text-gray-600">
                        {selectedSensorData.location} • {selectedSensorData.department}
                      </p>
                    </div>
                    <div className="card-body">
                      {mode === 'production' ? (
                        <SensorTypeAnalytics
                          sensorId={selectedSensorData.id}
                          sensorName={selectedSensorData.name}
                          sensorType={selectedSensorData.type}
                          readings={transformSensorReadings(sensorReadings)}
                          timeRange={timeRange}
                          onTimeRangeChange={setTimeRange}
                          location={selectedSensorData.location}
                          department={selectedSensorData.department}
                        />
                      ) : (
                        <SensorTypeAnalytics
                          sensorId={selectedSensorData.id}
                          sensorName={selectedSensorData.name}
                          sensorType={selectedSensorData.type}
                          readings={generateMockSensorReadings(selectedSensorData.type, selectedSensorData.id)}
                          timeRange={timeRange}
                          onTimeRangeChange={setTimeRange}
                          location={selectedSensorData.location}
                          department={selectedSensorData.department}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="card text-center">
                    <div className="card-body">
                      <div className="icon-container icon-lg icon-bg-gray mb-4">
                        <ChartBarIcon />
                      </div>
                      <p>Select a sensor to view analytics</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'locations' && (
            <div className="flex flex-col gap-6">
              <h2 className="h2">Location Overview</h2>
              
              <div className="grid grid-4 gap-4">
                {locations.map((location) => (
                  <MetricCard
                    key={location.id}
                    title={location.name}
                    value={`${location.onlineSensors || location.sensors_online}/${location.sensorCount || location.sensors_total}`}
                    change={
                      (location.alertCount || location.alerts_active || 0) > 0 
                        ? `${location.alertCount || location.alerts_active} alerts` 
                        : "All systems normal"
                    }
                    trend={(location.alertCount || location.alerts_active || 0) > 0 ? "down" : "neutral"}
                    status={(location.alertCount || location.alerts_active || 0) > 0 ? "warning" : "success"}
                    icon={<SimpleIcons.MapPinIcon />}
                  />
                ))}
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Location Details</h3>
                </div>
                <div className="card-body">
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Location</th>
                          <th>Total Sensors</th>
                          <th>Online</th>
                          <th>Health</th>
                          <th>Alerts</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {locations.map((location) => {
                          const totalSensors = location.sensorCount || location.sensors_total || 0;
                          const onlineSensors = location.onlineSensors || location.sensors_online || 0;
                          const health = totalSensors > 0 ? Math.round((onlineSensors / totalSensors) * 100) : 100;
                          const alerts = location.alertCount || location.alerts_active || 0;
                          
                          return (
                            <tr key={location.id}>
                              <td className="font-medium">{location.name}</td>
                              <td>{totalSensors}</td>
                              <td>{onlineSensors}</td>
                              <td>
                                <ProgressBar
                                  value={health}
                                  variant={health > 90 ? "success" : health > 70 ? "warning" : "error"}
                                  showPercentage={false}
                                  size="sm"
                                />
                              </td>
                              <td>{alerts}</td>
                              <td>
                                <StatusBadge 
                                  status={health > 90 ? "online" : health > 70 ? "warning" : "error"}
                                  size="sm"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="h2">Alert Management</h2>
                <div className="flex gap-2">
                  <button className="btn btn-secondary btn-sm">Mark All Read</button>
                  <button className="btn btn-primary btn-sm">Configure Alerts</button>
                </div>
              </div>

              <div className="grid grid-3 gap-6">
                <MetricCard
                  title="Total Alerts"
                  value={alerts.length}
                  status="info"
                  icon={<SimpleIcons.ExclamationTriangleIcon />}
                />
                <MetricCard
                  title="Active Alerts"
                  value={activeAlerts}
                  status={activeAlerts > 0 ? "warning" : "success"}
                  icon={<SimpleIcons.ExclamationTriangleIcon />}
                />
                <MetricCard
                  title="Resolved Today"
                  value={alerts.filter(a => a.resolved || a.acknowledged).length}
                  status="success"
                  icon={<SimpleIcons.ExclamationTriangleIcon />}
                />
              </div>

              <div className="card">
                <div className="card-body">
                  <AlertPanel 
                    alerts={transformAlertsForPanel(alerts)} 
                    onAlertAcknowledge={handleAlertAcknowledge}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && mode === 'demo' && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="h2">Advanced Analytics Dashboard</h2>
                <div className="flex gap-2">
                  <button className="btn btn-secondary btn-sm">Export Data</button>
                  <button className="btn btn-primary btn-sm">Generate Report</button>
                </div>
              </div>

              {/* Analytics Overview Cards */}
              <div className="grid grid-4 gap-6">
                <MetricCard
                  title="Data Points Collected"
                  value="124,567"
                  change="+8.2% vs last month"
                  trend="up"
                  status="success"
                  icon={<SimpleIcons.ChartBarIcon />}
                />
                <MetricCard
                  title="Average Response Time"
                  value="1.2ms"
                  change="-15% improvement"
                  trend="up"
                  status="success"
                  icon={<SimpleIcons.BoltIcon />}
                />
                <MetricCard
                  title="Data Accuracy"
                  value="99.8%"
                  change="+0.3% this week"
                  trend="up"
                  status="success"
                  icon={<SimpleIcons.CheckCircleIcon />}
                />
                <MetricCard
                  title="Prediction Accuracy"
                  value="94.5%"
                  change="+2.1% improvement"
                  trend="up"
                  status="info"
                  icon={<SimpleIcons.Cog6ToothIcon />}
                />
              </div>

              {/* Analytics Charts Row */}
              <div className="grid grid-2 gap-6">
                {/* System Performance Chart */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">System Performance Trends</h3>
                    <div className="flex gap-2">
                      <button className="btn btn-xs btn-secondary">24h</button>
                      <button className="btn btn-xs btn-primary">7d</button>
                      <button className="btn btn-xs btn-secondary">30d</button>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="h-64 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📈</div>
                        <h4 className="font-semibold text-gray-700 mb-2">Performance Analytics</h4>
                        <div className="flex justify-center space-x-4 mb-4">
                          <div className="text-center">
                            <div className="w-12 h-8 bg-blue-500 rounded mb-1"></div>
                            <span className="text-xs text-gray-600">CPU</span>
                          </div>
                          <div className="text-center">
                            <div className="w-12 h-12 bg-green-500 rounded mb-1"></div>
                            <span className="text-xs text-gray-600">Memory</span>
                          </div>
                          <div className="text-center">
                            <div className="w-12 h-6 bg-yellow-500 rounded mb-1"></div>
                            <span className="text-xs text-gray-600">Network</span>
                          </div>
                          <div className="text-center">
                            <div className="w-12 h-10 bg-purple-500 rounded mb-1"></div>
                            <span className="text-xs text-gray-600">Storage</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">Real-time system metrics visualization</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sensor Data Distribution */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Sensor Data Distribution</h3>
                    <select className="select select-sm" title="Select sensor type">
                      <option>All Sensors</option>
                      <option>Temperature Sensors</option>
                      <option>Humidity Sensors</option>
                      <option>Motion Sensors</option>
                    </select>
                  </div>
                  <div className="card-body">
                    <div className="h-64 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl mb-2">🥧</div>
                        <h4 className="font-semibold text-gray-700 mb-4">Data Distribution</h4>
                        <div className="grid grid-2 gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="text-sm">Temperature (35%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm">Humidity (28%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm">Motion (22%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            <span className="text-sm">Other (15%)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Predictive Analytics Section */}
              <div className="card">
                <div className="card-header bg-gradient">
                  <h3 className="card-title text-dark">Predictive Analytics & AI Insights</h3>
                  <span className="badge badge-light">Beta</span>
                </div>
                <div className="card-body">
                  <div className="grid grid-3 gap-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl mb-2">🔮</div>
                      <h4 className="font-semibold mb-2">Anomaly Detection</h4>
                      <p className="text-sm text-gray-600 mb-3">AI-powered monitoring identifies potential issues before they occur</p>
                      <div className="text-lg font-bold text-blue-600">3 Predictions</div>
                      <p className="text-xs text-gray-500">Next 24 hours</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl mb-2">⚡</div>
                      <h4 className="font-semibold mb-2">Energy Optimization</h4>
                      <p className="text-sm text-gray-600 mb-3">Smart recommendations to reduce power consumption</p>
                      <div className="text-lg font-bold text-green-600">12% Savings</div>
                      <p className="text-xs text-gray-500">Potential monthly</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl mb-2">🎯</div>
                      <h4 className="font-semibold mb-2">Maintenance Prediction</h4>
                      <p className="text-sm text-gray-600 mb-3">Proactive maintenance scheduling based on usage patterns</p>
                      <div className="text-lg font-bold text-purple-600">14 Days</div>
                      <p className="text-xs text-gray-500">Until next service</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Historical Trends */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Historical Data Trends</h3>
                  <div className="flex gap-2">
                    <button className="btn btn-xs btn-secondary">Temperature</button>
                    <button className="btn btn-xs btn-secondary">Humidity</button>
                    <button className="btn btn-xs btn-primary">All Metrics</button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="h-48 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl mb-2">📊</div>
                      <h4 className="font-semibold text-gray-700 mb-2">30-Day Trend Analysis</h4>
                      <div className="flex justify-center space-x-8 mb-4">
                        {[20, 35, 28, 42, 31, 38, 25].map((height, i) => (
                            <div key={i} className="text-center">
                              <div className={`w-4 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t mb-1 ${
                                height <= 25 ? 'h-6' : 
                                height <= 35 ? 'h-8' : 'h-10'
                              }`}>
                              </div>
                              <span className="text-xs text-gray-500">W{i + 1}</span>
                            </div>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500">Weekly aggregated sensor data</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Data Feed */}
              <div className="grid grid-2 gap-6">
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Live Data Stream</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-600">Live</span>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="space-y-3">
                      {[
                        { sensor: "Temp-01", value: "24.3°C", time: "Just now", status: "normal" },
                        { sensor: "Hum-05", value: "67%", time: "2 sec ago", status: "normal" },
                        { sensor: "Motion-12", value: "Active", time: "5 sec ago", status: "alert" },
                        { sensor: "Pressure-03", value: "1013 hPa", time: "8 sec ago", status: "normal" },
                        { sensor: "Light-07", value: "450 lux", time: "12 sec ago", status: "normal" },
                      ].map((item, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${item.status === 'alert' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                            <span className="font-medium">{item.sensor}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{item.value}</div>
                            <div className="text-xs text-gray-500">{item.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Performance Metrics</h3>
                    <span className="text-sm text-gray-500">Last 24 hours</span>
                  </div>
                  <div className="card-body">
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">Data Collection Rate</span>
                          <span className="text-sm text-gray-600">98.7%</span>
                        </div>
                        <ProgressBar value={98.7} variant="success" size="sm" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">System Uptime</span>
                          <span className="text-sm text-gray-600">99.9%</span>
                        </div>
                        <ProgressBar value={99.9} variant="success" size="sm" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">Alert Response Time</span>
                          <span className="text-sm text-gray-600">85.3%</span>
                        </div>
                        <ProgressBar value={85.3} variant="warning" size="sm" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">Data Accuracy</span>
                          <span className="text-sm text-gray-600">96.1%</span>
                        </div>
                        <ProgressBar value={96.1} variant="success" size="sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
