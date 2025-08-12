'use client';

import React from 'react';

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function StatusBadge({ status, size = 'md', showLabel = true }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          badgeClass: 'nn-badge-success',
          label: 'Online',
          dot: 'bg-green-500'
        };
      case 'offline':
        return {
          badgeClass: 'nn-badge-neutral',
          label: 'Offline',
          dot: 'bg-slate-400'
        };
      case 'warning':
        return {
          badgeClass: 'nn-badge-warning',
          label: 'Warning',
          dot: 'bg-amber-500'
        };
      case 'error':
        return {
          badgeClass: 'nn-badge-error',
          label: 'Error',
          dot: 'bg-red-500'
        };
      case 'maintenance':
        return {
          badgeClass: 'nn-badge-info',
          label: 'Maintenance',
          dot: 'bg-blue-500'
        };
      default:
        return {
          badgeClass: 'nn-badge-neutral',
          label: 'Unknown',
          dot: 'bg-slate-400'
        };
    }
  };

  const getDotSize = () => {
    switch (size) {
      case 'sm':
        return 'w-1.5 h-1.5';
      case 'lg':
        return 'w-3 h-3';
      default:
        return 'w-2 h-2';
    }
  };

  const config = getStatusConfig();

  return (
    <span className={`${config.badgeClass} inline-flex items-center`}>
      <span className={`${getDotSize()} ${config.dot} rounded-full mr-1.5`}></span>
      {showLabel && config.label}
    </span>
  );
}
