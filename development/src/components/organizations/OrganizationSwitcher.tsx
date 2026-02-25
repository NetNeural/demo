'use client'

import React, { useState } from 'react'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreateOrganizationDialog } from '@/components/organizations/CreateOrganizationDialog'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getRoleDisplayInfo } from '@/types/organization'
import { cn } from '@/lib/utils'

interface OrganizationSwitcherProps {
  className?: string
  showCreateButton?: boolean
  compact?: boolean
}

export function OrganizationSwitcher({
  className,
  showCreateButton = true,
  compact = false,
}: OrganizationSwitcherProps) {
  const {
    currentOrganization,
    userOrganizations,
    switchOrganization,
    refreshOrganizations,
    isLoading,
  } = useOrganization()

  const { user } = useUser()
  const isSuperAdmin = user?.isSuperAdmin || false

  // 🔍 DEBUG: Log user info to console
  console.log('🔍 OrganizationSwitcher Debug:', {
    userEmail: user?.email,
    userRole: user?.role,
    isSuperAdminFromUser: user?.isSuperAdmin,
    calculatedIsSuperAdmin: isSuperAdmin,
    showCreateButton: showCreateButton,
    willShowCreateOrg: showCreateButton && isSuperAdmin,
  })

  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex animate-pulse items-center gap-2 px-3 py-2',
          className
        )}
      >
        <div className="h-8 w-8 rounded bg-muted" />
        <div className="flex-1">
          <div className="mb-1 h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted/50" />
        </div>
      </div>
    )
  }

  // If no organization and user is super admin, show dropdown with create option
  if (!currentOrganization && isSuperAdmin) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-between gap-2 hover:bg-accent',
              compact ? 'h-10' : 'h-auto py-3',
              className
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <OrganizationLogo
                size={compact ? 'lg' : 'xl'}
                showFallback={true}
              />

              <div className="min-w-0 flex-1 text-left">
                <span
                  className={cn(
                    'font-medium text-muted-foreground',
                    compact ? 'text-sm' : 'text-base'
                  )}
                >
                  No Organization
                </span>
                {!compact && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Create your first organization
                  </p>
                )}
              </div>
            </div>

            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="z-[200] w-[320px]">
          <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
            Get Started
          </DropdownMenuLabel>

          {showCreateButton && (
            <div className="px-2 py-2">
              <CreateOrganizationDialog
                onSuccess={(newOrgId) => {
                  setOpen(false)
                  refreshOrganizations().then(() => {
                    switchOrganization(newOrgId)
                  })
                }}
                trigger={
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    Create Organization
                  </Button>
                }
              />
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Regular users without org (shouldn't happen but handle gracefully)
  if (!currentOrganization) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-muted-foreground',
          className
        )}
      >
        <Building2 className="h-5 w-5" />
        <span className="text-sm">No organization selected</span>
      </div>
    )
  }

  const roleInfo = getRoleDisplayInfo(currentOrganization.role)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-between gap-2 hover:bg-accent',
            compact ? 'h-10' : 'h-auto py-3',
            className
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <OrganizationLogo
              settings={currentOrganization.settings}
              name={currentOrganization.name}
              size={compact ? 'lg' : 'xl'}
              className={
                !currentOrganization.settings?.branding?.logo_url
                  ? 'bg-primary text-primary-foreground'
                  : ''
              }
            />

            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'truncate font-medium text-foreground',
                    compact ? 'text-sm' : 'text-base'
                  )}
                >
                  {currentOrganization.name}
                </span>
                <Badge
                  variant="secondary"
                  className={cn(
                    'capitalize',
                    compact ? 'px-1.5 py-0 text-xs' : 'text-xs',
                    roleInfo.color === 'purple' &&
                      'bg-purple-100 text-purple-700',
                    roleInfo.color === 'blue' && 'bg-blue-100 text-blue-700',
                    roleInfo.color === 'green' && 'bg-green-100 text-green-700',
                    roleInfo.color === 'gray' && 'bg-gray-100 text-gray-700'
                  )}
                >
                  {roleInfo.label}
                </Badge>
              </div>

              {!compact && currentOrganization.deviceCount !== undefined && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {currentOrganization.deviceCount} devices •{' '}
                  {currentOrganization.userCount} users
                </p>
              )}
            </div>
          </div>

          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="z-[200] w-[320px]">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Your Organizations
        </DropdownMenuLabel>

        {userOrganizations.map((org) => {
          const isSelected = org.id === currentOrganization.id
          const orgRoleInfo = getRoleDisplayInfo(org.role)

          return (
            <DropdownMenuItem
              key={org.id}
              onClick={() => {
                switchOrganization(org.id)
                setOpen(false)
              }}
              className="flex cursor-pointer items-start gap-3 p-3"
            >
              <OrganizationLogo
                settings={org.settings}
                name={org.name}
                size="xl"
                className={cn(
                  !org.settings?.branding?.logo_url &&
                    (isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground')
                )}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {org.name}
                  </span>
                  {isSelected && (
                    <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                  )}
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-xs capitalize',
                      orgRoleInfo.color === 'purple' &&
                        'bg-purple-100 text-purple-700',
                      orgRoleInfo.color === 'blue' &&
                        'bg-blue-100 text-blue-700',
                      orgRoleInfo.color === 'green' &&
                        'bg-green-100 text-green-700',
                      orgRoleInfo.color === 'gray' &&
                        'bg-gray-100 text-gray-700'
                    )}
                  >
                    {orgRoleInfo.label}
                  </Badge>

                  {org.deviceCount !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {org.deviceCount} devices
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuItem>
          )
        })}

        {showCreateButton && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2">
              <CreateOrganizationDialog
                onSuccess={(newOrgId) => {
                  setOpen(false)
                  // Refresh organizations and switch to new one
                  refreshOrganizations().then(() => {
                    switchOrganization(newOrgId)
                  })
                }}
                trigger={
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    Create Organization
                  </Button>
                }
              />
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Compact version for navigation sidebar
 * Note: showCreateButton defaults to true, super admin check happens inside OrganizationSwitcher
 */
export function OrganizationSwitcherCompact() {
  return <OrganizationSwitcher compact showCreateButton={true} />
}

/**
 * Simple display-only organization indicator
 */
export function OrganizationIndicator({ className }: { className?: string }) {
  const { currentOrganization } = useOrganization()

  if (!currentOrganization) return null

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <OrganizationLogo
        settings={currentOrganization.settings}
        name={currentOrganization.name}
        size="md"
        className={
          !currentOrganization.settings?.branding?.logo_url
            ? 'bg-primary text-primary-foreground'
            : ''
        }
      />
      <span className="truncate text-sm font-medium text-foreground">
        {currentOrganization.name}
      </span>
    </div>
  )
}
