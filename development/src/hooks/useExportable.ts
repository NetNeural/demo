/**
 * Hook to make a component's data exportable
 * Listens for the global 'export-current-view' event and calls the provided export function
 */

import { useEffect } from 'react'
import { exportToCSV, generateFilename } from '@/lib/export-utils'
import { toast } from 'sonner'

interface UseExportableOptions<T> {
  /**
   * Function to get the current data to export
   */
  getData: () => T[]

  /**
   * Base filename (without .csv extension)
   * A timestamp will be appended automatically
   */
  filename: string

  /**
   * Optional column definitions for CSV export
   */
  columns?: Array<{ key: keyof T; label: string }>

  /**
   * Optional callback after successful export
   */
  onExport?: () => void
}

export function useExportable<T extends Record<string, any>>(
  options: UseExportableOptions<T>
) {
  useEffect(() => {
    const handleExport = (event: Event) => {
      try {
        const data = options.getData()

        if (data.length === 0) {
          toast.warning('No data to export')
          return
        }

        const filename = generateFilename(options.filename)
        exportToCSV(data, filename, options.columns)

        toast.success(`Exported ${data.length} rows`, {
          description: `Downloaded as ${filename}.csv`,
        })

        options.onExport?.()
      } catch (error) {
        console.error('Export failed:', error)
        toast.error('Export failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    window.addEventListener('export-current-view', handleExport)
    return () => window.removeEventListener('export-current-view', handleExport)
  }, [options])
}
