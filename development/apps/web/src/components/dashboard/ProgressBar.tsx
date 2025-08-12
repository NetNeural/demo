'use client';

import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  size = 'md',
  variant = 'default'
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const getVariantClasses = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-500';
      case 'warning':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-1';
      case 'lg':
        return 'h-4';
      default:
        return 'h-2';
    }
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
          {showPercentage && (
            <span className="text-sm text-slate-500">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div className={`nn-progress ${getSizeClasses()}`}>
        <div
          className={`nn-progress-indicator ${getVariantClasses()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
