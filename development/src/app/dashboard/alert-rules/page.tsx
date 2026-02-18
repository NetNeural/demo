'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/contexts/OrganizationContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Plus, Power, PowerOff, Copy, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import type { AlertRule } from '@/lib/edge-functions/api/alert-rules'

export default function AlertRulesPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'telemetry' | 'offline'>('all')

  useEffect(() => {
    if (currentOrganization) {
      fetchRules()
    }
  }, [currentOrganization, filter])

  const fetchRules = async () => {
    if (!currentOrganization) return

    try {
      setLoading(true)
      const response = await edgeFunctions.alertRules.list(
        currentOrganization.id,
        filter !== 'all' ? { rule_type: filter } : undefined
      )

      if (response.success && response.data) {
        setRules(response.data)
      } else {
        toast.error('Failed to load rules')
      }
    } catch (error) {
      console.error('Error loading rules:', error)
      toast.error('Failed to load rules')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await edgeFunctions.alertRules.toggle(ruleId, !enabled)
      
      if (response.success) {
        setRules((prev) =>
          prev.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !enabled } : rule))
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{currentOrganization?.name ? `${currentOrganization.name} Alert Rules` : 'Alert Rules'}</h1>
          <p className="text-muted-foreground mt-1">
            Create automated rules to monitor your devices and trigger actions
          </p>
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
            <p className="text-muted-foreground mb-4">No alert rules yet</p>
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
                        {rule.rule_type === 'telemetry' ? 'Telemetry' : 'Offline Detection'}
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
                      onClick={() => router.push(`/dashboard/alert-rules/${rule.id}/edit`)}
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                    <p className="font-medium">{rule.actions.length} configured</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cooldown</p>
                    <p className="font-medium">{rule.cooldown_minutes} minutes</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Triggered</p>
                    <p className="font-medium">
                      {rule.last_triggered_at
                        ? new Date(rule.last_triggered_at).toLocaleString()
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
