'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Client-side redirect for static export compatibility
    router.replace('/dashboard')
  }, [router])

  // Show loading state during redirect
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p>Redirecting to dashboard...</p>
      </div>
    </div>
  )
}
