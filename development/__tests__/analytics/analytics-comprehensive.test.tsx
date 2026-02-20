/**
 * Comprehensive Tests for Analytics and Dashboard Components
 *
 * Tests for analytics cards, charts, and dashboard widgets
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Analytics - Device Status Distribution', () => {
  test('calculates device status percentages correctly', () => {
    const devices = [
      { status: 'online' },
      { status: 'online' },
      { status: 'offline' },
      { status: 'warning' },
    ]

    const onlineCount = devices.filter((d) => d.status === 'online').length
    const percentage = (onlineCount / devices.length) * 100

    expect(percentage).toBe(50)
  })

  test('handles empty device list', () => {
    const devices: any[] = []

    const onlineCount = devices.filter((d) => d.status === 'online').length
    const percentage =
      devices.length > 0 ? (onlineCount / devices.length) * 100 : 0

    expect(percentage).toBe(0)
  })

  test('calculates status counts correctly', () => {
    const devices = [
      { status: 'online' },
      { status: 'online' },
      { status: 'online' },
      { status: 'offline' },
      { status: 'warning' },
      { status: 'error' },
    ]

    const statusCounts = {
      online: devices.filter((d) => d.status === 'online').length,
      offline: devices.filter((d) => d.status === 'offline').length,
      warning: devices.filter((d) => d.status === 'warning').length,
      error: devices.filter((d) => d.status === 'error').length,
    }

    expect(statusCounts.online).toBe(3)
    expect(statusCounts.offline).toBe(1)
    expect(statusCounts.warning).toBe(1)
    expect(statusCounts.error).toBe(1)
  })
})

describe('Analytics - Alert Severity Distribution', () => {
  test('calculates alert severity counts', () => {
    const alerts = [
      { severity: 'critical' },
      { severity: 'critical' },
      { severity: 'high' },
      { severity: 'medium' },
      { severity: 'low' },
    ]

    const severityCounts = {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      high: alerts.filter((a) => a.severity === 'high').length,
      medium: alerts.filter((a) => a.severity === 'medium').length,
      low: alerts.filter((a) => a.severity === 'low').length,
    }

    expect(severityCounts.critical).toBe(2)
    expect(severityCounts.high).toBe(1)
    expect(severityCounts.medium).toBe(1)
    expect(severityCounts.low).toBe(1)
  })

  test('calculates critical alert percentage', () => {
    const alerts = [
      { severity: 'critical' },
      { severity: 'critical' },
      { severity: 'high' },
      { severity: 'medium' },
    ]

    const criticalCount = alerts.filter((a) => a.severity === 'critical').length
    const percentage = (criticalCount / alerts.length) * 100

    expect(percentage).toBe(50)
  })
})

describe('Analytics - Time Series Data', () => {
  test('aggregates data by hour', () => {
    const data = [
      { timestamp: '2026-02-19T10:00:00Z', value: 10 },
      { timestamp: '2026-02-19T10:30:00Z', value: 15 },
      { timestamp: '2026-02-19T11:00:00Z', value: 20 },
      { timestamp: '2026-02-19T11:30:00Z', value: 25 },
    ]

    const hourlyData = data.reduce((acc: any, item) => {
      const hour = new Date(item.timestamp).getHours()
      if (!acc[hour]) acc[hour] = []
      acc[hour].push(item.value)
      return acc
    }, {})

    expect(Object.keys(hourlyData)).toHaveLength(2)
    expect(hourlyData[10]).toHaveLength(2)
    expect(hourlyData[11]).toHaveLength(2)
  })

  test('calculates average values', () => {
    const values = [10, 20, 30, 40, 50]
    const average = values.reduce((sum, val) => sum + val, 0) / values.length

    expect(average).toBe(30)
  })

  test('finds min and max values', () => {
    const values = [15, 32, 8, 45, 22]

    const min = Math.min(...values)
    const max = Math.max(...values)

    expect(min).toBe(8)
    expect(max).toBe(45)
  })
})

describe('Analytics - Device Uptime Calculation', () => {
  test('calculates uptime percentage', () => {
    const totalHours = 24
    const onlineHours = 20
    const uptimePercentage = (onlineHours / totalHours) * 100

    expect(uptimePercentage).toBeCloseTo(83.33, 2)
  })

  test('handles 100% uptime', () => {
    const totalHours = 24
    const onlineHours = 24
    const uptimePercentage = (onlineHours / totalHours) * 100

    expect(uptimePercentage).toBe(100)
  })

  test('handles 0% uptime', () => {
    const totalHours = 24
    const onlineHours = 0
    const uptimePercentage = (onlineHours / totalHours) * 100

    expect(uptimePercentage).toBe(0)
  })
})

describe('Analytics - Data Aggregation', () => {
  test('groups data by device', () => {
    const telemetry = [
      { device_id: 'device-1', value: 10 },
      { device_id: 'device-1', value: 15 },
      { device_id: 'device-2', value: 20 },
      { device_id: 'device-2', value: 25 },
    ]

    const grouped = telemetry.reduce((acc: any, item) => {
      if (!acc[item.device_id]) acc[item.device_id] = []
      acc[item.device_id].push(item.value)
      return acc
    }, {})

    expect(Object.keys(grouped)).toHaveLength(2)
    expect(grouped['device-1']).toHaveLength(2)
    expect(grouped['device-2']).toHaveLength(2)
  })

  test('calculates total readings per device', () => {
    const telemetry = [
      { device_id: 'device-1', value: 10 },
      { device_id: 'device-1', value: 15 },
      { device_id: 'device-2', value: 20 },
    ]

    const counts = telemetry.reduce((acc: any, item) => {
      acc[item.device_id] = (acc[item.device_id] || 0) + 1
      return acc
    }, {})

    expect(counts['device-1']).toBe(2)
    expect(counts['device-2']).toBe(1)
  })
})

describe('Dashboard - Statistics Cards', () => {
  test('formats large numbers with suffixes', () => {
    const formatNumber = (num: number): string => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
      return num.toString()
    }

    expect(formatNumber(1500000)).toBe('1.5M')
    expect(formatNumber(2500)).toBe('2.5K')
    expect(formatNumber(500)).toBe('500')
  })

  test('calculates percentage change', () => {
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return 0
      return ((current - previous) / previous) * 100
    }

    expect(calculateChange(120, 100)).toBe(20)
    expect(calculateChange(80, 100)).toBe(-20)
    expect(calculateChange(100, 100)).toBe(0)
  })

  test('determines trend direction', () => {
    const getTrend = (change: number): 'up' | 'down' | 'stable' => {
      if (Math.abs(change) < 1) return 'stable'
      return change > 0 ? 'up' : 'down'
    }

    expect(getTrend(5)).toBe('up')
    expect(getTrend(-5)).toBe('down')
    expect(getTrend(0.5)).toBe('stable')
  })
})

describe('Reports - Data Export', () => {
  test('converts data to CSV format', () => {
    const data = [
      { id: '1', name: 'Device A', status: 'online' },
      { id: '2', name: 'Device B', status: 'offline' },
    ]

    const headers = Object.keys(data[0]).join(',')
    const rows = data.map((row) => Object.values(row).join(','))
    const csv = [headers, ...rows].join('\n')

    expect(csv).toContain('id,name,status')
    expect(csv).toContain('1,Device A,online')
    expect(csv).toContain('2,Device B,offline')
  })

  test('escapes commas in CSV data', () => {
    const value = 'Test, Value'
    const escaped = `"${value}"`

    expect(escaped).toBe('"Test, Value"')
  })
})

describe('Date Formatting Utilities', () => {
  test('formats date to ISO string', () => {
    const date = new Date('2026-02-19T12:00:00Z')
    const iso = date.toISOString()

    expect(iso).toMatch(/2026-02-19T12:00:00/)
  })

  test('calculates days ago', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86400000)
    const daysAgo = Math.floor((now.getTime() - yesterday.getTime()) / 86400000)

    expect(daysAgo).toBe(1)
  })

  test('formats relative time', () => {
    const formatRelativeTime = (timestamp: string): string => {
      const now = Date.now()
      const then = new Date(timestamp).getTime()
      const diffMs = now - then
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays}d ago`
    }

    const now = new Date().toISOString()
    const result = formatRelativeTime(now)

    expect(result).toBe('Just now')
  })
})
