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
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800 border-green-200';
      case 'offline': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'alert': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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
      className={`p-4 rounded-lg border-2 cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(sensor.status)}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getStatusIcon(sensor.status)}</span>
          <h3 className="font-semibold text-lg">{sensor.name}</h3>
        </div>
        <span className="text-sm font-medium px-2 py-1 rounded-full bg-white bg-opacity-50">
          {sensor.type}
        </span>
      </div>
      
      <div className="space-y-1 text-sm">
        <p><span className="font-medium">Location:</span> {sensor.location}</p>
        <p><span className="font-medium">Department:</span> {sensor.department}</p>
        
        {sensor.lastReading && (
          <div className="mt-2 pt-2 border-t border-current border-opacity-20">
            <p className="font-medium">Last Reading:</p>
            <p className="text-lg">
              {sensor.lastReading.value} {sensor.lastReading.unit}
            </p>
            <p className="text-xs opacity-75">
              {formatTimestamp(sensor.lastReading.timestamp)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
