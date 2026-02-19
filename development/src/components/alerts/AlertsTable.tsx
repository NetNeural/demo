'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDateFormatter } from '@/hooks/useDateFormatter'

export interface Alert {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  device: string
  timestamp: string
  acknowledged: boolean
}

interface AlertsTableProps {
  alerts: Alert[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onAcknowledge: (id: string) => void
  onViewDetails: (alert: Alert) => void
}

export function AlertsTable({
  alerts,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onAcknowledge,
  onViewDetails
}: AlertsTableProps) {
  const { fmt } = useDateFormatter()
  const allSelected = alerts.length > 0 && alerts.every(a => selectedIds.has(a.id))
  const someSelected = alerts.some(a => selectedIds.has(a.id)) && !allSelected

  const getSeverityBadge = (severity: Alert['severity']) => {
    const variants = {
      critical: 'destructive',
      high: 'outline',
      medium: 'outline',
      low: 'outline'
    } as const

    const colors = {
      critical: '',
      high: 'border-orange-500 text-orange-700 dark:text-orange-400',
      medium: 'border-yellow-500 text-yellow-700 dark:text-yellow-400',
      low: 'border-blue-500 text-blue-700 dark:text-blue-400'
    }

    return (
      <Badge variant={variants[severity]} className={colors[severity]}>
        {severity.toUpperCase()}
      </Badge>
    )
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      temperature: '🌡️',
      connectivity: '📡',
      battery: '🔋',
      vibration: '📳',
      security: '🔒',
      system: '💻'
    }
    return icons[category] || '⚙️'
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleSelectAll}
                aria-label="Select all"
                className={someSelected ? 'data-[state=checked]:bg-blue-600' : ''}
              />
            </TableHead>
            <TableHead className="w-24">Severity</TableHead>
            <TableHead className="w-20">Type</TableHead>
            <TableHead>Alert</TableHead>
            <TableHead>Device</TableHead>
            <TableHead className="w-32">Time</TableHead>
            <TableHead className="w-40">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No alerts found
              </TableCell>
            </TableRow>
          ) : (
            alerts.map((alert) => (
              <TableRow 
                key={alert.id}
                className={selectedIds.has(alert.id) ? 'bg-blue-50 dark:bg-blue-950' : ''}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(alert.id)}
                    onCheckedChange={() => onToggleSelect(alert.id)}
                    aria-label={`Select alert ${alert.id}`}
                  />
                </TableCell>
                <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                <TableCell className="text-2xl">{getCategoryIcon(alert.category)}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-sm text-muted-foreground line-clamp-1">
                      {alert.description}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{alert.device}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {fmt.timeAgo(alert.timestamp)}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    {!alert.acknowledged && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAcknowledge(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(alert)}
                    >
                      Details
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
