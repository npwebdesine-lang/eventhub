-- One person = one row = one dietary preference.
--
-- Until now a party of three was a single event_guests row with guests_count=3,
-- the companions' names concatenated into `notes`, and ONE dietary value for
-- everybody. Catering could not be counted, and a companion had no identity:
-- they could not be edited, given their own preference, or seated.
--
-- Rows are grouped by sharing the primary guest's phone, per the product spec.
-- Consequences worth stating plainly:
--   * phone is the ONLY grouping key. A group whose primary has no phone cannot
--     gain companions -- `g.phone = <null>` is never true in SQL, so such a row
--     is permanently a group of one. rsvp_add_companion raises rather than
--     silently creating an unreachable orphan.
--   * two unrelated parties that type the same phone number merge into one
--     group. Acceptable for a wedding list; noted so it is not a surprise.

-- ---------------------------------------------------------------------------
-- 1. Self-registration: one call, N rows
-- ---------------------------------------------------------------------------
-- p_guests is a jsonb array of {name, dietary}, ordered, first element = primary.
-- jsonb rather than parallel arrays so a name can never drift out of alignment
-- with its dietary choice.
--
-- DROP + CREATE, not CREATE OR REPLACE: the old signature took
-- (uuid,text,text,integer,text[],text,text) and leaving it in place would make
-- a call ambiguous (42725, "function is not unique") once a second overload
-- exists. The old one is gone for good -- nothing may write concatenated notes.
drop function if exists public.rsvp_self_register(uuid, text, text, integer, text[], text, text);

