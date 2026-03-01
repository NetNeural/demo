'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { ARAgingReport } from '@/components/admin/ARAgingReport'
import { PaymentFailureReport } from '@/components/admin/PaymentFailureReport'
import { TaxSummaryReport } from '@/components/admin/TaxSummaryReport'
import {
  fetchARAgingReport,
  fetchPaymentFailureReport,
  fetchTaxSummaryReport,
  arAgingToCsv,
  paymentFailureToCsv,
  taxSummaryToCsv,
} from '@/lib/admin/financial-report-queries'
import type {
  ARAgingSummary,
  PaymentFailureReport as PaymentFailureData,
  TaxSummaryReport as TaxSummaryData,
} from '@/lib/admin/financial-report-queries'
import { Download, RefreshCw } from 'lucide-react'

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

type TabKey = 'ar-aging' | 'payment-failures' | 'tax-summary'

export function FinancialReportsTab() {
  const supabase = getSupabase()

  const [activeTab, setActiveTab] = useState<TabKey>('ar-aging')

  // Data
  const [arData, setArData] = useState<ARAgingSummary | null>(null)
  const [failureData, setFailureData] = useState<PaymentFailureData | null>(null)
  const [taxData, setTaxData] = useState<TaxSummaryData | null>(null)

  // Loading
  const [arLoading, setArLoading] = useState(false)
  const [failureLoading, setFailureLoading] = useState(false)
  const [taxLoading, setTaxLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const currentYear = new Date().getFullYear()
  const [taxYear, setTaxYear] = useState<string>(String(currentYear))
  const [failureMonths, setFailureMonths] = useState<string>('6')

  // ── Data loaders ──────────────────────────────────────────────────

  const loadARData = useCallback(async () => {
    setArLoading(true)
    try {
      const data = await fetchARAgingReport(supabase)
      setArData(data)
    } catch (err) {
      console.error('AR aging error:', err)
    } finally {
      setArLoading(false)
    }
  }, [supabase])

  const loadFailureData = useCallback(async () => {
    setFailureLoading(true)
    try {
      const data = await fetchPaymentFailureReport(supabase, Number(failureMonths))
      setFailureData(data)
    } catch (err) {
      console.error('Payment failure error:', err)
    } finally {
      setFailureLoading(false)
    }
  }, [supabase, failureMonths])

  const loadTaxData = useCallback(async () => {
    setTaxLoading(true)
    try {
      const data = await fetchTaxSummaryReport(supabase, Number(taxYear))
      setTaxData(data)
    } catch (err) {
      console.error('Tax summary error:', err)
    } finally {
      setTaxLoading(false)
    }
  }, [supabase, taxYear])

  // Load data for active tab
  useEffect(() => {
    if (activeTab === 'ar-aging' && !arData) loadARData()
    if (activeTab === 'payment-failures' && !failureData) loadFailureData()
    if (activeTab === 'tax-summary' && !taxData) loadTaxData()
  }, [activeTab, arData, failureData, taxData, loadARData, loadFailureData, loadTaxData])

  // Reload on filter change
  useEffect(() => {
    if (activeTab === 'payment-failures') loadFailureData()
  }, [failureMonths]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'tax-summary') loadTaxData()
  }, [taxYear]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh ───────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    if (activeTab === 'ar-aging') await loadARData()
    else if (activeTab === 'payment-failures') await loadFailureData()
    else if (activeTab === 'tax-summary') await loadTaxData()
    setRefreshing(false)
  }, [activeTab, loadARData, loadFailureData, loadTaxData])

  // ── CSV export ────────────────────────────────────────────────────

  function downloadCsv(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleExport() {
    const timestamp = new Date().toISOString().split('T')[0]
    if (activeTab === 'ar-aging' && arData) {
      downloadCsv(arAgingToCsv(arData), `ar-aging-${timestamp}.csv`)
    } else if (activeTab === 'payment-failures' && failureData) {
      downloadCsv(paymentFailureToCsv(failureData), `payment-failures-${timestamp}.csv`)
    } else if (activeTab === 'tax-summary' && taxData) {
      downloadCsv(taxSummaryToCsv(taxData), `tax-summary-${taxYear}-${timestamp}.csv`)
    }
  }

  const canExport =
    (activeTab === 'ar-aging' && arData && arData.rows.length > 0) ||
    (activeTab === 'payment-failures' && failureData) ||
    (activeTab === 'tax-summary' && taxData && taxData.quarterly.length > 0)

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="ar-aging">AR Aging</TabsTrigger>
            <TabsTrigger value="payment-failures">Payment Failures</TabsTrigger>
            <TabsTrigger value="tax-summary">Tax Summary</TabsTrigger>
          </TabsList>

          {/* Tab-specific filters + action buttons */}
          <div className="flex items-center gap-2">
            {activeTab === 'payment-failures' && (
              <Select value={failureMonths} onValueChange={setFailureMonths}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Last 3 months</SelectItem>
                  <SelectItem value="6">Last 6 months</SelectItem>
                  <SelectItem value="12">Last 12 months</SelectItem>
                </SelectContent>
              </Select>
            )}

            {activeTab === 'tax-summary' && (
              <Select value={taxYear} onValueChange={setTaxYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!canExport}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <TabsContent value="ar-aging" className="mt-6">
          <ARAgingReport data={arData} loading={arLoading} />
        </TabsContent>

        <TabsContent value="payment-failures" className="mt-6">
          <PaymentFailureReport data={failureData} loading={failureLoading} />
        </TabsContent>

        <TabsContent value="tax-summary" className="mt-6">
          <TaxSummaryReport data={taxData} loading={taxLoading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
