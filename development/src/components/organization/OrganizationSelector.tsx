'use client';

import { useState } from 'react';
import { useUser } from '@/lib/auth/user-context';
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, Crown, Shield, Settings } from 'lucide-react';

export function OrganizationSelector() {
  const { organizations, currentOrganization, switchOrganization, loading } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  if (loading || !currentOrganization) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>Loading...</span>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>No organizations</span>
      </div>
    );
  }

  const getRoleIcon = (role: string | null) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-3 w-3" />;
      case 'admin':
        return <Shield className="h-3 w-3" />;
      default:
        return <Users className="h-3 w-3" />;
    }
  };

  const getRoleBadgeVariant = (role: string | null) => {
    switch (role) {
      case 'owner':
        return 'default' as const;
      case 'admin':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Organization Selector */}
      <div className="flex-1">
        <Select 
          value={currentOrganization.organization_id} 
          onValueChange={switchOrganization}
        >
          <SelectTrigger className="w-full min-w-[200px]">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">{currentOrganization.organization.name}</span>
                <Badge 
                  variant={getRoleBadgeVariant(currentOrganization.role)} 
                  className="h-4 text-xs"
                >
                  {getRoleIcon(currentOrganization.role)}
                  <span className="ml-1 capitalize">{currentOrganization.role}</span>
                </Badge>
              </div>
            </div>
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.organization_id} value={org.organization_id}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{org.organization.name}</span>
                    {org.organization.description && (
                      <span className="text-xs text-muted-foreground">{org.organization.description}</span>
                    )}
                  </div>
                  <Badge 
                    variant={getRoleBadgeVariant(org.role)} 
                    className="ml-2"
                  >
                    {getRoleIcon(org.role)}
                    <span className="ml-1 capitalize">{org.role}</span>
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Organization Settings Quick Access */}
      {(currentOrganization.role === 'owner' || currentOrganization.role === 'admin') && (
        <Button
          variant="ghost" 
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="p-2"
        >
          <Settings className="h-4 w-4" />
        </Button>
      )}
      
      {/* Organization Info Card */}
      {isOpen && (
        <Card className="absolute top-12 right-0 z-50 w-80">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Organization Details</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsOpen(false)}
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {currentOrganization.organization.name}
                </div>
                {currentOrganization.organization.description && (
                  <div>
                    <span className="font-medium">Description:</span> {currentOrganization.organization.description}
                  </div>
                )}
                <div>
                  <span className="font-medium">Your Role:</span>{' '}
                  <Badge variant={getRoleBadgeVariant(currentOrganization.role)}>
                    {getRoleIcon(currentOrganization.role)}
                    <span className="ml-1 capitalize">{currentOrganization.role}</span>
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Slug:</span> {currentOrganization.organization.slug}
                </div>
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  <Badge variant={currentOrganization.organization.is_active ? 'default' : 'destructive'}>
                    {currentOrganization.organization.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}