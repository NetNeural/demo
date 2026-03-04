'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  Circle,
  ChevronRight,
  X,
  Smartphone,
  Bell,
  Settings,
  BarChart3,
  Building2,
  BookOpen,
} from 'lucide-react'

const DISMISS_KEY = 'onboarding_dismissed_v1'
const CHECKED_KEY = 'onboarding_steps_v1'

interface OnboardingStep {
  id: string
  icon: React.ElementType
  title: string
  description: string
  href: string
  cta: string
}

const STEPS: OnboardingStep[] = [
  {
    id: 'org_setup',
    icon: Building2,
    title: 'Configure your organization',
    description:
      'Add your logo, set your timezone, and customize your organization profile.',
    href: '/dashboard/organizations',
    cta: 'Go to Organization Settings',
  },
  {
    id: 'add_device',
    icon: Smartphone,
    title: 'Add your first device',
    description: 'Connect a sensor or IoT device to start monitoring.',
    href: '/dashboard/hardware-provisioning',
    cta: 'Add a Device',
  },
  {
    id: 'create_alert',
    icon: Bell,
    title: 'Set up a threshold alert',
    description: 'Get notified when sensor readings go out of range.',
    href: '/dashboard/alerts',
    cta: 'Create an Alert',
  },
  {
    id: 'view_analytics',
    icon: BarChart3,
    title: 'Explore AI Analytics',
    description: 'See trends, anomalies, and insights from your device data.',
    href: '/dashboard/analytics',
    cta: 'View Analytics',
  },
  {
    id: 'run_report',
    icon: BarChart3,
    title: 'Generate your first report',
    description: 'Export sensor data and share reports with your team.',
    href: '/dashboard/reports',
    cta: 'Go to Reports',
  },
  {
    id: 'read_docs',
    icon: BookOpen,
    title: 'Explore the documentation',
    description: 'Find guides, API references, and integration tutorials.',
    href: 'https://docs.netneural.ai',
    cta: 'Open Docs',
  },
]

export function OnboardingChecklist() {
  const router = useRouter()
  const [dismissed, setDismissed] = useState<boolean>(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const d = localStorage.getItem(DISMISS_KEY)
      if (d === '1') setDismissed(true)
      const c = localStorage.getItem(CHECKED_KEY)
      if (c) setChecked(JSON.parse(c))
    } catch {
      /* ignore */
    }
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const markDone = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(CHECKED_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  // Don't render until mounted (avoids SSR hydration mismatch)
  if (!mounted || dismissed) return null

  const doneCount = STEPS.filter((s) => checked[s.id]).length
  const allDone = doneCount === STEPS.length

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">
              {allDone ? '🎉 Setup Complete!' : 'Get started with Sentinel'}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {doneCount}/{STEPS.length} done
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {allDone ? (
          <p className="text-sm text-muted-foreground">
            You&apos;ve completed the setup. Your platform is ready to use.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Complete these steps to get the most out of your new account.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon
            const done = !!checked[step.id]
            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                  done
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <button
                  className="mt-0.5 flex-shrink-0"
                  onClick={() => markDone(step.id)}
                  aria-label={done ? 'Mark as not done' : 'Mark as done'}
                >
                  {done ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium leading-tight ${done ? 'text-muted-foreground line-through' : ''}`}
                  >
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
                    {step.description}
                  </p>
                  {!done && (
                    <button
                      className="mt-1.5 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        if (step.href.startsWith('http')) {
                          window.open(step.href, '_blank')
                        } else {
                          router.push(step.href)
                        }
                      }}
                    >
                      {step.cta}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {allDone && (
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={dismiss}>
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
