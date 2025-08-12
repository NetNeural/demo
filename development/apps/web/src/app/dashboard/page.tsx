'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChartBarIcon } from '@heroicons/react/24/outline';
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
      <div className="page flex items-center justify-center">
        <div className="text-center">
          <div className="loading"></div>
          <p className="mt-4">Loading IoT Dashboard...</p>
        </div>
      </div>
    );
  }

  const selectedSensorData = selectedSensor ? sensors.find(s => s.id === selectedSensor) : null;

  return (
    <div className="page">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <div className="nav-links">
            <Link href="/" className="nav-link">← Home</Link>
            <Link href="/dashboard" className="nav-link active">Dashboard</Link>
            <Link href="/mvp" className="nav-link">MVP Demo</Link>
            <Link href="/overview" className="nav-link">Overview</Link>
          </div>
          <div className="text-small">Full IoT Dashboard</div>
        </div>
      </nav>

      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="header-title">IoT Sensor Dashboard</h1>
              <p className="header-subtitle">Real-time monitoring and analytics</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="badge badge-success">
                  {sensors.filter(s => s.status === 'online').length} sensors online
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-error">
                  {alerts.filter(a => a.is_active && !a.acknowledged).length} active alerts
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="section">
        <div className="container">
          <div className="grid grid-3 gap-6">
            {/* Left Column - Sensors and Map */}
            <div className="grid-span-2 flex flex-col gap-6">
              {/* Location Map */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Location Overview</h2>
                </div>
                <div className="card-body">
                  <LocationMap 
                    locations={locations} 
                    onLocationSelect={handleLocationClick}
                  />
                </div>
              </div>

              {/* Sensors Grid */}
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <h2 className="card-title">Sensors</h2>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-primary btn-sm">All</button>
                      <button className="btn btn-secondary btn-sm">Online</button>
                      <button className="btn btn-secondary btn-sm">Issues</button>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="grid grid-2 gap-4">
                    {sensors.map((sensor) => {
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
                          className={`cursor-pointer transition-all border rounded-lg p-4 ${
                            selectedSensor === sensor.id 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 hover:border-gray-300'
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
            </div>

            {/* Right Column - Alerts and Analytics */}
            <div className="flex flex-col gap-6">
              {/* Alerts */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Active Alerts</h2>
                </div>
                <div className="card-body">
                  <AlertPanel 
                    alerts={alerts} 
                    onAlertAcknowledge={handleAlertAcknowledge}
                  />
                </div>
              </div>

              {/* Analytics */}
              {selectedSensorData && (
                <div className="card">
                  <div className="card-header">
                    <h2 className="card-title">Analytics: {selectedSensorData.name}</h2>
                  </div>
                  <div className="card-body">
                    <SensorAnalytics
                      sensorId={selectedSensorData.id}
                      sensorName={selectedSensorData.name}
                      sensorType={selectedSensorData.type}
                      readings={sensorReadings}
                      timeRange={timeRange}
                      onTimeRangeChange={setTimeRange}
                    />
                  </div>
                </div>
              )}

              {!selectedSensorData && (
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
        </div>
      </div>
    </div>
  );
}
