/**
 * Client-side image moderation utility.
 * Converts a File/Blob to base64, calls the moderate-image Edge Function,
 * and returns whether the image is safe to upload.
 */

import { createClient } from '@/lib/supabase/client'

export interface ModerationResult {
  safe: boolean
  reason?: string
}

/**
 * Convert a File or Blob to a base64 data-URL string.
 */
function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Check whether an image is safe for upload using AI content moderation.
 *
 * - Returns `{ safe: true }` when the image passes moderation or if
 *   the moderation service is unavailable (fail-open).
 * - Returns `{ safe: false, reason: "..." }` when the image is flagged.
 * - Throws only on network/unexpected errors (callers should catch).
 *
 * @param file  The image File or Blob to moderate
 */
export async function moderateImage(file: File | Blob): Promise<ModerationResult> {
  try {
    // Skip moderation for SVGs (they're vector graphics, not photos)
    if (file.type === 'image/svg+xml') {
      return { safe: true }
    }

    // Skip very small files (< 1KB — likely placeholders)
    if (file.size < 1024) {
      return { safe: true }
    }

    const base64 = await fileToBase64(file)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase config missing — skipping moderation')
      return { safe: true }
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/moderate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ imageBase64: base64 }),
    })

    if (!response.ok) {
      console.warn('Moderation API returned non-OK status:', response.status)
      // Fail-open: allow upload if moderation is unavailable
      return { safe: true, reason: 'moderation_unavailable' }
    }

    const result: ModerationResult = await response.json()
    return result
  } catch (error) {
    console.warn('Image moderation check failed, allowing upload:', error)
    // Fail-open: don't block uploads due to moderation failures
    return { safe: true, reason: 'moderation_error' }
  }
}
