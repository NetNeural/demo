'use client'

import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrganizationSettings } from '@/types/organization'

interface OrganizationLogoProps {
  settings?: OrganizationSettings
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showFallback?: boolean
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
}

const fallbackIconSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-6 h-6',
}

/**
 * Displays organization logo with consistent sizing and fallback
 * Shows logo if available in settings.branding.logo_url
 * Falls back to Building2 icon if no logo or showFallback is false
 */
export function OrganizationLogo({
  settings,
  name = 'Organization',
  size = 'md',
  className,
  showFallback = true,
}: OrganizationLogoProps) {
  const logoUrl = settings?.branding?.logo_url

  if (!logoUrl) {
    if (!showFallback) return null

    return (
      <div
        className={cn(
          'flex flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground',
          sizeClasses[size],
          className
        )}
      >
        <Building2 className={fallbackIconSizes[size]} />
      </div>
    )
  }

  return (
    <img
      src={logoUrl}
      alt={`${name} logo`}
      className={cn(
        'flex-shrink-0 object-contain',
        sizeClasses[size],
        className
      )}
    />
  )
}
