import React, { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
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
} from 'chart.js';
import styles from './SensorAnalytics.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

interface SensorReading {
  id: string;
  value: number;
  unit: string;
  reading_time: string;
}

interface SensorAnalyticsProps {
  sensorId: string;
  sensorName: string;
  sensorType: string;
  readings: SensorReading[];
  timeRange: '1h' | '24h' | '7d' | '30d';
  onTimeRangeChange: (range: '1h' | '24h' | '7d' | '30d') => void;
}

export function SensorAnalytics({ 
  sensorId, 
  sensorName, 
  sensorType, 
  readings, 
  timeRange, 
  onTimeRangeChange 
}: SensorAnalyticsProps) {
  const [loading, setLoading] = useState(false);

  // Calculate statistics
  const values = readings.map(r => r.value);
  const stats = {
    current: values[values.length - 1] || 0,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    min: values.length ? Math.min(...values) : 0,
    max: values.length ? Math.max(...values) : 0,
    trend: values.length >= 2 ? (values[values.length - 1] - values[values.length - 2]) : 0,
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return '📈';
    if (trend < 0) return '📉';
    return '➡️';
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{sensorName} Analytics</h2>
          <p className="text-gray-600">{sensorType} Sensor</p>
        </div>
        
        {/* Time range selector */}
        <div className="flex space-x-2">
          {[
            { key: '1h', label: '1 Hour' },
            { key: '24h', label: '24 Hours' },
            { key: '7d', label: '7 Days' },
            { key: '30d', label: '30 Days' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onTimeRangeChange(key as any)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                timeRange === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm text-blue-600 font-medium">Current</p>
          <p className="text-lg font-bold text-blue-900">
            {stats.current.toFixed(1)} {readings[0]?.unit}
          </p>
        </div>
        
        <div className="bg-green-50 p-3 rounded-lg">
          <p className="text-sm text-green-600 font-medium">Average</p>
          <p className="text-lg font-bold text-green-900">
            {stats.average.toFixed(1)} {readings[0]?.unit}
          </p>
        </div>
        
        <div className="bg-orange-50 p-3 rounded-lg">
          <p className="text-sm text-orange-600 font-medium">Minimum</p>
          <p className="text-lg font-bold text-orange-900">
            {stats.min.toFixed(1)} {readings[0]?.unit}
          </p>
        </div>
        
        <div className="bg-red-50 p-3 rounded-lg">
          <p className="text-sm text-red-600 font-medium">Maximum</p>
          <p className="text-lg font-bold text-red-900">
            {stats.max.toFixed(1)} {readings[0]?.unit}
          </p>
        </div>
        
        <div className="bg-purple-50 p-3 rounded-lg">
          <p className="text-sm text-purple-600 font-medium">Trend</p>
          <p className={`text-lg font-bold ${getTrendColor(stats.trend)}`}>
            {getTrendIcon(stats.trend)} {Math.abs(stats.trend).toFixed(1)}
          </p>
        </div>
      </div>

      {/* Chart placeholder */}
      <div className="h-64 mb-4">
        {readings.length > 0 ? (
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-blue-900">📈 Chart Visualization</p>
              <p className="text-sm text-blue-700">
                {readings.length} data points over {timeRange}
              </p>
              <div className="mt-4 flex justify-center space-x-8">
                {readings.slice(-5).map((reading, index) => {
                  const height = Math.max(10, (reading.value / stats.max) * 60);
                  return (
                    <div key={reading.id} className="text-center">
                      <div 
                        className={`${styles.chartBar} mb-1`}
                        // eslint-disable-next-line react/forbid-dom-props
                        style={{ height: `${height}px` }}
                      />
                      <p className="text-xs text-blue-600">{reading.value.toFixed(1)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
            <div className="text-center text-gray-500">
              <p className="text-lg">📊 No data available</p>
              <p className="text-sm">Check back later for sensor readings</p>
            </div>
          </div>
        )}
      </div>

      {/* Recent readings table */}
      <div>
        <h3 className="font-semibold mb-3">Recent Readings</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">Value</th>
                <th className="text-left py-2">Unit</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {readings.slice(-10).reverse().map((reading) => (
                <tr key={reading.id} className="border-b border-gray-100">
                  <td className="py-2">
                    {new Date(reading.reading_time).toLocaleString()}
                  </td>
                  <td className="py-2 font-medium">{reading.value.toFixed(2)}</td>
                  <td className="py-2">{reading.unit}</td>
                  <td className="py-2">
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                      Normal
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
