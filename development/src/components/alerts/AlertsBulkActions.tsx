'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, X } from 'lucide-react'

interface AlertsBulkActionsProps {
  selectedCount: number
  onAcknowledgeSelected: () => void
  onClearSelection: () => void
  isProcessing?: boolean
}

export function AlertsBulkActions({
  selectedCount,
  onAcknowledgeSelected,
  onClearSelection,
  isProcessing = false,
}: AlertsBulkActionsProps) {
  if (selectedCount === 0) return null

  return (
    <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-blue-900 dark:text-blue-100">
              {selectedCount} alert{selectedCount !== 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="default"
              size="sm"
              onClick={onAcknowledgeSelected}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Acknowledge Selected'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isProcessing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
