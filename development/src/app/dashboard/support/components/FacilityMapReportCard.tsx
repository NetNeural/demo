'use client'

/**
 * FacilityMapReportCard — Feature report for the Facility Map system.
 * Displays all features, components, database schema, security policies,
 * and deployment status as a read-only admin documentation card.
 */

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Map,
  Layers,
  MousePointer2,
  Search,
  Download,
  Maximize2,
  Navigation,
  Activity,
  Shield,
  Database,
  FileCode2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Smartphone,
  Camera,
  Move,
  Image,
  Zap,
  Eye,
  BarChart3,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const COMPONENTS = [
  {
    name: 'FacilityMapView',
    file: 'src/components/facility-map/FacilityMapView.tsx',
    lines: 731,
    description: 'Main orchestrator — loads maps, devices, placements, telemetry; manages real-time subscriptions',
    icon: Map,
  },
  {
    name: 'FacilityMapCanvas',
    file: 'src/components/facility-map/FacilityMapCanvas.tsx',
    lines: 310,
    description: 'Interactive canvas — renders floor plan with device markers, click-to-place, export/fullscreen tools',
    icon: Layers,
  },
  {
    name: 'DeviceMarker',
    file: 'src/components/facility-map/DeviceMarker.tsx',
    lines: 265,
    description: 'Device dot — status colours, pulse animation, rich tooltip with telemetry, click-to-navigate',
    icon: Navigation,
  },
  {
    name: 'DevicePalette',
    file: 'src/components/facility-map/DevicePalette.tsx',
    lines: 191,
    description: 'Side panel — lists org devices, search filter, placed/unplaced badges, placement trigger',
    icon: Search,
  },
  {
    name: 'MapManagerDialog',
    file: 'src/components/facility-map/MapManagerDialog.tsx',
    lines: 220,
    description: 'CRUD dialog — create/edit map name, description, floor level, location, and image',
    icon: FileCode2,
  },
  {
    name: 'FacilityMapUploader',
    file: 'src/components/facility-map/FacilityMapUploader.tsx',
    lines: 258,
    description: 'Image upload — drag-and-drop, file picker, camera capture, Supabase Storage upload',
    icon: Camera,
  },
]

const CORE_FEATURES = [
  { name: 'Map CRUD', description: 'Create, edit, and delete facility maps with metadata', icon: Map },
  { name: 'Image Upload', description: 'Drag-and-drop, file picker, and mobile camera capture', icon: Image },
  { name: 'Click-to-Place', description: 'Click anywhere on map to position a device', icon: MousePointer2 },
  { name: 'Drag-to-Reposition', description: 'Drag device dots to new positions in edit mode', icon: Move },
  { name: 'Real-Time Status', description: 'Live device status via Supabase postgres_changes', icon: Zap },
  { name: 'Responsive Positioning', description: 'Percentage-based (0–100) coordinates for any screen size', icon: Maximize2 },
  { name: 'Touch Support', description: 'Touch events for mobile and tablet devices', icon: Smartphone },
  { name: 'Multiple Maps', description: 'Horizontal scrolling thumbnail strip with selection', icon: Layers },
  { name: 'Mode Switching', description: 'View / Place / Edit modes for the canvas toolbar', icon: Eye },
]

const ENHANCED_FEATURES = [
  { name: 'Device Count Badges', description: 'Badge showing placement count on each map thumbnail', icon: BarChart3 },
  { name: 'Click-to-Navigate', description: 'Click a device dot to open the device detail page', icon: Navigation },
  { name: 'Status Summary Bar', description: 'Online / offline / warning / error / maintenance counts', icon: Activity },
  { name: 'Search Filter', description: 'Filter devices by name in the side palette', icon: Search },
  { name: 'Export PNG', description: 'Download map as a PNG image with device markers and labels', icon: Download },
  { name: 'Telemetry Tooltips', description: 'Hover a device to see latest sensor readings (up to 6 values)', icon: Activity },
  { name: 'Bulk Placement', description: 'Auto-selects next unplaced device after placing one', icon: Layers },
  { name: 'Fullscreen Toggle', description: 'Full-screen canvas via the Browser Fullscreen API', icon: Maximize2 },
]

const PLANNED_FEATURES = [
  { issue: '#302', name: 'Map Annotations & Zones', description: 'Draw zones, add labels, create named areas on maps' },
  { issue: '#303', name: 'Heatmap Overlay', description: 'Gradient heatmap based on telemetry values' },
  { issue: '#304', name: 'Device Type Filters', description: 'Toggle device types on/off for map visibility' },
]

const DB_TABLES = [
  {
    name: 'facility_maps',
    description: 'Map records with image metadata, org/location refs, settings',
    columns: '17 columns — id, organization_id, location_id, name, description, floor_level, image_url, image_path, image_width, image_height, is_active, sort_order, settings, created_at, updated_at, created_by',
  },
  {
    name: 'device_map_placements',
    description: 'Device positions on maps with percentage-based coordinates',
    columns: '10 columns — id, facility_map_id, device_id, x_percent, y_percent, label, icon_size, rotation, settings, created_at, updated_at',
  },
]

