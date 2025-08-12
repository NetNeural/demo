'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { SimpleIcons } from '../icons/SimpleIcons';
import { MetricCard } from './MetricCard';
import { StatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';

// Mock data interfaces
interface Sensor {
  id: string;
  name: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'motion' | 'light';
  value: number;
  unit: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  location: string;
  lastUpdate: Date;
  batteryLevel?: number;
}

interface Location {
  id: string;
  name: string;
  sensorCount: number;
  onlineSensors: number;
  alertCount: number;
  coordinates: { lat: number; lng: number };
}

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: Date;
  location: string;
  sensor?: string;
  resolved: boolean;
}

// Mock data generators
const generateSensorData = (): Sensor[] => [
  {
    id: '1',
    name: 'Temperature Sensor A1',
    type: 'temperature',
    value: 22.5 + Math.random() * 5,
    unit: '°C',
    status: Math.random() > 0.9 ? 'warning' : 'online',
    location: 'Building A - Floor 1',
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
    lastUpdate: new Date(Date.now() - Math.random() * 300000),
    batteryLevel: 92
  },
  {
    id: '3',
    name: 'Motion Detector C1',
    type: 'motion',
    value: Math.random() > 0.7 ? 1 : 0,
    unit: '',
    status: 'online',
    location: 'Building C - Entrance',
    lastUpdate: new Date(Date.now() - Math.random() * 300000),
    batteryLevel: 78
  },
  {
    id: '4',
    name: 'Pressure Gauge A3',
    type: 'pressure',
    value: 1013 + Math.random() * 20 - 10,
    unit: 'hPa',
    status: Math.random() > 0.95 ? 'offline' : 'online',
    location: 'Building A - Floor 3',
    lastUpdate: new Date(Date.now() - Math.random() * 300000),
    batteryLevel: 88
  },
  {
    id: '5',
    name: 'Light Sensor D1',
    type: 'light',
    value: 300 + Math.random() * 700,
    unit: 'lux',
    status: 'online',
    location: 'Building D - Laboratory',
    lastUpdate: new Date(Date.now() - Math.random() * 300000),
    batteryLevel: 95
  }
];

