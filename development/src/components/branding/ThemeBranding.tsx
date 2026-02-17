'use client';

import { useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';

/**
 * ThemeBranding Component
 * Applies organization-specific branding (colors, theme) to the app
 * Theme hierarchy: Personal Override > Organization Default > System Preference
 */
export function ThemeBranding() {
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (!currentOrganization?.settings) return;

    const { branding, theme } = currentOrganization.settings;

    // Apply color scheme
    if (branding) {
      const root = document.documentElement;

      // Apply primary color to all shade variants
      if (branding.primary_color) {
        root.style.setProperty('--color-primary', branding.primary_color);
        
        // Apply to commonly used shade variants (600, 700, 800 for gradients/hovers)
        root.style.setProperty('--color-primary-600', branding.primary_color);
        root.style.setProperty('--color-primary-700', adjustBrightness(branding.primary_color, -10));
        root.style.setProperty('--color-primary-800', adjustBrightness(branding.primary_color, -20));
        
        // Convert hex to RGB for opacity variants
        const rgb = hexToRgb(branding.primary_color);
        if (rgb) {
          root.style.setProperty('--color-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        }
      }

      if (branding.secondary_color) {
        root.style.setProperty('--color-secondary', branding.secondary_color);
        root.style.setProperty('--color-secondary-600', branding.secondary_color);
      }

      if (branding.accent_color) {
        root.style.setProperty('--color-accent', branding.accent_color);
        root.style.setProperty('--color-accent-600', branding.accent_color);
      }

      console.log('✅ Applied organization branding:', {
        primary: branding.primary_color,
        secondary: branding.secondary_color,
        accent: branding.accent_color,
      });
    }

    // Apply theme mode (respecting personal override)
    const root = document.documentElement;
    
    // Store org theme as data attribute so personal settings can show it
    if (theme) {
      root.setAttribute('data-org-theme', theme);
    }
    
    // Check if user has personal theme override
    const personalTheme = localStorage.getItem('theme');
    const useOrgDefault = localStorage.getItem('useOrgDefaultTheme');
    
    // If user explicitly wants org default or has no personal preference, use org theme
    if (useOrgDefault === 'true' || !personalTheme) {
      if (theme) {
        applyTheme(theme);
        console.log('✅ Applied organization theme:', theme);
      }
    } else {
      // Personal preference takes precedence
      console.log('ℹ️ Using personal theme override, org theme available:', theme);
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
  return result && result[1] && result[2] && result[3]
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Adjust color brightness (positive = lighter, negative = darker)
 */
function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const adjust = (value: number) => {
    const adjusted = value + (value * percent / 100);
    return Math.max(0, Math.min(255, Math.round(adjusted)));
  };

  const r = adjust(rgb.r);
  const g = adjust(rgb.g);
  const b = adjust(rgb.b);

  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Apply theme to document root
 */
function applyTheme(theme: string) {
  const root = document.documentElement;
  
  // Remove all theme classes
  root.classList.remove('dark', 'light', 'theme-slate', 'theme-navy', 'theme-emerald', 'theme-neutral', 'theme-high-contrast', 'theme-twilight', 'theme-crimson');
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.add('light');
  } else if (theme === 'auto') {
    // Auto mode - respect system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.add('dark');
    } else {
      root.classList.add('light');
    }
  } else {
    // Custom theme
    root.classList.add(theme);
  }
}
