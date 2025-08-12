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

  const getAlertClass = (type: string) => {
    switch (type) {
      case 'critical': return 'alert alert-error';
      case 'warning': return 'alert alert-warning';
      case 'info': return 'alert alert-info';
      default: return 'alert alert-info';
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="badge badge-error">
            {criticalCount} Critical
          </div>
          <div className="badge badge-warning">
            {warningCount} Warning
          </div>
          <div className="badge badge-secondary">
            {unacknowledgedCount} Unacknowledged
          </div>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: 'All', count: alerts.length },
          { key: 'critical', label: 'Critical', count: criticalCount },
          { key: 'warning', label: 'Warning', count: warningCount },
          { key: 'unacknowledged', label: 'Unacknowledged', count: unacknowledgedCount },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            className={`btn btn-sm ${
              filter === key ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Alerts list */}
      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <p className="text-lg">🎉 No alerts found</p>
            <p className="text-sm">All systems are running normally</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`${getAlertClass(alert.type)} ${
                alert.acknowledged ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getAlertIcon(alert.type)}</span>
                    <h3 className="font-semibold">{alert.title}</h3>
                    <div className="badge">
                      {alert.type.toUpperCase()}
                    </div>
                  </div>
                  
                  <p className="text-sm mb-2">{alert.message}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span>📍 {alert.location_name}</span>
                    <span>🏢 {alert.department_name}</span>
                    <span>📡 {alert.sensor_name}</span>
                    <span>⏰ {formatTimeAgo(alert.triggered_at)}</span>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => onAlertAcknowledge?.(alert.id)}
                      className="btn btn-primary btn-sm"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => onAlertDismiss?.(alert.id)}
                    className="btn btn-secondary btn-sm"
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
          <button className="link">
            View All Alerts →
          </button>
        </div>
      )}
    </div>
  );
}
