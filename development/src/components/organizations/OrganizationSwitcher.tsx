'use client';

import React, { useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUser } from '@/contexts/UserContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreateOrganizationDialog } from '@/components/organizations/CreateOrganizationDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getRoleDisplayInfo } from '@/types/organization';
import { cn } from '@/lib/utils';

interface OrganizationSwitcherProps {
  className?: string;
  showCreateButton?: boolean;
  compact?: boolean;
}

export function OrganizationSwitcher({ 
  className,
  showCreateButton = true,
  compact = false
}: OrganizationSwitcherProps) {
  const { 
    currentOrganization, 
    userOrganizations, 
    switchOrganization,
    refreshOrganizations,
    isLoading 
  } = useOrganization();
  
  const { user } = useUser();
  const isSuperAdmin = user?.isSuperAdmin || false;
  
  // 🔍 DEBUG: Log user info to console
  console.log('🔍 OrganizationSwitcher Debug:', {
    userEmail: user?.email,
    userRole: user?.role,
    isSuperAdminFromUser: user?.isSuperAdmin,
    calculatedIsSuperAdmin: isSuperAdmin,
    showCreateButton: showCreateButton,
    willShowCreateOrg: showCreateButton && isSuperAdmin
  });
  
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 animate-pulse', className)}>
        <div className="w-8 h-8 bg-muted rounded" />
        <div className="flex-1">
          <div className="h-4 bg-muted rounded w-32 mb-1" />
          <div className="h-3 bg-muted/50 rounded w-20" />
        </div>
      </div>
    );
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
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn(
                'flex items-center justify-center rounded-md bg-muted text-muted-foreground flex-shrink-0',
                compact ? 'w-8 h-8' : 'w-10 h-10'
              )}>
                <Building2 className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
              </div>
              
              <div className="flex-1 min-w-0 text-left">
                <span className={cn(
                  'font-medium text-muted-foreground',
                  compact ? 'text-sm' : 'text-base'
                )}>
                  No Organization
                </span>
                {!compact && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create your first organization
                  </p>
                )}
              </div>
            </div>
            
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[320px] z-[200]">
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
            Get Started
          </DropdownMenuLabel>
          
          {showCreateButton && (
            <div className="px-2 py-2">
              <CreateOrganizationDialog
                onSuccess={(newOrgId) => {
                  setOpen(false);
                  refreshOrganizations().then(() => {
                    switchOrganization(newOrgId);
                  });
                }}
                trigger={
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Create Organization
                  </Button>
                }
              />
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Regular users without org (shouldn't happen but handle gracefully)
  if (!currentOrganization) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 text-muted-foreground', className)}>
        <Building2 className="w-5 h-5" />
        <span className="text-sm">No organization selected</span>
      </div>
    );
  }

  const roleInfo = getRoleDisplayInfo(currentOrganization.role);

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
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn(
              'flex items-center justify-center rounded-md bg-primary text-primary-foreground flex-shrink-0',
              compact ? 'w-8 h-8' : 'w-10 h-10'
            )}>
              <Building2 className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
            </div>
            
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'font-medium text-foreground truncate',
                  compact ? 'text-sm' : 'text-base'
                )}>
                  {currentOrganization.name}
                </span>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    'capitalize',
                    compact ? 'text-xs px-1.5 py-0' : 'text-xs',
                    roleInfo.color === 'purple' && 'bg-purple-100 text-purple-700',
                    roleInfo.color === 'blue' && 'bg-blue-100 text-blue-700',
                    roleInfo.color === 'green' && 'bg-green-100 text-green-700',
                    roleInfo.color === 'gray' && 'bg-gray-100 text-gray-700'
                  )}
                >
                  {roleInfo.label}
                </Badge>
              </div>
              
              {!compact && currentOrganization.deviceCount !== undefined && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {currentOrganization.deviceCount} devices • {currentOrganization.userCount} users
                </p>
              )}
            </div>
          </div>
          
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[320px] z-[200]">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wide">
          Your Organizations
        </DropdownMenuLabel>
        
        {userOrganizations.map((org) => {
          const isSelected = org.id === currentOrganization.id;
          const orgRoleInfo = getRoleDisplayInfo(org.role);
          
          return (
            <DropdownMenuItem
              key={org.id}
              onClick={() => {
                switchOrganization(org.id);
                setOpen(false);
              }}
              className="flex items-start gap-3 p-3 cursor-pointer"
            >
              <div className={cn(
                'flex items-center justify-center w-10 h-10 rounded-md flex-shrink-0',
                isSelected 
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                <Building2 className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">
                    {org.name}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      'capitalize text-xs',
                      orgRoleInfo.color === 'purple' && 'bg-purple-100 text-purple-700',
                      orgRoleInfo.color === 'blue' && 'bg-blue-100 text-blue-700',
                      orgRoleInfo.color === 'green' && 'bg-green-100 text-green-700',
                      orgRoleInfo.color === 'gray' && 'bg-gray-100 text-gray-700'
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
          );
        })}

        {showCreateButton && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2">
              <CreateOrganizationDialog
                onSuccess={(newOrgId) => {
                  setOpen(false);
                  // Refresh organizations and switch to new one
                  refreshOrganizations().then(() => {
                    switchOrganization(newOrgId);
                  });
                }}
                trigger={
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Create Organization
                  </Button>
                }
              />
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Compact version for navigation sidebar
 * Note: showCreateButton defaults to true, super admin check happens inside OrganizationSwitcher
 */
export function OrganizationSwitcherCompact() {
  return <OrganizationSwitcher compact showCreateButton={true} />;
}

/**
 * Simple display-only organization indicator
 */
export function OrganizationIndicator({ className }: { className?: string }) {
  const { currentOrganization } = useOrganization();

  if (!currentOrganization) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center">
        <Building2 className="w-3.5 h-3.5" />
      </div>
      <span className="text-sm font-medium text-foreground truncate">
        {currentOrganization.name}
      </span>
    </div>
  );
}
