/**
 * Export utilities for converting data to CSV and downloading files
 */

/**
 * Convert an array of objects to CSV format
 * @param data Array of objects to export
 * @param columns Optional array of column definitions { key: string, label: string }
 * @returns CSV string
 */
export function convertToCSV<T extends Record<string, any>>(
  data: T[],
  columns?: Array<{ key: keyof T; label: string }>
): string {
  if (data.length === 0) {
    return ''
  }

  // If columns not provided, use all keys from first object
  const firstRow = data[0]
  if (!firstRow) {
    return ''
  }
  const cols = columns || Object.keys(firstRow).map(key => ({ key, label: key }))

  // Create header row
  const headers = cols.map(col => escapeCSVValue(col.label)).join(',')

  // Create data rows
  const rows = data.map(row => {
    return cols
      .map(col => {
        const value = row[col.key]
        return escapeCSVValue(formatValue(value))
      })
      .join(',')
  })

  return [headers, ...rows].join('\n')
}

/**
 * Escape a value for CSV format
 */
function escapeCSVValue(value: string): string {
  if (value == null) return ''
  const str = String(value)
  // If value contains comma, newline, or quote, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Format a value for CSV export
 */
function formatValue(value: any): string {
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString()
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * Download a CSV file
 * @param filename Name of the file to download (without .csv extension)
 * @param csvContent CSV content as string
 */
export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    // Create a link to the file
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * Export data to CSV and download
 * @param data Array of objects to export
 * @param filename Name of the file (without .csv extension)
 * @param columns Optional column definitions
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: Array<{ key: keyof T; label: string }>
): void {
  const csv = convertToCSV(data, columns)
  downloadCSV(filename, csv)
}

/**
 * Generate a filename with timestamp
 * @param prefix Prefix for the filename
 * @returns Filename with timestamp (e.g., "devices-export-2026-02-19-14-30")
 */
export function generateFilename(prefix: string): string {
  const now = new Date()
  const timestamp = now
    .toISOString()
    .slice(0, 16)
    .replace('T', '-')
    .replace(/:/g, '-')
  return `${prefix}-${timestamp}`
}
