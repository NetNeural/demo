import React from 'react';

interface SensorCardProps {
  sensor: {
    id: string;
    name: string;
    type: string;
    status: 'online' | 'offline' | 'alert';
    lastReading?: {
      value: number;
      unit: string;
      timestamp: string;
    };
    location: string;
    department: string;
  };
  onClick?: () => void;
}

export function SensorCard({ sensor, onClick }: SensorCardProps) {
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'online': return 'badge badge-success';
      case 'offline': return 'badge badge-secondary';
      case 'alert': return 'badge badge-error';
      default: return 'badge badge-secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '🟢';
      case 'offline': return '⚫';
      case 'alert': return '🔴';
      default: return '⚫';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div 
      className="card cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getStatusIcon(sensor.status)}</span>
            <h3 className="text-lg font-semibold">{sensor.name}</h3>
          </div>
          <div className={getStatusBadgeClass(sensor.status)}>
            {sensor.type}
          </div>
        </div>
      </div>
      
      <div className="card-body">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Location:</span>
            <span>{sensor.location}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Department:</span>
            <span>{sensor.department}</span>
          </div>
          
          {sensor.lastReading && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-muted mb-1">Last Reading:</div>
              <div className="metric-value">
                {sensor.lastReading.value} {sensor.lastReading.unit}
              </div>
              <div className="text-xs text-muted mt-1">
                {formatTimestamp(sensor.lastReading.timestamp)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
