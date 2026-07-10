-- Phase 1.3 — RLS policy reset for Eventick guest tables.
--
-- Context: the database had accumulated two generations of policies. Newer
-- "*_own" policies scope guest writes to their device via the x-device-id
-- request header, but legacy "USING (true)" / "Allow public all ..." policies
-- still existed and, because permissive policies OR together, left every table
-- effectively world-writable. dating_likes had RLS disabled entirely.
--
-- This migration drops ALL existing policies on the guest tables and recreates
-- one consistent, least-privilege set. Guests are anonymous (anon role) and are
-- identified by public.device_id() (the x-device-id header). Admins are real
-- Supabase Auth users (authenticated role) and may only touch rows belonging to
-- events they own (public.owns_event()).

-- ---------------------------------------------------------------------------
-- Identity + ownership helpers
-- ---------------------------------------------------------------------------

-- The anonymous guest's device id, taken from the x-device-id request header.
-- STABLE + wrapped so the planner evaluates it once per statement (avoids the
-- auth_rls_initplan performance warning).
create or replace function public.device_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(
    (current_setting('request.headers', true)::json ->> 'x-device-id'),
    ''
  )
$$;

-- Event ownership column for admin scoping.
alter table public.events
  add column if not exists owner_id uuid default auth.uid() references auth.users(id);

-- Backfill any pre-existing events to the sole current admin (no-op if empty).
update public.events e
set owner_id = (select id from auth.users order by created_at limit 1)
where e.owner_id is null
  and exists (select 1 from auth.users);

