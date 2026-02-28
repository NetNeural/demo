'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, Loader2 } from 'lucide-react'

export type AcknowledgementType =
  | 'acknowledged'
  | 'resolved'
  | 'dismissed'
  | 'false_positive'

interface AcknowledgeAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  alertTitle?: string
  onConfirm: (type: AcknowledgementType, notes: string) => Promise<void>
}

const ACKNOWLEDGEMENT_OPTIONS: {
  value: AcknowledgementType
  label: string
  description: string
}[] = [
  {
    value: 'acknowledged',
    label: 'Acknowledged',
    description: 'Alert seen and noted — monitoring continues',
  },
  {
    value: 'resolved',
    label: 'Resolved',
    description: 'Issue has been fixed — no further action needed',
  },
  {
    value: 'dismissed',
    label: 'Dismissed',
    description: 'Alert is not actionable at this time',
  },
  {
    value: 'false_positive',
    label: 'False Positive',
    description: 'This alert was triggered incorrectly',
  },
]

export function AcknowledgeAlertDialog({
  open,
  onOpenChange,
  alertTitle,
  onConfirm,
}: AcknowledgeAlertDialogProps) {
  const [type, setType] = useState<AcknowledgementType>('acknowledged')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!notes.trim()) return
    setIsSubmitting(true)
    try {
      await onConfirm(type, notes.trim())
      // Reset form
      setType('acknowledged')
      setNotes('')
      onOpenChange(false)
    } catch {
      // Error handling is done by the parent
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setType('acknowledged')
    setNotes('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Acknowledge Alert
          </DialogTitle>
          <DialogDescription>
            {alertTitle ? (
              <>
                Provide resolution details for: <strong>{alertTitle}</strong>
              </>
            ) : (
              'Provide resolution details for this alert'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resolution Type */}
          <div className="space-y-2">
            <Label htmlFor="ack-type">Resolution Type *</Label>
            <Select
              value={type}
              onValueChange={(val) => setType(val as AcknowledgementType)}
            >
              <SelectTrigger id="ack-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACKNOWLEDGEMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <span className="font-medium">{opt.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resolution Notes */}
          <div className="space-y-2">
            <Label htmlFor="ack-notes">Resolution Notes *</Label>
            <Textarea
              id="ack-notes"
              placeholder="Describe what was done to resolve this alert, root cause, or why it's being dismissed..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              This will be recorded in the user audit log for compliance
              tracking.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !notes.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Confirm Acknowledgement'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
