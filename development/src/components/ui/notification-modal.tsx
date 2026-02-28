'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'

interface NotificationModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  autoClose?: number // Auto close after X seconds
}

const iconMap = {
  error: <XCircle className="h-6 w-6 text-red-500" />,
  warning: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
  info: <Info className="h-6 w-6 text-blue-500" />,
  success: <CheckCircle className="h-6 w-6 text-green-500" />,
}

const colorMap = {
  error: 'text-red-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
  success: 'text-green-600',
}

export function NotificationModal({
  isOpen,
  onClose,
  type,
  title,
  message,
  autoClose,
}: NotificationModalProps) {
  const [timeLeft, setTimeLeft] = useState(autoClose || 0)

  useEffect(() => {
    if (autoClose && isOpen && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)

      return () => clearTimeout(timer)
    } else if (autoClose && isOpen && timeLeft === 0) {
      onClose()
    }
    return undefined
  }, [autoClose, isOpen, timeLeft, onClose])

  useEffect(() => {
    if (isOpen && autoClose) {
      setTimeLeft(autoClose)
    }
  }, [isOpen, autoClose])

  const handleClose = () => {
    setTimeLeft(0)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            {iconMap[type]}
            <DialogTitle className={colorMap[type]}>{title}</DialogTitle>
          </div>
          <DialogDescription className="mt-3 text-sm text-gray-600">
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex justify-end space-x-2">
          {autoClose && timeLeft > 0 && (
            <span className="flex items-center text-xs text-gray-500">
              Auto-closing in {timeLeft}s
            </span>
          )}
          <Button onClick={handleClose} variant="outline">
            {type === 'error' ? 'Try Again' : 'OK'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook for managing notification state
export function useNotificationModal() {
  const [notification, setNotification] = useState<{
    isOpen: boolean
    type: 'error' | 'warning' | 'info' | 'success'
    title: string
    message: string
    autoClose?: number
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  })

  const showNotification = (
    type: 'error' | 'warning' | 'info' | 'success',
    title: string,
    message: string,
    autoClose?: number
  ) => {
    const notificationData: {
      isOpen: boolean
      type: 'error' | 'warning' | 'info' | 'success'
      title: string
      message: string
      autoClose?: number
    } = {
      isOpen: true,
      type,
      title,
      message,
    }

    if (autoClose !== undefined) {
      notificationData.autoClose = autoClose
    }

    setNotification(notificationData)
  }

  const hideNotification = () => {
    setNotification((prev) => ({ ...prev, isOpen: false }))
  }

  return {
    notification,
    showNotification,
    hideNotification,
  }
}
