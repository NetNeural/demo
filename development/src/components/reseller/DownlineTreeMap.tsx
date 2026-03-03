'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Wifi,
  Search,
  Users,
  Network,
} from 'lucide-react'
import { TIER_BG_COLORS, TIER_COLORS, type ResellerTreeNode } from '@/types/reseller'
import { cn } from '@/lib/utils'

interface DownlineTreeMapProps {
  rootOrgId:  string
  className?: string
}

interface EnrichedNode extends ResellerTreeNode {
  isExpanded:  boolean
  children:    EnrichedNode[]
}

function buildTree(flatNodes: ResellerTreeNode[], rootId: string): EnrichedNode[] {
  const map: Record<string, EnrichedNode> = {}
  for (const n of flatNodes) {
    map[n.id] = { ...n, isExpanded: n.depth < 2, children: [] }
  }
  const roots: EnrichedNode[] = []
  for (const n of Object.values(map)) {
    if (n.id === rootId) continue  // skip root itself
    if (n.parent_id !== null && n.parent_id !== undefined && map[n.parent_id]) {
      map[n.parent_id]!.children.push(n)
    } else if (n.parent_id === rootId) {
      roots.push(n)
    }
  }
  return roots
}

function TreeNodeRow({
  node,
  onToggle,
  searchQuery,
}: {
  node:        EnrichedNode
  onToggle:    (id: string) => void
  searchQuery: string
}) {
  const hasChildren = node.children.length > 0
  const tierBadge   = TIER_BG_COLORS[node.tier_name ?? ''] ?? 'bg-gray-100 text-gray-700'
  const tierColor   = TIER_COLORS[node.tier_name ?? ''] ?? '#6b7280'

  const matchesSearch = !searchQuery ||
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.slug.toLowerCase().includes(searchQuery.toLowerCase())

  if (!matchesSearch && !node.children.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))) {
    return null
  }

  return (
    <div>
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.04]',
          { 'pl-3': node.depth === 1, 'pl-6': node.depth === 2, 'pl-9': node.depth === 3, 'pl-12': node.depth >= 4 }
        )}
        style={{ paddingLeft: `${(node.depth - 1) * 16 + 12}px` }}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        {/* Expand/collapse indicator */}
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-500">
          {hasChildren ? (
            node.isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-gray-700" />
          )}
        </span>

        {/* Org icon */}
        <Building2 className="h-4 w-4 shrink-0 text-gray-500" />

        {/* Org name */}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-200">
          {node.name}
        </span>

        {/* Tier badge */}
        {node.tier_name && (
          <Badge className={cn('shrink-0 text-xs', tierBadge)}>
            {node.tier_name}
          </Badge>
        )}

        {/* Sensor count */}
        <div className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
          <Wifi className="h-3 w-3" style={{ color: tierColor }} />
          <span>{(node.sensor_count ?? 0).toLocaleString()}</span>
        </div>

        {/* Children count */}
        {hasChildren && (
          <span className="shrink-0 text-xs text-gray-600">
            {node.children.length} sub
          </span>
        )}
      </div>

      {/* Recursive children */}
      {hasChildren && node.isExpanded && (
        <div className="border-l border-white/[0.06] ml-7">
          {node.children.map(child => (
            <TreeNodeRow
              key={child.id}
              node={child}
              onToggle={onToggle}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DownlineTreeMap({ rootOrgId, className }: DownlineTreeMapProps) {
  const [nodes, setNodes]           = useState<EnrichedNode[]>([])
  const [loading, setLoading]       = useState(true)
  const [searchQuery, setSearch]    = useState('')
  const [flatNodes, setFlatNodes]   = useState<ResellerTreeNode[]>([])
  const [stats, setStats] = useState({
    totalPartners: 0, totalSensors: 0, maxDepth: 0,
  })

  const fetchTree = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()

      // Fetch full downline tree via DB function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { data: rawTree } = await db
        .rpc('get_reseller_tree', { root_org_id: rootOrgId })
      const tree = rawTree as ResellerTreeNode[] | null

      if (!tree) return

      // Enrich with sensor counts from cache
      const orgIds = tree.map((n: ResellerTreeNode) => n.id).filter((id: string) => id !== rootOrgId)
      const { data: sensorCounts } = await db
        .from('reseller_sensor_counts')
        .select('organization_id, effective_total, current_tier_id')
        .in('organization_id', orgIds)

      const { data: tierNames } = await db
        .from('reseller_tiers')
        .select('id, name, discount_pct')

      const tierMap: Record<string, { name: string; discount_pct: number }> = {}
      for (const t of (tierNames ?? [])) tierMap[t.id] = { name: t.name, discount_pct: t.discount_pct }

      const countMap: Record<string, number> = {}
      const tierIdMap: Record<string, string> = {}
      for (const sc of (sensorCounts ?? [])) {
        countMap[sc.organization_id] = sc.effective_total
        if (sc.current_tier_id) tierIdMap[sc.organization_id] = sc.current_tier_id
      }

      const enriched: ResellerTreeNode[] = (tree as unknown as ResellerTreeNode[])
        .filter(n => n.id !== rootOrgId)
        .map(n => ({
          ...n,
          sensor_count: countMap[n.id] ?? 0,
          tier_name:    (tierIdMap[n.id] && tierMap[tierIdMap[n.id] as string]) ? tierMap[tierIdMap[n.id] as string]?.name : undefined,
          tier_discount: (tierIdMap[n.id] && tierMap[tierIdMap[n.id] as string]) ? tierMap[tierIdMap[n.id] as string]?.discount_pct : undefined,
        }))

      setFlatNodes(enriched)
      setNodes(buildTree(enriched, rootOrgId))
      setStats({
        totalPartners: enriched.length,
        totalSensors:  Object.values(countMap).reduce((a, b) => a + b, 0),
        maxDepth:      Math.max(0, ...enriched.map(n => n.depth)) - 1,
      })
    } finally {
      setLoading(false)
    }
  }, [rootOrgId])

  useEffect(() => { fetchTree() }, [fetchTree])

  const handleToggle = (nodeId: string) => {
    const toggle = (ns: EnrichedNode[]): EnrichedNode[] =>
      ns.map(n =>
        n.id === nodeId
          ? { ...n, isExpanded: !n.isExpanded }
          : { ...n, children: toggle(n.children) }
      )
    setNodes(toggle)
  }

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center rounded-xl border border-white/[0.08] bg-gray-900/60 p-8', className)}>
        <div className="text-center text-sm text-gray-500">Loading network tree…</div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-white/[0.08] bg-gray-900/60', className)}>
      {/* Stats header */}
      <div className="border-b border-white/[0.08] px-5 py-4">
        <h3 className="text-sm font-semibold text-white mb-3">Downline Network</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users,   label: 'Partners',    value: stats.totalPartners },
            { icon: Wifi,    label: 'Total Sensors', value: stats.totalSensors.toLocaleString() },
            { icon: Network, label: 'Max Depth',    value: `${stats.maxDepth} levels` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-lg bg-white/[0.03] p-3 text-center">
              <Icon className="mx-auto mb-1 h-4 w-4 text-gray-500" />
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-white/[0.08] px-5 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <Input
            placeholder="Search partners…"
            value={searchQuery}
            onChange={e => setSearch(e.target.value)}
            className="h-8 border-white/[0.08] bg-white/[0.04] pl-8 text-sm"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="max-h-96 overflow-y-auto p-2">
        {nodes.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No sub-resellers in your network yet.
          </div>
        ) : (
          nodes.map(node => (
            <TreeNodeRow
              key={node.id}
              node={node}
              onToggle={handleToggle}
              searchQuery={searchQuery}
            />
          ))
        )}
      </div>
    </div>
  )
}
