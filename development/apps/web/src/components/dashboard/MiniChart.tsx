'use client';

import React from 'react';

interface DataPoint {
  timestamp: string;
  value: number;
}

interface MiniChartProps {
  data: DataPoint[];
  color?: 'blue' | 'green' | 'yellow' | 'red';
  height?: number;
  width?: number;
}

export function MiniChart({ 
  data, 
  color = 'blue', 
  height = 40, 
  width = 120 
}: MiniChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`bg-slate-100 rounded flex items-center justify-center text-slate-400 text-xs nn-icon-container-md`}>
        No data
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  const colorMap = {
    blue: '#3b82f6',
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444'
  };

  // Create SVG path for the chart
  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((point.value - minValue) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="relative">
      <svg 
        width={width} 
        height={height}
        className="overflow-visible nn-icon-container-md"
      >
        {/* Simplified grid - no complex patterns */}
        <rect width="100%" height="100%" fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
        
        {/* Area under the curve - reduced opacity */}
        <path
          d={`M 0,${height} L ${points} L ${width},${height} Z`}
          fill={colorMap[color]}
          fillOpacity="0.05"
        />
        
        {/* Line chart - thinner stroke */}
        <polyline
          points={points}
          fill="none"
          stroke={colorMap[color]}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points - smaller */}
        {data.map((point, index) => {
          const x = (index / (data.length - 1)) * width;
          const y = height - ((point.value - minValue) / range) * height;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="1"
              fill={colorMap[color]}
              className="opacity-60"
            />
          );
        })}
      </svg>
      
      {/* Simplified value labels */}
      <div className="absolute -top-4 left-0 text-xs text-slate-400">
        {maxValue.toFixed(0)}
      </div>
      <div className="absolute -bottom-4 left-0 text-xs text-slate-400">
        {minValue.toFixed(0)}
      </div>
    </div>
  );
}

// Generate sample time-series data
export function generateTimeSeriesData(points: number = 20): DataPoint[] {
  const now = new Date();
  const data: DataPoint[] = [];
  
  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000); // 5-minute intervals
    const baseValue = 50;
    const variation = Math.sin(i * 0.3) * 20 + Math.random() * 10;
    
    data.push({
      timestamp: timestamp.toLocaleTimeString(),
      value: baseValue + variation
    });
  }
  
  return data;
}
