import { createClient } from '@supabase/supabase-js';

// עכשיו השמות תואמים בול למה שכתבת בקובץ ה-.env!
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);