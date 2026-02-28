/**
 * Helper functions for managing SMS-enabled users
 * Used by alerts and notification systems to get users who have opted in to SMS
 *
 * Supports multi-org scenarios:
 * - Gets SMS-enabled users from primary organization (organization_id)
 * - Gets SMS-enabled users from secondary orgs via organization_members table
 */

import { createClient } from '@/lib/supabase/client'

export interface SMSEnabledUser {
  id: string
  full_name: string | null
  email: string
  phone_number: string | null
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

  // Get users who are primary members of the organization
  const { data: primaryMembers, error: primaryError } = await supabase
    .from('users')
    .select('id, full_name, email, phone_number, phone_number_secondary, role')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .or('phone_sms_enabled.eq.true,phone_secondary_sms_enabled.eq.true')
    .not('phone_number', 'is', null)

  if (primaryError) {
    console.error('Error fetching primary organization members:', primaryError)
    return []
  }

  // Get users who are secondary members via organization_members table
  const { data: orgMembers, error: membersError } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)

  if (membersError) {
    console.error(
      'Error fetching organization members relationships:',
      membersError
    )
    return (primaryMembers || []) as SMSEnabledUser[]
  }

  if (!orgMembers || orgMembers.length === 0) {
    return (primaryMembers || []) as SMSEnabledUser[]
  }

  // Get secondary members' details
  const userIds = orgMembers.map((m) => m.user_id)
  const { data: secondaryMembers, error: secondaryError } = await supabase
    .from('users')
    .select('id, full_name, email, phone_number, phone_number_secondary, role')
    .in('id', userIds)
    .eq('is_active', true)
    .or('phone_sms_enabled.eq.true,phone_secondary_sms_enabled.eq.true')
    .not('phone_number', 'is', null)

  if (secondaryError) {
    console.error(
      'Error fetching secondary organization members:',
      secondaryError
    )
    return (primaryMembers || []) as SMSEnabledUser[]
  }

  // Combine and deduplicate by user ID
  const allMembers = [...(primaryMembers || []), ...(secondaryMembers || [])]
  const uniqueMembers = Array.from(
    new Map(allMembers.map((m) => [m.id, m])).values()
  )

  return uniqueMembers as SMSEnabledUser[]
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

  // Get phone numbers for primary organization members
  const { data: primaryUsers, error: primaryError } = await supabase
    .from('users')
    .select(
      'phone_number, phone_number_secondary, phone_sms_enabled, phone_secondary_sms_enabled'
    )
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (primaryError) {
    console.error('Error fetching primary members phone numbers:', primaryError)
  }

  // Get phone numbers for secondary organization members
  const { data: members, error: membersError } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)

  let secondaryUsers: any[] = []
  if (!membersError && members && members.length > 0) {
    const userIds = members.map((m) => m.user_id)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(
        'phone_number, phone_number_secondary, phone_sms_enabled, phone_secondary_sms_enabled'
      )
      .eq('is_active', true)
      .in('id', userIds)

    if (!userError && userData) {
      secondaryUsers = userData
    } else if (userError) {
      console.error(
        'Error fetching secondary members phone numbers:',
        userError
      )
    }
  } else if (membersError) {
    console.error('Error fetching organization members:', membersError)
  }

  // Combine phone numbers from both primary and secondary members
  const phoneNumbers: string[] = []
  const users = [...(primaryUsers || []), ...secondaryUsers]

  users.forEach((user: any) => {
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
