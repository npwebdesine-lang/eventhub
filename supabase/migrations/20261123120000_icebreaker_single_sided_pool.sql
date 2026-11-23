-- Icebreaker: opt-in pool with an explicit "remove me", and private,
-- single-sided missions.
--
-- 1. Pool membership. A profile row means "I joined". Until now leaving the
--    game deleted the row (and with it the guest's photo). is_active lets a
--    guest step out of the pool ("הסר אותי מהמאגר") and come back later without
--    re-uploading. Only active profiles can be drawn, and the live counter
--    counts only them. Guests already update their own row
--    (icebreaker_profiles_update_own), so no new write policy is needed.
--
-- 2. Privacy. A mission is drawn by one guest about another, and the target
--    must never learn of it. The app no longer shows a pending match to
--    guest2, but the table was world-readable (select using true), so a
--    pending row naming the target was readable by anyone, the target
--    included, and was also broadcast over realtime. Now:
--      - completed matches stay public (the Wall of Fame);
--      - a pending match is visible only to the guest who drew it (guest1);
--      - the event owner still sees everything for moderation.
--    Realtime applies the same select policies, so pending rows stop being
--    broadcast too.
--
-- 3. Single-sided writes. Only guest1 (the drawer) may create or complete a
--    match. Before, guest2 could too, which only made sense for the old
--    two-sided flow.
--
-- DEPLOY ORDER: apply before the frontend. The old frontend keeps working: it
-- never reads is_active (the column defaults to true), and it only ever
-- inserted matches as guest1.

-- ---------------------------------------------------------------------------
-- 1. Pool membership
-- ---------------------------------------------------------------------------
alter table public.icebreaker_profiles
  add column if not exists is_active boolean not null default true;

create index if not exists icebreaker_profiles_event_active_idx
  on public.icebreaker_profiles (event_id)
  where is_active;

-- ---------------------------------------------------------------------------
-- 2. Privacy of pending matches
-- ---------------------------------------------------------------------------
drop policy if exists icebreaker_matches_select_public on public.icebreaker_matches;

create policy icebreaker_matches_select_visible
  on public.icebreaker_matches
  for select
  to anon, authenticated
  using (status = 'completed' or guest1_id = public.device_id());

-- Separate policy so owns_event() is only evaluated for signed-in users.
create policy icebreaker_matches_select_owner
  on public.icebreaker_matches
  for select
  to authenticated
  using (public.owns_event(event_id));

-- ---------------------------------------------------------------------------
-- 3. Only the drawer writes
-- ---------------------------------------------------------------------------
drop policy if exists icebreaker_matches_insert_participant on public.icebreaker_matches;
drop policy if exists icebreaker_matches_update_participant on public.icebreaker_matches;

create policy icebreaker_matches_insert_drawer
  on public.icebreaker_matches
  for insert
  to anon, authenticated
  with check (guest1_id = public.device_id() and guest2_id <> guest1_id);

create policy icebreaker_matches_update_drawer
  on public.icebreaker_matches
  for update
  to anon, authenticated
  using (guest1_id = public.device_id())
  with check (guest1_id = public.device_id());
