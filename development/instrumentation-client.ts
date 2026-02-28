import * as Sentry from '@sentry/nextjs'

// Log to verify this file is being loaded
console.log('[Sentry] Client config loading...')
console.log(
  '[Sentry] DSN:',
  process.env.NEXT_PUBLIC_SENTRY_DSN ? 'Configured' : 'Missing'
)

export function onClientInit() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Integrations
    integrations: [
      // Session replay to watch user sessions
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Debug mode — only in development to avoid noisy Transport disabled errors in prod
    debug: process.env.NODE_ENV === 'development',

    // Environment
    environment: process.env.NODE_ENV || 'development',

    // Release tracking
    release: process.env.NEXT_PUBLIC_APP_VERSION,

    // Customize breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Don't capture console logs as breadcrumbs in production
      if (
        breadcrumb.category === 'console' &&
        process.env.NODE_ENV === 'production'
      ) {
        return null
      }

      // Mask sensitive data in breadcrumbs
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        // Remove authorization headers
        if (breadcrumb.data?.['Authorization']) {
          breadcrumb.data['Authorization'] = '[Filtered]'
        }
      }

      // Mask Supabase auth tokens in breadcrumbs
      if (breadcrumb.message && typeof breadcrumb.message === 'string') {
        breadcrumb.message = breadcrumb.message
          .replace(/access_token=[^&]*/g, 'access_token=[Filtered]')
          .replace(/refresh_token=[^&]*/g, 'refresh_token=[Filtered]')
      }

      return breadcrumb
    },

    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      // Network errors
      'NetworkError',
      'Network request failed',
      'Failed to fetch',
      // Random plugins/extensions
      'ChunkLoadError',
    ],
  })

  console.log('[Sentry] Client initialized!', Sentry.getClient() ? '✅' : '❌')
}

// Instrument navigation transitions for performance monitoring
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
