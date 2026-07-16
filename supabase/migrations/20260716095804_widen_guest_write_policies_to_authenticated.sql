-- Same root cause as 20260716095457, applied to the remaining guest-write policies.
--
-- Every guest-write policy from the July hardening was scoped `TO anon`, so a
-- signed-in event owner using their own event as a guest matched no policy and hit
-- 403s across dating messages/likes, icebreaker matches, reports, rideshares,
-- blessings, and their own profile/photo updates and deletes. Anonymous guests were
-- never affected, which is why this stayed hidden.
--
-- Widen to anon + authenticated. Every USING/WITH CHECK expression is preserved
-- verbatim: the device_id() match, not the role, is what enforces ownership.

-- blessings (expr stays `true`: no device-scoped column exists; the column-level
-- grants from 20260711062723 still prevent guests forging is_approved)
drop policy if exists "blessings_insert_guest" on public.blessings;
create policy "blessings_insert_guest" on public.blessings
  for insert to anon, authenticated with check (true);

-- dating_likes
drop policy if exists "dating_likes_insert_own" on public.dating_likes;
create policy "dating_likes_insert_own" on public.dating_likes
  for insert to anon, authenticated with check (from_guest_id = device_id());

-- dating_messages
drop policy if exists "dating_messages_insert_own" on public.dating_messages;
create policy "dating_messages_insert_own" on public.dating_messages
  for insert to anon, authenticated with check (sender_id = device_id());

drop policy if exists "dating_messages_update_received" on public.dating_messages;
create policy "dating_messages_update_received" on public.dating_messages
  for update to anon, authenticated
  using (receiver_id = device_id()) with check (receiver_id = device_id());

-- dating_profiles
drop policy if exists "dating_profiles_update_own" on public.dating_profiles;
create policy "dating_profiles_update_own" on public.dating_profiles
  for update to anon, authenticated
  using (guest_id = device_id()) with check (guest_id = device_id());

drop policy if exists "dating_profiles_delete_own" on public.dating_profiles;
create policy "dating_profiles_delete_own" on public.dating_profiles
  for delete to anon, authenticated using (guest_id = device_id());

-- icebreaker_matches
drop policy if exists "icebreaker_matches_insert_participant" on public.icebreaker_matches;
create policy "icebreaker_matches_insert_participant" on public.icebreaker_matches
  for insert to anon, authenticated
  with check ((guest1_id = device_id()) or (guest2_id = device_id()));

drop policy if exists "icebreaker_matches_update_participant" on public.icebreaker_matches;
create policy "icebreaker_matches_update_participant" on public.icebreaker_matches
  for update to anon, authenticated
  using ((guest1_id = device_id()) or (guest2_id = device_id()))
  with check ((guest1_id = device_id()) or (guest2_id = device_id()));

-- icebreaker_profiles
drop policy if exists "icebreaker_profiles_update_own" on public.icebreaker_profiles;
create policy "icebreaker_profiles_update_own" on public.icebreaker_profiles
  for update to anon, authenticated
  using (guest_id = device_id()) with check (guest_id = device_id());

drop policy if exists "icebreaker_profiles_delete_own" on public.icebreaker_profiles;
create policy "icebreaker_profiles_delete_own" on public.icebreaker_profiles
  for delete to anon, authenticated using (guest_id = device_id());

-- photos
drop policy if exists "photos_delete_own" on public.photos;
create policy "photos_delete_own" on public.photos
  for delete to anon, authenticated using (guest_id = device_id());

-- reports
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert to anon, authenticated with check (reporter_id = device_id());

-- rideshares
drop policy if exists "rideshares_insert_own" on public.rideshares;
create policy "rideshares_insert_own" on public.rideshares
  for insert to anon, authenticated with check (guest_id = device_id());

drop policy if exists "rideshares_update_own" on public.rideshares;
create policy "rideshares_update_own" on public.rideshares
  for update to anon, authenticated
  using (guest_id = device_id()) with check (guest_id = device_id());

drop policy if exists "rideshares_delete_own" on public.rideshares;
create policy "rideshares_delete_own" on public.rideshares
  for delete to anon, authenticated using (guest_id = device_id());
