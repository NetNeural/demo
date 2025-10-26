'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/client';

/**
 * Component that tracks authenticated users in Sentry
 * Add this to your root layout or dashboard layout
 */
export function SentryUserTracker() {
  useEffect(() => {
    const supabase = createClient();

    // Get current user and set in Sentry
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        Sentry.setUser({
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.split('@')[0],
        });
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        Sentry.setUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0],
        });
      } else if (event === 'SIGNED_OUT') {
        Sentry.setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null; // This component doesn't render anything
}
