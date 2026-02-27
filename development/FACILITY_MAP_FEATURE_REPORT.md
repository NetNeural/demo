# FACILITY MAP - COMPLETE FEATURE REPORT

**Date:** February 27, 2026  
**Project:** NetNeural IoT Platform  
**Status:** ✅ **DEVELOPMENT COMPLETE** - Deployed to Staging & Dev  
**Epic:** GitHub Issue #300 — Facilities Map  
**Commit:** `eba00eb` (staging) / `f2f7bd4` (dev)

---

## 📊 Executive Summary

The Facility Map feature provides an **interactive visual floor plan system** for placing and monitoring IoT devices on uploaded facility images. Users can create multiple maps, drag-and-drop devices onto them, and view real-time device status, telemetry data, and navigation — all from within the Devices dashboard page.

✅ **8 Components:** Full-featured component library  
✅ **2 Database Tables:** `facility_maps` + `device_map_placements` with RLS  
✅ **1 Storage Bucket:** `facility-maps` for floor plan images  
✅ **17+ User-Facing Features:** From basic map CRUD to PNG export and fullscreen  
✅ **Real-Time Updates:** Live device status via Supabase subscriptions  
✅ **3 Planned Features:** GitHub stories #302, #303, #304

---

## 🗂️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Facility Map System                       │
├─────────────────────────────────────────────────────────────┤
│  FacilityMapView (Orchestrator)                             │
│    ├─ FacilityMapCanvas (Interactive map rendering)         │
│    │    └─ DeviceMarker (Status dots + tooltips + nav)      │
│    ├─ DevicePalette (Device list + search + place)          │
│    ├─ MapManagerDialog (Map CRUD dialog)                    │
│    └─ FacilityMapUploader (Image upload + camera)           │
├─────────────────────────────────────────────────────────────┤
│  Database Layer (Supabase)                                  │
│    ├─ facility_maps table (map metadata + image ref)        │
│    ├─ device_map_placements table (device positions)        │
│    ├─ device_telemetry_history (telemetry lookups)          │
│    └─ facility-maps storage bucket (floor plan images)      │
├─────────────────────────────────────────────────────────────┤
│  Types: facility-map.ts                                     │
│    ├─ FacilityMap, DeviceMapPlacement, PlacedDevice         │
│    ├─ MapViewport, PlacementMode                            │
│    └─ latestTelemetry extension on PlacedDevice             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Component Inventory

### ✅ 1. FacilityMapView — Main Orchestrator

**File:** `src/components/facility-map/FacilityMapView.tsx` (731 lines)  
**Status:** ✅ Fully Implemented  
**Description:** Top-level component that manages all state, data loading, and feature coordination.

**Features:**

- ✅ Loads maps, devices, placements, locations, and telemetry from Supabase
- ✅ Real-time device status updates via `postgres_changes` subscription
- ✅ Horizontal scrolling thumbnail strip with device count badges
- ✅ View / Edit mode toggle for admin-controlled placement
- ✅ Bulk placement mode — auto-selects next unplaced device after placing one
- ✅ Map CRUD (create, update, delete) via MapManagerDialog
- ✅ Placement CRUD (place, move, remove) with percentage-based coordinates
- ✅ Empty state with "Add Your First Map" call-to-action
- ✅ Device navigation via `useRouter` → `/dashboard/devices/view?id={deviceId}`
- ✅ Telemetry data loading from `device_telemetry_history` table

---

### ✅ 2. FacilityMapCanvas — Interactive Map Rendering

**File:** `src/components/facility-map/FacilityMapCanvas.tsx` (310 lines)  
**Status:** ✅ Fully Implemented  
**Description:** Renders the floor plan image with device markers overlaid. Supports click-to-place, drag-to-reposition, touch events, and real-time status display.

**Features:**

- ✅ Floor plan image rendering with responsive scaling
- ✅ Click-to-place — click anywhere on the map to position a device
- ✅ Touch support via `handleTouchEnd` for mobile/tablet
- ✅ Percentage-based positioning (0–100) for responsive device placement
- ✅ Status summary bar — shows online/offline/warning/error/maintenance counts
- ✅ Export map as PNG — Canvas API renders image + colored device dots + labels
- ✅ Fullscreen toggle — Browser Fullscreen API on the canvas container
- ✅ Toolbar with contextual badges (place/edit/view mode hints)
- ✅ Download button for one-click PNG export
- ✅ Fullscreen/minimize toggle button
- ✅ Delete button for removing selected placements in edit mode

