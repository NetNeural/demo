'use client'

// Story #270: This route is deprecated â€” redirect to consolidated /dashboard/devices/view
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function DeviceDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DeviceDetailsRedirect />
    </Suspense>
  )
}

function DeviceDetailsRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const deviceId = searchParams.get('id')
    if (deviceId) {
      router.replace(`/dashboard/devices/view?id=${deviceId}&tab=overview`)
    } else {
      router.replace('/dashboard/devices')
    }
  }, [router, searchParams])

  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
