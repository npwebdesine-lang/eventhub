-- Regression fix for 20260716093020_drop_legacy_permissive_insert_policies.sql.
--
-- The dropped policies were `TO public`, which covers anon AND authenticated. The
-- surviving *_insert_own policies are `TO anon` only. supabase-js attaches the
-- session JWT to every request, so a browser holding an admin/owner session runs
-- guest writes as `authenticated` -- which matched no INSERT policy at all and
-- failed with "new row violates row-level security policy for table photos".
-- Reproduced as: role=anon ALLOWED, role=authenticated BLOCKED, same header.
--
-- Being signed in does not stop you from also being a guest at the event. Widen to
-- anon + authenticated while KEEPING guest_id = device_id(): the device check, not
-- the role, is what provides the security.

drop policy if exists "photos_insert_own" on public.photos;
create policy "photos_insert_own" on public.photos
  for insert to anon, authenticated
  with check (guest_id = device_id());

drop policy if exists "dating_profiles_insert_own" on public.dating_profiles;
create policy "dating_profiles_insert_own" on public.dating_profiles
  for insert to anon, authenticated
  with check (guest_id = device_id());

drop policy if exists "icebreaker_profiles_insert_own" on public.icebreaker_profiles;
create policy "icebreaker_profiles_insert_own" on public.icebreaker_profiles
  for insert to anon, authenticated
  with check (guest_id = device_id());
