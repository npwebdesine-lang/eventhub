-- Icebreaker: lock down what a guest can write to icebreaker_matches.
--
-- After 20261123120000 only the drawer (guest1) can write a match, but the
-- rules still trusted every column they sent. Calling the API directly, a
-- guest could:
--   - insert a row already marked 'completed', with any event_id and any
--     mission_text. Completed rows are public (the Wall of Fame), so this
--     posted arbitrary text onto any event's wall. This predates the
--     single-sided rework.
--   - update their own row's event_id, guest2_id or mission_text, or flip a
--     completed row back to 'pending'.
--
-- Now a write can only do what the app does:
--   INSERT: a fresh 'pending' row (no photo, no completion time), drawn by an
--           active guest about another active guest in the same event, with
--           a mission that exists in that event's mission list.
--   UPDATE: only pending -> completed, and only status, completed_at and
--           photo_url may change. Event, guests and mission text are frozen
--           by column privileges (a policy cannot compare old and new
--           values, so it cannot freeze columns on its own).
--
-- The event owner is unaffected: the dashboard only deletes matches (policy
-- icebreaker_matches_delete_owner), and DELETE is not touched here.
--
-- DEPLOY ORDER: safe with the frontend in production. The app already
-- inserts exactly this shape and updates only these three columns.

-- ---------------------------------------------------------------------------
-- 1. INSERT: only a genuine, fresh draw
-- ---------------------------------------------------------------------------
drop policy if exists icebreaker_matches_insert_drawer on public.icebreaker_matches;

create policy icebreaker_matches_insert_drawer
  on public.icebreaker_matches
  for insert
  to anon, authenticated
  with check (
    guest1_id = public.device_id()
    and guest2_id <> guest1_id
    and status = 'pending'
    and completed_at is null
    and coalesce(photo_url, '') = ''
    -- The drawer is an active participant of this event...
    and exists (
      select 1 from public.icebreaker_profiles p
       where p.event_id = icebreaker_matches.event_id
         and p.guest_id = icebreaker_matches.guest1_id
         and p.is_active
    )
    -- ...and so is the target (a guest who left the pool cannot be drawn).
    and exists (
      select 1 from public.icebreaker_profiles p
       where p.event_id = icebreaker_matches.event_id
         and p.guest_id = icebreaker_matches.guest2_id
         and p.is_active
    )
    -- The mission text is one of this event's missions, not free text.
    and exists (
      select 1 from public.icebreaker_missions m
       where m.event_id = icebreaker_matches.event_id
         and m.content = icebreaker_matches.mission_text
    )
  );

-- ---------------------------------------------------------------------------
-- 2. UPDATE: only pending -> completed
-- ---------------------------------------------------------------------------
drop policy if exists icebreaker_matches_update_drawer on public.icebreaker_matches;

create policy icebreaker_matches_update_drawer
  on public.icebreaker_matches
  for update
  to anon, authenticated
  using (guest1_id = public.device_id() and status = 'pending')
  with check (
    guest1_id = public.device_id()
    and status = 'completed'
    and completed_at is not null
  );

-- ---------------------------------------------------------------------------
-- 3. Freeze everything except the completion columns
-- ---------------------------------------------------------------------------
revoke update on public.icebreaker_matches from anon, authenticated;
grant update (status, completed_at, photo_url)
  on public.icebreaker_matches to anon, authenticated;
