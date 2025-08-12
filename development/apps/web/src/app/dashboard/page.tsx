'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { SensorCard } from '../../components/sensors/SensorCard';
import { LocationMap } from '../../components/maps/LocationMap';
import { AlertPanel } from '../../components/alerts/AlertPanel';
import { SensorAnalytics } from '../../components/analytics/SensorAnalytics';

interface Sensor {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'alert';
  last_reading: number;
  unit: string;
  location: string;
  department: string;
  last_seen: string;
  battery_level?: number;
}

interface Alert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  sensor_name: string;
  location_name: string;
  department_name: string;
  triggered_at: string;
  is_active: boolean;
  acknowledged: boolean;
}

interface Location {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  sensors_total: number;
  sensors_online: number;
  alerts_active: number;
}

interface SensorReading {
  id: string;
  value: number;
  unit: string;
  reading_time: string;
}

export default function DashboardPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [sensorReadings, setSensorReadings] = useState<SensorReading[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [sensorsRes, alertsRes, locationsRes] = await Promise.all([
          fetch('/api/sensors'),
          fetch('/api/alerts'),
          fetch('/api/locations'),
        ]);

        if (sensorsRes.ok) {
          const sensorsData = await sensorsRes.json();
          setSensors(sensorsData);
        }

        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setAlerts(alertsData);
        }

        if (locationsRes.ok) {
          const locationsData = await locationsRes.json();
          setLocations(locationsData);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Fetch sensor readings when a sensor is selected
  useEffect(() => {
    if (selectedSensor) {
      const fetchSensorReadings = async () => {
        try {
          const response = await fetch(`/api/sensor-readings/${selectedSensor}?range=${timeRange}`);
          if (response.ok) {
            const data = await response.json();
            setSensorReadings(data);
          }
        } catch (error) {
          console.error('Error fetching sensor readings:', error);
        }
      };

      fetchSensorReadings();
    }
  }, [selectedSensor, timeRange]);

  const handleSensorSelect = (sensorId: string) => {
    setSelectedSensor(sensorId);
  };

  const handleAlertAcknowledge = async (alertId: string) => {
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
  };

  const handleLocationClick = (locationId: string) => {
    // Filter sensors by location and show them
    const locationSensors = sensors.filter(s => s.location === locationId);
    console.log('Location sensors:', locationSensors);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading IoT Dashboard...</p>
        </div>
      </div>
    );
  }

  const selectedSensorData = selectedSensor ? sensors.find(s => s.id === selectedSensor) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Home
            </Link>
            <span className="text-gray-400">|</span>
            <Link href="/test" className="text-gray-600 hover:text-gray-800">
              Test Dashboard
            </Link>
          </div>
          <div className="text-sm text-gray-600">
            Full IoT Dashboard
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">IoT Sensor Dashboard</h1>
              <p className="text-gray-600">Real-time monitoring and analytics</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">
                  {sensors.filter(s => s.status === 'online').length} sensors online
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-gray-600">
                  {alerts.filter(a => a.is_active && !a.acknowledged).length} active alerts
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Sensors and Map */}
          <div className="lg:col-span-2 space-y-6">
            {/* Location Map */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Location Overview</h2>
              <LocationMap 
                locations={locations} 
                onLocationSelect={handleLocationClick}
              />
            </div>

            {/* Sensors Grid */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Sensors</h2>
                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">
                    All
                  </button>
                  <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-md">
                    Online
                  </button>
                  <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-md">
                    Issues
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sensors.map((sensor) => {
                  // Transform sensor data to match SensorCard interface
                  const sensorCardData = {
                    ...sensor,
                    lastReading: {
                      value: sensor.last_reading,
                      unit: sensor.unit,
                      timestamp: sensor.last_seen,
                    },
                  };
                  
                  return (
                    <div
                      key={sensor.id}
                      className={`cursor-pointer transition-all ${
                        selectedSensor === sensor.id 
                          ? 'ring-2 ring-blue-500 ring-opacity-50' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => handleSensorSelect(sensor.id)}
                    >
                      <SensorCard sensor={sensorCardData} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Alerts and Analytics */}
          <div className="space-y-6">
            {/* Alerts */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Alerts</h2>
              <AlertPanel 
                alerts={alerts} 
                onAlertAcknowledge={handleAlertAcknowledge}
              />
            </div>

            {/* Analytics */}
            {selectedSensorData && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Analytics: {selectedSensorData.name}
                </h2>
                <SensorAnalytics
                  sensorId={selectedSensorData.id}
                  sensorName={selectedSensorData.name}
                  sensorType={selectedSensorData.type}
                  readings={sensorReadings}
                  timeRange={timeRange}
                  onTimeRangeChange={setTimeRange}
                />
              </div>
            )}

            {!selectedSensorData && (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <div className="text-gray-400 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-gray-600">Select a sensor to view analytics</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
