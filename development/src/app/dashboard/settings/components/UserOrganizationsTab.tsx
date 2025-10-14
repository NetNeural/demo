'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getRoleDisplayInfo } from '@/types/organization';
import { Building2, Users, Smartphone, ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';

export function UserOrganizationsTab() {
  const { userOrganizations, switchOrganization } = useOrganization();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Your Organizations
              </CardTitle>
              <CardDescription>
                Organizations you are a member of. Click &ldquo;Manage&rdquo; to configure organization settings.
              </CardDescription>
            </div>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {userOrganizations.map((org) => {
              const roleInfo = getRoleDisplayInfo(org.role);
              
              return (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    {/* Organization Icon */}
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                      {org.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Organization Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{org.name}</h3>
                        <Badge 
                          variant="secondary"
                          className={`${roleInfo.color} text-white`}
                        >
                          {roleInfo.label}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {roleInfo.description}
                      </p>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Smartphone className="w-4 h-4" />
                          <span>{org.deviceCount || 0} devices</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{org.userCount || 0} members</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link href="/dashboard/organizations">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => switchOrganization(org.id)}
                      >
                        Manage
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {userOrganizations.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Organizations</h3>
              <p className="text-muted-foreground mb-4">
                You are not a member of any organizations yet.
              </p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Organization
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900">
                About Organizations
              </p>
              <p className="text-sm text-blue-800">
                Organizations allow you to group devices, users, and resources. You can be a member of multiple 
                organizations with different roles and permissions in each one. Use the organization switcher 
                in the sidebar to change between your organizations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
