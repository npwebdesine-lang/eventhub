-- Magic-link RSVP capability. Design spec §4.
--
-- RLS cannot express "allow if the URL uuid matches this row" -- policy predicates are
-- evaluated per row, independently of what the client filtered on, so the only
-- expressible anon policy is USING(true), which would expose every guest's name and
-- phone to anyone who found the endpoint. The capability is therefore enforced here,
-- where the requested id is actually visible. anon has NO policies on event_guests and
-- cannot read or write it directly (verified).
--
-- SECURITY DEFINER runs with the owner's rights, so search_path is pinned and EVERY
-- table reference is schema-qualified: an unqualified reference under an empty
-- search_path is what broke check_photo_limit() (42P01, surfaced to the client as a 404).
--
-- Granted to anon AND authenticated: a signed-in owner testing their own link runs as
-- authenticated, and granting only anon reproduces the 403 regression fixed in
-- 20260716095457.
--
-- Deliberately never returns phone: the card has no use for it, so the link cannot leak it.
--
-- Supabase's advisors flag this function as anon/authenticated-executable
-- (0028/0029). That is intentional and is the entire point of a magic link: the
-- unguessable UUIDv4 is the credential, and the function touches only that one row.

create or replace function public.rsvp_respond(
  p_guest_id     uuid,
  p_status       text,
  p_guests_count integer default null,
  p_notes        text    default null
)
returns table (
  guest_name    text,
  status        text,
  guests_count  integer,
  notes         text,
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

  update public.event_guests g
     set status       = p_status,
         guests_count = coalesce(p_guests_count, g.guests_count),
         notes        = coalesce(p_notes, g.notes),
         responded_at = now()
   where g.id = p_guest_id;

  if not found then
    raise exception 'guest_not_found';
  end if;

  return query
    select g.guest_name, g.status, g.guests_count, g.notes,
           e.id, e.name, e.event_date, e.design_config
      from public.event_guests g
      join public.events e on e.id = g.event_id
     where g.id = p_guest_id;
end;
$function$;

revoke all on function public.rsvp_respond(uuid, text, integer, text) from public;
grant execute on function public.rsvp_respond(uuid, text, integer, text) to anon, authenticated;
