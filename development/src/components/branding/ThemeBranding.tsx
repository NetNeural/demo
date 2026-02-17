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

      // Apply primary color (convert hex to HSL for Tailwind)
      if (branding.primary_color) {
        const hsl = hexToHsl(branding.primary_color);
        if (hsl) {
          // Tailwind format: "hue saturation% lightness%"
          root.style.setProperty('--primary', hsl);
          root.style.setProperty('--primary-foreground', getLightness(hsl) > 50 ? '0 0% 9%' : '0 0% 98%');
          root.style.setProperty('--ring', hsl);
        }
      }

      // Apply secondary color
      if (branding.secondary_color) {
        const hsl = hexToHsl(branding.secondary_color);
        if (hsl) {
          root.style.setProperty('--secondary', hsl);
          root.style.setProperty('--secondary-foreground', getLightness(hsl) > 50 ? '0 0% 9%' : '0 0% 98%');
        }
      }

      // Apply accent color
      if (branding.accent_color) {
        const hsl = hexToHsl(branding.accent_color);
        if (hsl) {
          root.style.setProperty('--accent', hsl);
          root.style.setProperty('--accent-foreground', getLightness(hsl) > 50 ? '0 0% 9%' : '0 0% 98%');
        }
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
 * Convert hex color to HSL (Tailwind CSS format)
 * Returns format: "hue saturation% lightness%"
 */
function hexToHsl(hex: string): string | null {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  // Convert to degrees and percentages
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lPercent = Math.round(l * 100);

  // Return in Tailwind format (no commas, with %)
  return `${h} ${s}% ${lPercent}%`;
}

/**
 * Extract lightness value from HSL string
 */
function getLightness(hsl: string): number {
  const match = hsl.match(/\d+%$/);
  return match ? parseInt(match[0]) : 50;
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
