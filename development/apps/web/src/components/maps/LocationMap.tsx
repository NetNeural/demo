import React, { useState, useEffect } from 'react';
import styles from '../analytics/SensorAnalytics.module.css';

interface LocationMapProps {
  locations: Array<{
    id: string;
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    sensors_total: number;
    sensors_online: number;
    alerts_active: number;
  }>;
  onLocationSelect?: (locationId: string) => void;
}

export function LocationMap({ locations, onLocationSelect }: LocationMapProps) {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  const getLocationStatusColor = (location: any) => {
    if (location.alerts_active > 0) return 'bg-red-500';
    if (location.sensors_online < location.sensors_total) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleLocationClick = (locationId: string) => {
    setSelectedLocation(locationId);
    onLocationSelect?.(locationId);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Location Overview</h2>
      
      {/* Map placeholder - In real implementation, this would be a proper map component */}
      <div className="bg-gray-100 rounded-lg h-64 mb-4 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          🗺️ Interactive Map Coming Soon
        </div>
        
        {/* Location markers overlay */}
        <div className="absolute inset-0">
          {locations.map((location, index) => {
            const leftPosition = 20 + (index * 15) % 60;
            const topPosition = 30 + (index * 10) % 40;
            return (
              <div
                key={location.id}
                className={`${styles.mapMarker} absolute transition-transform hover:scale-150 ${getLocationStatusColor(location)}`}
                // eslint-disable-next-line react/forbid-dom-props
                style={{
                  left: `${leftPosition}%`,
                  top: `${topPosition}%`,
                }}
                onClick={() => handleLocationClick(location.id)}
                title={`${location.name} - ${location.sensors_online}/${location.sensors_total} sensors online`}
              />
            );
          })}
        </div>
      </div>

      {/* Location list */}
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Locations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {locations.map((location) => (
            <div
              key={location.id}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedLocation === location.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleLocationClick(location.id)}
            >
              <div className="flex items-center space-x-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${getLocationStatusColor(location)}`} />
                <h4 className="font-medium">{location.name}</h4>
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <p>{location.address}</p>
                <div className="flex justify-between">
                  <span>Sensors: {location.sensors_online}/{location.sensors_total}</span>
                  {location.alerts_active > 0 && (
                    <span className="text-red-600 font-medium">
                      🚨 {location.alerts_active} alerts
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h4 className="font-medium mb-2">Status Legend</h4>
        <div className="flex space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>All Online</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Some Offline</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Active Alerts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
