'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useOrganization } from '@/contexts/OrganizationContext'
import { getRoleDisplayInfo } from '@/types/organization'
import { Building2, Users, Smartphone, ArrowRight, Plus } from 'lucide-react'
import Link from 'next/link'

export function UserOrganizationsTab() {
  const { userOrganizations, switchOrganization } = useOrganization()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Your Organizations
              </CardTitle>
              <CardDescription>
                Organizations you are a member of. Click &ldquo;Manage&rdquo; to
                configure organization settings.
              </CardDescription>
            </div>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {userOrganizations.map((org) => {
              const roleInfo = getRoleDisplayInfo(org.role)

              return (
                <div
                  key={org.id}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex flex-1 items-start gap-4">
                    {/* Organization Logo / Icon */}
                    {org.settings?.branding?.logo_url ? (
                      <img
                        src={org.settings.branding.logo_url}
                        alt={`${org.name} logo`}
                        className="h-12 w-12 flex-shrink-0 rounded-lg object-contain"
                      />
                    ) : (
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-bold text-white">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Organization Info */}
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{org.name}</h3>
                        <Badge
                          variant="secondary"
                          className={`${roleInfo.color} text-white`}
                        >
                          {roleInfo.label}
                        </Badge>
                      </div>

                      <p className="mb-2 text-sm text-muted-foreground">
                        {roleInfo.description}
                      </p>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Smartphone className="h-4 w-4" />
                          <span>{org.deviceCount || 0} devices</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
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
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {userOrganizations.length === 0 && (
            <div className="py-12 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No Organizations</h3>
              <p className="mb-4 text-muted-foreground">
                You are not a member of any organizations yet.
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Organization
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Building2 className="mt-0.5 h-5 w-5 text-blue-600" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900">
                About Organizations
              </p>
              <p className="text-sm text-blue-800">
                Organizations allow you to group devices, users, and resources.
                You can be a member of multiple organizations with different
                roles and permissions in each one. Use the organization switcher
                in the sidebar to change between your organizations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