-- True when the current authenticated user owns the given event.
create or replace function public.owns_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.owner_id = (select auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------
-- Ensure RLS is enabled everywhere and drop every existing policy on the set
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  p record;
  tables text[] := array[
    'events','rsvps','blessings','photos','dating_profiles','dating_messages',
    'dating_likes','icebreaker_profiles','icebreaker_missions','icebreaker_matches',
    'rideshares','reports','seating','event_guests'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create policy events_select_public on public.events
  for select to public using (true);
create policy events_insert_owner on public.events
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy events_update_owner on public.events
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy events_delete_owner on public.events
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- rsvps  (public invite flow; submitter_phone hidden from anon via column grant)
-- ---------------------------------------------------------------------------
create policy rsvps_select_public on public.rsvps
  for select to public using (true);
create policy rsvps_insert_public on public.rsvps
  for insert to public with check (true);
create policy rsvps_update_owner on public.rsvps
  for update to authenticated
  using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy rsvps_delete_owner on public.rsvps
  for delete to authenticated using (public.owns_event(event_id));

-- Hide submitter_phone from anon. A table-level SELECT grant overrides a
-- single-column revoke, so revoke the table grant and re-grant only the safe
-- columns; admins (authenticated) keep full access including the phone.
revoke select on public.rsvps from anon;
grant select (id, event_id, group_id, submitter_name, guest_name, allergens, created_at)
  on public.rsvps to anon;

-- ---------------------------------------------------------------------------
-- blessings  (guests read approved; admin reads/moderates all in their event)
-- ---------------------------------------------------------------------------
create policy blessings_select_approved on public.blessings
  for select to anon using (is_approved = true);
create policy blessings_select_owner on public.blessings
  for select to authenticated using (public.owns_event(event_id));
create policy blessings_insert_guest on public.blessings
  for insert to anon with check (true);
create policy blessings_update_owner on public.blessings
  for update to authenticated
  using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy blessings_delete_owner on public.blessings
  for delete to authenticated using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
create policy photos_select_public on public.photos
  for select to public using (true);
create policy photos_insert_own on public.photos
  for insert to anon with check (guest_id = public.device_id());
create policy photos_delete_own on public.photos
  for delete to anon using (guest_id = public.device_id());
create policy photos_delete_owner on public.photos
  for delete to authenticated using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- dating_profiles
-- ---------------------------------------------------------------------------
create policy dating_profiles_select_public on public.dating_profiles
  for select to public using (true);
create policy dating_profiles_insert_own on public.dating_profiles
  for insert to anon with check (guest_id = public.device_id());
create policy dating_profiles_update_own on public.dating_profiles
  for update to anon
  using (guest_id = public.device_id()) with check (guest_id = public.device_id());
create policy dating_profiles_delete_own on public.dating_profiles
  for delete to anon using (guest_id = public.device_id());
create policy dating_profiles_delete_owner on public.dating_profiles
  for delete to authenticated using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- dating_messages  (only participants read; admin reads for moderation)
-- ---------------------------------------------------------------------------
create policy dating_messages_select_own on public.dating_messages
  for select to anon
  using (sender_id = public.device_id() or receiver_id = public.device_id());
create policy dating_messages_select_owner on public.dating_messages
  for select to authenticated using (public.owns_event(event_id));
create policy dating_messages_insert_own on public.dating_messages
  for insert to anon with check (sender_id = public.device_id());
create policy dating_messages_update_received on public.dating_messages
  for update to anon
  using (receiver_id = public.device_id()) with check (receiver_id = public.device_id());
create policy dating_messages_delete_owner on public.dating_messages
  for delete to authenticated using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- dating_likes  (currently unused by the app, but locked down defensively)
-- ---------------------------------------------------------------------------
create policy dating_likes_select_own on public.dating_likes
  for select to anon
  using (from_guest_id = public.device_id() or to_guest_id = public.device_id());
create policy dating_likes_insert_own on public.dating_likes
  for insert to anon with check (from_guest_id = public.device_id());
create policy dating_likes_delete_owner on public.dating_likes
  for delete to authenticated using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- rideshares  (phone is intentionally shared with other guests)
-- ---------------------------------------------------------------------------
create policy rideshares_select_public on public.rideshares
  for select to public using (true);
create policy rideshares_insert_own on public.rideshares
  for insert to anon with check (guest_id = public.device_id());
create policy rideshares_update_own on public.rideshares
  for update to anon
  using (guest_id = public.device_id()) with check (guest_id = public.device_id());
create policy rideshares_delete_own on public.rideshares
  for delete to anon using (guest_id = public.device_id());
create policy rideshares_delete_owner on public.rideshares
  for delete to authenticated using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- reports  (guests file; only admins read/manage)
-- ---------------------------------------------------------------------------
create policy reports_insert_own on public.reports
  for insert to anon with check (reporter_id = public.device_id());
create policy reports_select_owner on public.reports
  for select to authenticated using (public.owns_event(event_id));
create policy reports_update_owner on public.reports
  for update to authenticated
  using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy reports_delete_owner on public.reports
  for delete to authenticated using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- seating  (guests read to find their table; only admins write)
-- ---------------------------------------------------------------------------
create policy seating_select_public on public.seating
  for select to public using (true);
create policy seating_insert_owner on public.seating
  for insert to authenticated with check (public.owns_event(event_id));
create policy seating_update_owner on public.seating
  for update to authenticated
  using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy seating_delete_owner on public.seating
  for delete to authenticated using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- icebreaker_profiles
-- ---------------------------------------------------------------------------
create policy icebreaker_profiles_select_public on public.icebreaker_profiles
  for select to public using (true);
create policy icebreaker_profiles_insert_own on public.icebreaker_profiles
  for insert to anon with check (guest_id = public.device_id());
create policy icebreaker_profiles_update_own on public.icebreaker_profiles
  for update to anon
  using (guest_id = public.device_id()) with check (guest_id = public.device_id());
create policy icebreaker_profiles_delete_own on public.icebreaker_profiles
  for delete to anon using (guest_id = public.device_id());
create policy icebreaker_profiles_delete_owner on public.icebreaker_profiles
  for delete to authenticated using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- icebreaker_missions  (admin-authored content; guests read only)
-- ---------------------------------------------------------------------------
create policy icebreaker_missions_select_public on public.icebreaker_missions
  for select to public using (true);
create policy icebreaker_missions_insert_owner on public.icebreaker_missions
  for insert to authenticated with check (public.owns_event(event_id));
create policy icebreaker_missions_update_owner on public.icebreaker_missions
  for update to authenticated
  using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy icebreaker_missions_delete_owner on public.icebreaker_missions
  for delete to authenticated using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- icebreaker_matches  (only participants create/complete; admin moderates)
-- ---------------------------------------------------------------------------
create policy icebreaker_matches_select_public on public.icebreaker_matches
  for select to public using (true);
create policy icebreaker_matches_insert_participant on public.icebreaker_matches
  for insert to anon
  with check (guest1_id = public.device_id() or guest2_id = public.device_id());
create policy icebreaker_matches_update_participant on public.icebreaker_matches
  for update to anon
  using (guest1_id = public.device_id() or guest2_id = public.device_id())
  with check (guest1_id = public.device_id() or guest2_id = public.device_id());
create policy icebreaker_matches_delete_owner on public.icebreaker_matches
  for delete to authenticated using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- event_guests  (not used by the app; deny all guest access, admin owner only)
-- ---------------------------------------------------------------------------
create policy event_guests_all_owner on public.event_guests
  for all to authenticated
  using (public.owns_event(event_id)) with check (public.owns_event(event_id));