const RLS_POLICIES = [
  { table: 'facility_maps', operation: 'SELECT', rule: 'Org members can view' },
  { table: 'facility_maps', operation: 'INSERT', rule: 'Admin/Owner only' },
  { table: 'facility_maps', operation: 'UPDATE', rule: 'Admin/Owner only' },
  { table: 'facility_maps', operation: 'DELETE', rule: 'Admin/Owner only' },
  { table: 'device_map_placements', operation: 'SELECT', rule: 'Org members can view' },
  { table: 'device_map_placements', operation: 'INSERT', rule: 'Admin/Owner only' },
  { table: 'device_map_placements', operation: 'UPDATE', rule: 'Admin/Owner only' },
  { table: 'device_map_placements', operation: 'DELETE', rule: 'Admin/Owner only' },
]

const DEPLOYMENT = [
  { env: 'Development', ref: 'tsomafkalaoarnuwgdyu', code: true, migration: true },
  { env: 'Staging', ref: 'atgbmxicqikmapfqouco', code: true, migration: false },
  { env: 'Production', ref: 'bldojxpockljyivldxwf', code: false, migration: false },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FacilityMapReportCard() {
  const [expanded, setExpanded] = useState(false)

  const totalLines = COMPONENTS.reduce((sum, c) => sum + c.lines, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Facility Map — Feature Report
            </CardTitle>
            <CardDescription>
              Interactive floor plan system for placing and monitoring IoT
              devices — {CORE_FEATURES.length + ENHANCED_FEATURES.length}{' '}
              features across {COMPONENTS.length} components (
              {totalLines.toLocaleString()} lines)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-600 text-white">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Complete
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          {/* ── Components ── */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileCode2 className="h-4 w-4" />
              Components ({COMPONENTS.length})
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COMPONENTS.map((comp) => {
                const Icon = comp.icon
                return (
                  <div
                    key={comp.name}
                    className="rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">{comp.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {comp.description}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {comp.lines} lines &middot;{' '}
                          <span className="font-mono text-[10px]">
                            {comp.file}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* ── Core Features ── */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Core Features ({CORE_FEATURES.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CORE_FEATURES.map((feat) => {
                const Icon = feat.icon
                return (
                  <div
                    key={feat.name}
                    className="flex items-start gap-2 rounded-md border p-2.5 text-sm"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    <div>
                      <p className="font-medium">{feat.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {feat.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* ── Enhanced Features ── */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-amber-500" />
              Enhanced Features ({ENHANCED_FEATURES.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ENHANCED_FEATURES.map((feat) => {
                const Icon = feat.icon
                return (
                  <div
                    key={feat.name}
                    className="flex items-start gap-2 rounded-md border p-2.5 text-sm"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="font-medium">{feat.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {feat.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* ── Planned Features ── */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-blue-500" />
              Planned Features ({PLANNED_FEATURES.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {PLANNED_FEATURES.map((feat) => (
                <div
                  key={feat.issue}
                  className="flex items-start gap-2 rounded-md border border-dashed p-2.5 text-sm"
                >
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <div>
                    <p className="font-medium">
                      {feat.name}{' '}
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {feat.issue}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {feat.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* ── Database Schema ── */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Database className="h-4 w-4" />
              Database Schema
            </h3>
            <div className="space-y-3">
              {DB_TABLES.map((table) => (
                <div key={table.name} className="rounded-lg border p-3">
                  <p className="text-sm font-medium font-mono">{table.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {table.description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {table.columns}
                  </p>
                </div>
              ))}
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium font-mono">
                  facility-maps{' '}
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    Storage Bucket
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  Floor plan images — public read, 10 MB max, PNG/JPG/WebP/SVG
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Security / RLS ── */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4" />
              Row-Level Security (RLS)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Table</th>
                    <th className="pb-2 pr-4">Operation</th>
                    <th className="pb-2">Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {RLS_POLICIES.map((policy, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-mono text-xs">
                        {policy.table}
                      </td>
                      <td className="py-1.5 pr-4">
                        <Badge variant="outline" className="text-[10px]">
                          {policy.operation}
                        </Badge>
                      </td>
                      <td className="py-1.5 text-xs text-muted-foreground">
                        {policy.rule}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          {/* ── Deployment Status ── */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4" />
              Deployment Status
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Environment</th>
                    <th className="pb-2 pr-4">Supabase Ref</th>
                    <th className="pb-2 pr-4">Code</th>
                    <th className="pb-2">Migration</th>
                  </tr>
                </thead>
                <tbody>
                  {DEPLOYMENT.map((env) => (
                    <tr key={env.env} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-medium">{env.env}</td>
                      <td className="py-1.5 pr-4 font-mono text-xs text-muted-foreground">
                        {env.ref}
                      </td>
                      <td className="py-1.5 pr-4">
                        {env.code ? (
                          <Badge
                            variant="default"
                            className="bg-green-600 text-[10px] text-white"
                          >
                            Deployed
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="py-1.5">
                        {env.migration ? (
                          <Badge
                            variant="default"
                            className="bg-green-600 text-[10px] text-white"
                          >
                            Applied
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Pending
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Migration file reference ── */}
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Migration:</span>{' '}
              <span className="font-mono">
                supabase/migrations/20260227100000_facility_maps.sql
              </span>{' '}
              (211 lines)
            </p>
            <p className="mt-0.5">
              <span className="font-medium text-foreground">Epic:</span> GitHub
              Issue #300 &middot;{' '}
              <span className="font-medium text-foreground">Commits:</span>{' '}
              <span className="font-mono">eba00eb</span> (staging) /{' '}
              <span className="font-mono">f2f7bd4</span> (dev)
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
