// ─── Shared password strength & generator utilities ─────────────────
// Used by SecurityTab, reset-password, and change-password pages.

export interface PasswordRequirement {
  label: string
  test: (pw: string) => boolean
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: 'At least 12 characters', test: (pw) => pw.length >= 12 },
  { label: 'Uppercase letter (A-Z)', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter (a-z)', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Number (0-9)', test: (pw) => /[0-9]/.test(pw) },
  {
    label: 'Special character (!@#$...)',
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
]

export function getPasswordStrength(pw: string): {
  score: number
  label: string
  color: string
} {
  if (!pw) return { score: 0, label: '', color: '' }
  const passed = PASSWORD_REQUIREMENTS.filter((r) => r.test(pw)).length
  // Bonus for length
  const lengthBonus = pw.length >= 16 ? 1 : 0
  const total = passed + lengthBonus
  if (total <= 1) return { score: 1, label: 'Very Weak', color: 'bg-red-500' }
  if (total <= 2) return { score: 2, label: 'Weak', color: 'bg-orange-500' }
  if (total <= 3) return { score: 3, label: 'Fair', color: 'bg-yellow-500' }
  if (total <= 4) return { score: 4, label: 'Strong', color: 'bg-blue-500' }
  return { score: 5, label: 'Very Strong', color: 'bg-green-500' }
}

export function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '!@#$%&*_+-='
  const all = upper + lower + digits + special

  // Guarantee at least one of each category
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]!
  const required = [pick(upper), pick(lower), pick(digits), pick(special)]

  // Fill to 20 characters
  const remaining = Array.from({ length: 16 }, () => pick(all))
  const chars = [...required, ...remaining]

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}
