'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSupabase } from '../../providers/SupabaseProvider'

interface DashboardData {
  organizations: any[]
  locations: any[]
  sensors: any[]
  alerts: any[]
  recentReadings: any[]
}

export function IoTDashboard() {
  const { user, loading } = useAuth()
  const { supabase } = useSupabase()
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    organizations: [],
    locations: [],
    sensors: [],
    alerts: [],
    recentReadings: []
  })
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'overview' | 'map' | 'sensors' | 'alerts'>('overview')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      // This will be replaced with actual Supabase queries
      // For now, we'll use mock data that matches our schema
      
      const mockData: DashboardData = {
        organizations: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'RetailChain Corp',
            slug: 'retailchain-corp',
            subsidiaries: [
              { id: '1', name: 'SuperMart', locations_count: 2 },
              { id: '2', name: 'ValueStore', locations_count: 1 }
            ]
          }
        ],
        locations: [
          {
            id: '770e8400-e29b-41d4-a716-446655440001',
            name: 'SuperMart Downtown',
            city: 'Portland',
            state: 'OR',
            sensors_online: 6,
            sensors_total: 7,
            alerts_active: 1
          },
          {
            id: '770e8400-e29b-41d4-a716-446655440002',
            name: 'SuperMart Westside',
            city: 'Portland',
            state: 'OR',
            sensors_online: 1,
            sensors_total: 1,
            alerts_active: 0
          }
        ],
        sensors: [
          {
            id: 'aa0e8400-e29b-41d4-a716-446655440001',
            name: 'Pharmacy-Temp-01',
            type: 'temperature',
            status: 'online',
            department: 'Pharmacy',
            last_reading: 22.3,
            unit: 'celsius',
            battery_level: 85
          },
          {
            id: 'aa0e8400-e29b-41d4-a716-446655440004',
            name: 'Produce-Temp-01',
            type: 'temperature',
            status: 'online',
            department: 'Produce',
            last_reading: 9.2,
            unit: 'celsius',
            battery_level: 88,
            alert_level: 'red'
          }
        ],
        alerts: [
          {
            id: 'cc0e8400-e29b-41d4-a716-446655440001',
            title: 'Produce Temperature Alert',
            message: 'Temperature reading of 9.2°C exceeds safe range (2-8°C)',
            level: 'red',
            sensor_name: 'Produce-Temp-01',
            location: 'SuperMart Downtown',
            department: 'Produce',
            triggered_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
            is_active: true
          }
        ],
        recentReadings: []
      }
      
      setDashboardData(mockData)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const getStatusColor = (status: string, alertLevel?: string) => {
    if (alertLevel) {
      switch (alertLevel) {
        case 'red': return 'text-red-600 bg-red-100'
        case 'yellow': return 'text-yellow-600 bg-yellow-100'
        case 'critical': return 'text-red-800 bg-red-200'
        default: return 'text-green-600 bg-green-100'
      }
    }
    
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100'
      case 'offline': return 'text-gray-600 bg-gray-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-gray-900">IoT Sensor Management</h1>
              <div className="flex space-x-2">
                <button
                  onClick={() => setViewMode('overview')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    viewMode === 'overview' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    viewMode === 'map' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Map View
                </button>
                <button
                  onClick={() => setViewMode('sensors')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    viewMode === 'sensors' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Sensors
                </button>
                <button
                  onClick={() => setViewMode('alerts')}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    viewMode === 'alerts' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Alerts
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.email}</span>
              <button
                onClick={handleSignOut}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Overview Dashboard */}
          {viewMode === 'overview' && (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Locations */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="nn-icon-container-sm bg-blue-500">
                          <span className="text-white font-bold">L</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Locations</dt>
                          <dd className="text-lg font-medium text-gray-900">{dashboardData.locations.length}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Online Sensors */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="nn-icon-container-sm bg-green-500">
                          <span className="text-white font-bold">S</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Online Sensors</dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {dashboardData.sensors.filter(s => s.status === 'online').length}/
                            {dashboardData.sensors.length}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Alerts */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="nn-icon-container-sm bg-red-500">
                          <span className="text-white font-bold">!</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Active Alerts</dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {dashboardData.alerts.filter(a => a.is_active).length}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Organizations */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="nn-icon-container-sm bg-purple-500">
                          <span className="text-white font-bold">O</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Organizations</dt>
                          <dd className="text-lg font-medium text-gray-900">{dashboardData.organizations.length}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Alerts */}
              {dashboardData.alerts.length > 0 && (
                <div className="mb-8">
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                        Recent Alerts
                      </h3>
                      <div className="space-y-3">
                        {dashboardData.alerts.slice(0, 5).map((alert) => (
                          <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor('', alert.level)}`}>
                                {alert.level.toUpperCase()}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                                <p className="text-sm text-gray-500">{alert.location} - {alert.department}</p>
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(alert.triggered_at).toLocaleTimeString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Locations Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashboardData.locations.map((location) => (
                  <div key={location.id} className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900">{location.name}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          location.alerts_active > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {location.alerts_active > 0 ? `${location.alerts_active} Alert${location.alerts_active > 1 ? 's' : ''}` : 'All Good'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{location.city}, {location.state}</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Sensors Online:</span>
                          <span className="font-medium">{location.sensors_online}/{location.sensors_total}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`bg-green-600 h-2 rounded-full`}
                            style={{ width: `${(location.sensors_online / location.sensors_total) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <button 
                          onClick={() => {
                            setSelectedLocation(location.id)
                            setViewMode('map')
                          }}
                          className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                        >
                          View Details →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Map View */}
          {viewMode === 'map' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Location Map View</h3>
              <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-500 mb-2">Interactive Map Coming Soon</p>
                  <p className="text-sm text-gray-400">
                    Will show sensor locations with color-coded status indicators
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sensors View */}
          {viewMode === 'sensors' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sensor Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardData.sensors.map((sensor) => (
                  <div key={sensor.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{sensor.name}</h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sensor.status, sensor.alert_level)}`}>
                        {sensor.alert_level || sensor.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{sensor.department}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Last Reading:</span>
                        <span className="font-medium">{sensor.last_reading}°{sensor.unit === 'celsius' ? 'C' : 'F'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Battery:</span>
                        <span className="font-medium">{sensor.battery_level}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <span className="font-medium capitalize">{sensor.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerts View */}
          {viewMode === 'alerts' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Alert Management</h3>
              <div className="space-y-4">
                {dashboardData.alerts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No active alerts</p>
                  </div>
                ) : (
                  dashboardData.alerts.map((alert) => (
                    <div key={alert.id} className="border-l-4 border-red-400 bg-red-50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex">
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">{alert.title}</h3>
                            <div className="mt-2 text-sm text-red-700">
                              <p>{alert.message}</p>
                              <p className="mt-1 text-xs">
                                {alert.location} - {alert.department} - {alert.sensor_name}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                            Acknowledge
                          </button>
                          <button className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700">
                            Details
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