---

### ✅ 3. DeviceMarker — Device Dot with Tooltips & Navigation

**File:** `src/components/facility-map/DeviceMarker.tsx` (265 lines)  
**Status:** ✅ Fully Implemented  
**Description:** Renders a single device dot on the canvas. Shows status colour, animated pulse, rich tooltip on hover, and supports click-to-navigate and drag-to-reposition.

**Features:**

- ✅ Status-colored dots (green/gray/amber/red/blue) with glow shadow
- ✅ Animated pulse ring for online devices
- ✅ 3 size options: small, medium, large
- ✅ Rich hover tooltip displaying:
  - Device name and status badge
  - Relative time since last seen (e.g., "5m ago", "2h ago")
  - Device type
  - Battery level (when available)
  - Last telemetry readings (up to 6 key-value pairs)
- ✅ Click-to-navigate in view mode → opens device detail page
- ✅ ExternalLink icon and "Click to view details" hint in view mode
- ✅ Drag-and-drop repositioning in edit mode
- ✅ `formatRelativeTime()` utility for human-readable timestamps
- ✅ `formatTelemetryKey()` — converts snake_case keys to Title Case for display

---

### ✅ 4. DevicePalette — Device List & Search

**File:** `src/components/facility-map/DevicePalette.tsx` (191 lines)  
**Status:** ✅ Fully Implemented  
**Description:** Side panel listing all devices in the organization. Shows placed vs unplaced status, allows search filtering, and triggers placement mode.

**Features:**

- ✅ Lists all organization devices with status dots
- ✅ Search/filter input to find devices by name
- ✅ Clear filter button (X icon)
- ✅ Placed devices shown with green "Placed" badge and MapPin icon
- ✅ Unplaced devices show "Place on Map" button
- ✅ Status icons per device (Wifi, WifiOff, AlertTriangle, Wrench)
- ✅ Selected-to-place device highlighted with primary ring
- ✅ Cancel placement button
- ✅ Remove existing placement via trash icon
- ✅ Loading skeleton state
- ✅ Empty state messaging when no devices match filter

---

### ✅ 5. MapManagerDialog — Map Create / Edit Dialog

**File:** `src/components/facility-map/MapManagerDialog.tsx` (220 lines)  
**Status:** ✅ Fully Implemented  
**Description:** Modal dialog for creating new maps or editing existing ones. Handles map metadata and floor plan image upload.

**Features:**

- ✅ Create new facility map with name, description, floor level, and location
- ✅ Edit existing map metadata
- ✅ Location dropdown with all organization locations
- ✅ "No Location" option for unassigned maps
- ✅ Floor level number input
- ✅ Integrated FacilityMapUploader for image management
- ✅ Form validation (name required)
- ✅ Loading state during save
- ✅ Accessible dialog with description

---

### ✅ 6. FacilityMapUploader — Image Upload & Camera

**File:** `src/components/facility-map/FacilityMapUploader.tsx` (258 lines)  
**Status:** ✅ Fully Implemented  
**Description:** Handles floor plan image upload via drag-and-drop, file picker, or device camera capture. Validates file type and size, uploads to Supabase Storage.

**Features:**

- ✅ Drag-and-drop upload zone with visual feedback
- ✅ File picker via click-to-browse
- ✅ Camera capture (`capture="environment"`) for mobile photo
- ✅ File type validation: PNG, JPG, WebP, SVG
- ✅ File size validation: max 10 MB
- ✅ Uploads to Supabase Storage `facility-maps` bucket
- ✅ Extracts image dimensions (width × height) for metadata
- ✅ Compact mode (replace/take photo) when image already exists
- ✅ Upload progress indicator
- ✅ Preview of uploaded image
- ✅ Error toast on invalid files

---

### ✅ 7. Type Definitions

