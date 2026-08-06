-- Fold the magic-link capability into the self-service invite at /invite/:id, and
-- extend dietary preferences to the self-service `rsvps` path.
--
-- Two separate answer surfaces stay separate on purpose (see 20260716101728):
--   event_guests -> "did David confirm?"  (pre-loaded list, magic link)
--   rsvps        -> "who is coming?"      (self-service, one row PER GUEST)
-- The unified page picks the surface based on whether ?guest_id= is present.

-- rsvps is one row per guest, so dietary is per person here rather than per group.
-- That is what makes a catering breakdown a plain GROUP BY.
-- NOT NULL for the same reason as event_guests.dietary: a bare check constraint
-- accepts NULL, because `null in (...)` is unknown rather than false.
alter table public.rsvps
  add column if not exists dietary text not null default 'regular';

alter table public.rsvps
  drop constraint if exists rsvps_dietary_check;

alter table public.rsvps
  add constraint rsvps_dietary_check
    check (dietary in ('regular','vegetarian','vegan','gluten_free','kids'));

-- Read side of the magic link.
--
-- RLS cannot express "allow if the URL uuid matches this row" -- policy predicates are
-- evaluated per row independently of the client's filter, so the only expressible anon
-- policy is USING(true), which would expose every guest's name and phone. anon
-- therefore has NO policies on event_guests and cannot select from it at all, which is
-- why prefilling the name needs a SECURITY DEFINER function rather than a plain select.
--
-- Same capability model as rsvp_respond: the unguessable UUIDv4 IS the credential and
-- the function touches exactly one row. Unlike rsvp_respond this one is read-only, so
-- landing on the page does not fabricate a response or move responded_at.
--
-- Returns event_id so the caller can confirm the guest actually belongs to the event in
-- the URL; a mismatch must fall back to self-service rather than greet the wrong person.
--
-- Deliberately never returns phone, matching rsvp_respond.

create or replace function public.rsvp_guest_lookup(p_guest_id uuid)
returns table (
  guest_name   text,
  status       text,
  guests_count integer,
  notes        text,
  dietary      text,
  event_id     uuid
)
language sql
stable
security definer
set search_path to ''
as $function$
  select g.guest_name, g.status, g.guests_count, g.notes, g.dietary, g.event_id
    from public.event_guests g
   where g.id = p_guest_id;
$function$;

revoke all on function public.rsvp_guest_lookup(uuid) from public;
grant execute on function public.rsvp_guest_lookup(uuid) to anon, authenticated;
