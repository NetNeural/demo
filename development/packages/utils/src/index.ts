// Utility functions for the NetNeural platform
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const generateDeviceId = (): string => {
  return 'device_' + Math.random().toString(36).substr(2, 9);
};

export const formatSensorValue = (value: number, unit: string): string => {
  return `${value.toFixed(2)} ${unit}`;
};

export const getDeviceStatusColor = (status: string): string => {
  switch (status) {
    case 'online':
      return '#10b981'; // green
    case 'offline':
      return '#6b7280'; // gray
    case 'error':
      return '#ef4444'; // red
    default:
      return '#6b7280';
  }
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
