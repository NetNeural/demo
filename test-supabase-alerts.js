// Test Supabase alerts table access with anon key
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTc4MDksImV4cCI6MjA4NjU5MzgwOX0.V-nVEkKdoNbzl_9bmS0d4X7QbNt7raxEYuevpaPEYwg'
);

const { data, error } = await supabase.from('alerts').select('*').limit(5);
console.log('Direct query result:', { 
  count: data?.length, 
  error: error?.message || error,
  data: data 
});
