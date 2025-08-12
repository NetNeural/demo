import React, { useState, useEffect } from 'react';

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

interface AlertPanelProps {
  alerts: Alert[];
  onAlertAcknowledge?: (alertId: string) => void;
  onAlertDismiss?: (alertId: string) => void;
}

export function AlertPanel({ alerts, onAlertAcknowledge, onAlertDismiss }: AlertPanelProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'unacknowledged'>('all');

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '🔔';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'warning': return 'border-yellow-500 bg-yellow-50';
      case 'info': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'unacknowledged') return !alert.acknowledged;
    return alert.type === filter;
  });

  const criticalCount = alerts.filter(a => a.type === 'critical' && a.is_active).length;
  const warningCount = alerts.filter(a => a.type === 'warning' && a.is_active).length;
  const unacknowledgedCount = alerts.filter(a => !a.acknowledged && a.is_active).length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Active Alerts</h2>
        <div className="flex space-x-2">
          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
            {criticalCount} Critical
          </span>
          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
            {warningCount} Warning
          </span>
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
            {unacknowledgedCount} Unacknowledged
          </span>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex space-x-2 mb-4">
        {[
          { key: 'all', label: 'All', count: alerts.length },
          { key: 'critical', label: 'Critical', count: criticalCount },
          { key: 'warning', label: 'Warning', count: warningCount },
          { key: 'unacknowledged', label: 'Unacknowledged', count: unacknowledgedCount },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Alerts list */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">🎉 No alerts found</p>
            <p className="text-sm">All systems are running normally</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`border-l-4 p-4 rounded-r-lg ${getAlertColor(alert.type)} ${
                alert.acknowledged ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">{getAlertIcon(alert.type)}</span>
                    <h3 className="font-semibold">{alert.title}</h3>
                    <span className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                      {alert.type.toUpperCase()}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-600">
                    <span>📍 {alert.location_name}</span>
                    <span>🏢 {alert.department_name}</span>
                    <span>📡 {alert.sensor_name}</span>
                    <span>⏰ {formatTimeAgo(alert.triggered_at)}</span>
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => onAlertAcknowledge?.(alert.id)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => onAlertDismiss?.(alert.id)}
                    className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredAlerts.length > 5 && (
        <div className="mt-4 text-center">
          <button className="text-blue-600 text-sm hover:text-blue-800">
            View All Alerts →
          </button>
        </div>
      )}
    </div>
  );
}
