'use client';

import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
}

export function MetricCard({
  title,
  value,
  unit,
  change,
  trend = 'neutral',
  status = 'info',
  icon
}: MetricCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'nn-metric-change-positive';
      case 'down':
        return 'nn-metric-change-negative';
      default:
        return 'text-slate-600';
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'success':
        return 'nn-badge-success';
      case 'warning':
        return 'nn-badge-warning';
      case 'error':
        return 'nn-badge-error';
      default:
        return 'nn-badge-info';
    }
  };

  return (
    <div className="nn-metric">
      <div className="nn-metric-header">
        <div className="nn-metric-title">{title}</div>
        {icon && (
          <div className="nn-icon-md text-slate-400">
            {icon}
          </div>
        )}
      </div>
      
      <div className="nn-metric-value">
        {value}
        {unit && <span className="text-lg font-normal text-slate-500 ml-1">{unit}</span>}
      </div>
      
      {change && (
        <div className={`nn-metric-change ${getTrendColor()}`}>
          {trend === 'up' && '↗ '}
          {trend === 'down' && '↘ '}
          {change}
        </div>
      )}
      
      <div className={`nn-badge ${getStatusBadge()} mt-2`}>
        {status}
      </div>
    </div>
  );
}
