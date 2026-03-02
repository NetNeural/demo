/**
 * PDF Export Utility — Issue #255
 *
 * Provides two modes of PDF generation:
 *
 * 1. **Table PDF** — Uses jspdf + jspdf-autotable for structured data exports
 *    (alerts, audit logs, telemetry). Produces clean, paginated PDFs with
 *    headers, metadata, and branded footers.
 *
 * 2. **HTML PDF** — Uses a hidden iframe + window.print() for rich HTML
 *    content (executive reports, assessment reports). Lets the browser's
 *    native print engine handle layout with @media print styles.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TablePDFOptions {
  /** PDF title shown at top of first page */
  title: string
  /** Optional subtitle (e.g. date range, filters) */
  subtitle?: string
  /** Column headers */
  headers: string[]
  /** 2D array of row data (strings) */
  rows: string[][]
  /** Output filename (without .pdf extension) */
  filename: string
  /** Optional organization name for header */
  organization?: string
  /** Page orientation */
  orientation?: 'portrait' | 'landscape'
  /** Optional summary stats to show above the table */
  summary?: { label: string; value: string }[]
}

// ─── Brand Colors ────────────────────────────────────────────────────────────

const COLORS = {
  primary: [30, 64, 175] as [number, number, number], // blue-800
  headerBg: [30, 41, 59] as [number, number, number], // slate-800
  headerText: [255, 255, 255] as [number, number, number],
  altRow: [241, 245, 249] as [number, number, number], // slate-100
  textDark: [15, 23, 42] as [number, number, number], // slate-900
  textMuted: [100, 116, 139] as [number, number, number], // slate-500
}

// ─── Table PDF Export ────────────────────────────────────────────────────────

/**
 * Generate and download a PDF with a data table.
 * Uses jspdf + jspdf-autotable for clean, paginated output.
 */
export function exportTableToPDF(options: TablePDFOptions): void {
  const {
    title,
    subtitle,
    headers,
    rows,
    filename,
    organization,
    orientation = 'landscape',
    summary,
  } = options

  if (rows.length === 0) return

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 15

  // ── Header bar ──
  doc.setFillColor(...COLORS.headerBg)
  doc.rect(0, 0, pageWidth, 28, 'F')

  doc.setTextColor(...COLORS.headerText)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Sentinel by NetNeural', 14, 12)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Generated ${format(new Date(), 'MMMM d, yyyy · h:mm a')}`,
    pageWidth - 14,
    12,
    { align: 'right' }
  )

  if (organization) {
    doc.text(organization, pageWidth - 14, 18, { align: 'right' })
  }

  y = 36

  // ── Title ──
  doc.setTextColor(...COLORS.textDark)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, y)
  y += 6

  if (subtitle) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.textMuted)
    doc.text(subtitle, 14, y)
    y += 5
  }

  // ── Summary stats ──
  if (summary && summary.length > 0) {
    y += 2
    doc.setFontSize(9)
    const colWidth = (pageWidth - 28) / Math.min(summary.length, 5)
    summary.forEach((stat, i) => {
      const x = 14 + i * colWidth
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.textMuted)
      doc.text(stat.label, x, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COLORS.textDark)
      doc.text(stat.value, x, y + 4.5)
    })
    y += 12
  }

  // ── Table ──
  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.headerText,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: COLORS.textDark,
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: COLORS.altRow,
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer on every page
      const pageCount = (doc as any).internal.getNumberOfPages()
      const currentPage = data.pageNumber
      doc.setFontSize(7)
      doc.setTextColor(...COLORS.textMuted)
      doc.text(
        `Page ${currentPage} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      )
      doc.text(
        'Sentinel by NetNeural — Confidential',
        14,
        doc.internal.pageSize.getHeight() - 8
      )
    },
  })

  // ── Row count footer ──
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20
  if (finalY < doc.internal.pageSize.getHeight() - 20) {
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.textMuted)
    doc.text(`Total rows: ${rows.length}`, 14, finalY + 6)
  }

  // ── Download ──
  doc.save(`${filename}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.pdf`)
}

// ─── HTML PDF Export (Print) ─────────────────────────────────────────────────

/**
 * Print HTML content as PDF using a hidden iframe + window.print().
 * Best for rich executive reports that are already formatted as HTML.
 *
 * The browser's Save as PDF option in the print dialog produces a high-quality
 * PDF without needing any server-side rendering.
 */
export function printHtmlAsPdf(html: string, title: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '-10000px'
  iframe.style.left = '-10000px'
  iframe.style.width = '1024px'
  iframe.style.height = '768px'

  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    return
  }

  iframeDoc.open()
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @media print {
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
          @page { margin: 1.5cm; size: A4; }
        }
        body { font-family: Arial, Helvetica, sans-serif; padding: 20px; color: #1e293b; }
        table { border-collapse: collapse; width: 100%; }
        td, th { padding: 6px 10px; border: 1px solid #e2e8f0; }
        th { background: #1e293b; color: white; text-align: left; }
        img { max-width: 100%; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `)
  iframeDoc.close()

  // Wait for content to render, then print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print()
      // Clean up after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }, 300)
  }

  // Trigger load manually if already loaded
  if (iframeDoc.readyState === 'complete') {
    iframe.onload?.(new Event('load'))
  }
}
