# Changelog

All notable changes to the NetNeural IoT Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-09

### Added

#### Database Schema (Issue #80)
- Added `last_seen_online` column to devices table for tracking connection timestamps
- Added `last_seen_offline` column to devices table for tracking disconnection timestamps  
- Added `hardware_ids` TEXT[] column to devices table for multiple hardware identifiers
- Added `cohort_id` column to devices table for OTA update group management
- Created performance indexes on new timestamp and cohort_id columns
- Created GIN index on hardware_ids array column

#### Integration Provider Interface (Issue #82)
- Created `DeviceIntegrationProvider` abstract base class (`src/lib/integrations/base-integration-provider.ts`)
- Implemented common interfaces: `DeviceData`, `DeviceStatus`, `ConnectionInfo`, `ProviderCapabilities`
- Created `GoliothIntegrationProvider` implementation with full Golioth API mapping
- Built `IntegrationProviderFactory` with provider registry pattern for dynamic instantiation
- Added firmware component parsing from Golioth metadata
- Added health metrics extraction (battery, signal strength, temperature)

#### Generic Sync Orchestrator (Issue #88)
- Created provider-agnostic `SyncOrchestrator` class (`src/lib/sync/generic-sync-orchestrator.ts`)
- Implemented `syncOrganization()` method to sync all integrations for an organization
- Implemented `syncIntegration()` method with device matching and creation logic
- Added feature flags system (`src/lib/config/feature-flags.ts`) for gradual rollout:
  - `USE_GENERIC_SYNC`: Enable new provider-agnostic sync
  - `USE_UNIFIED_STATUS_API`: Enable unified device status API
  - `DEBUG_SYNC`: Enable detailed sync logging

#### Unified Device Status API (Issue #89)
- Created unified device status types (`src/types/unified-device-status.ts`)
- Created REST API endpoint `/api/devices/[id]/status` for real-time device status
- Built `useDeviceStatus` React hook with auto-refresh capability
- Created `DeviceStatusCard` component for displaying device status with:
  - Real-time status indicators (online, offline, warning, error)
  - Firmware version display with component breakdown
  - Health metrics (battery, signal strength, temperature)
  - Connection history (last seen timestamps)
  - Provider information and cohort tracking

### Changed

#### Data Model
- Extended `GoliothDevice` interface with optional new fields (backward compatible)
- Updated `organization-golioth-sync.ts` to capture all new fields during sync
- Regenerated TypeScript database types from schema

#### Dependencies
- Updated `@supabase/supabase-js` from 2.75.0 to 2.80.0
- Updated `supabase` CLI from 2.51.0 to 2.58.3
- Updated `@sentry/nextjs` from 10.22.0 to 10.23.0
- Fixed 2 security vulnerabilities via `npm audit fix`

### Technical Details

#### Migration
- Migration file: `20251109000001_add_golioth_device_fields.sql`
- All new columns are nullable (NON-BREAKING change)
- Database indexes created for optimal query performance

#### Architecture
- Provider abstraction enables multi-cloud IoT support (Golioth, AWS IoT, Azure IoT, etc.)
- Factory pattern allows dynamic provider instantiation based on integration type
- Sync orchestrator uses provider interface for cloud-agnostic device synchronization
- Feature flags enable safe parallel testing before production cutover

#### Type Safety
- All changes pass TypeScript strict type checking
- Database types auto-generated from Supabase schema
- No `any` types used (replaced with `unknown` for proper type safety)

### Non-Breaking Changes
- All database columns are nullable to maintain backward compatibility
- Existing Golioth sync service preserved (not replaced)
- Feature flags default to `false` for safe rollout
- Old API endpoints unchanged

### Development Notes
- Type checking: ✓ Passed with 0 errors
- PM2 processes: ✓ Both services healthy and stable
- Database migration: ✓ Applied successfully with indexes
- Security: ✓ All vulnerabilities resolved

---

## [1.0.0] - 2025-01-08

### Initial Release
- Next.js 15.5.5 with Turbopack
- Supabase PostgreSQL backend
- TypeScript with strict type checking
- PM2 process management
- Golioth IoT integration
- Basic device management
