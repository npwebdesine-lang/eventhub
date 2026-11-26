-- The digital gift module (bit / PayBox) becomes a per-event add-on that can
-- be switched off without losing its links: design_config.gift_enabled.
--
-- resolve_gift_redirect now returns NULL straight away when gift_enabled is
-- explicitly false, BEFORE touching event_gift_scan_counters, so a printed
-- /g/bit/<code> or /g/paybox/<code> QR of a switched-off event lands on the
-- invite (/i/<code>, see api/gift-redirect.js) and does not count as a scan.
--
-- Backward compatibility, mirroring isGiftEnabled() in src/lib/bitGift.js:
--   * gift_enabled missing (events saved before the toggle): unchanged
--     behaviour. Events with saved links keep redirecting; events without
--     links already return NULL.
--   * gift_enabled true: unchanged behaviour.
-- The dashboard writes an explicit boolean on every save. A string "false" is
-- treated as false too, defensively.
--
-- Same signature, return type and grants: safe before or after the frontend.

create or replace function public.resolve_gift_redirect(
  p_event_id uuid,
  p_provider text
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_config  jsonb;
  v_host_re text;
  v_links   text[];
  v_count   bigint;
begin
  if p_provider is null or p_provider not in ('bit', 'paybox') then
    return null;
  end if;

  select e.design_config into v_config
    from public.events e
   where e.id = p_event_id;
  if not found then
    return null;
  end if;

  -- Module switched off: no redirect and no counter bump.
  if lower(coalesce(v_config ->> 'gift_enabled', '')) = 'false' then
    return null;
  end if;

  -- https + exact host or a subdomain of it; the path may be anything but
  -- must not contain whitespace, quotes or angle brackets.
  v_host_re := case p_provider
    when 'bit' then
      '^https://([a-z0-9-]+\.)*bitpay\.co\.il(:443)?(/[^\s"<>]*)?$'
    else
      '^https://([a-z0-9-]+\.)*(payboxapp\.com|payboxapp\.page\.link)(:443)?(/[^\s"<>]*)?$'
  end;

  -- Keep the configured order (groom first), dropping empty/invalid entries.
  select coalesce(array_agg(link order by ord), array[]::text[])
    into v_links
    from (
      select trim(value) as link, ord
        from jsonb_array_elements_text(
               case when jsonb_typeof(v_config -> (p_provider || '_links')) = 'array'
                    then v_config -> (p_provider || '_links')
                    else '[]'::jsonb
               end
             ) with ordinality as t(value, ord)
    ) links
   where links.link ~* v_host_re;

  -- Backward compatibility: events saved before bit_links existed.
  if cardinality(v_links) = 0 and p_provider = 'bit'
     and trim(coalesce(v_config ->> 'bit_link', '')) ~* v_host_re then
    v_links := array[trim(v_config ->> 'bit_link')];
  end if;

  if cardinality(v_links) = 0 then
    return null;  -- nothing configured: the caller sends the guest to the invite
  end if;

  -- Atomic: concurrent scans each get their own number (row lock on upsert).
  insert into public.event_gift_scan_counters as c (event_id, provider, scans)
  values (p_event_id, p_provider, 1)
  on conflict (event_id, provider)
  do update set scans = c.scans + 1, updated_at = now()
  returning c.scans into v_count;

  -- scan 1 -> link 1, scan 2 -> link 2, scan 3 -> link 1, ...
  return v_links[((v_count - 1) % cardinality(v_links)) + 1];
end;
$function$;

revoke all on function public.resolve_gift_redirect(uuid, text) from public;
grant execute on function public.resolve_gift_redirect(uuid, text) to anon, authenticated;
