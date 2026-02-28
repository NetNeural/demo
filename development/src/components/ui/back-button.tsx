'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BackButtonProps {
  href?: string
  label?: string
}

/**
 * Reusable back-navigation button.
 * If `href` is provided, navigates to that route; otherwise uses router.back().
 */
export function BackButton({ href, label = 'Back' }: BackButtonProps) {
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => (href ? router.push(href) : router.back())}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  )
}
