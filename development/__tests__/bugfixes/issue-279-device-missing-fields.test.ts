/**
 * Bug #279 — Device view page: missing device fields
 *
 * The device view page was missing 4 fields from the API response:
 * is_gateway, hardware_ids, cohort_id, parent_device_id.
 *
 * This test verifies these fields are mapped correctly from API data,
 * including fallback logic (is_gateway falls back to metadata.is_gateway).
 */

describe('Bug #279 — Device field mapping with 4 new fields', () => {
  /**
   * Mirror the mappedDevice construction from devices/view/page.tsx (lines 166-207).
   * We test only the 4 new fields and their fallback logic.
   */
  function mapDeviceFields(deviceData: Record<string, any>) {
    return {
      // Bug #279: add missing fields
      is_gateway:
        deviceData.is_gateway ??
        deviceData.metadata?.is_gateway ??
        false,
      hardware_ids: deviceData.hardware_ids || [],
      cohort_id: deviceData.cohort_id,
      parent_device_id: deviceData.parent_device_id,
    }
  }

  it('maps all 4 fields when present in API response', () => {
    const apiData = {
      is_gateway: true,
      hardware_ids: ['hw-001', 'hw-002'],
      cohort_id: 'production',
      parent_device_id: 'parent-123',
    }

    const mapped = mapDeviceFields(apiData)
    expect(mapped.is_gateway).toBe(true)
    expect(mapped.hardware_ids).toEqual(['hw-001', 'hw-002'])
    expect(mapped.cohort_id).toBe('production')
    expect(mapped.parent_device_id).toBe('parent-123')
  })

  it('is_gateway falls back to metadata.is_gateway', () => {
    const apiData = {
      metadata: { is_gateway: true },
      hardware_ids: [],
    }

    const mapped = mapDeviceFields(apiData)
    expect(mapped.is_gateway).toBe(true)
  })

  it('is_gateway defaults to false when absent everywhere', () => {
    const apiData = {
      metadata: {},
    }

    const mapped = mapDeviceFields(apiData)
    expect(mapped.is_gateway).toBe(false)
  })

  it('is_gateway prefers top-level over metadata', () => {
    const apiData = {
      is_gateway: false,
      metadata: { is_gateway: true },
    }

    // Nullish coalescing: false ?? true → false (false is not null/undefined)
    const mapped = mapDeviceFields(apiData)
    expect(mapped.is_gateway).toBe(false)
  })

  it('hardware_ids defaults to empty array', () => {
    const apiData = {}
    const mapped = mapDeviceFields(apiData)
    expect(mapped.hardware_ids).toEqual([])
  })

  it('cohort_id and parent_device_id can be undefined', () => {
    const apiData = {}
    const mapped = mapDeviceFields(apiData)
    expect(mapped.cohort_id).toBeUndefined()
    expect(mapped.parent_device_id).toBeUndefined()
  })

  it('handles null values correctly', () => {
    const apiData = {
      is_gateway: null,
      hardware_ids: null,
      cohort_id: null,
      parent_device_id: null,
      metadata: null,
    }

    const mapped = mapDeviceFields(apiData)
    // null ?? metadata?.is_gateway → undefined?.is_gateway → undefined ?? false → false
    expect(mapped.is_gateway).toBe(false)
    // null || [] → []
    expect(mapped.hardware_ids).toEqual([])
    expect(mapped.cohort_id).toBeNull()
    expect(mapped.parent_device_id).toBeNull()
  })
})
