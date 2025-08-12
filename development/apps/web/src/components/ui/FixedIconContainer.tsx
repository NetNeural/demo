'use client';

import React from 'react';

interface FixedIconContainerProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  backgroundColor?: string;
  className?: string;
}

export function FixedIconContainer({ 
  children, 
  size = 'md', 
  backgroundColor = 'bg-gray-100',
  className = ''
}: FixedIconContainerProps) {
  const sizeClass = `fixed-icon-container-${size}`;

  return (
    <div 
      className={`fixed-icon-container ${sizeClass} rounded-lg ${backgroundColor} ${className}`}
    >
      <div className="fixed-icon-inner">
        {children}
      </div>
    </div>
  );
}
