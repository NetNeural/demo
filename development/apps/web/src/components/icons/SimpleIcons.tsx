'use client';

import React from 'react';

// Simplified icon variants with minimal path complexity
interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

// Unified stroke attributes for all icons
const iconDefaults = {
  fill: "none",
  stroke: "currentColor", 
  strokeWidth: "1.5",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24"
};

export function SimpleChartIcon({ className, style }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} style={style}>
      <path d="M3 13l4-4 4 4 10-10M3 21h18" />
    </svg>
  );
}

export function SimpleCpuIcon({ className, style }: IconProps) {
  return (
    <svg {...iconDefaults} className={className} style={style}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  );
}

export function SimpleMapIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function SimpleAlertIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M12 9v2M12 15h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

export function SimpleSignalIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M2 20h20M2 20v-8M7 20v-4M12 20V8M17 20V4M22 20v-2" />
    </svg>
  );
}

export function SimpleFireIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

export function SimpleEyeIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function SimpleBoltIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function SimpleWifiIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
    </svg>
  );
}

export function SimpleClockIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}

export function SimpleCheckCircleIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22,4 12,14.01 9,11.01" />
    </svg>
  );
}

export function SimpleCogIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
    </svg>
  );
}

export function SimpleBellIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function SimpleUserIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function SimpleHomeIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  );
}

export function SimplePhoneIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

export function SimplePieChartIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

export function SimpleBuildingIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12h4M6 16h4M14 12h4M14 16h4" />
    </svg>
  );
}

export function SimpleShieldIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function SimpleArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function SimplePlayIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M8 5l8 7-8 7V5z" />
    </svg>
  );
}

export function SimpleRocketLaunchIcon({ className }: IconProps) {
  return (
    <svg {...iconDefaults} className={className}>
      <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

// Icon mapping for easy replacement
export const SimpleIcons = {
  ChartBarIcon: SimpleChartIcon,
  CpuChipIcon: SimpleCpuIcon,
  MapPinIcon: SimpleMapIcon,
  ExclamationTriangleIcon: SimpleAlertIcon,
  SignalIcon: SimpleSignalIcon,
  FireIcon: SimpleFireIcon,
  EyeIcon: SimpleEyeIcon,
  BoltIcon: SimpleBoltIcon,
  WifiIcon: SimpleWifiIcon,
  ClockIcon: SimpleClockIcon,
  CheckCircleIcon: SimpleCheckCircleIcon,
  Cog6ToothIcon: SimpleCogIcon,
  BellIcon: SimpleBellIcon,
  UserCircleIcon: SimpleUserIcon,
  HomeIcon: SimpleHomeIcon,
  DevicePhoneMobileIcon: SimplePhoneIcon,
  ChartPieIcon: SimplePieChartIcon,
  BuildingOfficeIcon: SimpleBuildingIcon,
  ShieldCheckIcon: SimpleShieldIcon,
  ArrowRightIcon: SimpleArrowRightIcon,
  PlayIcon: SimplePlayIcon,
  RocketLaunchIcon: SimpleRocketLaunchIcon
} as const;

// Type for icon names
export type SimpleIconName = keyof typeof SimpleIcons;
