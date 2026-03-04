'use client'

/**
 * useSessionTimeout
 *
 * SOC 2 CC6.2 — Idle session invalidation.
 *
 * After IDLE_MINUTES of no user activity the user is automatically signed out
 * and redirected to the login page with `?reason=session_timeout`.
 * A warning modal appears WARNING_SECONDS before that deadline so the user can
 * extend the session.
 *
 * Activity events: mousemove, keydown, click, scroll, touchstart.
 * Tab-safe: last-activity is persisted in sessionStorage so other open tabs
 * reset the timer for the current tab too.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const IDLE_MINUTES = 30
const WARNING_SECONDS = 120 // show warning 2 min before expiry

const IDLE_MS = IDLE_MINUTES * 60 * 1000
const WARNING_MS = WARNING_SECONDS * 1000
const ACTIVITY_KEY = 'nn_last_activity'
const ACTIVITY_EVENTS = [
  'mousemove',
  'keydown',
  'click',
  'scroll',
  'touchstart',
]

export interface SessionTimeoutState {
  showWarning: boolean
  secondsRemaining: number
  extendSession: () => void
  signOutNow: () => void
}

export function useSessionTimeout(): SessionTimeoutState {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(WARNING_SECONDS)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const checkRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const supabase = createClient()

  const resetActivity = useCallback(() => {
    sessionStorage.setItem(ACTIVITY_KEY, Date.now().toString())
    setShowWarning(false)
  }, [])

  const signOutNow = useCallback(async () => {
    // Log to audit trail before signing out
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('user_audit_log').insert({
          user_id: user.id,
          user_email: user.email ?? '',
          action_category: 'auth',
          action_type: 'session_timeout',
          resource_type: 'session',
          method: 'SYSTEM',
          endpoint: '/dashboard',
          status: 'success',
          changes: { reason: 'idle_timeout', idle_minutes: IDLE_MINUTES },
        })
      }
    } catch {
      // Non-critical — don't block sign-out
    }
    await supabase.auth.signOut()
    router.push('/auth/login?reason=session_timeout')
  }, [supabase, router])

  const extendSession = useCallback(() => {
    resetActivity()
  }, [resetActivity])

  // Attach activity listeners
  useEffect(() => {
    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, resetActivity, { passive: true })
    })
    resetActivity() // stamp current time on mount

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, resetActivity)
      })
    }
  }, [resetActivity])

  // Poll every second: check idleness
  useEffect(() => {
    checkRef.current = setInterval(() => {
      const stored = sessionStorage.getItem(ACTIVITY_KEY)
      // If no timestamp stored yet, treat user as active right now
      const last = stored ? parseInt(stored, 10) : Date.now()
      const idleMs = Date.now() - last
      const remaining = IDLE_MS - idleMs

      if (remaining <= 0) {
        // Time's up
        clearInterval(checkRef.current!)
        clearInterval(tickRef.current!)
        signOutNow()
        return
      }

      if (remaining <= WARNING_MS) {
        setShowWarning(true)
        setSecondsRemaining(Math.ceil(remaining / 1000))
      } else {
        setShowWarning(false)
      }
    }, 1000)

    return () => {
      if (checkRef.current) clearInterval(checkRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [signOutNow])

  return { showWarning, secondsRemaining, extendSession, signOutNow }
}
