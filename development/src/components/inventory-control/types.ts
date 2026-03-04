/**
 * NetNeural Inventory Control — Type Definitions
 *
 * Types for tracking hardware inventory, manufacturing costs,
 * pricing, quantities, states, customer issuances, and
 * vendor/manufacturer relationships.
 */

/** Inventory item status lifecycle */
export type InventoryStatus =
  | 'in_stock'
  | 'allocated'
  | 'issued'
  | 'returned'
  | 'defective'
  | 'retired'

/** Hardware category matching NetNeural device types */
export type HardwareCategory =
  | 'modular_sensor'
  | 'hub'
  | 'cellular_hub'
  | 'accessory'
  | 'component'
  | 'other'

/** Vendor/Manufacturer type */
export type VendorType = 'manufacturer' | 'vendor' | 'distributor' | 'oem_partner'

/** Vendor/Manufacturer status */
export type VendorStatus = 'active' | 'inactive' | 'pending' | 'suspended'

/** Vendor / Manufacturer record */
export interface Vendor {
  id: string
  name: string
  type: VendorType
  status: VendorStatus
  contact_name: string
  contact_email: string
  contact_phone: string
  website: string
  address_line1: string
  address_line2: string
  city: string
  state_province: string
  postal_code: string
  country: string
  tax_id: string
  payment_terms: string
  lead_time_days: number
  quality_rating: number // 1-5
  categories: HardwareCategory[]
  notes: string
  created_at: string
  updated_at: string
}

/** Form values for vendor/manufacturer */
export interface VendorFormValues {
  name: string
  type: VendorType
  status: VendorStatus
  contact_name: string
  contact_email: string
  contact_phone: string
  website: string
  address_line1: string
  address_line2: string
  city: string
  state_province: string
  postal_code: string
  country: string
  tax_id: string
  payment_terms: string
  lead_time_days: string
  quality_rating: string
  categories: HardwareCategory[]
  notes: string
}

/** Inventory item record */
export interface InventoryItem {
  id: string
  sku: string
  name: string
  description: string
  category: HardwareCategory
  status: InventoryStatus

  // Quantities
  quantity_total: number
  quantity_available: number
  quantity_allocated: number
  quantity_issued: number
  quantity_defective: number
  reorder_threshold: number

  // Financials
  manufacturing_cost: number
  wholesale_price: number
  retail_price: number
  currency: string

  // Hardware details
  model_number: string
  hardware_version: string
  firmware_version: string
  serial_prefix: string

  // Vendor / Manufacturer
  manufacturer_id: string | null
  manufacturer_name: string
  vendor_id: string | null
  vendor_name: string

  // Tracking
  supplier: string
  warehouse_location: string
  batch_number: string
  manufacture_date: string | null

  // Metadata
  created_at: string
  updated_at: string
  created_by: string | null
  notes: string
}

/** Form values for creating/editing inventory items */
export interface InventoryFormValues {
  sku: string
  name: string
  description: string
  category: HardwareCategory
  quantity_total: string
  reorder_threshold: string
  manufacturing_cost: string
  wholesale_price: string
  retail_price: string
  currency: string
  model_number: string
  hardware_version: string
  firmware_version: string
  serial_prefix: string
  manufacturer_id: string
  vendor_id: string
  supplier: string
  warehouse_location: string
  batch_number: string
  manufacture_date: string
  notes: string
}

/** Hardware issuance to a customer */
export interface HardwareIssuance {
  id: string
  inventory_item_id: string
  inventory_item_name: string
  customer_org_id: string
  customer_org_name: string
  quantity: number
  serial_numbers: string[]
  unit_price: number
  total_price: number
  issued_by: string
  issued_at: string
  notes: string
  status: 'issued' | 'delivered' | 'returned' | 'cancelled'
  tracking_number: string
  return_date: string | null
}

/** Form values for issuing hardware */
export interface IssuanceFormValues {
  inventory_item_id: string
  customer_org_id: string
  quantity: string
  serial_numbers: string
  unit_price: string
  notes: string
  tracking_number: string
}

/** Summary stats for dashboard cards */
export interface InventoryStats {
  totalItems: number
  totalValue: number
  lowStockCount: number
  totalIssued: number
  totalRevenue: number
  categoryCounts: Record<HardwareCategory, number>
}

/** Sort options for inventory table */
export type InventorySortField =
  | 'name'
  | 'sku'
  | 'category'
  | 'quantity_available'
  | 'manufacturing_cost'
  | 'retail_price'
  | 'status'
  | 'updated_at'

export type SortDirection = 'asc' | 'desc'

/** Category display labels */
export const CATEGORY_LABELS: Record<HardwareCategory, string> = {
  modular_sensor: 'Modular Sensor',
  hub: 'Hub',
  cellular_hub: 'Cellular Hub',
  accessory: 'Accessory',
  component: 'Component',
  other: 'Other',
}

/** Vendor type labels */
export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  manufacturer: 'Manufacturer',
  vendor: 'Vendor / Supplier',
  distributor: 'Distributor',
  oem_partner: 'OEM Partner',
}

/** Vendor status config */
export const VENDOR_STATUS_CONFIG: Record<
  VendorStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  active: { label: 'Active', variant: 'default' },
  inactive: { label: 'Inactive', variant: 'outline' },
  pending: { label: 'Pending', variant: 'secondary' },
  suspended: { label: 'Suspended', variant: 'destructive' },
}

/** Status display labels and colors */
export const STATUS_CONFIG: Record<
  InventoryStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  in_stock: { label: 'In Stock', variant: 'default' },
  allocated: { label: 'Allocated', variant: 'secondary' },
  issued: { label: 'Issued', variant: 'outline' },
  returned: { label: 'Returned', variant: 'secondary' },
  defective: { label: 'Defective', variant: 'destructive' },
  retired: { label: 'Retired', variant: 'outline' },
}

/** Default form values for new inventory item */
export const DEFAULT_INVENTORY_FORM: InventoryFormValues = {
  sku: '',
  name: '',
  description: '',
  category: 'modular_sensor',
  quantity_total: '0',
  reorder_threshold: '10',
  manufacturing_cost: '0.00',
  wholesale_price: '0.00',
  retail_price: '0.00',
  currency: 'USD',
  model_number: '',
  hardware_version: '',
  firmware_version: '',
  serial_prefix: 'NN-',
  manufacturer_id: '',
  vendor_id: '',
  supplier: '',
  warehouse_location: '',
  batch_number: '',
  manufacture_date: '',
  notes: '',
}

/** Default issuance form values */
export const DEFAULT_ISSUANCE_FORM: IssuanceFormValues = {
  inventory_item_id: '',
  customer_org_id: '',
  quantity: '1',
  serial_numbers: '',
  unit_price: '',
  notes: '',
  tracking_number: '',
}

/** Default vendor form values */
export const DEFAULT_VENDOR_FORM: VendorFormValues = {
  name: '',
  type: 'vendor',
  status: 'active',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  website: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state_province: '',
  postal_code: '',
  country: 'US',
  tax_id: '',
  payment_terms: 'Net 30',
  lead_time_days: '14',
  quality_rating: '3',
  categories: [],
  notes: '',
}
