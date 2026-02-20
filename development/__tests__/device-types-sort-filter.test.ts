/**
 * Tests for Device Types sorting and filtering
 * Issue #168: Device Types Sorting and Filtering
 */

describe('Device Types Sorting and Filtering', () => {
  // Helper function to sort device types (matching component logic)
  const sortDeviceTypes = (types: any[], field: string, direction: string) => {
    const sorted = [...types]
    sorted.sort((a, b) => {
      let aVal = null
      let bVal = null

      if (field === 'name') {
        aVal = a.name
        bVal = b.name
      } else if (field === 'device_class') {
        aVal = a.device_class || ''
        bVal = b.device_class || ''
      } else if (field === 'unit') {
        aVal = a.unit || ''
        bVal = b.unit || ''
      }

      if (!aVal || !bVal) {
        return (aVal ? 1 : -1) * (direction === 'asc' ? 1 : -1)
      }

      const comparison = aVal.localeCompare(bVal)
      return direction === 'asc' ? comparison : -comparison
    })

    return sorted
  }

  // Helper function to filter device types (matching component logic)
  const filterDeviceTypes = (
    types: any[],
    filterClass: string | null,
    filterUnit: string | null
  ) => {
    return types.filter((dt) => {
      if (filterClass && dt.device_class !== filterClass) return false
      if (filterUnit && dt.unit !== filterUnit) return false
      return true
    })
  }

  const mockDeviceTypes = [
    {
      id: '1',
      name: 'Temperature Sensor',
      description: 'Internal temperature sensor',
      device_class: 'temperature',
      unit: '°C',
    },
    {
      id: '2',
      name: 'Pressure Gauge',
      description: 'Air pressure measurement',
      device_class: 'pressure',
      unit: 'hPa',
    },
    {
      id: '3',
      name: 'Humidity Sensor',
      description: 'Relative humidity measurement',
      device_class: 'humidity',
      unit: '%',
    },
    {
      id: '4',
      name: 'Distance Sensor',
      description: 'Ultrasonic distance measurement',
      device_class: 'distance',
      unit: 'm',
    },
    {
      id: '5',
      name: 'Voltage Monitor',
      description: null,
      device_class: 'voltage',
      unit: 'V',
    },
  ]

  describe('Sort by Name', () => {
    it('should sort by name ascending', () => {
      const sorted = sortDeviceTypes(mockDeviceTypes, 'name', 'asc')
      const names = sorted.map((dt: any) => dt.name)
      expect(names).toEqual([
        'Distance Sensor',
        'Humidity Sensor',
        'Pressure Gauge',
        'Temperature Sensor',
        'Voltage Monitor',
      ])
    })

    it('should sort by name descending', () => {
      const sorted = sortDeviceTypes(mockDeviceTypes, 'name', 'desc')
      const names = sorted.map((dt: any) => dt.name)
      expect(names).toEqual([
        'Voltage Monitor',
        'Temperature Sensor',
        'Pressure Gauge',
        'Humidity Sensor',
        'Distance Sensor',
      ])
    })
  })

  describe('Sort by Device Class', () => {
    it('should sort by device_class ascending', () => {
      const sorted = sortDeviceTypes(mockDeviceTypes, 'device_class', 'asc')
      const classes = sorted.map((dt: any) => dt.device_class)
      expect(classes).toEqual([
        'distance',
        'humidity',
        'pressure',
        'temperature',
        'voltage',
      ])
    })

    it('should sort by device_class descending', () => {
      const sorted = sortDeviceTypes(mockDeviceTypes, 'device_class', 'desc')
      const classes = sorted.map((dt: any) => dt.device_class)
      expect(classes).toEqual([
        'voltage',
        'temperature',
        'pressure',
        'humidity',
        'distance',
      ])
    })
  })

  describe('Sort by Unit', () => {
    it('should sort by unit ascending (consistent ordering)', () => {
      const sorted = sortDeviceTypes(mockDeviceTypes, 'unit', 'asc')
      const units = sorted.map((dt: any) => dt.unit)
      // Verify all units are present
      expect(units).toHaveLength(5)
      expect(units).toContain('%')
      expect(units).toContain('°C')
      expect(units).toContain('V')
      expect(units).toContain('hPa')
      expect(units).toContain('m')
      // Ascending should be alphabetically sorted
      const unitsCopy = [...units]
      unitsCopy.sort((a: string, b: string) => a.localeCompare(b))
      expect(units).toEqual(unitsCopy)
    })

    it('should sort by unit descending (reverse ordering)', () => {
      const sortedAsc = sortDeviceTypes(mockDeviceTypes, 'unit', 'asc')
      const sortedDesc = sortDeviceTypes(mockDeviceTypes, 'unit', 'desc')
      const unitsAsc = sortedAsc.map((dt: any) => dt.unit)
      const unitsDesc = sortedDesc.map((dt: any) => dt.unit)
      // Descending should be reverse of ascending
      expect(unitsDesc).toEqual([...unitsAsc].reverse())
    })
  })

  describe('Filter by Device Class', () => {
    it('should filter by single device class', () => {
      const filtered = filterDeviceTypes(mockDeviceTypes, 'temperature', null)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Temperature Sensor')
    })

    it('should return all items when device class filter is null', () => {
      const filtered = filterDeviceTypes(mockDeviceTypes, null, null)
      expect(filtered).toHaveLength(mockDeviceTypes.length)
    })

    it('should return empty array when no matching device class', () => {
      const filtered = filterDeviceTypes(mockDeviceTypes, 'nonexistent', null)
      expect(filtered).toHaveLength(0)
    })
  })

  describe('Filter by Unit', () => {
    it('should filter by single unit', () => {
      const filtered = filterDeviceTypes(mockDeviceTypes, null, '°C')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Temperature Sensor')
    })

    it('should return all items when unit filter is null', () => {
      const filtered = filterDeviceTypes(mockDeviceTypes, null, null)
      expect(filtered).toHaveLength(mockDeviceTypes.length)
    })

    it('should return empty array when no matching unit', () => {
      const filtered = filterDeviceTypes(mockDeviceTypes, null, 'nonexistent')
      expect(filtered).toHaveLength(0)
    })

    it('should filter multiple device types by same unit', () => {
      const typesWithDuplicate = [
        ...mockDeviceTypes,
        {
          ...mockDeviceTypes[0],
          id: '6',
          name: 'External Temperature',
          unit: '°C',
        },
      ]
      const filtered = filterDeviceTypes(typesWithDuplicate, null, '°C')
      expect(filtered).toHaveLength(2)
    })
  })

  describe('Combined Sort and Filter', () => {
    it('should filter by device class then sort by name', () => {
      const filtered = filterDeviceTypes(mockDeviceTypes, 'temperature', null)
      const sorted = sortDeviceTypes(filtered, 'name', 'asc')
      expect(sorted).toHaveLength(1)
      expect(sorted[0].name).toBe('Temperature Sensor')
    })

    it('should apply both device class and unit filters', () => {
      const filtered = filterDeviceTypes(mockDeviceTypes, 'temperature', '°C')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Temperature Sensor')
    })

    it('should return empty when combined filters have no matches', () => {
      const filtered = filterDeviceTypes(mockDeviceTypes, 'temperature', 'hPa')
      expect(filtered).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty array', () => {
      const sorted = sortDeviceTypes([], 'name', 'asc')
      expect(sorted).toHaveLength(0)
    })

    it('should handle single item', () => {
      const single = [mockDeviceTypes[0]]
      const sorted = sortDeviceTypes(single, 'name', 'asc')
      expect(sorted).toHaveLength(1)
      expect(sorted[0]).toBe(mockDeviceTypes[0])
    })

    it('should extract unique device classes', () => {
      const classes = new Set<string>()
      mockDeviceTypes.forEach((dt) => {
        if (dt.device_class) classes.add(dt.device_class)
      })
      const unique = Array.from(classes).sort()
      expect(unique).toEqual([
        'distance',
        'humidity',
        'pressure',
        'temperature',
        'voltage',
      ])
    })

    it('should extract unique units', () => {
      const units = new Set<string>()
      mockDeviceTypes.forEach((dt) => {
        if (dt.unit) units.add(dt.unit)
      })
      const unique = Array.from(units).sort()
      expect(unique).toEqual(['%', 'V', 'hPa', 'm', '°C'])
    })
  })
})
