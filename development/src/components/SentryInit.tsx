'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export function SentryInit() {
  useEffect(() => {
    console.log('[Sentry] Initializing client...');
    console.log('[Sentry] DSN:', process.env.NEXT_PUBLIC_SENTRY_DSN ? 'Configured ✅' : 'Missing ❌');

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      integrations: [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      debug: false,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.NEXT_PUBLIC_APP_VERSION,
      
      // Disable stack trace parsing in development to avoid symbolication errors
      stackParser: process.env.NODE_ENV === 'development' ? undefined : Sentry.defaultStackParser,

      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.category === 'console' && process.env.NODE_ENV === 'production') {
          return null;
        }

        if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
          if (breadcrumb.data?.['Authorization']) {
            breadcrumb.data['Authorization'] = '[Filtered]';
          }
        }

        if (breadcrumb.message && typeof breadcrumb.message === 'string') {
          breadcrumb.message = breadcrumb.message
            .replace(/access_token=[^&]*/g, 'access_token=[Filtered]')
            .replace(/refresh_token=[^&]*/g, 'refresh_token=[Filtered]');
        }

        return breadcrumb;
      },

      beforeSend(event) {
        // Show user feedback dialog for errors in production
        if (event.exception && process.env.NODE_ENV === 'production') {
          Sentry.showReportDialog({
            eventId: event.event_id,
            title: 'It looks like we\'re having issues',
            subtitle: 'Our team has been notified.',
            subtitle2: 'If you\'d like to help, tell us what happened below.',
            labelName: 'Name',
            labelEmail: 'Email',
            labelComments: 'What happened?',
            labelClose: 'Close',
            labelSubmit: 'Submit',
          });
        }
        return event;
      },

      ignoreErrors: [
        'top.GLOBALS',
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'NetworkError',
        'Network request failed',
        'Failed to fetch',
        'ChunkLoadError',
      ],
    });

    console.log('[Sentry] Client initialized!', Sentry.getClient() ? '✅' : '❌');

    // Global error handler for unhandled errors
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('[Global Error]', event.error);
      Sentry.captureException(event.error, {
        extra: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
        tags: {
          error_type: 'global_error',
        },
      });
    };

    // Global promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[Unhandled Rejection]', event.reason);
      Sentry.captureException(event.reason, {
        extra: {
          promise: 'unhandled_rejection',
        },
        tags: {
          error_type: 'unhandled_promise',
        },
      });
    };

    // Add global error listeners
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
