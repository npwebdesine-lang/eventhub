-- Dietary preferences for the RSVP & Guest Management module.
--
-- Mirrors the conventions established in 20260716101728_event_guests_rsvp_schema.sql:
-- NOT NULL + default + check constraint, exactly like `status`. NOT NULL matters here
-- because a check constraint alone would happily accept NULL (`null in (...)` is
-- unknown, not false), which would let a null slip past both the DB and the RPC.
--
-- The column name is `dietary` (not `dietary_preference`) to match the terse column
-- naming already used across event_guests: status, notes, phone.

alter table public.event_guests
  add column if not exists dietary text not null default 'regular';

alter table public.event_guests
  drop constraint if exists event_guests_dietary_check;

alter table public.event_guests
  add constraint event_guests_dietary_check
    check (dietary in ('regular','vegetarian','vegan','gluten_free','kids'));

-- rsvp_respond gains p_dietary and returns the stored choice.
--
-- This MUST be a DROP + CREATE, not a CREATE OR REPLACE. Two independent reasons:
--   1. Adding a defaulted 5th parameter under CREATE OR REPLACE creates an OVERLOAD
--      rather than replacing the function. A 4-argument call from the client would
--      then match both candidates and fail with 42725 "function is not unique".
--   2. Postgres refuses to change the return type of an existing function, and the
--      returned table gains a `dietary` column.
--
-- Everything else is carried over verbatim from 20260716101756: SECURITY DEFINER with
-- an empty search_path and every table reference schema-qualified (an unqualified
-- reference under an empty search_path is what broke check_photo_limit() with 42P01,
-- surfacing to the client as a misleading 404), granted to anon AND authenticated so a
-- signed-in owner testing their own link does not hit the 403 fixed in 20260716095457,
-- and phone is still never returned.

drop function if exists public.rsvp_respond(uuid, text, integer, text);

create or replace function public.rsvp_respond(
  p_guest_id     uuid,
  p_status       text,
  p_guests_count integer default null,
  p_notes        text    default null,
  p_dietary      text    default null
)
returns table (
  guest_name    text,
  status        text,
  guests_count  integer,
  notes         text,
  dietary       text,
  event_id      uuid,
  event_name    text,
  event_date    date,
  design_config jsonb
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_status is null or p_status not in ('confirmed','canceled','pending') then
    raise exception 'invalid_status';
  end if;

  if p_guests_count is not null and (p_guests_count < 0 or p_guests_count > 20) then
    raise exception 'invalid_guests_count';
  end if;

  if p_notes is not null and char_length(p_notes) > 500 then
    raise exception 'invalid_notes';
  end if;

  -- Validated here as well as by the check constraint so the client receives the
  -- same readable error code as every other field, instead of a raw 23514.
  if p_dietary is not null
     and p_dietary not in ('regular','vegetarian','vegan','gluten_free','kids') then
    raise exception 'invalid_dietary';
  end if;

  update public.event_guests g
     set status       = p_status,
         guests_count = coalesce(p_guests_count, g.guests_count),
         notes        = coalesce(p_notes, g.notes),
         dietary      = coalesce(p_dietary, g.dietary),
         responded_at = now()
   where g.id = p_guest_id;

  if not found then
    raise exception 'guest_not_found';
  end if;

  return query
    select g.guest_name, g.status, g.guests_count, g.notes, g.dietary,
           e.id, e.name, e.event_date, e.design_config
      from public.event_guests g
      join public.events e on e.id = g.event_id
     where g.id = p_guest_id;
end;
$function$;

revoke all on function public.rsvp_respond(uuid, text, integer, text, text) from public;
grant execute on function public.rsvp_respond(uuid, text, integer, text, text) to anon, authenticated;
