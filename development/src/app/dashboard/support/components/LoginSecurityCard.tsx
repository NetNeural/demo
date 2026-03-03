'use client'

/**
 * LoginSecurityCard
 *
 * SOC 2 CC7.2 — Visible to super_admins in Support → Admin Tools → Security.
 * Shows recent failed login attempts, active account lockouts, and allows
 * super_admins to manually unlock locked accounts.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ShieldAlert, Unlock, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface LoginAttempt {
  id: string
  user_email: string
  ip_address: string | null
  user_agent: string | null
  success: boolean
  failure_reason: string | null
  attempted_at: string
}

interface AccountLockout {
  id: string
  user_email: string
  locked_at: string
  locked_until: string
  reason: string
  attempt_count: number
  unlocked_at: string | null
}

interface SecurityData {
  attempts: LoginAttempt[]
  lockouts: AccountLockout[]
}

export function LoginSecurityCard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [data, setData] = useState<SecurityData | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      const { data: raw, error } = await supabase.functions.invoke('auth-monitor', {
        body: { event: 'LIST_ATTEMPTS' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (error) throw error
      setData(raw?.data ?? { attempts: [], lockouts: [] })
    } catch (e) {
      console.error('[LoginSecurityCard]', e)
      toast.error('Failed to load login security data')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleUnlock = async (email: string) => {
    setUnlocking(email)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { error } = await supabase.functions.invoke('auth-monitor', {
        body: { event: 'UNLOCK', email },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (error) throw error
      toast.success(`Account ${email} unlocked`)
      await loadData()
    } catch (e) {
      console.error('[LoginSecurityCard] unlock error', e)
      toast.error('Failed to unlock account')
    } finally {
      setUnlocking(null)
    }
  }

  const activeLockouts = data?.lockouts.filter(
    (l) => !l.unlocked_at && new Date(l.locked_until) > new Date()
  ) ?? []

  const recentFailures = data?.attempts.filter((a) => !a.success).slice(0, 20) ?? []

  return (
    <div className="space-y-6">
      {/* Active Lockouts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <CardTitle className="text-base">Active Account Lockouts</CardTitle>
            </div>
            <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Accounts locked due to repeated failed login attempts (5 failures in 10 min → 30 min lockout)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : activeLockouts.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              No active lockouts
            </div>
          ) : (
            <div className="space-y-2">
              {activeLockouts.map((lockout) => (
                <div
                  key={lockout.id}
                  className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{lockout.user_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {lockout.attempt_count} failures · locked{' '}
                      {formatDistanceToNow(new Date(lockout.locked_at), { addSuffix: true })} ·
                      expires {formatDistanceToNow(new Date(lockout.locked_until), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnlock(lockout.user_email)}
                    disabled={unlocking === lockout.user_email}
                  >
                    {unlocking === lockout.user_email ? (
                      <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Unlock className="mr-1 h-4 w-4" />
                    )}
                    Unlock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Failed Attempts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Recent Failed Login Attempts</CardTitle>
          </div>
          <CardDescription>Last 20 failed authentication attempts across all users</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentFailures.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              No failed attempts recorded
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Reason</th>
                    <th className="pb-2 pr-4 font-medium">IP</th>
                    <th className="pb-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentFailures.map((attempt) => (
                    <tr key={attempt.id} className="py-1.5">
                      <td className="py-1.5 pr-4 font-medium">{attempt.user_email}</td>
                      <td className="py-1.5 pr-4">
                        <Badge variant="destructive" className="text-xs">
                          {attempt.failure_reason ?? 'unknown'}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-4 font-mono text-muted-foreground">
                        {attempt.ip_address ?? '—'}
                      </td>
                      <td className="py-1.5 text-muted-foreground">
                        {formatDistanceToNow(new Date(attempt.attempted_at), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