const generateLocationData = (): Location[] => [
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

const generateAlertData = (): Alert[] => [
  {
    id: '1',
    title: 'High Temperature Alert',
    description: 'Temperature sensor A1 reading exceeds normal range',
    severity: 'high',
    timestamp: new Date(Date.now() - 1800000),
    location: 'Building A - Floor 1',
    sensor: 'Temperature Sensor A1',
    resolved: false
  },
  {
    id: '2',
    title: 'Motion Detected After Hours',
    description: 'Unexpected motion detected in restricted area',
    severity: 'medium',
    timestamp: new Date(Date.now() - 3600000),
    location: 'Building C - Entrance',
    sensor: 'Motion Detector C1',
    resolved: false
  },
  {
    id: '3',
    title: 'Low Battery Warning',
    description: 'Pressure gauge battery level below 20%',
    severity: 'low',
    timestamp: new Date(Date.now() - 7200000),
    location: 'Building A - Floor 3',
    sensor: 'Pressure Gauge A3',
    resolved: true
  }
];

export default function MVPDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [locations] = useState<Location[]>(generateLocationData());
  const [alerts, setAlerts] = useState<Alert[]>(generateAlertData());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Simulate real-time data updates
  useEffect(() => {
    const updateData = () => {
      setSensors(generateSensorData());
      setLastUpdate(new Date());
    };

    updateData();
    const interval = setInterval(updateData, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const onlineSensors = sensors.filter(s => s.status === 'online').length;
  const totalSensors = sensors.length;
  const activeAlerts = alerts.filter(a => !a.resolved).length;
  const systemHealth = Math.round((onlineSensors / totalSensors) * 100);

  const getTabClass = (tabName: string) =>
    activeTab === tabName ? 'tab tab-active' : 'tab';

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

  const formatValue = (sensor: Sensor) => {
    if (sensor.type === 'motion') {
      return sensor.value === 1 ? 'Motion Detected' : 'No Motion';
    }
    return `${sensor.value.toFixed(1)} ${sensor.unit}`;
  };

  const renderOverview = () => (
    <div className="space-y-6 nn-fade-in-up">
      {/* Key Metrics */}
      <div className="nn-grid-cols-4">
        <MetricCard
          title="Total Sensors"
          value={totalSensors}
          change="+2 this week"
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
      <div className="nn-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">System Health Overview</h3>
          <StatusBadge 
            status={systemHealth > 90 ? "online" : systemHealth > 70 ? "warning" : "error"} 
          />
        </div>
        <ProgressBar
          value={systemHealth}
          label="Overall System Health"
          variant={systemHealth > 90 ? "success" : systemHealth > 70 ? "warning" : "error"}
          size="lg"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="nn-card">
          <div className="nn-card-header">
            <h3 className="text-lg font-semibold text-gray-900">Recent Sensor Data</h3>
          </div>
          <div className="nn-card-body">
            <div className="space-y-4">
              {sensors.slice(0, 3).map((sensor) => (
                <div key={sensor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getSensorIcon(sensor.type)}
                    <div>
                      <p className="font-medium text-gray-900">{sensor.name}</p>
                      <p className="text-sm text-gray-500">{sensor.location}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatValue(sensor)}</p>
                    <StatusBadge status={sensor.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="nn-card">
          <div className="nn-card-header">
            <h3 className="text-lg font-semibold text-gray-900">Active Alerts</h3>
          </div>
          <div className="nn-card-body">
            <div className="space-y-4">
              {alerts.filter(a => !a.resolved).slice(0, 3).map((alert) => (
                <div key={alert.id} className={`nn-alert-${alert.severity}`}>
                  <div className="flex items-start">
                    <SimpleIcons.ExclamationTriangleIcon className="nn-icon-sm mt-0.5 flex-shrink-0" />
                    <div className="ml-3 flex-1">
                      <h4 className="font-medium">{alert.title}</h4>
                      <p className="text-sm mt-1">{alert.description}</p>
                      <p className="text-xs mt-2 opacity-75">
                        {alert.location} • {alert.timestamp.toLocaleTimeString()}
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
  );

  const renderSensors = () => (
    <div className="space-y-6 nn-fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Sensor Management</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <SimpleIcons.ClockIcon className="nn-icon-xs" />
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="nn-grid-cols-1">
        {sensors.map((sensor) => (
          <div key={sensor.id} className="nn-card p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  {getSensorIcon(sensor.type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{sensor.name}</h3>
                  <p className="text-sm text-gray-500 mb-2">{sensor.location}</p>
                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="text-2xl font-bold text-gray-900">{formatValue(sensor)}</span>
                    </div>
                    <StatusBadge status={sensor.status} />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-2">Battery Level</p>
                {sensor.batteryLevel && (
                  <ProgressBar
                    value={sensor.batteryLevel}
                    variant={sensor.batteryLevel > 50 ? "success" : sensor.batteryLevel > 20 ? "warning" : "error"}
                    showPercentage={true}
                    size="sm"
                  />
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Updated {Math.floor((Date.now() - sensor.lastUpdate.getTime()) / 60000)}m ago
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderLocations = () => (
    <div className="space-y-6 nn-fade-in-up">
      <h2 className="text-xl font-semibold text-gray-900">Location Overview</h2>
      
      <div className="nn-grid-cols-3">
        {locations.map((location) => (
          <MetricCard
            key={location.id}
            title={location.name}
            value={`${location.onlineSensors}/${location.sensorCount}`}
            change={location.alertCount > 0 ? `${location.alertCount} alerts` : "All systems normal"}
            trend={location.alertCount > 0 ? "down" : "neutral"}
            status={location.alertCount > 0 ? "warning" : "success"}
            icon={<SimpleIcons.MapPinIcon />}
          />
        ))}
      </div>

      <div className="nn-card">
        <div className="nn-card-header">
          <h3 className="text-lg font-semibold text-gray-900">Location Details</h3>
        </div>
        <div className="nn-card-body">
          <div className="overflow-x-auto">
            <table className="nn-table">
              <thead className="nn-table-header">
                <tr>
                  <th className="nn-table-header-cell">Location</th>
                  <th className="nn-table-header-cell">Total Sensors</th>
                  <th className="nn-table-header-cell">Online</th>
                  <th className="nn-table-header-cell">Health</th>
                  <th className="nn-table-header-cell">Alerts</th>
                  <th className="nn-table-header-cell">Status</th>
                </tr>
              </thead>
              <tbody className="nn-table-body">
                {locations.map((location) => {
                  const health = Math.round((location.onlineSensors / location.sensorCount) * 100);
                  return (
                    <tr key={location.id} className="nn-table-row">
                      <td className="nn-table-cell font-medium">{location.name}</td>
                      <td className="nn-table-cell">{location.sensorCount}</td>
                      <td className="nn-table-cell">{location.onlineSensors}</td>
                      <td className="nn-table-cell">
                        <ProgressBar
                          value={health}
                          variant={health > 90 ? "success" : health > 70 ? "warning" : "error"}
                          showPercentage={false}
                          size="sm"
                        />
                      </td>
                      <td className="nn-table-cell">{location.alertCount}</td>
                      <td className="nn-table-cell">
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
  );

  const renderAlerts = () => (
    <div className="space-y-6 nn-fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Alert Management</h2>
        <div className="flex space-x-2">
          <button className="nn-btn-outline nn-btn-sm">Mark All Read</button>
          <button className="nn-btn-primary nn-btn-sm">Configure Alerts</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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
          value={alerts.filter(a => a.resolved).length}
          status="success"
          icon={<SimpleIcons.ExclamationTriangleIcon />}
        />
      </div>

      <div className="space-y-4">
        <div className="flex space-x-4 mb-4">
          <button className="nn-btn-outline nn-btn-sm">All</button>
          <button className="nn-btn-outline nn-btn-sm">High Priority</button>
          <button className="nn-btn-outline nn-btn-sm">Medium Priority</button>
          <button className="nn-btn-outline nn-btn-sm">Low Priority</button>
        </div>

        {alerts.map((alert) => (
          <div key={alert.id} className={`nn-alert-${alert.severity} ${alert.resolved ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <SimpleIcons.ExclamationTriangleIcon className="nn-icon-sm mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-medium">{alert.title}</h4>
                    <span className={`nn-status nn-status-${alert.severity === 'high' ? 'error' : alert.severity === 'medium' ? 'warning' : 'info'}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    {alert.resolved && (
                      <span className="nn-status-success">RESOLVED</span>
                    )}
                  </div>
                  <p className="text-sm mb-2">{alert.description}</p>
                  <div className="flex items-center space-x-4 text-xs opacity-75">
                    <span>📍 {alert.location}</span>
                    {alert.sensor && <span>🔧 {alert.sensor}</span>}
                    <span>🕒 {alert.timestamp.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                {!alert.resolved && (
                  <>
                    <button 
                      className="nn-btn-outline nn-btn-sm"
                      onClick={() => {
                        setAlerts(alerts.map(a => 
                          a.id === alert.id ? { ...a, resolved: true } : a
                        ));
                      }}
                    >
                      Resolve
                    </button>
                    <button className="nn-btn-primary nn-btn-sm">Details</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <div className="nav-links">
            <Link href="/" className="nav-link">← Home</Link>
            <Link href="/dashboard" className="nav-link">Dashboard</Link>
            <Link href="/mvp" className="nav-link active">MVP Demo</Link>
            <Link href="/overview" className="nav-link">Overview</Link>
          </div>
          <div className="text-small">MVP IoT Dashboard</div>
        </div>
      </nav>

      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="header-title">NetNeural IoT Dashboard</h1>
              <p className="header-subtitle">Real-time monitoring and management of your IoT infrastructure</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </div>
              <StatusBadge 
                status={systemHealth > 90 ? "online" : "warning"} 
                showLabel={false}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="section bg-light">
        <div className="container">
          <div className="tabs">
            <button 
              className={getTabClass('overview')}
              onClick={() => setActiveTab('overview')}
            >
              <SimpleIcons.ChartBarIcon className="icon icon-sm mr-2" />
              Overview
            </button>
            <button 
              className={getTabClass('sensors')}
              onClick={() => setActiveTab('sensors')}
            >
              <SimpleIcons.CpuChipIcon className="icon icon-sm mr-2" />
              Sensors ({totalSensors})
            </button>
            <button 
              className={getTabClass('locations')}
              onClick={() => setActiveTab('locations')}
            >
              <SimpleIcons.MapPinIcon className="icon icon-sm mr-2" />
              Locations ({locations.length})
            </button>
            <button 
              className={getTabClass('alerts')}
              onClick={() => setActiveTab('alerts')}
            >
              <SimpleIcons.ExclamationTriangleIcon className="icon icon-sm mr-2" />
              Alerts ({activeAlerts})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="section">
        <div className="container">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'sensors' && renderSensors()}
          {activeTab === 'locations' && renderLocations()}
          {activeTab === 'alerts' && renderAlerts()}
        </div>
      </div>
    </div>
  );
}
