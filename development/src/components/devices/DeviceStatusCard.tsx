import React from 'react';
import { useDeviceStatus } from '@/hooks/useDeviceStatus';
import { useDateFormatter } from '@/hooks/useDateFormatter';
import type { DeviceConnectionStatus } from '@/types/unified-device-status';

interface DeviceStatusCardProps {
  deviceId: string;
  refreshInterval?: number;
  showDetails?: boolean;
}

const statusColors: Record<DeviceConnectionStatus, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  unknown: 'bg-gray-300',
};

const statusLabels: Record<DeviceConnectionStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  warning: 'Warning',
  error: 'Error',
  unknown: 'Unknown',
};

/**
 * DeviceStatusCard Component
 * Displays unified device status with real-time updates
 */
export function DeviceStatusCard({
  deviceId,
  refreshInterval = 30000,
  showDetails = true,
}: DeviceStatusCardProps) {
  const { status, isLoading, error, refresh } = useDeviceStatus({
    deviceId,
    refreshInterval,
  });
  const { fmt } = useDateFormatter();

  if (isLoading && !status) {
    return (
      <div className="border rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-2/3 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
        <div className="flex items-center gap-2 text-red-800">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">Error loading device status</span>
        </div>
        <p className="text-sm text-red-600 mt-2">{error.message}</p>
        <button
          onClick={() => void refresh()}
          className="mt-3 text-sm text-red-700 underline hover:text-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="border rounded-lg p-4 text-gray-500">
        No device status available
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${statusColors[status.status]}`}
          ></div>
          <div>
            <h3 className="font-semibold text-lg">{status.name}</h3>
            <p className="text-sm text-gray-500">
              {statusLabels[status.status]}
            </p>
          </div>
        </div>
        <button
          onClick={() => void refresh()}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh status"
        >
          <svg
            className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase">Last Seen</p>
          <p className="text-sm font-medium">
            {fmt.timeAgo(status.lastSeen)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Device Type</p>
          <p className="text-sm font-medium capitalize">{status.deviceType}</p>
        </div>
      </div>

      {showDetails && (
        <>
          {/* Firmware */}
          {status.firmware && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 uppercase mb-1">Firmware</p>
              <p className="text-sm font-medium">{status.firmware.version}</p>
              {status.firmware.components && status.firmware.components.length > 0 && (
                <div className="mt-2 space-y-1">
                  {status.firmware.components.map((component, idx) => (
                    <div key={idx} className="text-xs text-gray-600">
                      {component.name}: {component.version}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Health Metrics */}
          {status.health && Object.keys(status.health).length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 uppercase mb-2">Health</p>
              <div className="grid grid-cols-2 gap-3">
                {status.health.battery !== undefined && (
                  <div>
                    <p className="text-xs text-gray-600">Battery</p>
                    <p className="text-sm font-medium">
                      {status.health.battery}%
                    </p>
                  </div>
                )}
                {status.health.signalStrength !== undefined && (
                  <div>
                    <p className="text-xs text-gray-600">Signal</p>
                    <p className="text-sm font-medium">
                      {status.health.signalStrength} dBm
                    </p>
                  </div>
                )}
                {status.health.temperature !== undefined && (
                  <div>
                    <p className="text-xs text-gray-600">Temperature</p>
                    <p className="text-sm font-medium">
                      {status.health.temperature}°C
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="pt-4 border-t text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Provider:</span>
              <span className="font-medium text-gray-700">
                {status.providerType}
              </span>
            </div>
            {status.externalDeviceId && (
              <div className="flex justify-between">
                <span>External ID:</span>
                <span className="font-mono text-gray-700">
                  {status.externalDeviceId}
                </span>
              </div>
            )}
            {status.cohortId && (
              <div className="flex justify-between">
                <span>Cohort:</span>
                <span className="font-medium text-gray-700">
                  {status.cohortId}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
