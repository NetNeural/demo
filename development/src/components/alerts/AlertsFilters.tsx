'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

interface AlertsFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  severityFilter: string
  onSeverityChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
  onClearFilters: () => void
}

export function AlertsFilters({
  searchTerm,
  onSearchChange,
  severityFilter,
  onSeverityChange,
  categoryFilter,
  onCategoryChange,
  onClearFilters,
}: AlertsFiltersProps) {
  const hasActiveFilters =
    searchTerm || severityFilter !== 'all' || categoryFilter !== 'all'

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Search */}
      <div className="min-w-[200px] flex-1">
        <Label htmlFor="alert-search">Search</Label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="alert-search"
            placeholder="Search alerts, devices..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Severity Filter */}
      <div className="w-[180px]">
        <Label htmlFor="severity-filter">Severity</Label>
        <Select value={severityFilter} onValueChange={onSeverityChange}>
          <SelectTrigger id="severity-filter">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Category Filter */}
      <div className="w-[180px]">
        <Label htmlFor="category-filter">Category</Label>
        <Select value={categoryFilter} onValueChange={onCategoryChange}>
          <SelectTrigger id="category-filter">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="connectivity">Device Offline</SelectItem>
            <SelectItem value="temperature">Temperature</SelectItem>
            <SelectItem value="battery">Battery</SelectItem>
            <SelectItem value="vibration">Vibration</SelectItem>
            <SelectItem value="security">Security</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="mb-0"
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
