/**
 * Profanity Filter Utility
 *
 * Centralised content-moderation helper using the `bad-words` library.
 * - `containsProfanity(text)` — returns true when profane words are detected.
 * - `cleanText(text)` — replaces profane words with asterisks.
 * - `validateClean(text)` — returns an error message string or null.
 *
 * Usage in form validation:
 *   const error = validateClean(inputValue)
 *   if (error) { setFieldError(error) }
 *
 * Usage as sanitiser before save:
 *   const safe = cleanText(rawInput)
 */

import { Filter } from 'bad-words'

const filter = new Filter()

/** Returns `true` when the text contains profanity. */
export function containsProfanity(text: string): boolean {
  if (!text?.trim()) return false
  try {
    return filter.isProfane(text)
  } catch {
    return false
  }
}

/** Replaces profane words with asterisks (`****`). */
export function cleanText(text: string): string {
  if (!text?.trim()) return text
  try {
    return filter.clean(text)
  } catch {
    return text
  }
}

/**
 * Validation helper — returns an error message when profanity is detected,
 * or `null` when the text is clean.
 */
export function validateClean(text: string): string | null {
  if (containsProfanity(text)) {
    return 'Please remove inappropriate language before submitting.'
  }
  return null
}
