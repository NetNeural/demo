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
    if (trend > 0) return 'text-success';
    if (trend < 0) return 'text-error';
    return 'text-muted';
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">{sensorName} Analytics</h2>
          <p className="text-muted">{sensorType} Sensor</p>
        </div>
        
        {/* Time range selector */}
        <div className="flex gap-2">
          {[
            { key: '1h', label: '1H' },
            { key: '24h', label: '24H' },
            { key: '7d', label: '7D' },
            { key: '30d', label: '30D' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onTimeRangeChange(key as any)}
              className={timeRange === key ? 'btn btn-primary btn-xs' : 'btn btn-secondary btn-xs'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card-body">
        {/* Statistics cards */}
        <div className="grid grid-5 gap-4 mb-6">
          <div className="metric-card metric-info">
            <div className="metric-label">Current</div>
            <div className="metric-value">
              {stats.current.toFixed(1)} {readings[0]?.unit}
            </div>
          </div>
          
          <div className="metric-card metric-success">
            <div className="metric-label">Average</div>
            <div className="metric-value">
              {stats.average.toFixed(1)} {readings[0]?.unit}
            </div>
          </div>
          
          <div className="metric-card metric-warning">
            <div className="metric-label">Minimum</div>
            <div className="metric-value">
              {stats.min.toFixed(1)} {readings[0]?.unit}
            </div>
          </div>
          
          <div className="metric-card metric-error">
            <div className="metric-label">Maximum</div>
            <div className="metric-value">
              {stats.max.toFixed(1)} {readings[0]?.unit}
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-label">Trend</div>
            <div className={`metric-value ${getTrendColor(stats.trend)}`}>
              {getTrendIcon(stats.trend)} {Math.abs(stats.trend).toFixed(1)}
            </div>
          </div>
        </div>

        {/* Enhanced Chart Visualization */}
        <div className="mb-6">
          {readings.length > 0 ? (
            <div className="card bg-gradient">
              <div className="card-body">
                <div className="text-center text-white mb-4">
                  <h4 className="h4 mb-2">📈 Sensor Data Visualization</h4>
                  <p className="text-light">
                    {readings.length} readings over {timeRange} • Last updated: {new Date(readings[readings.length - 1]?.reading_time).toLocaleTimeString()}
                  </p>
                </div>
                
                {/* Interactive Chart Area */}
                <div className="bg-white rounded-lg p-4">
                  <div className="flex justify-center space-x-2 mb-4">
                    {readings.slice(-12).map((reading, index) => {
                      const height = Math.max(8, Math.min(48, (reading.value / stats.max) * 48));
                      const isRecent = index >= readings.slice(-12).length - 3;
                      return (
                        <div key={reading.id} className="text-center">
                          <div 
                            className={`w-3 rounded-t mb-1 ${
                              isRecent ? 'bg-blue-500' : 'bg-blue-300'
                            } ${
                              height <= 16 ? 'h-4' : 
                              height <= 32 ? 'h-8' : 'h-12'
                            }`}
                          ></div>
                          <div className="text-xs text-gray-600 font-medium">{reading.value.toFixed(1)}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(reading.reading_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Chart Stats */}
                  <div className="grid grid-3 gap-4 text-center">
                    <div>
                      <div className="text-sm text-gray-500">Peak</div>
                      <div className="font-bold text-blue-600">{stats.max.toFixed(1)} {readings[0]?.unit}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Average</div>
                      <div className="font-bold text-green-600">{stats.average.toFixed(1)} {readings[0]?.unit}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Latest</div>
                      <div className="font-bold text-purple-600">{stats.current.toFixed(1)} {readings[0]?.unit}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center">
              <div className="card-body">
                <div className="icon-container icon-lg icon-bg-gray mb-4">📊</div>
                <h4 className="h4 mb-2">No Data Available</h4>
                <p className="text-muted">Check back later for sensor readings</p>
              </div>
            </div>
          )}
        </div>

        {/* Recent readings table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Readings</h3>
            <span className="badge badge-success">Live</span>
          </div>
          <div className="card-body">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Value</th>
                    <th>Unit</th>
                    <th>Status</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.slice(-8).reverse().map((reading, index) => {
                    const prevReading = readings[readings.length - index - 2];
                    const trend = prevReading ? reading.value - prevReading.value : 0;
                    const status = reading.value < stats.min * 1.1 ? 'Low' :
                                  reading.value > stats.max * 0.9 ? 'High' : 'Normal';
                    
                    return (
                      <tr key={reading.id}>
                        <td className="font-mono text-sm">
                          {new Date(reading.reading_time).toLocaleString()}
                        </td>
                        <td className="font-bold">{reading.value.toFixed(2)}</td>
                        <td className="text-muted">{reading.unit}</td>
                        <td>
                          <span className={`badge ${
                            status === 'Normal' ? 'badge-success' :
                            status === 'High' ? 'badge-warning' : 'badge-info'
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td>
                          <span className={`text-sm ${getTrendColor(trend)}`}>
                            {getTrendIcon(trend)}
                          </span>
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
    </div>
  );
}
