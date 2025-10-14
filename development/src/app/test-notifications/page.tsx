'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationModal, useNotificationModal } from '@/components/ui/notification-modal'

export default function TestNotificationPage() {
  const { notification, showNotification, hideNotification } = useNotificationModal()

  const triggerAuthError = () => {
    showNotification(
      'error',
      'Authentication Error',
      'No authenticated user found. Please try logging in again.',
      10 // Auto-close after 10 seconds
    )
  }

  const triggerProfileError = () => {
    showNotification(
      'error',
      'Profile Creation Failed',
      'Unable to create your user profile. This may be a temporary issue. Please try refreshing the page or contact support if the problem persists.',
      15 // Auto-close after 15 seconds
    )
  }

  const triggerOrgError = () => {
    showNotification(
      'error',
      'Organization Access Failed',
      'Unable to assign you to the default organization. Please contact your administrator for assistance.',
      20 // Auto-close after 20 seconds
    )
  }

  const triggerWarning = () => {
    showNotification(
      'warning',
      'Organization Assignment Issue',
      'There was an issue setting up your organization access. Please contact support if you experience any problems.',
      15 // Auto-close after 15 seconds
    )
  }

  const triggerSuccess = () => {
    showNotification(
      'success',
      'Success!',
      'Operation completed successfully.',
      5 // Auto-close after 5 seconds
    )
  }

  const triggerInfo = () => {
    showNotification(
      'info',
      'Information',
      'This is an informational message.',
      8 // Auto-close after 8 seconds
    )
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Modal Test</CardTitle>
          <CardDescription>
            Test different types of notification modals that replace console errors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={triggerAuthError} variant="destructive">
              Test Auth Error
            </Button>
            <Button onClick={triggerProfileError} variant="destructive">
              Test Profile Error
            </Button>
            <Button onClick={triggerOrgError} variant="destructive">
              Test Organization Error
            </Button>
            <Button onClick={triggerWarning} variant="outline">
              Test Warning
            </Button>
            <Button onClick={triggerSuccess} variant="default">
              Test Success
            </Button>
            <Button onClick={triggerInfo} variant="secondary">
              Test Info
            </Button>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Test Scenarios:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• <strong>Auth Error:</strong> Simulates &quot;No authenticated user found&quot; scenario</li>
              <li>• <strong>Profile Error:</strong> Simulates profile creation failure</li>
              <li>• <strong>Organization Error:</strong> Simulates organization assignment failure</li>
              <li>• <strong>Warning:</strong> Simulates organization setup issues</li>
              <li>• <strong>Success:</strong> Shows success notification</li>
              <li>• <strong>Info:</strong> Shows informational notification</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <NotificationModal
        isOpen={notification.isOpen}
        onClose={hideNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        {...(notification.autoClose !== undefined && { autoClose: notification.autoClose })}
      />
    </div>
  )
}