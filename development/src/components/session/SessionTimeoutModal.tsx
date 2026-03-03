'use client'

/**
 * SessionTimeoutModal
 *
 * Shown when the user has been idle for (IDLE_MINUTES - 2 minutes).
 * Gives the user a chance to extend their session or sign out manually.
 * Auto-signs-out when countdown reaches 0 (handled by useSessionTimeout).
 */

import { useEffect, useRef } from 'react'
import { Clock, LogOut, RefreshCw } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface SessionTimeoutModalProps {
  open: boolean
  secondsRemaining: number
  totalWarningSeconds?: number
  onExtend: () => void
  onSignOut: () => void
}

export function SessionTimeoutModal({
  open,
  secondsRemaining,
  totalWarningSeconds = 120,
  onExtend,
  onSignOut,
}: SessionTimeoutModalProps) {
  const extendRef = useRef<HTMLButtonElement>(null)

  // Auto-focus the "Stay logged in" button when the modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => extendRef.current?.focus(), 50)
    }
  }, [open])

  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60
  const timeLabel =
    minutes > 0
      ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
      : `${secondsRemaining}s`

  const progress = Math.round((secondsRemaining / totalWarningSeconds) * 100)

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <AlertDialogTitle>Your session is about to expire</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              You&apos;ve been inactive for a while. For your security, you will
              be automatically signed out in:
            </p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                  {timeLabel}
                </span>
                <span className="text-xs text-muted-foreground">remaining</span>
              </div>
              <Progress
                value={progress}
                className="h-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Click &quot;Stay logged in&quot; to continue your session.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onSignOut}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign out now
          </Button>
          <Button
            ref={extendRef}
            onClick={onExtend}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Stay logged in
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
