-- Let the general invite form record "לא אגיע" (not attending).
--
-- Until now rsvp_self_register always wrote status = 'confirmed', so a guest
-- who opened the general link and knew they could not come had no way to say
-- so. Hosts could not tell "has not seen the invite" from "already declined".
--
-- A decline is one person: just a name and an optional note. No phone, no
-- companions, no dietary choice (the column is NOT NULL, so it keeps the
-- default 'regular'). It is written as status = 'canceled' -- the same value the
-- magic links write -- so the admin dashboard's "ביטלו" filter and badge pick it
-- up, and the meal totals (which only sum confirmed rows) ignore it.
--
-- The new p_status argument defaults to 'confirmed', so the frontend already in
-- production keeps working unchanged. DEPLOY ORDER: apply before the frontend.
--
-- Adding an argument changes the signature, so the old function is dropped
-- first; otherwise both overloads would exist and PostgREST could not choose.

drop function if exists public.rsvp_self_register(uuid, text, jsonb, text, integer);

create or replace function public.rsvp_self_register(
  p_event_id       uuid,
  p_phone          text,
  p_guests         jsonb,
  p_notes          text    default null,
  p_under_5_count  integer default 0,
  p_status         text    default 'confirmed'
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
  v_under_5    integer := coalesce(p_under_5_count, 0);
  v_status     text    := coalesce(p_status, 'confirmed');
  v_phone      text;
  v_notes      text;
  v_guest      jsonb;
  v_name       text;
  v_dietary    text;
  v_index      integer := 0;
begin
  -- 'pending' is not a response, so a self-registration cannot write it.
  if v_status not in ('confirmed', 'canceled') then
    raise exception 'invalid_status';
  end if;

  if p_guests is null or jsonb_typeof(p_guests) <> 'array' then
    raise exception 'invalid_guests';
  end if;

  v_count := jsonb_array_length(p_guests);
  if v_count < 1 or v_count > 20 then
    raise exception 'invalid_guests_count';
  end if;
  -- A decline speaks for one person only.
  if v_status = 'canceled' and v_count <> 1 then
    raise exception 'invalid_guests_count';
  end if;

  if v_under_5 < 0 or v_under_5 > 20 then
    raise exception 'invalid_under_5_count';
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
    v_name := trim(coalesce(v_guest ->> 'name', ''));
    -- Nobody is eating, so a decline ignores any dietary value sent.
    v_dietary := case
      when v_status = 'canceled' then 'regular'
      else coalesce(nullif(v_guest ->> 'dietary', ''), 'regular')
    end;

    if char_length(v_name) < 1 or char_length(v_name) > 100 then
      raise exception 'invalid_guest_name';
    end if;
    if v_dietary not in ('regular','vegetarian','vegan','gluten_free','kids','under_5') then
      raise exception 'invalid_dietary';
    end if;
    if v_index = 0 and v_dietary = 'under_5' then
      raise exception 'invalid_dietary';
    end if;

    insert into public.event_guests
      (event_id, guest_name, phone, status, guests_count, under_5_count,
       notes, dietary, responded_at)
    values
      (p_event_id, v_name, v_phone, v_status, 1,
       case when v_index = 0 and v_status = 'confirmed' then v_under_5 else 0 end,
       case when v_index = 0 then v_notes else null end,
       v_dietary, now())
    returning id into v_id;

    if v_index = 0 then
      v_primary_id := v_id;
    end if;
    v_index := v_index + 1;
  end loop;

  return v_primary_id;
end;
$function$;

revoke all on function public.rsvp_self_register(uuid, text, jsonb, text, integer, text) from public;
grant execute on function public.rsvp_self_register(uuid, text, jsonb, text, integer, text) to anon, authenticated;
