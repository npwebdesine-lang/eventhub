-- Make the device_id() hardening from 20260710165226_rls_reset.sql actually enforce.
--
-- Pre-hardening dashboard policies ("Allow public insert to <table>", role public,
-- WITH CHECK true) survived the reset and sat alongside the new *_insert_own
-- policies. Postgres ORs permissive policies together, so the `true` check always
-- won: any client could insert rows claiming an arbitrary guest_id, and
-- guest_id = device_id() was never enforced despite the docs saying otherwise.
--
-- Verified before dropping: every write path sends x-device-id (src/lib/supabase.js)
-- and sets guest_id = getOrCreateDeviceId(), so the surviving *_insert_own policies
-- accept all legitimate writes. Public SELECT is unaffected.
--
-- blessings_insert_guest and rsvps_insert_public are also WITH CHECK true, but are
-- intentional: neither table has a device-scoped column. They are left in place.

drop policy if exists "Allow public insert to photos" on public.photos;
drop policy if exists "Allow public insert to dating_profiles" on public.dating_profiles;
drop policy if exists "Allow public insert to icebreaker_profiles" on public.icebreaker_profiles;
