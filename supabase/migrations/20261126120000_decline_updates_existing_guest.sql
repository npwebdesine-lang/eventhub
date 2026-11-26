-- A decline from the public invite page updates the guest's existing row
-- instead of adding a second one.
--
-- Before: rsvp_self_register always inserted. An invited guest ("דוד כהן",
-- 050-1234567, pending) who tapped "לא אוכל להגיע" on the general invite link
-- became TWO rows: the original still pending, plus a new canceled one. The
-- admin then had to spot and merge them by hand.
--
-- Now, for status = 'canceled' with a real phone, the function first looks for
-- PENDING rows in the same event whose NORMALIZED phone
-- (public.normalize_guest_phone) and normalized name (lower-cased, trimmed,
-- inner whitespace collapsed) both match. If any exist they are marked
-- canceled (a new note is appended, never replacing one) and NULL is
-- returned. Otherwise a new canceled row is inserted, exactly as before.
--
-- Guards, because the general invite link is public:
--   * name AND phone together: phone alone would let anyone who knows a
--     number cancel every guest in that party;
--   * pending rows only: a guest who already answered (e.g. confirmed) is
--     never flipped from this link — that goes through their magic link;
--   * every decline returns NULL (update or insert alike): the row id is the
--     magic-link key, and a differing result would reveal whether a
--     name+phone pair is a pending invitee.
-- The frontend ignores the return value.
--
-- Confirmations are unchanged (always insert). Signature, defaults, grants and
-- return value are unchanged, so this is safe to apply before or after the
-- matching frontend deploy.

create or replace function public.rsvp_self_register(
  p_event_id      uuid,
  p_phone         text,
  p_guests        jsonb,
  p_notes         text    default null,
  p_under_5_count integer default 0,
  p_status        text    default 'confirmed'
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
  v_matched    integer;
  v_under_5    integer := coalesce(p_under_5_count, 0);
  v_status     text    := coalesce(p_status, 'confirmed');
  v_phone      text;
  v_phone_key  text;
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
  v_phone_key := public.normalize_guest_phone(v_phone);

  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'event_not_found';
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    v_notes := left(v_notes, 500);
  end if;

  -- Decline of an existing guest: update in place (see header).
  if v_status = 'canceled' and v_phone_key is not null then
    v_name := trim(coalesce(p_guests -> 0 ->> 'name', ''));
    if char_length(v_name) < 1 or char_length(v_name) > 100 then
      raise exception 'invalid_guest_name';
    end if;

    -- Only rows still waiting for an answer ('pending'). A row that already
    -- holds a response is never overwritten from the public link: the decline
    -- falls through to a new row and the host sees both.
    with matched as (
      update public.event_guests g
         set status       = 'canceled',
             notes        = case
                              when v_notes is null then g.notes
                              when g.notes is null then v_notes
                              else left(g.notes || E'\n' || v_notes, 500)
                            end,
             responded_at = now()
       where g.event_id = p_event_id
         and g.status = 'pending'
         and public.normalize_guest_phone(g.phone) = v_phone_key
         and regexp_replace(lower(trim(g.guest_name)), '\s+', ' ', 'g')
           = regexp_replace(lower(v_name), '\s+', ' ', 'g')
      returning g.id
    )
    select count(*) into v_matched from matched;

    -- Deliberately returns NULL, not the matched id: a guest's id is the key
    -- inside their personal /r/ magic link, so returning it would hand that
    -- link to anyone who knows the guest's name and phone.
    if v_matched > 0 then
      return null;
    end if;
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

  -- A decline returns NULL on BOTH paths (update above, insert here), so a
  -- caller cannot use the return value to learn whether a name+phone belongs
  -- to a pending invitee. Confirmations still return their own new row's id.
  if v_status = 'canceled' then
    return null;
  end if;
  return v_primary_id;
end;
$function$;

revoke all on function public.rsvp_self_register(uuid, text, jsonb, text, integer, text) from public;
grant execute on function public.rsvp_self_register(uuid, text, jsonb, text, integer, text) to anon, authenticated;
