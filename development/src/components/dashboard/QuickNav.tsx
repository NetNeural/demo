'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  AlertTriangle,
  Activity,
  BarChart3,
  FileText,
  Network,
  CreditCard,
  Building2,
  TrendingUp,
  Layers,
  UserCog,
  PackageSearch,
  ShieldCheck,
  Users,
  Wand2,
  Settings,
  X,
  Plus,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Pencil,
  Smartphone,
  Map,
  MessageSquare,
  Wrench,
  Boxes,
  MonitorSmartphone,
  type LucideIcon,
} from 'lucide-react'

// --- Nav item definitions ---

export interface NavItemDef {
  id: string
  label: string
  description: string
  path: string
  icon: LucideIcon
  iconColor: string
  access: 'manager' | 'owner' | 'platform'
}

// Master registry of all available nav items
const ALL_NAV_ITEMS: NavItemDef[] = [
  // Manager-level
  { id: 'reports', label: 'Reports', description: 'Device & alert reports', path: '/dashboard/reports', icon: FileText, iconColor: 'text-blue-500', access: 'manager' },
  { id: 'analytics', label: 'Analytics', description: 'Trends & insights', path: '/dashboard/analytics', icon: BarChart3, iconColor: 'text-violet-500', access: 'manager' },
  { id: 'alert-rules', label: 'Alert Rules', description: 'Configure thresholds', path: '/dashboard/alert-rules', icon: AlertTriangle, iconColor: 'text-amber-500', access: 'manager' },
  { id: 'users', label: 'Users', description: 'Manage team members', path: '/dashboard/users', icon: Users, iconColor: 'text-cyan-500', access: 'manager' },
  { id: 'integrations', label: 'Integrations', description: 'MQTT & connections', path: '/dashboard/integrations', icon: Network, iconColor: 'text-emerald-500', access: 'manager' },
  { id: 'devices', label: 'Devices', description: 'View all devices', path: '/dashboard/hardware-provisioning', icon: Smartphone, iconColor: 'text-blue-600', access: 'manager' },
  { id: 'alerts', label: 'Alerts', description: 'Active alert feed', path: '/dashboard/alerts', icon: AlertTriangle, iconColor: 'text-red-500', access: 'manager' },
  { id: 'organizations', label: 'Organization', description: 'Org settings', path: '/dashboard/organizations', icon: Settings, iconColor: 'text-gray-500', access: 'manager' },
  { id: 'facility-map', label: 'Facility Map', description: 'Location floor plans', path: '/dashboard/facility-map', icon: Map, iconColor: 'text-teal-500', access: 'manager' },
  { id: 'feedback', label: 'Feedback', description: 'Submit feedback', path: '/dashboard/feedback', icon: MessageSquare, iconColor: 'text-purple-500', access: 'manager' },
  { id: 'device-types', label: 'Device Types', description: 'Manage device types', path: '/dashboard/device-types', icon: Boxes, iconColor: 'text-orange-600', access: 'manager' },
  { id: 'developer', label: 'Developer', description: 'API & developer tools', path: '/dashboard/developer', icon: Wrench, iconColor: 'text-gray-600', access: 'manager' },
  { id: 'inventory', label: 'Inventory', description: 'Inventory control', path: '/dashboard/inventory-control', icon: MonitorSmartphone, iconColor: 'text-lime-600', access: 'manager' },
  { id: 'support', label: 'Support', description: 'Help & documentation', path: '/dashboard/support', icon: MessageSquare, iconColor: 'text-sky-500', access: 'manager' },
  // Owner-level
  { id: 'billing', label: 'Billing', description: 'Plans & invoices', path: '/dashboard/billing', icon: CreditCard, iconColor: 'text-pink-500', access: 'owner' },
  { id: 'reseller', label: 'Resellers', description: 'Reseller dashboard', path: '/dashboard/reseller', icon: Building2, iconColor: 'text-orange-500', access: 'owner' },
  // Platform admin-level
  { id: 'reseller-approvals', label: 'Reseller Approvals', description: 'Review applications', path: '/dashboard/admin/reseller-applications', icon: PackageSearch, iconColor: 'text-violet-500', access: 'platform' },
  { id: 'customers', label: 'Customers', description: 'All orgs & accounts', path: '/dashboard/admin/customers', icon: UserCog, iconColor: 'text-blue-600', access: 'platform' },
  { id: 'revenue', label: 'Revenue', description: 'Financial overview', path: '/dashboard/admin/revenue', icon: TrendingUp, iconColor: 'text-green-600', access: 'platform' },
  { id: 'plans-pricing', label: 'Plans & Pricing', description: 'Manage subscription tiers', path: '/dashboard/plans-pricing', icon: Layers, iconColor: 'text-indigo-500', access: 'platform' },
  { id: 'security-audit', label: 'Security Audit', description: 'Logs & access review', path: '/dashboard/admin/security-audit', icon: ShieldCheck, iconColor: 'text-rose-500', access: 'platform' },
  { id: 'platform-health', label: 'Platform Health', description: 'System monitoring', path: '/dashboard/admin/platform-health', icon: Activity, iconColor: 'text-teal-500', access: 'platform' },
]

// Default items shown before any customization (matches original)
const DEFAULT_ITEM_IDS = [
  'reports', 'analytics', 'alert-rules', 'users', 'integrations',
  'billing', 'reseller',
  'reseller-approvals', 'customers', 'revenue', 'plans-pricing', 'security-audit', 'platform-health',
]

const STORAGE_KEY = 'quicknav-config'

interface QuickNavConfig {
  itemIds: string[]
  hidden: boolean
}

