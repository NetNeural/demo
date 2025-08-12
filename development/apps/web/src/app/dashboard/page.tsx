'use client';

import React from 'react';
import UnifiedDashboard from '../../components/dashboard/UnifiedDashboard';

export default function DashboardPage() {
  return (
    <UnifiedDashboard 
      mode="production" 
      title="IoT Dashboard"
      currentPage="dashboard"
    />
  );
}
