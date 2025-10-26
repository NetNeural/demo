import * as Sentry from '@sentry/nextjs';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseIntegration } from '@supabase/sentry-js-integration';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Integrations
  integrations: [
    // Supabase integration for automatic error tracking in edge runtime
    new SupabaseIntegration(SupabaseClient, {
      tracing: true,
      breadcrumbs: true,
      errors: true,
    }),
  ],

  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions (reduce to 0.1 in production)

  // Debug mode
  debug: false,

  // Environment
  environment: process.env.NODE_ENV,
});