create or replace function public.rsvp_self_register(
  p_event_id uuid,
  p_phone    text,
  p_guests   jsonb,
  p_notes    text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_primary_id uuid;
  v_id         uuid;
  v_count      integer;
  v_phone      text;
  v_notes      text;
  v_guest      jsonb;
  v_name       text;
  v_dietary    text;
  v_index      integer := 0;
begin
  if p_guests is null or jsonb_typeof(p_guests) <> 'array' then
    raise exception 'invalid_guests';
  end if;

  v_count := jsonb_array_length(p_guests);
  if v_count < 1 or v_count > 20 then
    raise exception 'invalid_guests_count';
  end if;

  if p_phone is not null and p_phone <> ''
     and p_phone !~ '^[0-9+\-\s]{7,15}$' then
    raise exception 'invalid_phone';
  end if;
  v_phone := nullif(trim(coalesce(p_phone, '')), '');

  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'event_not_found';
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    v_notes := left(v_notes, 500);
  end if;

  for v_guest in select * from jsonb_array_elements(p_guests)
  loop
    v_name    := trim(coalesce(v_guest ->> 'name', ''));
    v_dietary := coalesce(nullif(v_guest ->> 'dietary', ''), 'regular');

    if char_length(v_name) < 1 or char_length(v_name) > 100 then
      raise exception 'invalid_guest_name';
    end if;
    if v_dietary not in ('regular','vegetarian','vegan','gluten_free','kids') then
      raise exception 'invalid_dietary';
    end if;

    insert into public.event_guests
      (event_id, guest_name, phone, status, guests_count, notes, dietary, responded_at)
    values
      (p_event_id, v_name, v_phone, 'confirmed', 1,
       -- free-text notes belong to the person who typed them, i.e. the primary
       case when v_index = 0 then v_notes else null end,
       v_dietary, now())
    returning id into v_id;

    -- The first element is the primary; capture its id directly rather than
    -- looking it up by name afterwards, which would pick the wrong row when
    -- two guests in the same party share a name.
    if v_index = 0 then
      v_primary_id := v_id;
    end if;
    v_index := v_index + 1;
  end loop;

  return v_primary_id;
end;
$function$;

revoke all on function public.rsvp_self_register(uuid, text, jsonb, text) from public;
grant execute on function public.rsvp_self_register(uuid, text, jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Read the whole group behind a magic link
-- ---------------------------------------------------------------------------
-- rsvp_guest_lookup returns one row; the magic-link page now has to render an
-- editor per person. anon still cannot select event_guests, so this is the only
-- read path. Never returns phone, matching the other definer functions.
--
-- `is_self` marks the row the SUPPLIED uuid addresses -- i.e. "this is you" --
-- not the group's originator. Anyone in the group may hold the link, so opening
-- a companion's link marks the companion. Naming it is_primary would invite the
-- opposite reading. The self row sorts first, then the rest by created_at, so
-- the list never reshuffles between renders.
create or replace function public.rsvp_guest_group(p_guest_id uuid)
returns table (
  id           uuid,
  guest_name   text,
  status       text,
  guests_count integer,
  notes        text,
  dietary      text,
  event_id     uuid,
  is_self      boolean
)
language sql
stable
security definer
set search_path to ''
as $function$
  with anchor as (
    select g.event_id, g.phone, g.created_at, g.id
      from public.event_guests g
     where g.id = p_guest_id
  )
  select g.id, g.guest_name, g.status, g.guests_count, g.notes, g.dietary,
         g.event_id,
         (g.id = a.id) as is_self
    from public.event_guests g
    join anchor a on g.event_id = a.event_id
   where g.id = a.id
      -- `= a.phone` is never true when a.phone is null, so a phoneless guest
      -- correctly resolves to a group of exactly one.
      or (a.phone is not null and g.phone = a.phone)
   order by (g.id = a.id) desc, g.created_at asc;
$function$;

revoke all on function public.rsvp_guest_group(uuid) from public;
grant execute on function public.rsvp_guest_group(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Grow / shrink a party from the magic link
-- ---------------------------------------------------------------------------
-- Raising the party size inserts a real row rather than incrementing a counter,
-- so the new person gets their own name, dietary preference and identity.
create or replace function public.rsvp_add_companion(
  p_primary_guest_id uuid,
  p_guest_name       text,
  p_dietary          text default 'regular'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_event_id uuid;
  v_phone    text;
  v_size     integer;
  v_id       uuid;
  v_name     text := trim(coalesce(p_guest_name, ''));
begin
  select g.event_id, g.phone into v_event_id, v_phone
    from public.event_guests g where g.id = p_primary_guest_id;

  if v_event_id is null then
    raise exception 'guest_not_found';
  end if;

  -- Without a phone there is no grouping key, so the new row could never be
  -- found again. Fail loudly instead of creating an orphan.
  if v_phone is null then
    raise exception 'primary_has_no_phone';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 100 then
    raise exception 'invalid_guest_name';
  end if;

  if coalesce(p_dietary,'regular')
       not in ('regular','vegetarian','vegan','gluten_free','kids') then
    raise exception 'invalid_dietary';
  end if;

  -- The UUID is a capability, so cap the blast radius: a leaked link cannot be
  -- used to append unlimited rows to an event.
  select count(*) into v_size
    from public.event_guests g
   where g.event_id = v_event_id and g.phone = v_phone;
  if v_size >= 20 then
    raise exception 'invalid_guests_count';
  end if;

  insert into public.event_guests
    (event_id, guest_name, phone, status, guests_count, dietary, responded_at)
  values
    (v_event_id, v_name, v_phone, 'confirmed', 1,
     coalesce(p_dietary,'regular'), now())
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.rsvp_add_companion(uuid, text, text) from public;
grant execute on function public.rsvp_add_companion(uuid, text, text) to anon, authenticated;

-- Shrinking removes the companion's row. Guarded so a magic link can only ever
-- delete within its OWN group, and can never delete the primary itself.
create or replace function public.rsvp_remove_companion(
  p_primary_guest_id uuid,
  p_companion_id     uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_event_id uuid;
  v_phone    text;
begin
  if p_primary_guest_id = p_companion_id then
    raise exception 'cannot_remove_primary';
  end if;

  select g.event_id, g.phone into v_event_id, v_phone
    from public.event_guests g where g.id = p_primary_guest_id;

  if v_event_id is null then
    raise exception 'guest_not_found';
  end if;
  if v_phone is null then
    raise exception 'primary_has_no_phone';
  end if;

  delete from public.event_guests g
   where g.id = p_companion_id
     and g.event_id = v_event_id
     and g.phone = v_phone;

  if not found then
    raise exception 'guest_not_found';
  end if;
end;
$function$;

revoke all on function public.rsvp_remove_companion(uuid, uuid) from public;
grant execute on function public.rsvp_remove_companion(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Split the rows that already use the old shape
-- ---------------------------------------------------------------------------
-- Only touches rows the old rsvp_self_register wrote, identified by the exact
-- prefix it used. Companions inherit the primary's phone (the grouping key) and
-- its dietary value -- the old shape stored only one preference, so there is
-- nothing more specific to recover; the admin can correct each row afterwards.
-- Idempotent: the notes line is cleared, so a re-run matches nothing.
do $$
declare
  r        record;
  v_name   text;
begin
  for r in
    select id, event_id, phone, dietary, notes, status
      from public.event_guests
     where notes like 'מגיעים איתי: %'
  loop
    foreach v_name in array
      string_to_array(
        regexp_replace(split_part(r.notes, E'\n', 1), '^מגיעים איתי: ', ''),
        ', ')
    loop
      v_name := trim(v_name);
      continue when v_name = '' or char_length(v_name) > 100;

      insert into public.event_guests
        (event_id, guest_name, phone, status, guests_count, dietary, responded_at)
      values
        (r.event_id, v_name, r.phone, r.status, 1, r.dietary, now());
    end loop;

    -- Preserve any free text the guest typed below the companion line.
    update public.event_guests
       set guests_count = 1,
           notes = nullif(trim(coalesce(
                     substr(r.notes, length(split_part(r.notes, E'\n', 1)) + 2)
                   , '')), '')
     where id = r.id;
  end loop;
end $$;
