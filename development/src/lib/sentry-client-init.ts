import * as Sentry from '@sentry/nextjs'

// Ensure this runs on the client side only
if (typeof window !== 'undefined') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Integrations
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Debug mode — only in development to avoid Transport disabled noise in prod
    debug: process.env.NODE_ENV === 'development',

    // Environment
    environment: process.env.NODE_ENV || 'development',

    // Release tracking
    release: process.env.NEXT_PUBLIC_APP_VERSION,

    // Customize breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      if (
        breadcrumb.category === 'console' &&
        process.env.NODE_ENV === 'production'
      ) {
        return null
      }

      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        if (breadcrumb.data?.['Authorization']) {
          breadcrumb.data['Authorization'] = '[Filtered]'
        }
      }

      if (breadcrumb.message && typeof breadcrumb.message === 'string') {
        breadcrumb.message = breadcrumb.message
          .replace(/access_token=[^&]*/g, 'access_token=[Filtered]')
          .replace(/refresh_token=[^&]*/g, 'refresh_token=[Filtered]')
      }

      return breadcrumb
    },

    // Ignore certain errors
    ignoreErrors: [
      'top.GLOBALS',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'NetworkError',
      'Network request failed',
      'Failed to fetch',
      'ChunkLoadError',
    ],
  })
}
