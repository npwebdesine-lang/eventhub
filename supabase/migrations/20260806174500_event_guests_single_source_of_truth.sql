-- Make event_guests the single source of truth for guests.
--
-- Until now /invite/:id wrote to `rsvps` (one row per named guest) while the
-- pre-loaded list lived in `event_guests` (one row per invitee, with guests_count).
-- Two tables answering overlapping questions meant the admin had two lists and no
-- combined headcount. Public submissions now land in event_guests too.
--
-- `rsvps` is deliberately NOT dropped: it still holds historical submissions, and
-- dropping it would destroy them. It simply stops receiving new rows.

-- ---------------------------------------------------------------------------
-- Why these are SECURITY DEFINER functions and not an anon INSERT policy
-- ---------------------------------------------------------------------------
-- event_guests has exactly one policy -- event_guests_all_owner (authenticated,
-- owns_event(event_id)). anon has NO policy and cannot read or write the table at
-- all. That is deliberate: RLS predicates are evaluated per row independently of
-- what the client filtered on, so any anon-visible policy would have to be
-- USING(true)/WITH CHECK(true), which would expose or allow tampering with every
-- invitee's name and phone across every event.
--
-- Granting anon a blanket INSERT policy would also let anyone append rows to any
-- event's guest list AND (paired with the existing absence of a SELECT policy)
-- would still not let the page do its duplicate check. So both operations are
-- funnelled through definer functions that constrain exactly what anon may do:
-- insert one self-registration, and ask whether a name is already taken.
--
-- Empty search_path + every table reference schema-qualified: an unqualified
-- reference under an empty search_path is what broke check_photo_limit() with
-- 42P01, surfacing to the client as a misleading 404.

-- Self-registration from the public invite page.
--
-- Mirrors the check constraints on event_guests rather than trusting the client,
-- and raises the same readable error codes the RSVP UI already maps to Hebrew
-- copy, instead of leaking a raw 23514.
--
-- Companions are stored in `notes` (no dedicated column) as a single readable
-- line. p_notes stays available for anything the guest types; the two are joined
-- so neither is lost, and the result is clamped to the column's 500-char limit.
create or replace function public.rsvp_self_register(
  p_event_id     uuid,
  p_guest_name   text,
  p_phone        text    default null,
  p_guests_count integer default 1,
  p_companions   text[]  default null,
  p_dietary      text    default 'regular',
  p_notes        text    default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id           uuid;
  v_companions   text;
  v_notes        text;
begin
  if p_guest_name is null or char_length(trim(p_guest_name)) < 1
     or char_length(trim(p_guest_name)) > 100 then
    raise exception 'invalid_guest_name';
  end if;

  if p_phone is not null and p_phone <> ''
     and p_phone !~ '^[0-9+\-\s]{7,15}$' then
    raise exception 'invalid_phone';
  end if;

  if p_guests_count is null or p_guests_count < 0 or p_guests_count > 20 then
    raise exception 'invalid_guests_count';
  end if;

  if p_dietary is not null
     and p_dietary not in ('regular','vegetarian','vegan','gluten_free','kids') then
    raise exception 'invalid_dietary';
  end if;

  -- The event must exist. Without this the FK would raise 23503, which reaches the
  -- client as an opaque 409 rather than a code the UI can translate.
  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'event_not_found';
  end if;

  select nullif(
           trim(both ' ' from array_to_string(
             array(select trim(c)
                     from unnest(coalesce(p_companions, array[]::text[])) c
                    where trim(coalesce(c,'')) <> ''), ', ')), '')
    into v_companions;

  v_notes := nullif(
    concat_ws(
      E'\n',
      case when v_companions is not null
           then 'מגיעים איתי: ' || v_companions end,
      nullif(trim(coalesce(p_notes, '')), '')
    ), '');

  if v_notes is not null and char_length(v_notes) > 500 then
    v_notes := left(v_notes, 500);
  end if;

  insert into public.event_guests
    (event_id, guest_name, phone, status, guests_count, notes, dietary, responded_at)
  values
    (p_event_id, trim(p_guest_name), nullif(trim(coalesce(p_phone,'')), ''),
     'confirmed', p_guests_count, v_notes,
     coalesce(p_dietary, 'regular'), now())
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.rsvp_self_register(uuid, text, text, integer, text[], text, text) from public;
grant execute on function public.rsvp_self_register(uuid, text, text, integer, text[], text, text) to anon, authenticated;

-- Duplicate pre-check for the invite form.
--
-- anon cannot select event_guests, so the "someone already registered this name"
-- warning needs a definer function too. Returns ONLY the matching names -- never
-- phone, status, or ids -- so it cannot be used to enumerate the guest list:
-- the caller must already know the exact name to get a hit.
create or replace function public.rsvp_check_duplicates(
  p_event_id uuid,
  p_names    text[]
)
returns table (guest_name text)
language sql
stable
security definer
set search_path to ''
as $function$
  select distinct g.guest_name
    from public.event_guests g
   where g.event_id = p_event_id
     and lower(trim(g.guest_name)) = any (
           select lower(trim(n))
             from unnest(coalesce(p_names, array[]::text[])) n
         );
$function$;

revoke all on function public.rsvp_check_duplicates(uuid, text[]) from public;
grant execute on function public.rsvp_check_duplicates(uuid, text[]) to anon, authenticated;

-- The public list is now materially larger and always filtered by event.
create index if not exists event_guests_event_id_created_at_idx
  on public.event_guests (event_id, created_at desc);
