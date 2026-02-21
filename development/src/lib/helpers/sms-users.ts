/**
 * Helper functions for managing SMS-enabled users
 * Used by alerts and notification systems to get users who have opted in to SMS
 *
 * NOTE: TypeScript errors will show until the database migration is applied
 * and types are regenerated. Run:
 *   npx supabase db reset --local
 *   npx supabase gen types typescript --local > src/types/supabase.ts
 */

import { createClient } from '@/lib/supabase/client'

export interface SMSEnabledUser {
  id: string
  full_name: string | null
  email: string
  phone_number: string
  phone_number_secondary?: string | null
  role: string | null
}

/**
 * Get all users in an organization who have opted in to SMS notifications
 * Includes both primary organization members and those joined via organization_members table
 * @param organizationId - The organization ID
 * @returns Array of users with phone numbers and SMS enabled
 */
export async function getSMSEnabledUsers(
  organizationId: string
): Promise<SMSEnabledUser[]> {
  const supabase = createClient()

  // Use RPC to get all organization members (including secondary org members)
  // This includes users where organization_id = organizationId AND users in organization_members table
  const { data, error } = await supabase
    .rpc('get_organization_members', { org_id: organizationId })
    .select('id, full_name, email, phone_number, phone_number_secondary, role')
    .eq('is_active', true)
    .or('phone_sms_enabled.eq.true,phone_secondary_sms_enabled.eq.true')
    .not('phone_number', 'is', null)

  // Fall back to direct query if RPC doesn't exist
  if (error?.message?.includes('rpc') || error?.message?.includes('not found')) {
    console.warn(
      'RPC get_organization_members not found, falling back to direct query'
    )
    const { data: directData, error: directError } = await supabase
      .from('users')
      .select(`
        id, 
        full_name, 
        email, 
        phone_number, 
        phone_number_secondary, 
        role,
        organization_members!inner(*)
      `)
      .eq('is_active', true)
      .or('phone_sms_enabled.eq.true,phone_secondary_sms_enabled.eq.true')
      .not('phone_number', 'is', null)
      .or(
        `organization_id.eq.${organizationId},organization_members.organization_id.eq.${organizationId}`
      )

    if (directError) {
      console.error('Error fetching SMS-enabled users (fallback):', directError)
      return []
    }

    // Type assertion needed until migration is applied and types regenerated
    return directData as unknown as SMSEnabledUser[]
  }

  if (error) {
    console.error('Error fetching SMS-enabled users:', error)
    return []
  }

  // Type assertion needed until migration is applied and types regenerated
  return data as unknown as SMSEnabledUser[]
}

/**
 * Get all phone numbers for users who have SMS enabled
 * Includes both primary organization members and those joined via organization_members table
 * Returns array of phone numbers that can be used for SMS notifications
 * @param organizationId - The organization ID
 * @returns Array of phone numbers in E.164 format
 */
export async function getSMSPhoneNumbers(
  organizationId: string
): Promise<string[]> {
  const supabase = createClient()

  // Try RPC first for best performance
  const { data, error } = await supabase
    .rpc('get_organization_members', { org_id: organizationId })
    .select(
      'phone_number, phone_number_secondary, phone_sms_enabled, phone_secondary_sms_enabled'
    )
    .eq('is_active', true)

  // Fall back to direct query with organization_members join
  if (error?.message?.includes('rpc') || error?.message?.includes('not found')) {
    console.warn(
      'RPC get_organization_members not found, falling back to direct query'
    )
    
    // Get org members first
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)

    if (membersError || !members) {
      console.error('Error fetching organization members:', membersError)
      return []
    }

    const userIds = members.map((m) => m.user_id)
    if (userIds.length === 0) {
      return []
    }

    // Get phone numbers for these users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(
        'phone_number, phone_number_secondary, phone_sms_enabled, phone_secondary_sms_enabled'
      )
      .eq('is_active', true)
      .in('id', userIds)

    if (userError || !userData) {
      console.error('Error fetching user phone numbers:', userError)
      return []
    }

    const phoneNumbers: string[] = []
    userData.forEach((user: any) => {
      if (user.phone_sms_enabled && user.phone_number) {
        phoneNumbers.push(user.phone_number)
      }
      if (user.phone_secondary_sms_enabled && user.phone_number_secondary) {
        phoneNumbers.push(user.phone_number_secondary)
      }
    })
    return phoneNumbers
  }

  if (error) {
    console.error('Error fetching phone numbers:', error)
    return []
  }

  const phoneNumbers: string[] = []

  // Type assertion needed until migration is applied
  data?.forEach((user: any) => {
    if (user.phone_sms_enabled && user.phone_number) {
      phoneNumbers.push(user.phone_number)
    }
    if (user.phone_secondary_sms_enabled && user.phone_number_secondary) {
      phoneNumbers.push(user.phone_number_secondary)
    }
  })

  return phoneNumbers
}

/**
 * Get phone numbers for a specific user
 * @param userId - The user ID
 * @returns Object with primary and secondary phone numbers if SMS enabled
 */
export async function getUserSMSPhoneNumbers(userId: string): Promise<{
  primary: string | null
  secondary: string | null
}> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('users')
    .select(
      'phone_number, phone_number_secondary, phone_sms_enabled, phone_secondary_sms_enabled'
    )
    .eq('id', userId)
    .single()

  if (error || !data) {
    return { primary: null, secondary: null }
  }

  // Type assertion needed until migration is applied
  const userData = data as any

  return {
    primary: userData.phone_sms_enabled ? userData.phone_number : null,
    secondary: userData.phone_secondary_sms_enabled
      ? userData.phone_number_secondary
      : null,
  }
}

/**
 * Format phone number to E.164 format
 * @param phone - Phone number in any format
 * @param defaultCountryCode - Default country code if not provided (default: +1 for US)
 * @returns Phone number in E.164 format or null if invalid
 */
export function formatPhoneE164(
  phone: string,
  defaultCountryCode = '+1'
): string | null {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '')

  // If already has +, assume it's in correct format
  if (cleaned.startsWith('+')) {
    return cleaned
  }

  // If starts with 1 and is 11 digits (US/Canada), add +
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return '+' + cleaned
  }

  // If 10 digits, assume US/Canada and add country code
  if (cleaned.length === 10) {
    return defaultCountryCode + cleaned
  }

  // If 11+ digits without +, add + to beginning
  if (cleaned.length >= 11) {
    return '+' + cleaned
  }

  // Invalid format
  return null
}

/**
 * Validate phone number format
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')

  // Check if matches E.164 format: +[1-9][0-9]{1,14}
  return /^\+?[1-9]\d{1,14}$/.test(cleaned)
}