**File:** `src/types/facility-map.ts` (61 lines)  
**Status:** ✅ Fully Implemented  
**Description:** TypeScript type definitions for the entire Facility Map domain.

**Types Defined:**

- ✅ `FacilityMap` — Map record with image metadata, org/location refs, settings
- ✅ `DeviceMapPlacement` — Position record with x/y percentages, display settings
- ✅ `PlacedDevice` — Joined device data (name, status, battery, signal, telemetry)
- ✅ `MapViewport` — Scale and offset for future zoom/pan
- ✅ `PlacementMode` — Union type: `'view' | 'place' | 'edit'`

---

### ✅ 8. Barrel Export

**File:** `src/components/facility-map/index.ts`  
**Status:** ✅ Implemented  
**Description:** Re-exports all 6 components for clean imports.

---

## 🗄️ Database Schema

### Table: `facility_maps`

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated primary key |
| `organization_id` | UUID (FK) | References `organizations.id` |
| `location_id` | UUID (FK, nullable) | References `locations.id` |
| `name` | VARCHAR(255) | Map name (required) |
| `description` | TEXT | Optional description |
| `floor_level` | INTEGER | Floor number (default 0) |
| `image_url` | TEXT | Public URL in Supabase Storage |
| `image_path` | TEXT | Storage path for deletion |
| `image_width` | INTEGER | Original pixel width |
| `image_height` | INTEGER | Original pixel height |
| `is_active` | BOOLEAN | Active flag (default true) |
| `sort_order` | INTEGER | Display order (default 0) |
| `settings` | JSONB | Additional config |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `created_by` | UUID (FK) | References `auth.users.id` |

### Table: `device_map_placements`

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated primary key |
| `facility_map_id` | UUID (FK) | References `facility_maps.id` (CASCADE) |
| `device_id` | UUID (FK) | References `devices.id` (CASCADE) |
| `x_percent` | DECIMAL(6,3) | X position 0–100 (responsive) |
| `y_percent` | DECIMAL(6,3) | Y position 0–100 (responsive) |
| `label` | VARCHAR(255) | Custom label (defaults to device name) |
| `icon_size` | VARCHAR(20) | `'small'`, `'medium'`, `'large'` |
| `rotation` | DECIMAL(5,2) | Rotation in degrees (default 0) |
| `settings` | JSONB | Additional display config |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Constraint:** `UNIQUE(facility_map_id, device_id)` — each device appears once per map.

### Storage Bucket: `facility-maps`

- **Access:** Public read
- **Max Size:** 10 MB per file
- **Allowed Types:** PNG, JPG, WebP, SVG
- **Path Pattern:** `{organization_id}/{timestamp}_{filename}`

---

## 🔒 Security — Row-Level Security (RLS)

### facility_maps

| Policy | Operation | Rule |
|---|---|---|
| Users can view their org maps | SELECT | `organization_id` in user's memberships |
| Admins can insert maps | INSERT | User role is `owner` or `admin` |
| Admins can update maps | UPDATE | User role is `owner` or `admin` |
| Admins can delete maps | DELETE | User role is `owner` or `admin` |

### device_map_placements

| Policy | Operation | Rule |
|---|---|---|
| Users can view placements | SELECT | Parent map's `organization_id` in user's memberships |
| Admins can insert placements | INSERT | User role is `owner` or `admin` on parent map's org |
| Admins can update placements | UPDATE | User role is `owner` or `admin` on parent map's org |
| Admins can delete placements | DELETE | User role is `owner` or `admin` on parent map's org |

### Storage Policies

| Policy | Operation | Rule |
|---|---|---|
| Authenticated users can upload | INSERT | User is authenticated |
| Anyone can view images | SELECT | Public access |
| Authenticated users can update | UPDATE | User is authenticated |
| Authenticated users can delete | DELETE | User is authenticated |

---

## 🎯 Feature Summary — All 17+ Features

### Core Features

