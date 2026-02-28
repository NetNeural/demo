// Test Supabase alerts table access with anon key
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data, error } = await supabase.from('alerts').select('*').limit(5);
console.log('Direct query result:', { 
  count: data?.length, 
  error: error?.message || error,
  data: data 
});
