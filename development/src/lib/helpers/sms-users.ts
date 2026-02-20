/**
 * Helper functions for managing SMS-enabled users
 * Used by alerts and notification systems to get users who have opted in to SMS
 * 
 * NOTE: TypeScript errors will show until the database migration is applied
 * and types are regenerated. Run:
 *   npx supabase db reset --local
 *   npx supabase gen types typescript --local > src/types/supabase.ts
 */

import { createClient } from '@/lib/supabase/client';

export interface SMSEnabledUser {
  id: string;
  full_name: string | null;
  email: string;
  phone_number: string;
  phone_number_secondary?: string | null;
  role: string | null;
}

/**
 * Get all users in an organization who have opted in to SMS notifications
 * @param organizationId - The organization ID
 * @returns Array of users with phone numbers and SMS enabled
 */
export async function getSMSEnabledUsers(organizationId: string): Promise<SMSEnabledUser[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, phone_number, phone_number_secondary, role')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .or('phone_sms_enabled.eq.true,phone_secondary_sms_enabled.eq.true')
    .not('phone_number', 'is', null);

  if (error) {
    console.error('Error fetching SMS-enabled users:', error);
    return [];
  }

  // Type assertion needed until migration is applied and types regenerated
  return data as unknown as SMSEnabledUser[];
}

/**
 * Get all phone numbers for users who have SMS enabled
 * Returns array of phone numbers that can be used for SMS notifications
 * @param organizationId - The organization ID
 * @returns Array of phone numbers in E.164 format
 */
export async function getSMSPhoneNumbers(organizationId: string): Promise<string[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('users')
    .select('phone_number, phone_number_secondary, phone_sms_enabled, phone_secondary_sms_enabled')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching phone numbers:', error);
    return [];
  }

  const phoneNumbers: string[] = [];

  // Type assertion needed until migration is applied
  data?.forEach((user: any) => {
    if (user.phone_sms_enabled && user.phone_number) {
      phoneNumbers.push(user.phone_number);
    }
    if (user.phone_secondary_sms_enabled && user.phone_number_secondary) {
      phoneNumbers.push(user.phone_number_secondary);
    }
  });

  return phoneNumbers;
}

/**
 * Get phone numbers for a specific user
 * @param userId - The user ID
 * @returns Object with primary and secondary phone numbers if SMS enabled
 */
export async function getUserSMSPhoneNumbers(userId: string): Promise<{
  primary: string | null;
  secondary: string | null;
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('users')
    .select('phone_number, phone_number_secondary, phone_sms_enabled, phone_secondary_sms_enabled')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return { primary: null, secondary: null };
  }

  // Type assertion needed until migration is applied
  const userData = data as any;

  return {
    primary: userData.phone_sms_enabled ? userData.phone_number : null,
    secondary: userData.phone_secondary_sms_enabled ? userData.phone_number_secondary : null,
  };
}

/**
 * Format phone number to E.164 format
 * @param phone - Phone number in any format
 * @param defaultCountryCode - Default country code if not provided (default: +1 for US)
 * @returns Phone number in E.164 format or null if invalid
 */
export function formatPhoneE164(phone: string, defaultCountryCode = '+1'): string | null {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If already has +, assume it's in correct format
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If starts with 1 and is 11 digits (US/Canada), add +
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return '+' + cleaned;
  }

  // If 10 digits, assume US/Canada and add country code
  if (cleaned.length === 10) {
    return defaultCountryCode + cleaned;
  }

  // If 11+ digits without +, add + to beginning
  if (cleaned.length >= 11) {
    return '+' + cleaned;
  }

  // Invalid format
  return null;
}

/**
 * Validate phone number format
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Check if matches E.164 format: +[1-9][0-9]{1,14}
  return /^\+?[1-9]\d{1,14}$/.test(cleaned);
}
