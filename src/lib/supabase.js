import { createClient } from "@supabase/supabase-js";
import { getOrCreateDeviceId } from "../utils/deviceId";

// עכשיו השמות תואמים בול למה שכתבת בקובץ ה-.env!
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// The device ID identifies anonymous guests. It is attached to every request as
// the `x-device-id` header, which the row-level-security policies read via
// current_setting('request.headers') to scope guest writes to their own rows.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      "x-device-id": getOrCreateDeviceId(),
    },
  },
});
