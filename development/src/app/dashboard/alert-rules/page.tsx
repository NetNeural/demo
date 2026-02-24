'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { Plus, Power, PowerOff, Copy, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import type { AlertRule } from '@/lib/edge-functions/api/alert-rules'

export default function AlertRulesPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const { fmt } = useDateFormatter()
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'telemetry' | 'offline'>('all')
  const activeOrgRef = useRef<string | null>(null)

  useEffect(() => {
    if (currentOrganization) {
      activeOrgRef.current = currentOrganization.id
      fetchRules()
    }
  }, [currentOrganization, filter])

  const fetchRules = async () => {
    if (!currentOrganization) return
    const fetchOrgId = currentOrganization.id

    try {
      setLoading(true)
      const response = await edgeFunctions.alertRules.list(
        fetchOrgId,
        filter !== 'all' ? { rule_type: filter } : undefined
      )

      if (activeOrgRef.current !== fetchOrgId) return // org switched, discard stale data

      if (response.success && response.data) {
        setRules(response.data)
      } else {
        toast.error('Failed to load rules')
      }
    } catch (error) {
      if (activeOrgRef.current !== fetchOrgId) return
      console.error('Error loading rules:', error)
      toast.error('Failed to load rules')
    } finally {
      if (activeOrgRef.current === fetchOrgId) setLoading(false)
    }
  }

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await edgeFunctions.alertRules.toggle(ruleId, !enabled)

      if (response.success) {
        setRules((prev) =>
          prev.map((rule) =>
            rule.id === ruleId ? { ...rule, enabled: !enabled } : rule
          )
        )
        toast.success(`Rule ${!enabled ? 'enabled' : 'disabled'}`)
      } else {
        toast.error('Failed to toggle rule')
      }
    } catch (error) {
      console.error('Error toggling rule:', error)
      toast.error('Failed to toggle rule')
    }
  }

  const handleDuplicate = async (ruleId: string) => {
    try {
      const response = await edgeFunctions.alertRules.duplicate(ruleId)

      if (response.success) {
        toast.success('Rule duplicated')
        await fetchRules()
      } else {
        toast.error('Failed to duplicate rule')
      }
    } catch (error) {
      console.error('Error duplicating rule:', error)
      toast.error('Failed to duplicate rule')
    }
  }

  const handleDelete = async (ruleId: string, ruleName: string) => {
    if (!confirm(`Are you sure you want to delete the rule "${ruleName}"?`)) {
      return
    }

    try {
      const response = await edgeFunctions.alertRules.delete(ruleId)

      if (response.success) {
        setRules((prev) => prev.filter((rule) => rule.id !== ruleId))
        toast.success('Rule deleted')
      } else {
        toast.error('Failed to delete rule')
      }
    } catch (error) {
      console.error('Error deleting rule:', error)
      toast.error('Failed to delete rule')
    }
  }

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">
              Please select an organization from the sidebar to view alert rules
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={currentOrganization?.settings}
            name={currentOrganization?.name || 'NetNeural'}
            size="xl"
          />
          <div>
            <h1 className="text-3xl font-bold">
              {currentOrganization?.name
                ? `${currentOrganization.name} Alert Rules`
                : 'Alert Rules'}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Create automated rules to monitor your devices and trigger actions
            </p>
          </div>
        </div>
        <Button onClick={() => router.push('/dashboard/alert-rules/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Rule
        </Button>
      </div>

      <div className="flex space-x-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          All Rules
        </Button>
        <Button
          variant={filter === 'telemetry' ? 'default' : 'outline'}
          onClick={() => setFilter('telemetry')}
        >
          Telemetry Rules
        </Button>
        <Button
          variant={filter === 'offline' ? 'default' : 'outline'}
          onClick={() => setFilter('offline')}
        >
          Offline Detection
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-muted-foreground">No alert rules yet</p>
            <Button onClick={() => router.push('/dashboard/alert-rules/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-xl">{rule.name}</CardTitle>
                      <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <Badge variant="outline">
                        {rule.rule_type === 'telemetry'
                          ? 'Telemetry'
                          : 'Offline Detection'}
                      </Badge>
                    </div>
                    {rule.description && (
                      <CardDescription>{rule.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(rule.id, rule.enabled)}
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.enabled ? (
                        <PowerOff className="h-4 w-4" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(`/dashboard/alert-rules/${rule.id}/edit`)
                      }
                      title="Edit rule"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(rule.id)}
                      title="Duplicate rule"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rule.id, rule.name)}
                      title="Delete rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Device Scope</p>
                    <p className="font-medium">
                      {rule.device_scope.type === 'all'
                        ? 'All Devices'
                        : `${rule.device_scope.type} (${rule.device_scope.values?.length || 0})`}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Actions</p>
                    <p className="font-medium">
                      {rule.actions.length} configured
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cooldown</p>
                    <p className="font-medium">
                      {rule.cooldown_minutes} minutes
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Triggered</p>
                    <p className="font-medium">
                      {rule.last_triggered_at
                        ? fmt.dateTime(rule.last_triggered_at)
                        : 'Never'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
