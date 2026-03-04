/**
 * Issuance History Panel
 *
 * Shows a sortable table of all hardware issuances to customers
 * with status tracking and return management.
 */
'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Truck,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from 'lucide-react'
import type { HardwareIssuance } from './types'

interface IssuanceHistoryPanelProps {
  issuances: HardwareIssuance[]
  onMarkDelivered: (issuance: HardwareIssuance) => void
  onMarkReturned: (issuance: HardwareIssuance) => void
}

const PAGE_SIZE = 10

const ISSUANCE_STATUS_CONFIG: Record<
  HardwareIssuance['status'],
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
> = {
  issued: { label: 'Issued', variant: 'default' },
  delivered: { label: 'Delivered', variant: 'secondary' },
  returned: { label: 'Returned', variant: 'outline' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function IssuanceHistoryPanel({
  issuances,
  onMarkDelivered,
  onMarkReturned,
}: IssuanceHistoryPanelProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    HardwareIssuance['status'] | 'all'
  >('all')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    let result = [...issuances]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (i) =>
          i.inventory_item_name.toLowerCase().includes(q) ||
          i.customer_org_name.toLowerCase().includes(q) ||
          i.tracking_number.toLowerCase().includes(q) ||
          i.serial_numbers.some((s) => s.toLowerCase().includes(q))
      )
    }
    if (statusFilter !== 'all') {
      result = result.filter((i) => i.status === statusFilter)
    }
    result.sort(
      (a, b) =>
        new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()
    )
    return result
  }, [issuances, search, statusFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by item, customer, tracking #, serial..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as HardwareIssuance['status'] | 'all')
            setPage(0)
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(ISSUANCE_STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                {cfg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
          <ClipboardList className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="font-medium text-muted-foreground">
            {issuances.length === 0
              ? 'No hardware issued yet'
              : 'No issuances match your filters'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Serials</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((iss) => {
                  const statusCfg = ISSUANCE_STATUS_CONFIG[iss.status]
                  return (
                    <TableRow key={iss.id}>
                      <TableCell className="text-sm">
                        {formatDate(iss.issued_at)}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate font-medium">
                        {iss.inventory_item_name}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate">
                        {iss.customer_org_name}
                      </TableCell>
                      <TableCell className="text-right">
                        {iss.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(iss.total_price)}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate font-mono text-sm text-muted-foreground">
                        {iss.tracking_number || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-[120px] flex-wrap gap-1">
                          {iss.serial_numbers.length > 0 ? (
                            iss.serial_numbers.slice(0, 2).map((sn) => (
                              <Badge
                                key={sn}
                                variant="outline"
                                className="font-mono text-[10px]"
                              >
                                {sn}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                          {iss.serial_numbers.length > 2 && (
                            <Badge variant="secondary" className="text-[10px]">
                              +{iss.serial_numbers.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusCfg.variant}>
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {iss.status === 'issued' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onMarkDelivered(iss)}
                              title="Mark delivered"
                            >
                              <Truck className="h-4 w-4" />
                            </Button>
                          )}
                          {(iss.status === 'issued' ||
                            iss.status === 'delivered') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onMarkReturned(iss)}
                              title="Mark returned"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
