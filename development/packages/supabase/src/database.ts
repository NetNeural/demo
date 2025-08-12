import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database';

let supabase: SupabaseClient<Database>;

export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    supabase = createClient<Database>(supabaseUrl, supabaseKey);
  }
  
  return supabase;
};

export const getSupabaseAdminClient = (): SupabaseClient<Database> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export { supabase } from './index';