| # | Feature | Status | Description |
|---|---|---|---|
| 1 | Map CRUD | ✅ Done | Create, edit, delete facility maps with metadata |
| 2 | Image Upload | ✅ Done | Drag-and-drop, file picker, camera capture |
| 3 | Click-to-Place | ✅ Done | Click map canvas to position a device |
| 4 | Drag-to-Reposition | ✅ Done | Drag placed devices to new positions |
| 5 | Real-Time Status | ✅ Done | Live device status via Supabase subscriptions |
| 6 | Responsive Positioning | ✅ Done | Percentage-based (0–100) coordinates |
| 7 | Touch Support | ✅ Done | Touch events for mobile/tablet devices |
| 8 | Multiple Maps | ✅ Done | Thumbnail strip with horizontal scrolling |
| 9 | Mode Switching | ✅ Done | View / Place / Edit modes for the canvas |

### Enhanced Features (Batch 2)

| # | Feature | Status | Description |
|---|---|---|---|
| 10 | Device Count Badges | ✅ Done | Badge showing placement count on each map thumbnail |
| 11 | Click-to-Navigate | ✅ Done | Click device dot → opens device detail page |
| 12 | Status Summary Bar | ✅ Done | Online/offline/warning/error/maintenance counts |
| 13 | Search Filter | ✅ Done | Filter devices by name in device palette |
| 14 | Export PNG | ✅ Done | Download map as PNG with device markers + labels |
| 15 | Telemetry Tooltips | ✅ Done | Hover device to see latest sensor readings |
| 16 | Bulk Placement | ✅ Done | Auto-select next unplaced device after placing one |
| 17 | Fullscreen Toggle | ✅ Done | Full-screen canvas via Browser Fullscreen API |

---

## 📋 Planned Features (GitHub Stories)

| Issue | Feature | Status | Description |
|---|---|---|---|
| #302 | Map Annotations & Zones | 📋 Planned | Draw zones, add labels, create areas on maps |
| #303 | Heatmap Overlay | 📋 Planned | Gradient heatmap based on telemetry values |
| #304 | Device Type Filters | 📋 Planned | Toggle device types on/off for map visibility |

---

## 📁 File Manifest

| File | Lines | Purpose |
|---|---|---|
| `src/types/facility-map.ts` | 61 | TypeScript type definitions |
| `src/components/facility-map/index.ts` | 8 | Barrel export |
| `src/components/facility-map/FacilityMapView.tsx` | 731 | Main orchestrator |
| `src/components/facility-map/FacilityMapCanvas.tsx` | 310 | Canvas rendering + tools |
| `src/components/facility-map/DeviceMarker.tsx` | 265 | Device dot + tooltip |
| `src/components/facility-map/DevicePalette.tsx` | 191 | Device list + search |
| `src/components/facility-map/MapManagerDialog.tsx` | 220 | Map CRUD dialog |
| `src/components/facility-map/FacilityMapUploader.tsx` | 258 | Image upload + camera |
| `supabase/migrations/20260227100000_facility_maps.sql` | 211 | Database migration |
| `src/app/dashboard/devices/page.tsx` | — | Integration point |

**Total:** ~2,255 lines of code across 10 files

---

## 🚀 Deployment Status

| Environment | Status | Details |
|---|---|---|
| **Development** (dev) | ✅ Deployed | Cherry-picked `f2f7bd4`, migration applied |
| **Staging** | ✅ Deployed | Commit `eba00eb`, code deployed via GitHub Actions |
| **Production** | ⏳ Pending | Awaiting promotion from staging |

### Migration Status

| Environment | Supabase Ref | Migration Applied |
|---|---|---|
| Dev | `tsomafkalaoarnuwgdyu` | ✅ Applied |
| Staging | `atgbmxicqikmapfqouco` | ⏳ Pending |
| Production | `bldojxpockljyivldxwf` | ⏳ Pending |

---

## 🔗 Integration Points

- **Devices Page:** `FacilityMapView` is embedded at the top of `/dashboard/devices`
- **Device Detail:** Click-to-navigate routes to `/dashboard/devices/view?id={deviceId}`
- **Telemetry:** Reads from `device_telemetry_history` table for tooltip display
- **Locations:** Dropdown populated from `locations` table for map organization
- **Organizations:** All queries scoped to current organization via `OrganizationContext`
- **Real-Time:** Supabase `postgres_changes` subscription on `devices` table for live status
