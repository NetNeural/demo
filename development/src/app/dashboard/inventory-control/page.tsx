/**
 * NetNeural Inventory Control Page
 *
 * Platform-admin-only page for managing:
 * 1. Inventory Dashboard — KPI overview cards
 * 2. Inventory Items — full CRUD with search, filter, sort
 * 3. Issue Hardware — track hardware issued to customers
 * 4. Vendors & Manufacturers — supply chain partner management
 *
 * Data is stored client-side with localStorage persistence until
 * the DB migration for inventory tables is applied. All CRUD operations
 * work immediately out of the box.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  InventoryDashboard,
  InventoryTable,
  AddEditItemDialog,
  IssueHardwareDialog,
  VendorManufacturerPanel,
  IssuanceHistoryPanel,
} from '@/components/inventory-control'
import type {
  InventoryItem,
  InventoryFormValues,
  InventoryStats,
  HardwareIssuance,
  IssuanceFormValues,
  Vendor,
  VendorFormValues,
  HardwareCategory,
} from '@/components/inventory-control/types'
import { isPlatformAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  Package,
  BarChart3,
  Truck,
  Building,
  Plus,
  Warehouse,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Local Storage Keys ──────────────────────────────────────────
const LS_INVENTORY = 'nn_inventory_items'
const LS_ISSUANCES = 'nn_inventory_issuances'
const LS_VENDORS = 'nn_inventory_vendors'

function loadFromLS<T>(key: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function saveToLS<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
}

function uuid() {
  return crypto.randomUUID()
}

// ── Compute Stats ───────────────────────────────────────────────
function computeStats(
  items: InventoryItem[],
  issuances: HardwareIssuance[]
): InventoryStats {
  const categoryCounts: Record<HardwareCategory, number> = {
    modular_sensor: 0,
    hub: 0,
    cellular_hub: 0,
    accessory: 0,
    component: 0,
    other: 0,
  }
  let totalValue = 0
  let lowStockCount = 0
  let totalIssued = 0

  for (const item of items) {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1
    totalValue += item.manufacturing_cost * item.quantity_available
    if (item.quantity_available <= item.reorder_threshold) lowStockCount++
  }

  let totalRevenue = 0
  for (const iss of issuances) {
    if (iss.status !== 'cancelled') {
      totalIssued += iss.quantity
      totalRevenue += iss.total_price
    }
  }

  return {
    totalItems: items.length,
    totalValue,
    lowStockCount,
    totalIssued,
    totalRevenue,
    categoryCounts,
  }
}

// ── Page Component ──────────────────────────────────────────────
export default function InventoryControlPage() {
  const { currentOrganization, isLoading, userRole } = useOrganization()
  const { user } = useUser()

  // State
  const [items, setItems] = useState<InventoryItem[]>([])
  const [issuances, setIssuances] = useState<HardwareIssuance[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [organizations, setOrganizations] = useState<
    { id: string; name: string }[]
  >([])
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [addEditOpen, setAddEditOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [issueDialogOpen, setIssueDialogOpen] = useState(false)
  const [issueItem, setIssueItem] = useState<InventoryItem | null>(null)

  const isNetNeuralAdmin = isPlatformAdmin(
    user,
    currentOrganization?.id,
    userRole
  )

  // ── Load Data ───────────────────────────────────────────────
  useEffect(() => {
    setItems(loadFromLS<InventoryItem>(LS_INVENTORY, []))
    setIssuances(loadFromLS<HardwareIssuance>(LS_ISSUANCES, []))
    setVendors(loadFromLS<Vendor>(LS_VENDORS, []))
    setLoading(false)
  }, [])

  // Load organizations for the issuance customer picker
  useEffect(() => {
    const loadOrgs = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('organizations')
          .select('id, name')
          .order('name')
        setOrganizations(data || [])
      } catch {
        // Non-critical — user can still type org names
      }
    }
    loadOrgs()
  }, [])

  // ── Persist helpers ─────────────────────────────────────────
  const persistItems = useCallback(
    (newItems: InventoryItem[]) => {
      setItems(newItems)
      saveToLS(LS_INVENTORY, newItems)
    },
    []
  )
  const persistIssuances = useCallback(
    (newIssuances: HardwareIssuance[]) => {
      setIssuances(newIssuances)
      saveToLS(LS_ISSUANCES, newIssuances)
    },
    []
  )
  const persistVendors = useCallback(
    (newVendors: Vendor[]) => {
      setVendors(newVendors)
      saveToLS(LS_VENDORS, newVendors)
    },
    []
  )

  // ── Inventory CRUD ──────────────────────────────────────────
  const handleSaveItem = async (
    form: InventoryFormValues,
    editId?: string
  ) => {
    const now = new Date().toISOString()
    const qty = parseInt(form.quantity_total, 10) || 0
    const mfgVendor = vendors.find((v) => v.id === form.manufacturer_id)
    const supVendor = vendors.find((v) => v.id === form.vendor_id)

    if (editId) {
      // Update existing
      const updated = items.map((i) =>
        i.id === editId
          ? {
              ...i,
              sku: form.sku,
              name: form.name,
              description: form.description,
              category: form.category,
              quantity_total: qty,
              quantity_available:
                qty -
                i.quantity_allocated -
                i.quantity_issued -
                i.quantity_defective,
              reorder_threshold: parseInt(form.reorder_threshold, 10) || 0,
              manufacturing_cost: parseFloat(form.manufacturing_cost) || 0,
              wholesale_price: parseFloat(form.wholesale_price) || 0,
              retail_price: parseFloat(form.retail_price) || 0,
              currency: form.currency,
              model_number: form.model_number,
              hardware_version: form.hardware_version,
              firmware_version: form.firmware_version,
              serial_prefix: form.serial_prefix,
              manufacturer_id: form.manufacturer_id || null,
              manufacturer_name: mfgVendor?.name || '',
              vendor_id: form.vendor_id || null,
              vendor_name: supVendor?.name || '',
              supplier: form.supplier,
              warehouse_location: form.warehouse_location,
              batch_number: form.batch_number,
              manufacture_date: form.manufacture_date || null,
              notes: form.notes,
              updated_at: now,
            }
          : i
      )
      persistItems(updated)
      toast.success('Inventory item updated')
    } else {
      // Create new
      const newItem: InventoryItem = {
        id: uuid(),
        sku: form.sku,
        name: form.name,
        description: form.description,
        category: form.category,
        status: 'in_stock',
        quantity_total: qty,
        quantity_available: qty,
        quantity_allocated: 0,
        quantity_issued: 0,
        quantity_defective: 0,
        reorder_threshold: parseInt(form.reorder_threshold, 10) || 0,
        manufacturing_cost: parseFloat(form.manufacturing_cost) || 0,
        wholesale_price: parseFloat(form.wholesale_price) || 0,
        retail_price: parseFloat(form.retail_price) || 0,
        currency: form.currency,
        model_number: form.model_number,
        hardware_version: form.hardware_version,
        firmware_version: form.firmware_version,
        serial_prefix: form.serial_prefix,
        manufacturer_id: form.manufacturer_id || null,
        manufacturer_name: mfgVendor?.name || '',
        vendor_id: form.vendor_id || null,
        vendor_name: supVendor?.name || '',
        supplier: form.supplier,
        warehouse_location: form.warehouse_location,
        batch_number: form.batch_number,
        manufacture_date: form.manufacture_date || null,
        created_at: now,
        updated_at: now,
        created_by: user?.id || null,
        notes: form.notes,
      }
      persistItems([...items, newItem])
      toast.success('Inventory item added')
    }
  }

  const handleDeleteItem = (item: InventoryItem) => {
    if (!confirm(`Delete "${item.name}" (${item.sku})?`)) return
    persistItems(items.filter((i) => i.id !== item.id))
    toast.success('Item deleted')
  }

  const handleEditItem = (item: InventoryItem) => {
    setEditItem(item)
    setAddEditOpen(true)
  }

  const handleOpenIssue = (item: InventoryItem) => {
    setIssueItem(item)
    setIssueDialogOpen(true)
  }

  // ── Issue Hardware ──────────────────────────────────────────
  const handleIssueHardware = async (form: IssuanceFormValues) => {
    const qty = parseInt(form.quantity, 10) || 0
    const unitPrice = parseFloat(form.unit_price) || 0
    const item = items.find((i) => i.id === form.inventory_item_id)
    if (!item) return

    const org = organizations.find((o) => o.id === form.customer_org_id)

    const issuance: HardwareIssuance = {
      id: uuid(),
      inventory_item_id: item.id,
      inventory_item_name: item.name,
      customer_org_id: form.customer_org_id,
      customer_org_name: org?.name || form.customer_org_id,
      quantity: qty,
      serial_numbers: form.serial_numbers
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      unit_price: unitPrice,
      total_price: qty * unitPrice,
      issued_by: user?.email || 'unknown',
      issued_at: new Date().toISOString(),
      notes: form.notes,
      status: 'issued',
      tracking_number: form.tracking_number,
      return_date: null,
    }

    // Update item quantities
    const updatedItems = items.map((i) =>
      i.id === item.id
        ? {
            ...i,
            quantity_available: i.quantity_available - qty,
            quantity_issued: i.quantity_issued + qty,
            status:
              i.quantity_available - qty <= 0
                ? ('issued' as const)
                : i.status,
            updated_at: new Date().toISOString(),
          }
        : i
    )

    persistItems(updatedItems)
    persistIssuances([...issuances, issuance])
    toast.success(`${qty} unit(s) issued to ${org?.name || 'customer'}`)
  }

  // ── Issuance Status Updates ─────────────────────────────────
  const handleMarkDelivered = (iss: HardwareIssuance) => {
    const updated = issuances.map((i) =>
      i.id === iss.id ? { ...i, status: 'delivered' as const } : i
    )
    persistIssuances(updated)
    toast.success('Marked as delivered')
  }

  const handleMarkReturned = (iss: HardwareIssuance) => {
    const updated = issuances.map((i) =>
      i.id === iss.id
        ? {
            ...i,
            status: 'returned' as const,
            return_date: new Date().toISOString(),
          }
        : i
    )
    persistIssuances(updated)

    // Return quantity to inventory
    const updatedItems = items.map((item) =>
      item.id === iss.inventory_item_id
        ? {
            ...item,
            quantity_available: item.quantity_available + iss.quantity,
            quantity_issued: item.quantity_issued - iss.quantity,
            status: 'in_stock' as const,
            updated_at: new Date().toISOString(),
          }
        : item
    )
    persistItems(updatedItems)
    toast.success('Marked as returned — stock restored')
  }

  // ── Vendor CRUD ─────────────────────────────────────────────
  const handleSaveVendor = async (
    form: VendorFormValues,
    editId?: string
  ) => {
    const now = new Date().toISOString()
    if (editId) {
      const updated = vendors.map((v) =>
        v.id === editId
          ? {
              ...v,
              ...form,
              lead_time_days: parseInt(form.lead_time_days, 10) || 0,
              quality_rating: parseInt(form.quality_rating, 10) || 3,
              updated_at: now,
            }
          : v
      )
      persistVendors(updated)
      toast.success('Vendor updated')
    } else {
      const newVendor: Vendor = {
        id: uuid(),
        ...form,
        lead_time_days: parseInt(form.lead_time_days, 10) || 0,
        quality_rating: parseInt(form.quality_rating, 10) || 3,
        created_at: now,
        updated_at: now,
      }
      persistVendors([...vendors, newVendor])
      toast.success('Vendor added')
    }
  }

  const handleDeleteVendor = async (vendor: Vendor) => {
    persistVendors(vendors.filter((v) => v.id !== vendor.id))
    toast.success('Vendor deleted')
  }

  // ── Stats ───────────────────────────────────────────────────
  const stats = computeStats(items, issuances)

  // ── Loading & Auth Guards ───────────────────────────────────
  if (isLoading || loading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">
              Please select an organization to manage inventory
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={currentOrganization?.settings}
            name={currentOrganization?.name || 'NetNeural'}
            size="xl"
          />
          <div>
            <div className="flex items-center gap-2">
              <Warehouse className="h-6 w-6 text-primary" />
              <h2 className="text-3xl font-bold tracking-tight">
                Inventory Control
              </h2>
            </div>
            <p className="text-muted-foreground">
              Track hardware inventory, issue to customers, manage vendors &
              manufacturers
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditItem(null)
            setAddEditOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            Inventory
            {items.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {items.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="issuances" className="flex items-center gap-1.5">
            <Truck className="h-4 w-4" />
            Issuances
            {issuances.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {issuances.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="vendors" className="flex items-center gap-1.5">
            <Building className="h-4 w-4" />
            Vendors & Manufacturers
            {vendors.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {vendors.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Dashboard */}
        <TabsContent value="dashboard" className="mt-4">
          <InventoryDashboard stats={stats} />
        </TabsContent>

        {/* Tab: Inventory */}
        <TabsContent value="inventory" className="mt-4">
          <InventoryTable
            items={items}
            onEdit={handleEditItem}
            onIssue={handleOpenIssue}
            onDelete={handleDeleteItem}
          />
        </TabsContent>

        {/* Tab: Issuances */}
        <TabsContent value="issuances" className="mt-4">
          <IssuanceHistoryPanel
            issuances={issuances}
            onMarkDelivered={handleMarkDelivered}
            onMarkReturned={handleMarkReturned}
          />
        </TabsContent>

        {/* Tab: Vendors & Manufacturers */}
        <TabsContent value="vendors" className="mt-4">
          <VendorManufacturerPanel
            vendors={vendors}
            onSave={handleSaveVendor}
            onDelete={handleDeleteVendor}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddEditItemDialog
        open={addEditOpen}
        onClose={() => {
          setAddEditOpen(false)
          setEditItem(null)
        }}
        onSave={handleSaveItem}
        editItem={editItem}
        vendors={vendors}
      />

      <IssueHardwareDialog
        open={issueDialogOpen}
        onClose={() => {
          setIssueDialogOpen(false)
          setIssueItem(null)
        }}
        onIssue={handleIssueHardware}
        item={issueItem}
        organizations={organizations}
      />
    </div>
  )
}
