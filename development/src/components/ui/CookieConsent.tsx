'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Constants ───────────────────────────────────────────────────────────────
const CONSENT_KEY = 'nn_cookie_consent'
const CONSENT_VERSION = 1 // bump to re-prompt users after policy changes

type ConsentValue = 'accepted' | 'rejected'

interface StoredConsent {
  value: ConsentValue
  version: number
  timestamp: string
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * GDPR-compliant cookie consent banner.
 *
 * This platform uses only **essential / strictly-necessary cookies** for
 * authentication (Supabase auth tokens stored in localStorage). No analytics,
 * advertising, or third-party tracking cookies are used.
 *
 * Under GDPR Article 7, users must still be informed about cookie usage and
 * given the ability to accept or reject non-essential cookies. Because this
 * platform has no non-essential cookies at present, rejecting cookies does
 * not change functionality — but the banner satisfies the legal requirement
 * and provides the framework to gate future cookies behind consent.
 *
 * Consent state is persisted in localStorage (not a cookie — avoiding the
 * irony of needing a cookie to remember cookie preferences).
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // Show the banner only when there's no valid, current-version consent stored.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONSENT_KEY)
      if (raw) {
        const parsed: StoredConsent = JSON.parse(raw)
        if (parsed.version === CONSENT_VERSION) return // already consented
      }
    } catch {
      // corrupt value — re-prompt
    }
    // Small delay so it doesn't fight the initial page render
    const t = setTimeout(() => setVisible(true), 1200)
    return () => clearTimeout(t)
  }, [])

  const persist = useCallback((value: ConsentValue) => {
    const consent: StoredConsent = {
      value,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '0 16px 16px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: '0 auto',
          background: '#1e293b',
          color: '#e2e8f0',
          borderRadius: 12,
          boxShadow: '0 -2px 24px rgba(0,0,0,0.25)',
          padding: '20px 24px',
          fontSize: 14,
          lineHeight: 1.55,
          pointerEvents: 'auto',
          animation: 'nnCookieSlideUp 0.35s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="8" cy="9" r="1" fill="#f59e0b" />
            <circle cx="15" cy="11" r="1" fill="#f59e0b" />
            <circle cx="10" cy="15" r="1" fill="#f59e0b" />
            <circle cx="14" cy="7" r="1" fill="#f59e0b" />
          </svg>
          <strong style={{ fontSize: 15 }}>Cookie Notice</strong>
        </div>

        {/* Body text */}
        <p style={{ margin: '0 0 6px' }}>
          This platform uses <strong>essential cookies only</strong> for
          authentication and security. No tracking or advertising cookies are
          used.
        </p>

        {/* Expandable details */}
        <button
          type="button"
          onClick={() => setShowDetails((d) => !d)}
          style={{
            background: 'none',
            border: 'none',
            color: '#60a5fa',
            cursor: 'pointer',
            padding: 0,
            fontSize: 13,
            textDecoration: 'underline',
            marginBottom: showDetails ? 8 : 12,
          }}
        >
          {showDetails ? 'Hide details ▲' : 'Learn more ▼'}
        </button>

        {showDetails && (
          <div
            style={{
              background: '#0f172a',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 12,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: '0 0 8px' }}>
              <strong>Essential cookies</strong> — Required for login sessions
              and security (Supabase auth). These cannot be disabled.
            </p>
            <p style={{ margin: '0 0 8px' }}>
              <strong>Analytics cookies</strong> — None. We do not use Google
              Analytics, Meta Pixel, or any third-party tracking.
            </p>
            <p style={{ margin: 0 }}>
              For more information, see our{' '}
              <a
                href="/privacy"
                style={{ color: '#60a5fa', textDecoration: 'underline' }}
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => persist('accepted')}
            style={{
              flex: 1,
              minWidth: 120,
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Accept All
          </button>
          <button
            type="button"
            onClick={() => persist('rejected')}
            style={{
              flex: 1,
              minWidth: 120,
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid #475569',
              background: 'transparent',
              color: '#cbd5e1',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Essential Only
          </button>
        </div>
      </div>

      {/* Keyframe animation (injected once) */}
      <style>{`
        @keyframes nnCookieSlideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
