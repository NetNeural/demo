'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { SimpleIcons } from '../icons/SimpleIcons';

interface DashboardStats {
  totalSensors: number;
  onlineSensors: number;
  offlineSensors: number;
  alertSensors: number;
  totalLocations: number;
  totalDepartments: number;
  dataPoints24h: number;
  systemUptime: number;
}

interface Sensor {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'alert';
  value: number;
  unit: string;
  location: string;
  department: string;
  lastSeen: string;
  batteryLevel?: number;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  sensorName: string;
  location: string;
  time: string;
  acknowledged: boolean;
}

interface Location {
  id: string;
  name: string;
  address: string;
  sensorsTotal: number;
  sensorsOnline: number;
  alertsActive: number;
  status: 'healthy' | 'warning' | 'critical';
}

export default function MVPDashboard() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats>({
    totalSensors: 0,
    onlineSensors: 0,
    offlineSensors: 0,
    alertSensors: 0,
    totalLocations: 0,
    totalDepartments: 0,
    dataPoints24h: 0,
    systemUptime: 99.8
  });
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedView, setSelectedView] = useState<'overview' | 'sensors' | 'locations' | 'alerts'>('overview');
  const [loading, setLoading] = useState(true);

  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Simulate API calls with realistic IoT data
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data generation
        const mockSensors: Sensor[] = [
          {
            id: '1',
            name: 'Temperature Sensor 01',
            type: 'temperature',
            status: 'online',
            value: 22.5,
            unit: '°C',
            location: 'Warehouse A',
            department: 'Storage',
            lastSeen: '2 min ago',
            batteryLevel: 85
          },
          {
            id: '2',
            name: 'Humidity Sensor 01',
            type: 'humidity',
            status: 'online',
            value: 65,
            unit: '%',
            location: 'Warehouse A',
            department: 'Storage',
            lastSeen: '1 min ago',
            batteryLevel: 92
          },
          {
            id: '3',
            name: 'Door Sensor 01',
            type: 'door',
            status: 'alert',
            value: 1,
            unit: 'open',
            location: 'Office Building',
            department: 'Security',
            lastSeen: '30 sec ago',
            batteryLevel: 78
          },
          {
            id: '4',
            name: 'Motion Detector 01',
            type: 'motion',
            status: 'online',
            value: 0,
            unit: 'detected',
            location: 'Office Building',
            department: 'Security',
            lastSeen: '5 min ago',
            batteryLevel: 88
          },
          {
            id: '5',
            name: 'Pressure Sensor 01',
            type: 'pressure',
            status: 'offline',
            value: 0,
            unit: 'PSI',
            location: 'Manufacturing Plant',
            department: 'Production',
            lastSeen: '2 hours ago',
            batteryLevel: 45
          },
          {
            id: '6',
            name: 'Temperature Sensor 02',
            type: 'temperature',
            status: 'alert',
            value: 35.2,
            unit: '°C',
            location: 'Manufacturing Plant',
            department: 'Production',
            lastSeen: '1 min ago',
            batteryLevel: 67
          }
        ];

        const mockAlerts: Alert[] = [
          {
            id: '1',
            type: 'critical',
            title: 'High Temperature Alert',
            message: 'Temperature sensor 02 reading 35.2°C exceeds threshold',
            sensorName: 'Temperature Sensor 02',
            location: 'Manufacturing Plant',
            time: '2 min ago',
            acknowledged: false
          },
          {
            id: '2',
            type: 'warning',
            title: 'Door Open Alert',
            message: 'Security door has been open for 10 minutes',
            sensorName: 'Door Sensor 01',
            location: 'Office Building',
            time: '10 min ago',
            acknowledged: false
          },
          {
            id: '3',
            type: 'critical',
            title: 'Sensor Offline',
            message: 'Pressure sensor has been offline for 2 hours',
            sensorName: 'Pressure Sensor 01',
            location: 'Manufacturing Plant',
            time: '2 hours ago',
            acknowledged: true
          }
        ];

        const mockLocations: Location[] = [
          {
            id: '1',
            name: 'Warehouse A',
            address: '123 Storage St, Industrial District',
            sensorsTotal: 8,
            sensorsOnline: 7,
            alertsActive: 0,
            status: 'healthy'
          },
          {
            id: '2',
            name: 'Office Building',
            address: '456 Business Ave, Downtown',
            sensorsTotal: 12,
            sensorsOnline: 11,
            alertsActive: 1,
            status: 'warning'
          },
          {
            id: '3',
            name: 'Manufacturing Plant',
            address: '789 Industry Blvd, Manufacturing Zone',
            sensorsTotal: 15,
            sensorsOnline: 12,
            alertsActive: 2,
            status: 'critical'
          }
        ];

        setSensors(mockSensors);
        setAlerts(mockAlerts);
        setLocations(mockLocations);

        // Calculate stats
        const onlineCount = mockSensors.filter(s => s.status === 'online').length;
        const offlineCount = mockSensors.filter(s => s.status === 'offline').length;
        const alertCount = mockSensors.filter(s => s.status === 'alert').length;
        
        setStats({
          totalSensors: mockSensors.length,
          onlineSensors: onlineCount,
          offlineSensors: offlineCount,
          alertSensors: alertCount,
          totalLocations: mockLocations.length,
          totalDepartments: 4,
          dataPoints24h: 2840,
          systemUptime: 99.8
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <SimpleIcons.CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'offline':
        return <SimpleIcons.ExclamationTriangleIcon className="w-5 h-5 text-gray-400" />;
      case 'alert':
        return <SimpleIcons.ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <SimpleIcons.ClockIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'offline':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'alert':
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading NetNeural MVP Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="nn-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center">
                  <SimpleIcons.CpuChipIcon className="nn-icon-md text-blue-600" />
                  <span className="ml-2 text-xl font-bold nn-text-gradient">NetNeural</span>
                  <span className="ml-1 text-sm text-gray-500 font-medium">MVP</span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <button
                  onClick={() => setSelectedView('overview')}
                  className={selectedView === 'overview' ? 'nn-nav-item-active' : 'nn-nav-item'}
                >
                  <SimpleIcons.HomeIcon className="w-4 h-4 inline mr-1" />
                  Overview
                </button>
                <button
                  onClick={() => setSelectedView('sensors')}
                  className={selectedView === 'sensors' ? 'nn-nav-item-active' : 'nn-nav-item'}
                >
                  <SimpleIcons.SignalIcon className="w-4 h-4 inline mr-1" />
                  Sensors
                </button>
                <button
                  onClick={() => setSelectedView('locations')}
                  className={selectedView === 'locations' ? 'nn-nav-item-active' : 'nn-nav-item'}
                >
                  <SimpleIcons.MapPinIcon className="w-4 h-4 inline mr-1" />
                  Locations
                </button>
                <button
                  onClick={() => setSelectedView('alerts')}
                  className={selectedView === 'alerts' ? 'nn-nav-item-active' : 'nn-nav-item'}
                >
                  <SimpleIcons.BellIcon className="w-4 h-4 inline mr-1" />
                  Alerts
                  {alerts.filter(a => !a.acknowledged).length > 0 && (
                    <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {alerts.filter(a => !a.acknowledged).length}
                    </span>
                  )}
                </button>
              </div>
            </nav>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Live</span>
              </div>
              <div className="text-sm font-mono text-gray-600">{currentTime}</div>
              <div className="flex items-center space-x-2">
                <SimpleIcons.Cog6ToothIcon className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-pointer" />
                <SimpleIcons.UserCircleIcon className="nn-icon-md text-gray-400 hover:text-gray-600 cursor-pointer" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overview Tab */}
        {selectedView === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="nn-grid-4">
              <div className="nn-metric-card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="nn-metric-value text-blue-600">{stats.totalSensors}</div>
                    <div className="nn-metric-label">Total Sensors</div>
                  </div>
                  <SimpleIcons.CpuChipIcon className="nn-icon-md text-blue-500" />
                </div>
                <div className="nn-metric-trend-up">
                  +{stats.onlineSensors} online
                </div>
              </div>

              <div className="nn-metric-card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="nn-metric-value text-green-600">{stats.onlineSensors}</div>
                    <div className="nn-metric-label">Online</div>
                  </div>
                  <SimpleIcons.CheckCircleIcon className="nn-icon-md text-green-500" />
                </div>
                <div className="nn-metric-trend-up">
                  {((stats.onlineSensors / stats.totalSensors) * 100).toFixed(1)}% uptime
                </div>
              </div>

              <div className="nn-metric-card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="nn-metric-value text-red-600">{stats.alertSensors}</div>
                    <div className="nn-metric-label">Alerts</div>
                  </div>
                  <SimpleIcons.ExclamationTriangleIcon className="nn-icon-md text-red-500" />
                </div>
                <div className="nn-metric-trend-down">
                  Needs attention
                </div>
              </div>

              <div className="nn-metric-card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="nn-metric-value text-purple-600">{stats.totalLocations}</div>
                    <div className="nn-metric-label">Locations</div>
                  </div>
                  <SimpleIcons.BuildingOfficeIcon className="nn-icon-md text-purple-500" />
                </div>
                <div className="nn-metric-trend-up">
                  {stats.totalDepartments} departments
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="nn-grid-2">
              <div className="nn-card">
                <div className="nn-card-header">
                  <h3 className="text-lg font-medium text-gray-900">Sensor Status Distribution</h3>
                </div>
                <div className="nn-card-body">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm text-gray-600">Online</span>
                      </div>
                      <span className="text-sm font-medium">{stats.onlineSensors}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        <span className="text-sm text-gray-600">Alert</span>
                      </div>
                      <span className="text-sm font-medium">{stats.alertSensors}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                        <span className="text-sm text-gray-600">Offline</span>
                      </div>
                      <span className="text-sm font-medium">{stats.offlineSensors}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="nn-card">
                <div className="nn-card-header">
                  <h3 className="text-lg font-medium text-gray-900">System Health</h3>
                </div>
                <div className="nn-card-body">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">System Uptime</span>
                        <span className="text-sm font-medium">{stats.systemUptime}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`bg-green-500 h-2 rounded-full`}
                          data-width={stats.systemUptime}
                        ></div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Data Points (24h): <span className="font-medium">{stats.dataPoints24h.toLocaleString()}</span></p>
                      <p>Last Update: <span className="font-medium">Live</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="nn-card">
              <div className="nn-card-header">
                <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
              </div>
              <div className="nn-card-body">
                <div className="space-y-3">
                  {alerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${
                        alert.type === 'critical' ? 'bg-red-500' : 
                        alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{alert.title}</p>
                        <p className="text-sm text-gray-500">{alert.location} • {alert.time}</p>
                      </div>
                      {!alert.acknowledged && (
                        <span className="nn-status-error">Active</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sensors Tab */}
        {selectedView === 'sensors' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Sensor Management</h2>
              <button className="nn-btn-primary nn-btn-md">
                Add Sensor
              </button>
            </div>
            
            <div className="nn-grid-3">
              {sensors.map((sensor) => (
                <div key={sensor.id} className="nn-card hover:shadow-md transition-shadow">
                  <div className="nn-card-body">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(sensor.status)}
                        <h3 className="text-lg font-medium text-gray-900">{sensor.name}</h3>
                      </div>
                      <span className={`nn-status px-2 py-1 border ${getStatusColor(sensor.status)}`}>
                        {sensor.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      <p><span className="font-medium">Type:</span> {sensor.type}</p>
                      <p><span className="font-medium">Location:</span> {sensor.location}</p>
                      <p><span className="font-medium">Department:</span> {sensor.department}</p>
                      <p><span className="font-medium">Last Reading:</span> {sensor.value} {sensor.unit}</p>
                      <p><span className="font-medium">Last Seen:</span> {sensor.lastSeen}</p>
                      {sensor.batteryLevel && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Battery:</span>
                            <span>{sensor.batteryLevel}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                            <div 
                              className={`h-1 rounded-full ${
                                sensor.batteryLevel > 50 ? 'bg-green-500' : 
                                sensor.batteryLevel > 20 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              data-width={sensor.batteryLevel}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locations Tab */}
        {selectedView === 'locations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Location Overview</h2>
              <button className="nn-btn-primary nn-btn-md">
                Add Location
              </button>
            </div>
            
            <div className="nn-grid-1">
              {locations.map((location) => (
                <div key={location.id} className="nn-card">
                  <div className="nn-card-body">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-medium text-gray-900 mb-1">{location.name}</h3>
                        <p className="text-gray-600 mb-3">{location.address}</p>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{location.sensorsTotal}</div>
                            <div className="text-sm text-gray-500">Total Sensors</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{location.sensorsOnline}</div>
                            <div className="text-sm text-gray-500">Online</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{location.alertsActive}</div>
                            <div className="text-sm text-gray-500">Active Alerts</div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`nn-status px-3 py-1 border ${getStatusColor(location.status)}`}>
                          {location.status}
                        </span>
                        <div className="mt-4">
                          <button className="nn-btn-ghost nn-btn-sm mr-2">View Details</button>
                          <button className="nn-btn-secondary nn-btn-sm">Configure</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {selectedView === 'alerts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Alert Management</h2>
              <div className="flex space-x-2">
                <button className="nn-btn-secondary nn-btn-md">Mark All Read</button>
                <button className="nn-btn-primary nn-btn-md">Configure Alerts</button>
              </div>
            </div>
            
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className={`nn-card ${!alert.acknowledged ? 'ring-2 ring-red-200' : ''}`}>
                  <div className="nn-card-body">
                    <div className="flex items-start space-x-4">
                      <div className={`w-3 h-3 rounded-full mt-2 ${
                        alert.type === 'critical' ? 'bg-red-500' : 
                        alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-gray-900">{alert.title}</h3>
                          <div className="flex items-center space-x-2">
                            <span className={`nn-status px-2 py-1 border ${
                              alert.type === 'critical' ? 'text-red-600 bg-red-50 border-red-200' :
                              alert.type === 'warning' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                              'text-blue-600 bg-blue-50 border-blue-200'
                            }`}>
                              {alert.type}
                            </span>
                            <span className="text-sm text-gray-500">{alert.time}</span>
                          </div>
                        </div>
                        <p className="text-gray-600 mt-1">{alert.message}</p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="text-sm text-gray-500">
                            <span className="font-medium">{alert.sensorName}</span> • {alert.location}
                          </div>
                          <div className="flex space-x-2">
                            {!alert.acknowledged && (
                              <button className="nn-btn-primary nn-btn-sm">
                                Acknowledge
                              </button>
                            )}
                            <button className="nn-btn-ghost nn-btn-sm">
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
