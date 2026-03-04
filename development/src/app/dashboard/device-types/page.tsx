/**
 * Device Types Page — redirects to Hardware Provisioning (Device Types tab)
 * Kept for backward compatibility / bookmarks.
 */
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function DeviceTypesPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/hardware-provisioning')
  }, [router])

  return (
    <div className="flex-1 p-8">
      <LoadingSpinner />
    </div>
  )
}
