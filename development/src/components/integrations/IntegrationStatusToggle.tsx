'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface IntegrationStatusToggleProps {
  status: 'active' | 'inactive' | 'not-configured'
  onStatusChange: (status: 'active' | 'inactive' | 'not-configured') => void
  disabled?: boolean
  disabledMessage?: string
}

export function IntegrationStatusToggle({
  status,
  onStatusChange,
  disabled = false,
  disabledMessage = 'Configure required fields to enable'
}: IntegrationStatusToggleProps) {
  return (
    <div className="flex items-center justify-between pt-4 pb-4 border-t border-b bg-gray-50 dark:bg-gray-50 p-4 rounded-lg">
      <div className="space-y-0.5">
        <Label htmlFor="status-toggle" className="text-gray-900">Integration Status</Label>
        <p className="text-sm text-gray-600">
          {status === 'active' 
            ? 'Integration is active' 
            : status === 'inactive' 
            ? 'Integration is configured but inactive' 
            : disabledMessage}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold ${status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
          {status === 'active' ? 'Active' : 'Inactive'}
        </span>
        <Switch
          id="status-toggle"
          checked={status === 'active'}
          onCheckedChange={(checked) => 
            onStatusChange(checked ? 'active' : 'inactive')
          }
          disabled={disabled}
          className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-400"
        />
      </div>
    </div>
  )
}
