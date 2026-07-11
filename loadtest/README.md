# Eventick load tests (k6)

Local load-testing scripts that simulate peak guest traffic (500–1000+
concurrent) against the Supabase REST API, using the exact payloads, headers,
and RLS rules the app relies on after Phase 1.

- `rsvp-load.js` — a flood of RSVP submissions (invite link shared, everyone
  responds at once).
- `dating-load.js` — the read+write-heavy Dating flow: browsing profiles,
  upserting your own profile, and sending messages.
- `lib.js` — shared helpers (RFC-4122 v4 UUID generator that satisfies the
  `is_valid_uuidv4()` CHECK, phone generator, config/header helpers).

## Prerequisites

Install k6: <https://grafana.com/docs/k6/latest/set-up/install-k6/>
(Windows: `winget install k6` or `choco install k6`).

## ⚠️ Use a throwaway test event

These scripts write **real rows** (rsvps, dating_profiles, dating_messages)
into whatever `EVENT_ID` you pass. **Never point them at a live event.** Create
a dedicated test event first, then delete it (and its child rows) afterwards.

Create a test event (Supabase SQL editor) and note the returned id:

```sql
insert into public.events (name) values ('__loadtest__') returning id;
```

Clean everything up afterwards:

```sql
-- replace <EVENT_ID> with the id from above
delete from public.dating_messages where event_id = '<EVENT_ID>';
delete from public.dating_profiles  where event_id = '<EVENT_ID>';
delete from public.rsvps            where event_id = '<EVENT_ID>';
delete from public.events           where id = '<EVENT_ID>';
```

## Running

Pass config as environment vars (`-e`). Use the **publishable anon key** (the
same `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` the browser uses) — never a
service-role key.

```bash
k6 run -e SUPABASE_URL=https://<project-ref>.supabase.co \
       -e ANON_KEY=<publishable-anon-key> \
       -e EVENT_ID=<throwaway-test-event-uuid> \
       loadtest/rsvp-load.js

k6 run -e SUPABASE_URL=https://<project-ref>.supabase.co \
       -e ANON_KEY=<publishable-anon-key> \
       -e EVENT_ID=<throwaway-test-event-uuid> \
       loadtest/dating-load.js
```

Both scripts ramp 0 → peak → hold → 0 over ~8 minutes. Adjust the `stages` in
each file's `options` to change the shape or peak.

## Reading the results

- `http_req_failed` — should stay under the threshold (1–2%). A spike here at a
  given VU level is your ceiling.
- `http_req_duration` p95 per operation (tagged `op:rsvp_insert`,
  `op:profiles_list`, `op:profile_upsert`, `op:message_send`) — where latency
  climbs tells you which query needs an index or the DB needs more headroom.
- k6 prints a per-check pass rate; a falling "accepted (201)" rate means the API
  is shedding load (429s / timeouts / connection limits).

After a run, check the DB side for what actually hurt:

- Supabase Dashboard → Reports (CPU, connections, disk IO) during the run.
- `get_advisors(performance)` and `get_logs` for slow queries / errors.

See `BOTTLENECKS.md` for the known ceilings and what to watch.

## Notes on fidelity

- Each VU generates one stable device id and sends it as `x-device-id`; that id
  is also used as `guest_id` / `sender_id` so the device-scoped RLS
  `WITH CHECK` policies pass — exactly as the app behaves.
- `dating-load.js` expects a 409 on a profile that already exists
  (`unique(event_id, guest_id)`), matching the app's select-then-insert path.
- These hit the REST API directly. They do **not** exercise Supabase Realtime
  (WebSocket) load — see `BOTTLENECKS.md` for why that is the separate, and
  likely first, ceiling to hit.
