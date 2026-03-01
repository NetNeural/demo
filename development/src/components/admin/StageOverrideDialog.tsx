'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertTriangle, ArrowRightLeft } from 'lucide-react'
import type { LifecycleStage } from '@/types/billing'
import { formatLifecycleStage } from '@/types/billing'

interface StageOverrideDialogProps {
  currentStage: LifecycleStage
  orgName: string
  onOverride: (toStage: LifecycleStage, reason: string) => Promise<void>
}

const ALL_STAGES: LifecycleStage[] = ['trial', 'onboarding', 'active', 'at_risk', 'churned', 'reactivated']

export function StageOverrideDialog({ currentStage, orgName, onOverride }: StageOverrideDialogProps) {
  const [open, setOpen] = useState(false)
  const [toStage, setToStage] = useState<LifecycleStage | ''>('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableStages = ALL_STAGES.filter(s => s !== currentStage)

  async function handleSubmit() {
    if (!toStage || !reason.trim()) {
      setError('Please select a stage and provide a reason.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onOverride(toStage, reason.trim())
      setOpen(false)
      setToStage('')
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stage')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Override Stage
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Manual Stage Override
          </DialogTitle>
          <DialogDescription>
            Change the lifecycle stage for <strong>{orgName}</strong>. This action
            will be logged with your name and reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current stage */}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Current stage</p>
            <p className="text-sm font-semibold">{formatLifecycleStage(currentStage)}</p>
          </div>

          {/* Target stage */}
          <div className="space-y-2">
            <Label htmlFor="target-stage">New Stage</Label>
            <Select
              value={toStage}
              onValueChange={(v) => setToStage(v as LifecycleStage)}
            >
              <SelectTrigger id="target-stage">
                <SelectValue placeholder="Select target stage..." />
              </SelectTrigger>
              <SelectContent>
                {availableStages.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatLifecycleStage(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="override-reason">Reason (required)</Label>
            <Textarea
              id="override-reason"
              placeholder="Explain why this stage change is needed..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !toStage || !reason.trim()}>
            {submitting ? 'Updating...' : 'Confirm Override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
