'use client';

import { useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';

/**
 * ThemeBranding Component
 * Applies organization-specific branding (colors, theme) to the app
 */
export function ThemeBranding() {
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (!currentOrganization?.settings) return;

    const { branding, theme } = currentOrganization.settings;

    // Apply color scheme
    if (branding) {
      const root = document.documentElement;

      if (branding.primary_color) {
        root.style.setProperty('--color-primary', branding.primary_color);
        // Convert hex to RGB for opacity variants
        const rgb = hexToRgb(branding.primary_color);
        if (rgb) {
          root.style.setProperty('--color-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        }
      }

      if (branding.secondary_color) {
        root.style.setProperty('--color-secondary', branding.secondary_color);
      }

      if (branding.accent_color) {
        root.style.setProperty('--color-accent', branding.accent_color);
      }

      console.log('✅ Applied organization branding:', {
        primary: branding.primary_color,
        secondary: branding.secondary_color,
        accent: branding.accent_color,
      });
    }

    // Apply theme mode
    if (theme) {
      const root = document.documentElement;
      
      if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else if (theme === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
      } else {
        // Auto mode - respect system preference
        root.classList.remove('light', 'dark');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
        }
      }

      console.log('✅ Applied theme mode:', theme);
    }

    // Cleanup function
    return () => {
      // Optionally reset to defaults on unmount
    };
  }, [currentOrganization?.settings]);

  return null; // This component doesn't render anything
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}
