'use client';

import React, { useState, useEffect } from 'react';
import { Line, Doughnut, Bar, Radar, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
  RadialLinearScale,
} from 'chart.js';
import styles from './SensorTypeAnalytics.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
  RadialLinearScale
);

interface SensorReading {
  id: string;
  value: number;
  unit: string;
  reading_time: string;
  metadata?: Record<string, any>;
}

interface SensorTypeAnalyticsProps {
  sensorId: string;
  sensorName: string;
  sensorType: string;
  readings: SensorReading[];
  timeRange: '1h' | '24h' | '7d' | '30d';
  onTimeRangeChange: (range: '1h' | '24h' | '7d' | '30d') => void;
  location?: string;
  department?: string;
}

// Temperature Sensor Analytics
const TemperatureAnalytics: React.FC<SensorTypeAnalyticsProps> = ({ 
  sensorName, readings, timeRange, onTimeRangeChange 
}) => {
  const values = readings.map(r => r.value);
  const times = readings.map(r => new Date(r.reading_time).toLocaleTimeString());
  
  const stats = {
    current: values[values.length - 1] || 0,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
    trend: values.length >= 2 ? (values[values.length - 1] - values[values.length - 2]) : 0,
  };

  // Temperature comfort zones
  const getComfortLevel = (temp: number): { level: string; cssClass: string; badgeClass: string; description: string } => {
    if (temp < 18) return { 
      level: 'Too Cold', 
      cssClass: styles['temperature-status-cool'], 
      badgeClass: styles['temperature-badge-cool'],
      description: 'Below comfortable range' 
    };
    if (temp < 22) return { 
      level: 'Cool', 
      cssClass: styles['temperature-status-cool'], 
      badgeClass: styles['temperature-badge-cool'],
      description: 'Slightly below optimal' 
    };
    if (temp < 26) return { 
      level: 'Optimal', 
      cssClass: styles['temperature-status-optimal'], 
      badgeClass: styles['temperature-badge-optimal'],
      description: 'Ideal temperature range' 
    };
    if (temp < 30) return { 
      level: 'Warm', 
      cssClass: styles['temperature-status-warm'], 
      badgeClass: styles['temperature-badge-warm'],
      description: 'Slightly above optimal' 
    };
    return { 
      level: 'Too Hot', 
      cssClass: styles['temperature-status-hot'], 
      badgeClass: styles['temperature-badge-hot'],
      description: 'Above comfortable range' 
    };
  };

  const comfort = getComfortLevel(stats.current);

  // Temperature distribution chart
  const temperatureDistribution = {
    labels: ['Too Cold (<18°C)', 'Cool (18-22°C)', 'Optimal (22-26°C)', 'Warm (26-30°C)', 'Too Hot (>30°C)'],
    datasets: [{
      data: [
        values.filter(v => v < 18).length,
        values.filter(v => v >= 18 && v < 22).length,
        values.filter(v => v >= 22 && v < 26).length,
        values.filter(v => v >= 26 && v < 30).length,
        values.filter(v => v >= 30).length,
      ],
      backgroundColor: ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
      borderWidth: 2,
      borderColor: '#ffffff',
    }]
  };

  // Temperature trend chart
  const trendData = {
    labels: times.slice(-24),
    datasets: [{
      label: 'Temperature',
      data: values.slice(-24),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 6,
    }, {
      label: 'Optimal Range',
      data: new Array(Math.min(24, values.length)).fill(24), // Optimal temp line
      borderColor: '#10b981',
      borderDash: [5, 5],
      fill: false,
      pointRadius: 0,
    }]
  };

  return (
    <div className="space-y-6">
      {/* Temperature Status Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`bg-white rounded-lg p-4 border-2 ${comfort.cssClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Temperature</p>
              <p className="text-2xl font-bold">{stats.current.toFixed(1)}°C</p>
            </div>
            <div className="text-3xl">🌡️</div>
          </div>
          <div className="mt-2">
            <span className={`px-2 py-1 rounded text-xs font-medium text-white ${comfort.badgeClass}`}>
              {comfort.level}
            </span>
            <p className="text-xs text-gray-500 mt-1">{comfort.description}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">24h Average</p>
              <p className="text-2xl font-bold text-blue-600">{stats.average.toFixed(1)}°C</p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Daily Range</p>
              <p className="text-lg font-bold text-orange-600">{(stats.max - stats.min).toFixed(1)}°C</p>
              <p className="text-xs text-gray-500">{stats.min.toFixed(1)}° - {stats.max.toFixed(1)}°</p>
            </div>
            <div className="text-3xl">📈</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Trend</p>
              <p className={`text-2xl font-bold ${stats.trend > 0 ? 'text-red-500' : stats.trend < 0 ? 'text-blue-500' : 'text-gray-500'}`}>
                {stats.trend > 0 ? '↗️' : stats.trend < 0 ? '↘️' : '➡️'}
              </p>
              <p className="text-xs text-gray-500">{Math.abs(stats.trend).toFixed(1)}° change</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Temperature Trend Chart */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            📈 Temperature Trend ({timeRange})
          </h3>
          <Line 
            data={trendData} 
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'top' as const },
                tooltip: {
                  callbacks: {
                    label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(1)}°C`
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: false,
                  title: { display: true, text: 'Temperature (°C)' }
                }
              }
            }} 
          />
        </div>

        {/* Comfort Zone Distribution */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            🎯 Comfort Zone Distribution
          </h3>
          <Doughnut 
            data={temperatureDistribution}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'bottom' as const },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                      const percentage = ((context.parsed / total) * 100).toFixed(1);
                      return `${context.label}: ${context.parsed} readings (${percentage}%)`;
                    }
                  }
                }
              }
            }}
          />
        </div>
      </div>

      {/* Temperature Insights */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          💡 Temperature Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800">Energy Efficiency</h4>
            <p className="text-sm text-blue-600 mt-1">
              {stats.average > 24 ? 'Consider reducing HVAC to save energy' : 
               stats.average < 20 ? 'Temperature may be too low, consider increasing' :
               'Temperature is well-optimized for energy efficiency'}
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-800">Comfort Level</h4>
            <p className="text-sm text-green-600 mt-1">
              {getComfortLevel(stats.current).description}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <h4 className="font-medium text-purple-800">Stability</h4>
            <p className="text-sm text-purple-600 mt-1">
              {(stats.max - stats.min) < 3 ? 'Very stable temperature' :
               (stats.max - stats.min) < 6 ? 'Moderately stable' :
               'High temperature variation detected'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Motion Sensor Analytics
const MotionAnalytics: React.FC<SensorTypeAnalyticsProps> = ({ 
  sensorName, readings, timeRange, onTimeRangeChange, location 
}) => {
  // Motion sensors typically have binary values (0 = no motion, 1 = motion detected)
  const motionEvents = readings.filter(r => r.value > 0);
  const totalReadings = readings.length;
  const motionPercentage = totalReadings > 0 ? (motionEvents.length / totalReadings) * 100 : 0;

  // Activity pattern analysis
  const hourlyActivity = new Array(24).fill(0);
  motionEvents.forEach(event => {
    const hour = new Date(event.reading_time).getHours();
    hourlyActivity[hour]++;
  });

  // Recent activity timeline
  const recentActivity = readings.slice(-20).map(reading => ({
    time: new Date(reading.reading_time),
    motion: reading.value > 0,
    timestamp: reading.reading_time
  }));

  const activityData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [{
      label: 'Motion Events',
      data: hourlyActivity,
      backgroundColor: 'rgba(34, 197, 94, 0.8)',
      borderColor: '#22c55e',
      borderWidth: 1,
    }]
  };

  // Calculate activity insights
  const peakHour = hourlyActivity.indexOf(Math.max(...hourlyActivity));
  const quietHour = hourlyActivity.indexOf(Math.min(...hourlyActivity));
  const avgEventsPerHour = motionEvents.length / Math.max(1, new Set(motionEvents.map(e => 
    new Date(e.reading_time).getHours()
  )).size);

  return (
    <div className="space-y-6">
      {/* Motion Status Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border-2 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Status</p>
              <p className="text-xl font-bold">
                {readings[readings.length - 1]?.value > 0 ? 'Motion Detected' : 'No Motion'}
              </p>
            </div>
            <div className="text-3xl">
              {readings[readings.length - 1]?.value > 0 ? '🏃' : '😴'}
            </div>
          </div>
          <div className="mt-2">
            <span className={`px-2 py-1 rounded text-xs font-medium text-white ${
              readings[readings.length - 1]?.value > 0 ? 'bg-green-500' : 'bg-gray-500'
            }`}>
              {readings[readings.length - 1]?.value > 0 ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Activity Rate</p>
              <p className="text-2xl font-bold text-blue-600">{motionPercentage.toFixed(1)}%</p>
              <p className="text-xs text-gray-500">{motionEvents.length} of {totalReadings} readings</p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Peak Activity</p>
              <p className="text-xl font-bold text-orange-600">{peakHour}:00</p>
              <p className="text-xs text-gray-500">{hourlyActivity[peakHour]} events</p>
            </div>
            <div className="text-3xl">⏰</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Events/Hour</p>
              <p className="text-2xl font-bold text-purple-600">{avgEventsPerHour.toFixed(1)}</p>
            </div>
            <div className="text-3xl">🔄</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Activity Pattern */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            📈 Hourly Activity Pattern
          </h3>
          <Bar 
            data={activityData}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => `${context.parsed.y} motion events at ${context.label}`
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: 'Motion Events' }
                },
                x: {
                  title: { display: true, text: 'Hour of Day' }
                }
              }
            }}
          />
        </div>

        {/* Recent Activity Timeline */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            ⏱️ Recent Activity Timeline
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentActivity.reverse().map((activity, index) => (
              <div 
                key={index} 
                className={`flex items-center justify-between p-2 rounded ${
                  activity.motion ? 'bg-green-50 border-l-4 border-green-500' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">
                    {activity.motion ? '🏃' : '😴'}
                  </span>
                  <span className="font-medium">
                    {activity.motion ? 'Motion Detected' : 'No Motion'}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {activity.time.toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Motion Insights */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          💡 Motion Insights & Occupancy Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-800">Space Utilization</h4>
            <p className="text-sm text-green-600 mt-1">
              {motionPercentage > 70 ? 'High activity area - frequently used space' :
               motionPercentage > 30 ? 'Moderate activity - regular usage patterns' :
               'Low activity area - consider space optimization'}
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800">Usage Pattern</h4>
            <p className="text-sm text-blue-600 mt-1">
              Peak usage at {peakHour}:00 with {hourlyActivity[peakHour]} events.
              {peakHour >= 9 && peakHour <= 17 ? ' Business hours activity.' : ' Off-hours activity detected.'}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <h4 className="font-medium text-purple-800">Security Status</h4>
            <p className="text-sm text-purple-600 mt-1">
              {readings[readings.length - 1]?.value > 0 ? 
                'Area is currently occupied' : 
                'Area appears vacant - ideal for security monitoring'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Humidity Sensor Analytics
const HumidityAnalytics: React.FC<SensorTypeAnalyticsProps> = ({ 
  sensorName, readings, timeRange, onTimeRangeChange 
}) => {
  const values = readings.map(r => r.value);
  const times = readings.map(r => new Date(r.reading_time).toLocaleTimeString());
  
  const stats = {
    current: values[values.length - 1] || 0,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
    trend: values.length >= 2 ? (values[values.length - 1] - values[values.length - 2]) : 0,
  };

  // Humidity comfort zones
  const getHumidityLevel = (humidity: number): { level: string; cssClass: string; badgeClass: string; description: string; risk: string } => {
    if (humidity < 30) return { 
      level: 'Too Dry', 
      cssClass: styles['humidity-status-dry'], 
      badgeClass: styles['humidity-badge-dry'],
      description: 'Below optimal range',
      risk: 'Static electricity, dry skin, respiratory irritation'
    };
    if (humidity < 40) return { 
      level: 'Dry', 
      cssClass: styles['humidity-status-dry'], 
      badgeClass: styles['humidity-badge-dry'],
      description: 'Slightly below optimal',
      risk: 'Minor comfort issues'
    };
    if (humidity < 60) return { 
      level: 'Optimal', 
      cssClass: styles['humidity-status-optimal'], 
      badgeClass: styles['humidity-badge-optimal'],
      description: 'Ideal humidity range',
      risk: 'Comfortable environment'
    };
    if (humidity < 70) return { 
      level: 'Humid', 
      cssClass: styles['humidity-status-humid'], 
      badgeClass: styles['humidity-badge-humid'],
      description: 'Slightly above optimal',
      risk: 'Slight discomfort'
    };
    return { 
      level: 'Too Humid', 
      cssClass: styles['humidity-status-humid'], 
      badgeClass: styles['humidity-badge-humid'],
      description: 'Above comfortable range',
      risk: 'Mold growth risk, discomfort'
    };
  };

  const comfort = getHumidityLevel(stats.current);

  // Humidity distribution
  const humidityDistribution = {
    labels: ['Too Dry (<30%)', 'Dry (30-40%)', 'Optimal (40-60%)', 'Humid (60-70%)', 'Too Humid (>70%)'],
    datasets: [{
      data: [
        values.filter(v => v < 30).length,
        values.filter(v => v >= 30 && v < 40).length,
        values.filter(v => v >= 40 && v < 60).length,
        values.filter(v => v >= 60 && v < 70).length,
        values.filter(v => v >= 70).length,
      ],
      backgroundColor: ['#f59e0b', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
      borderWidth: 2,
      borderColor: '#ffffff',
    }]
  };

  return (
    <div className="space-y-6">
      {/* Humidity Status Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`bg-white rounded-lg p-4 border-2 ${comfort.cssClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Humidity</p>
              <p className="text-2xl font-bold">{stats.current.toFixed(1)}%</p>
            </div>
            <div className="text-3xl">💧</div>
          </div>
          <div className="mt-2">
            <span className={`px-2 py-1 rounded text-xs font-medium text-white ${comfort.badgeClass}`}>
              {comfort.level}
            </span>
            <p className="text-xs text-gray-500 mt-1">{comfort.description}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">24h Average</p>
              <p className="text-2xl font-bold text-blue-600">{stats.average.toFixed(1)}%</p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Daily Range</p>
              <p className="text-lg font-bold text-orange-600">{(stats.max - stats.min).toFixed(1)}%</p>
              <p className="text-xs text-gray-500">{stats.min.toFixed(1)}% - {stats.max.toFixed(1)}%</p>
            </div>
            <div className="text-3xl">📈</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Mold Risk</p>
              <p className={`text-xl font-bold ${stats.current > 60 ? 'text-red-500' : 'text-green-500'}`}>
                {stats.current > 60 ? 'High' : 'Low'}
              </p>
              <p className="text-xs text-gray-500">
                {stats.current > 60 ? 'Monitor closely' : 'Safe levels'}
              </p>
            </div>
            <div className="text-3xl">🦠</div>
          </div>
        </div>
      </div>

      {/* Charts and detailed analytics similar to temperature but humidity-specific */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          💡 Humidity Health Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800">Health Impact</h4>
            <p className="text-sm text-blue-600 mt-1">{comfort.risk}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-800">Recommendation</h4>
            <p className="text-sm text-green-600 mt-1">
              {stats.current < 30 ? 'Use humidifier to increase moisture' :
               stats.current > 70 ? 'Use dehumidifier or improve ventilation' :
               'Humidity levels are optimal'}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <h4 className="font-medium text-purple-800">Equipment Impact</h4>
            <p className="text-sm text-purple-600 mt-1">
              {stats.current < 30 ? 'May cause static damage to electronics' :
               stats.current > 70 ? 'Risk of condensation and corrosion' :
               'Safe for equipment operation'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Air Quality Sensor Analytics
const AirQualityAnalytics: React.FC<SensorTypeAnalyticsProps> = ({ 
  sensorName, readings, timeRange, onTimeRangeChange 
}) => {
  const values = readings.map(r => r.value);
  
  const stats = {
    current: values[values.length - 1] || 0,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
  };

  // AQI levels (assuming PM2.5 or general AQI scale)
  const getAQILevel = (aqi: number): { level: string; cssClass: string; badgeClass: string; advisoryClass: string; description: string; health: string } => {
    if (aqi <= 50) return { 
      level: 'Good', 
      cssClass: styles['aqi-status-good'], 
      badgeClass: styles['aqi-badge-good'],
      advisoryClass: styles['aqi-advisory-good'],
      description: 'Air quality is satisfactory',
      health: 'Little to no health risk'
    };
    if (aqi <= 100) return { 
      level: 'Moderate', 
      cssClass: styles['aqi-status-moderate'], 
      badgeClass: styles['aqi-badge-moderate'],
      advisoryClass: styles['aqi-advisory-moderate'],
      description: 'Acceptable air quality',
      health: 'Sensitive individuals may experience minor issues'
    };
    if (aqi <= 150) return { 
      level: 'Unhealthy for Sensitive', 
      cssClass: styles['aqi-status-unhealthy-sensitive'], 
      badgeClass: styles['aqi-badge-unhealthy-sensitive'],
      advisoryClass: styles['aqi-advisory-unhealthy-sensitive'],
      description: 'Members of sensitive groups may experience health effects',
      health: 'Sensitive people should reduce outdoor exposure'
    };
    if (aqi <= 200) return { 
      level: 'Unhealthy', 
      cssClass: styles['aqi-status-unhealthy'], 
      badgeClass: styles['aqi-badge-unhealthy'],
      advisoryClass: styles['aqi-advisory-unhealthy'],
      description: 'Everyone may begin to experience health effects',
      health: 'Active children and adults should avoid outdoor activities'
    };
    return { 
      level: 'Very Unhealthy', 
      cssClass: styles['aqi-status-very-unhealthy'], 
      badgeClass: styles['aqi-badge-very-unhealthy'],
      advisoryClass: styles['aqi-advisory-very-unhealthy'],
      description: 'Health warnings of emergency conditions',
      health: 'Everyone should avoid outdoor exposure'
    };
  };

  const aqi = getAQILevel(stats.current);

  return (
    <div className="space-y-6">
      {/* Air Quality Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`bg-white rounded-lg p-4 border-2 ${aqi.cssClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Air Quality Index</p>
              <p className="text-2xl font-bold">{stats.current.toFixed(0)}</p>
            </div>
            <div className="text-3xl">🌬️</div>
          </div>
          <div className="mt-2">
            <span className={`px-2 py-1 rounded text-xs font-medium text-white ${aqi.badgeClass}`}>
              {aqi.level}
            </span>
            <p className="text-xs text-gray-500 mt-1">{aqi.description}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">24h Average</p>
              <p className="text-2xl font-bold text-blue-600">{stats.average.toFixed(0)}</p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Peak AQI</p>
              <p className="text-2xl font-bold text-red-600">{stats.max.toFixed(0)}</p>
            </div>
            <div className="text-3xl">⚠️</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Health Risk</p>
              <p className={`text-lg font-bold ${stats.current > 100 ? 'text-red-500' : 'text-green-500'}`}>
                {stats.current > 100 ? 'High' : 'Low'}
              </p>
            </div>
            <div className="text-3xl">🏥</div>
          </div>
        </div>
      </div>

      {/* Air Quality Health Advisory */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          🏥 Health Advisory
        </h3>
        <div className={`p-4 rounded-lg ${aqi.advisoryClass}`}>
          <h4 className="font-medium">{aqi.level} Air Quality</h4>
          <p className="text-sm mt-1">{aqi.health}</p>
        </div>
      </div>
    </div>
  );
};

// Pressure Sensor Analytics
const PressureAnalytics: React.FC<SensorTypeAnalyticsProps> = ({ 
  sensorName, readings, timeRange, onTimeRangeChange 
}) => {
  const values = readings.map(r => r.value);
  
  const stats = {
    current: values[values.length - 1] || 0,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
    trend: values.length >= 2 ? (values[values.length - 1] - values[values.length - 2]) : 0,
  };

  // Weather pattern prediction based on pressure
  const getWeatherPrediction = (pressure: number, trend: number): { condition: string; icon: string; description: string } => {
    if (pressure > 1020) {
      return { condition: 'High Pressure', icon: '☀️', description: 'Clear weather expected' };
    } else if (pressure < 1000) {
      return { condition: 'Low Pressure', icon: '🌧️', description: 'Stormy weather possible' };
    } else if (trend > 2) {
      return { condition: 'Rising', icon: '⬆️', description: 'Weather improving' };
    } else if (trend < -2) {
      return { condition: 'Falling', icon: '⬇️', description: 'Weather deteriorating' };
    }
    return { condition: 'Stable', icon: '🌤️', description: 'Weather steady' };
  };

  const weather = getWeatherPrediction(stats.current, stats.trend);

  return (
    <div className="space-y-6">
      {/* Pressure Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border-2 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Barometric Pressure</p>
              <p className="text-2xl font-bold">{stats.current.toFixed(1)} hPa</p>
            </div>
            <div className="text-3xl">📈</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Weather Trend</p>
              <p className="text-lg font-bold">{weather.condition}</p>
            </div>
            <div className="text-3xl">{weather.icon}</div>
          </div>
          <p className="text-xs text-gray-500 mt-1">{weather.description}</p>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pressure Change</p>
              <p className={`text-xl font-bold ${stats.trend > 0 ? 'text-green-500' : stats.trend < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {stats.trend > 0 ? '+' : ''}{stats.trend.toFixed(1)} hPa
              </p>
            </div>
            <div className="text-3xl">
              {stats.trend > 0 ? '📈' : stats.trend < 0 ? '📉' : '➡️'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Altitude Est.</p>
              <p className="text-lg font-bold text-purple-600">
                {Math.round((1013.25 - stats.current) * 8.5)}m
              </p>
            </div>
            <div className="text-3xl">🏔️</div>
          </div>
        </div>
      </div>

      {/* Weather Insights */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          🌤️ Weather Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800">Current Conditions</h4>
            <p className="text-sm text-blue-600 mt-1">{weather.description}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-800">Forecast</h4>
            <p className="text-sm text-green-600 mt-1">
              {stats.trend > 2 ? 'Improving weather conditions expected' :
               stats.trend < -2 ? 'Deteriorating conditions possible' :
               'Stable weather conditions'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Component
export const SensorTypeAnalytics: React.FC<SensorTypeAnalyticsProps> = (props) => {
  const { sensorType } = props;

  const renderAnalytics = () => {
    switch (sensorType.toLowerCase()) {
      case 'temperature':
        return <TemperatureAnalytics {...props} />;
      case 'motion':
        return <MotionAnalytics {...props} />;
      case 'humidity':
        return <HumidityAnalytics {...props} />;
      case 'air_quality':
      case 'air quality':
        return <AirQualityAnalytics {...props} />;
      case 'pressure':
      case 'barometric':
        return <PressureAnalytics {...props} />;
      default:
        // Fallback to generic analytics for unknown sensor types
        return (
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">
              📊 Generic Sensor Analytics - {sensorType}
            </h3>
            <p className="text-gray-600">
              Specific analytics for {sensorType} sensors are not yet implemented.
              Using generic sensor data display.
            </p>
            {/* Could render basic stats here */}
          </div>
        );
    }
  };

  return (
    <div className="p-6">
      {/* Header with sensor type info */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {props.sensorName}
            </h1>
            <p className="text-gray-600 capitalize">
              {sensorType} Sensor Analytics • {props.location} {props.department && `• ${props.department}`}
            </p>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex gap-2">
            {[
              { key: '1h', label: '1 Hour' },
              { key: '24h', label: '24 Hours' },
              { key: '7d', label: '7 Days' },
              { key: '30d', label: '30 Days' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => props.onTimeRangeChange(key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  props.timeRange === key
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sensor-specific analytics */}
      {renderAnalytics()}
    </div>
  );
};
