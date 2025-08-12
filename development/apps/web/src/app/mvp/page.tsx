'use client';

import React from 'react';
import UnifiedDashboard from '../../components/dashboard/UnifiedDashboard';

export default function MVPPage() {
  return (
    <UnifiedDashboard 
      mode="demo" 
      title="MVP Dashboard"
      currentPage="mvp"
    />
  );
}
