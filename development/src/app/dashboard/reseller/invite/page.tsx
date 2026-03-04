'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ResellerInvitePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/reseller?tab=invites')
  }, [router])
  return <div className="p-6 text-muted-foreground">Redirecting…</div>
}
