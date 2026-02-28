'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface ExportOptions<T = Record<string, unknown>> {
  filename: string
  headers: string[]
  data: T[]
  transformRow?: (row: T) => unknown[]
  chunkSize?: number
  maxRows?: number
}

interface ExportProgress {
  isExporting: boolean
  progress: number
  total: number
  currentRow: number
}

export function useExport() {
  const [progress, setProgress] = useState<ExportProgress>({
    isExporting: false,
    progress: 0,
    total: 0,
    currentRow: 0,
  })

  /**
   * Export data to CSV format with progress tracking
   * Handles large datasets by processing in chunks
   */
  const exportToCSV = useCallback(
    async <T = Record<string, unknown>>(options: ExportOptions<T>) => {
      const {
        filename,
        headers,
        data,
        transformRow,
        chunkSize = 1000,
        maxRows = 10000,
      } = options

      if (data.length === 0) {
        toast.error('No data to export')
        return
      }

      // Warn if data exceeds max rows
      if (data.length > maxRows) {
        toast.warning(`Export limited to ${maxRows} rows`, {
          description: `Total: ${data.length} rows available`,
        })
      }

      const rowsToExport = data.slice(0, maxRows)

      try {
        setProgress({
          isExporting: true,
          progress: 0,
          total: rowsToExport.length,
          currentRow: 0,
        })

        // Process data in chunks to avoid blocking UI
        const chunks: unknown[][] = []

        for (let i = 0; i < rowsToExport.length; i += chunkSize) {
          const chunk = rowsToExport.slice(i, i + chunkSize)
          const processedChunk = chunk.map((row, idx) => {
            // Use custom transform if provided, otherwise use the row as-is
            const transformedRow = transformRow
              ? transformRow(row)
              : Object.values(row as Record<string, unknown>)

            // Update progress
            setProgress({
              isExporting: true,
              progress: Math.round(((i + idx + 1) / rowsToExport.length) * 100),
              total: rowsToExport.length,
              currentRow: i + idx + 1,
            })

            return transformedRow
          })

          chunks.push(...processedChunk)

          // Allow UI to update between chunks
          await new Promise((resolve) => setTimeout(resolve, 0))
        }

        // Escape CSV values
        const escapeCSV = (value: unknown): string => {
          if (value === null || value === undefined) return ''
          const stringValue = String(value)
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (
            stringValue.includes(',') ||
            stringValue.includes('"') ||
            stringValue.includes('\n')
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        }

        // Build CSV content
        const csvContent = [
          // Headers
          headers.map(escapeCSV).join(','),
          // Data rows
          ...chunks.map((row) => row.map((val) => escapeCSV(val)).join(',')),
        ].join('\n')

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)

        link.setAttribute('href', url)
        link.setAttribute(
          'download',
          `${filename}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`
        )
        link.style.visibility = 'hidden'

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Clean up
        URL.revokeObjectURL(url)

        toast.success('Export completed', {
          description: `Downloaded ${rowsToExport.length} rows`,
        })
      } catch (error) {
        console.error('[useExport] Export error:', error)
        toast.error('Export failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        setProgress({
          isExporting: false,
          progress: 100,
          total: 0,
          currentRow: 0,
        })
      }
    },
    []
  )

  /**
   * Export data to JSON format
   */
  const exportToJSON = useCallback(
    (
      filename: string,
      data: Record<string, unknown> | Record<string, unknown>[]
    ) => {
      if (!data || (Array.isArray(data) && data.length === 0)) {
        toast.error('No data to export')
        return
      }

      try {
        const jsonString = JSON.stringify(data, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)

        link.setAttribute('href', url)
        link.setAttribute(
          'download',
          `${filename}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`
        )
        link.style.visibility = 'hidden'

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        URL.revokeObjectURL(url)

        toast.success('JSON export completed')
      } catch (error) {
        console.error('[useExport] JSON export error:', error)
        toast.error('JSON export failed')
      }
    },
    []
  )

  /**
   * Generate PDF report via Edge Function
   * This delegates to server-side PDF generation for complex reports
   */
  const exportToPDF = useCallback(
    async (_reportConfig: {
      reportType: string
      title: string
      data: Record<string, unknown>
      organizationId: string
    }) => {
      try {
        setProgress({
          isExporting: true,
          progress: 0,
          total: 100,
          currentRow: 0,
        })

        toast.info('Generating PDF...', {
          description: 'This may take a moment for large reports',
        })

        // TODO: Implement Edge Function call for PDF generation
        // const response = await edgeFunctions.reports.generatePDF(reportConfig)

        // For now, show placeholder
        toast.warning('PDF export coming soon', {
          description: 'PDF generation will be available in the next update',
        })
      } catch (error) {
        console.error('[useExport] PDF export error:', error)
        toast.error('PDF export failed')
      } finally {
        setProgress({
          isExporting: false,
          progress: 0,
          total: 0,
          currentRow: 0,
        })
      }
    },
    []
  )

  return {
    exportToCSV,
    exportToJSON,
    exportToPDF,
    progress,
    isExporting: progress.isExporting,
  }
}
