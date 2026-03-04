'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ResellerTierEngineResult } from '@/types/reseller'

/**
 * Hook: useResellerTier
 * Fetches the current tier engine result for a reseller org.
 * Polls every 5 minutes or on manual refetch.
 */
export function useResellerTier(orgId: string | null) {
  const [data, setData] = useState<ResellerTierEngineResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const res = await window.fetch(
        `${supabaseUrl}/functions/v1/reseller-tier-engine?org_id=${orgId}`,
        {
          headers: {
            Authorization: `Bearer ${(await createClient().auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )
      const json = await res.json()
      if (json.success) setData(json.data)
      else setError(json.error ?? 'Failed to load tier data')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
