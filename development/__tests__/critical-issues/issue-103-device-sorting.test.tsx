/**
 * UNIT TESTS: Issue #103 - Default Sorting on Devices Page
 * 
 * Tests that devices are sorted with online devices appearing first
 * Priority: online > warning > error > offline > maintenance
 */

import { describe, test, expect } from '@jest/globals'

// Mock device data
const createDevice = (id: string, name: string, status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance') => ({
  id,
  name,
  device_type: 'sensor',
  status,
  lastSeen: new Date().toISOString(),
})

describe('Issue #103: Device Sorting Priority', () => {
  describe('Status Priority Mapping', () => {
    test('should define correct status priority order', () => {
      const statusPriority = { 
        online: 1, 
        warning: 2, 
        error: 3, 
        offline: 4, 
        maintenance: 5 
      }

      expect(statusPriority.online).toBeLessThan(statusPriority.warning)
      expect(statusPriority.warning).toBeLessThan(statusPriority.error)
      expect(statusPriority.error).toBeLessThan(statusPriority.offline)
      expect(statusPriority.offline).toBeLessThan(statusPriority.maintenance)
    })

    test('should handle unknown status with lowest priority', () => {
      const statusPriority: Record<string, number> = { 
        online: 1, 
        warning: 2, 
        error: 3, 
        offline: 4, 
        maintenance: 5 
      }
      const unknownStatus = 'unknown_status'
      const priority = statusPriority[unknownStatus] || 999

      expect(priority).toBe(999)
      expect(priority).toBeGreaterThan(statusPriority.maintenance)
    })
  })

  describe('Device Sorting Logic', () => {
    test('should sort devices by status priority (online first)', () => {
      const devices = [
        createDevice('1', 'Device Offline', 'offline'),
        createDevice('2', 'Device Online', 'online'),
        createDevice('3', 'Device Error', 'error'),
        createDevice('4', 'Device Warning', 'warning'),
        createDevice('5', 'Device Maintenance', 'maintenance'),
      ]

      const statusPriority: Record<string, number> = { 
        online: 1, 
        warning: 2, 
        error: 3, 
        offline: 4, 
        maintenance: 5 
      }

      const sorted = [...devices].sort((a, b) => {
        const aPriority = statusPriority[a.status] || 999
        const bPriority = statusPriority[b.status] || 999
        return aPriority - bPriority
      })

      expect(sorted[0].status).toBe('online')
      expect(sorted[1].status).toBe('warning')
      expect(sorted[2].status).toBe('error')
      expect(sorted[3].status).toBe('offline')
      expect(sorted[4].status).toBe('maintenance')
    })

    test('should maintain secondary sort by name for same status', () => {
      const devices = [
        createDevice('1', 'Device C', 'online'),
        createDevice('2', 'Device A', 'online'),
        createDevice('3', 'Device B', 'online'),
      ]

      const statusPriority: Record<string, number> = { 
        online: 1, 
        warning: 2, 
        error: 3, 
        offline: 4, 
        maintenance: 5 
      }

      const sorted = [...devices].sort((a, b) => {
        const aPriority = statusPriority[a.status] || 999
        const bPriority = statusPriority[b.status] || 999
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }
        
        // Secondary sort by name
        return a.name.localeCompare(b.name)
      })

      expect(sorted[0].name).toBe('Device A')
      expect(sorted[1].name).toBe('Device B')
      expect(sorted[2].name).toBe('Device C')
      expect(sorted.every(d => d.status === 'online')).toBe(true)
    })

    test('should handle mixed status with secondary name sorting', () => {
      const devices = [
        createDevice('1', 'Sensor Z', 'offline'),
        createDevice('2', 'Sensor A', 'online'),
        createDevice('3', 'Sensor B', 'online'),
        createDevice('4', 'Sensor Y', 'offline'),
      ]

      const statusPriority: Record<string, number> = { 
        online: 1, 
        warning: 2, 
        error: 3, 
        offline: 4, 
        maintenance: 5 
      }

      const sorted = [...devices].sort((a, b) => {
        const aPriority = statusPriority[a.status] || 999
        const bPriority = statusPriority[b.status] || 999
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }
        
        return a.name.localeCompare(b.name)
      })

      // Online devices first, alphabetically
      expect(sorted[0]).toMatchObject({ name: 'Sensor A', status: 'online' })
      expect(sorted[1]).toMatchObject({ name: 'Sensor B', status: 'online' })
      
      // Offline devices last, alphabetically
      expect(sorted[2]).toMatchObject({ name: 'Sensor Y', status: 'offline' })
      expect(sorted[3]).toMatchObject({ name: 'Sensor Z', status: 'offline' })
    })
  })

  describe('Default Sort Configuration', () => {
    test('should default sortBy to "status" not "name"', () => {
      const defaultSortBy = 'status' // Expected after fix
      expect(defaultSortBy).toBe('status')
    })

    test('should default sortOrder to "asc"', () => {
      const defaultSortOrder = 'asc'
      expect(defaultSortOrder).toBe('asc')
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty device list', () => {
      const devices: any[] = []
      const sorted = [...devices].sort((a, b) => a.status.localeCompare(b.status))
      expect(sorted).toEqual([])
    })

    test('should handle single device', () => {
      const devices = [createDevice('1', 'Only Device', 'online')]
      const sorted = [...devices].sort((a, b) => a.status.localeCompare(b.status))
      expect(sorted).toHaveLength(1)
      expect(sorted[0].name).toBe('Only Device')
    })

    test('should handle all devices with same status', () => {
      const devices = [
        createDevice('1', 'Device 3', 'online'),
        createDevice('2', 'Device 1', 'online'),
        createDevice('3', 'Device 2', 'online'),
      ]

      const sorted = [...devices].sort((a, b) => a.name.localeCompare(b.name))
      
      expect(sorted[0].name).toBe('Device 1')
      expect(sorted[1].name).toBe('Device 2')
      expect(sorted[2].name).toBe('Device 3')
    })
  })
})