function loadConfig(): QuickNavConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveConfig(config: QuickNavConfig) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

// --- Component Props ---

interface QuickNavProps {
  canManage: boolean
  isOwnerOrSuper: boolean
  isPlAdmin: boolean
}

export function QuickNav({ canManage, isOwnerOrSuper, isPlAdmin }: QuickNavProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [config, setConfig] = useState<QuickNavConfig>({ itemIds: DEFAULT_ITEM_IDS, hidden: false })
  const [mounted, setMounted] = useState(false)
  const dragItemRef = useRef<number | null>(null)
  const dragOverItemRef = useRef<number | null>(null)

  // Load persisted config on mount
  useEffect(() => {
    const saved = loadConfig()
    if (saved) setConfig(saved)
    setMounted(true)
  }, [])

  // Persist whenever config changes (after mount)
  useEffect(() => {
    if (mounted) saveConfig(config)
  }, [config, mounted])

  // Filter items the user has access to
  const accessibleItems = useCallback(() => {
    return ALL_NAV_ITEMS.filter((item) => {
      if (item.access === 'platform') return isPlAdmin
      if (item.access === 'owner') return isOwnerOrSuper
      return canManage
    })
  }, [canManage, isOwnerOrSuper, isPlAdmin])

  // Visible items in configured order, filtered by access
  const visibleItems = useCallback(() => {
    const accessible = accessibleItems()
    const accessibleIds = new Set(accessible.map((i) => i.id))
    return config.itemIds
      .filter((id) => accessibleIds.has(id))
      .map((id) => accessible.find((i) => i.id === id)!)
      .filter(Boolean)
  }, [config.itemIds, accessibleItems])

  // Items available to add (accessible but not currently shown)
  const addableItems = useCallback(() => {
    const currentIds = new Set(config.itemIds)
    return accessibleItems().filter((i) => !currentIds.has(i.id))
  }, [config.itemIds, accessibleItems])

  const handleRemoveItem = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      itemIds: prev.itemIds.filter((i) => i !== id),
    }))
  }

  const handleAddItem = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      itemIds: [...prev.itemIds, id],
    }))
  }

  const handleToggleHidden = () => {
    setConfig((prev) => ({ ...prev, hidden: !prev.hidden }))
  }

  const handleReset = () => {
    setConfig({ itemIds: DEFAULT_ITEM_IDS, hidden: false })
    setIsEditing(false)
  }

  // --- Drag and Drop ---
  const handleDragStart = (index: number) => {
    dragItemRef.current = index
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    dragOverItemRef.current = index
  }

  const handleDrop = () => {
    if (dragItemRef.current === null || dragOverItemRef.current === null) return
    if (dragItemRef.current === dragOverItemRef.current) return

    const fromIndex = dragItemRef.current
    const toIndex = dragOverItemRef.current

    setConfig((prev) => {
      const accessible = new Set(accessibleItems().map((i) => i.id))
      const orderedIds = prev.itemIds.filter((id) => accessible.has(id))
      const newIds = [...orderedIds]
      const removed = newIds.splice(fromIndex, 1)[0]
      if (removed) newIds.splice(toIndex, 0, removed)
      return { ...prev, itemIds: newIds }
    })

    dragItemRef.current = null
    dragOverItemRef.current = null
  }

  if (!canManage) return null
  if (!mounted) return null // Avoid hydration mismatch

  const items = visibleItems()
  const available = addableItems()

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="h-4 w-4" />
              Quick Navigation
            </CardTitle>
            <CardDescription>
              Shortcuts to key areas based on your role
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {/* Hide/Show toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleHidden}
              title={config.hidden ? 'Show quick nav' : 'Hide quick nav'}
            >
              {config.hidden ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>

            {!config.hidden && (
              <>
                {/* Edit mode toggle */}
                <Button
                  variant={isEditing ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  title={isEditing ? 'Done editing' : 'Customize'}
                >
                  <Pencil className="h-4 w-4" />
                </Button>

                {/* Reset */}
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    title="Reset to defaults"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {!config.hidden && (
        <CardContent>
          {items.length === 0 && !isEditing ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No shortcuts configured.{' '}
              <button
                onClick={() => setIsEditing(true)}
                className="text-primary underline underline-offset-4"
              >
                Add some
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((item, index) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.id}
                    draggable={isEditing}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={handleDrop}
                    className={`relative ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <button
                      onClick={() => {
                        if (!isEditing) router.push(item.path)
                      }}
                      className={`flex w-full flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors ${
                        isEditing
                          ? 'border-dashed border-muted-foreground/40'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {isEditing && (
                            <GripVertical className="h-3 w-3 text-muted-foreground" />
                          )}
                          <Icon className={`h-4 w-4 ${item.iconColor}`} />
                        </div>
                        {isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveItem(item.id)
                            }}
                            className="rounded p-0.5 hover:bg-destructive/10"
                            title="Remove shortcut"
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </button>
                        )}
                      </div>
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </button>
                  </div>
                )
              })}

              {/* Add button — only in edit mode */}
              {isEditing && available.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/40 p-3 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                      <Plus className="h-5 w-5" />
                      <span className="text-xs font-medium">Add Shortcut</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                    <DropdownMenuLabel>Available Shortcuts</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {available.map((item) => {
                      const Icon = item.icon
                      return (
                        <DropdownMenuItem
                          key={item.id}
                          onClick={() => handleAddItem(item.id)}
                        >
                          <Icon className={`mr-2 h-4 w-4 ${item.iconColor}`} />
                          <div>
                            <div className="text-sm">{item.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.description}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
