'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Settings, Trash2, AlertTriangle } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { ConflictResolutionDialog } from '@/components/integrations/ConflictResolutionDialog'
import { edgeFunctions } from '@/lib/edge-functions'
import { integrationSyncService } from '@/services/integration-sync.service'
import { toast } from 'sonner'

interface Integration {
  id: string
  name: string
  integration_type: string
  status: string | null
  created_at: string
  last_sync_at?: string | null
  last_sync_status?: string | null
}

export default function IntegrationsPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const { fmt } = useDateFormatter()

  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [pendingConflicts, setPendingConflicts] = useState(0)

  const loadIntegrations = useCallback(async () => {
    if (!currentOrganization) return

    setLoading(true)
    try {
      const response = await edgeFunctions.integrations.list(
        currentOrganization.id
      )

      if (!response.success) {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to load integrations'
        )
      }

      const allIntegrations = (response.data as any)?.integrations || []
      // Map all integrations
      const mappedIntegrations = allIntegrations.map((i: any) => ({
        id: i.id,
        name: i.name,
        integration_type: i.type || i.integrationType,
        status: i.status,
        created_at: i.createdAt || i.created_at,
        last_sync_at: i.lastSyncAt || i.last_sync_at,
        last_sync_status: i.lastSyncStatus || i.last_sync_status,
      }))

      setIntegrations(mappedIntegrations)
    } catch (error) {
      console.error('Failed to load integrations:', error)
      toast.error('Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  const loadPendingConflicts = useCallback(async () => {
    if (!currentOrganization) return

    try {
      const conflicts = await integrationSyncService.getPendingConflicts(
        currentOrganization.id
      )
      setPendingConflicts(conflicts.length)
    } catch (error) {
      console.error('Failed to load conflicts:', error)
    }
  }, [currentOrganization])

  useEffect(() => {
    if (currentOrganization?.id) {
      loadIntegrations()
      loadPendingConflicts()
    }
  }, [currentOrganization?.id, loadIntegrations, loadPendingConflicts])

  const handleEdit = (integration: Integration) => {
    if (!currentOrganization) return
    router.push(
      `/dashboard/integrations/view?id=${integration.id}&organizationId=${currentOrganization.id}&type=${integration.integration_type}`
    )
  }

  const handleAdd = () => {
    if (!currentOrganization) return
    // Navigate to integration type selector via settings page
    router.push(`/dashboard/organizations?tab=integrations&action=add`)
  }

  const handleDelete = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return

    try {
      const response = await edgeFunctions.integrations.delete(integrationId)

      if (!response.success) {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to delete integration'
        )
      }

      toast.success('Integration deleted successfully')
      loadIntegrations()
    } catch (error) {
      console.error('Failed to delete integration:', error)
      toast.error('Failed to delete integration')
    }
  }

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">
              Please select an organization from the sidebar to manage
              integrations
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={currentOrganization.settings}
            name={currentOrganization.name}
            size="xl"
          />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {currentOrganization.name} Integrations
            </h2>
            <p className="text-muted-foreground">
              Manage platform integrations for {currentOrganization.name}
            </p>
          </div>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </div>

      {/* Pending Conflicts Alert */}
      {pendingConflicts > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-amber-900 dark:text-amber-100">
                  Pending Conflicts
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConflictOpen(true)}
              >
                Resolve Conflicts
              </Button>
            </div>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              {pendingConflicts} device conflict
              {pendingConflicts > 1 ? 's' : ''} need
              {pendingConflicts === 1 ? 's' : ''} resolution
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Integrations List */}
      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : integrations.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3 text-center">
                <p className="text-muted-foreground">
                  No integrations configured
                </p>
                <Button onClick={handleAdd} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Integration
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          integrations.map((integration) => (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{integration.name}</CardTitle>
                      <Badge
                        variant={
                          integration.status === 'active'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {integration.status === 'active'
                          ? 'Active'
                          : integration.status || 'Inactive'}
                      </Badge>
                    </div>
                    <CardDescription>
                      {integration.last_sync_at ? (
                        <>
                          Last synced: {fmt.dateTime(integration.last_sync_at)}
                          {integration.last_sync_status && (
                            <Badge
                              variant={
                                integration.last_sync_status === 'completed'
                                  ? 'default'
                                  : 'destructive'
                              }
                              className="ml-2"
                            >
                              {integration.last_sync_status}
                            </Badge>
                          )}
                        </>
                      ) : (
                        'Never synced'
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(integration)}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Configure
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(integration.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      {/* Dialogs */}
      {currentOrganization && (
        <ConflictResolutionDialog
          open={conflictOpen}
          onOpenChange={setConflictOpen}
          organizationId={currentOrganization.id}
          onResolved={() => {
            loadPendingConflicts()
            setConflictOpen(false)
          }}
        />
      )}
    </div>
  )
}
