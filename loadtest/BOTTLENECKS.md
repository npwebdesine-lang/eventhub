# Eventick launch bottlenecks & capacity report

Target load: **500–1000+ concurrent guests per event.**
Supabase project: `EventHub` (`eihsjrfncqhbmseldren`), org `np web studio`.

> **🚨 Blocker #0 — the project is on the Supabase FREE plan.**
> The Free tier cannot serve this event size. This must be resolved before
> launch; everything below assumes you also address this. Details in §1.

---

## 1. Supabase Realtime concurrent connections — the #1 ceiling

Every guest on the event Home holds a live WebSocket (photos carousel +
blessings ticker), and the Photos page opens another. So concurrent guests ≈
concurrent Realtime connections.

| Plan | Realtime concurrent connections (default) |
|------|-------------------------------------------|
| **Free (current)** | **200** |
| Pro | 500 (raisable on request) |
| Team / Enterprise | higher / negotiable |

- **At 500–1000 guests you will exceed the Free 200-connection cap** — new
  guests' Realtime subscriptions will be refused and the live photo/blessing
  updates stop working. This is the first thing that breaks, and it breaks
  hard.
- **Action:**
  1. Upgrade to **Pro** at minimum before launch.
  2. Since even Pro's default 500 is below a 1000-guest peak, **request a
     Realtime connection-limit increase** for the event, **and/or** reduce
     per-guest connections (below).
- **Mitigation already noted:** Home currently uses 2 channels/guest. Gating
  the blessings-ticker channel behind tab visibility, or lazily subscribing
  only when the relevant module is on screen, cuts the connection/message load.
  (This was deferred in Phase 2 because consolidating channels does not reduce
  the per-guest *connection* count — only *not subscribing* does.)
- The k6 scripts here hit the REST API only; **they do not load-test Realtime.**
  Validate Realtime separately by opening many real browser/WebSocket clients
  against a test event, or with a WebSocket load tool, and watch
  Dashboard → Reports → Realtime.

## 2. Compute (CPU / IO) — Free is shared, undersized

- Free runs on a shared micro instance; sustained write bursts (RSVP floods,
  message sends) will saturate CPU/IO long before a paid instance would.
- Phase 1 added the missing `event_id` indexes and chat composites, so the
  hot read/write paths are index-backed — but the instance still needs
  headroom. **Pro's dedicated compute (or a compute add-on) is required** for
  a 1000-guest write burst.
- Watch during a k6 run: Dashboard → Reports → CPU, Memory, Disk IO. If CPU
  pins at 100%, size up the compute add-on.

## 3. Connection pooling

- PostgREST sits behind the Supavisor pooler, so REST traffic doesn't consume
  raw Postgres connections 1:1 — good. But the Free tier's pool is small.
- Keep all guest traffic on the REST API / pooler (it already is). Do not open
  direct DB connections from any serverless/edge function without the pooler.

## 4. Storage egress — album image bandwidth

- Free tier includes only ~5 GB egress/month. A busy album (hundreds of photos)
  viewed by hundreds of guests on the big-screen `Album` page can blow through
  that in a single event.
- **Mitigations already shipped (Phase 2):**
  - `Album` now paginates (24/page) instead of loading every image at once.
  - All uploaders (including blessings, newly) compress to bounded JPEGs, and
    the storage buckets enforce a 10 MB size cap + image-only MIME types, so no
    raw multi-MB originals are served.
- **Still recommended:** front the public storage buckets with a CDN / image
  transformation (Supabase Storage image transformations, or Cloudflare in
  front of the storage domain) and generate thumbnails for the album grid,
  serving full-res only in the lightbox. Confirm the paid plan's egress
  allotment covers your expected event bandwidth.

## 5. No per-key / per-IP rate limiting on PostgREST

- The publishable anon key is public and there is **no built-in per-key or
  per-IP rate limit** on the REST endpoints. The Phase 1 CHECK constraints and
  RLS are the only brakes on spam/abuse — they cap row *content*, not request
  *volume*.
- A malicious client can still hammer inserts (each a valid, constrained row).
  Follow-ups to consider:
  - Per-device throttles via DB triggers, similar to the existing
    `check_photo_limit()` (e.g. max N messages/minute per `sender_id`, max N
    rsvps per `group_id`/device).
  - A WAF / rate limit at the edge (Cloudflare in front of the Supabase domain,
    or move writes behind an Edge Function that rate-limits) if abuse is a real
    concern for a public event.

## 6. Auth (admin only)

- Only the event admin uses Supabase Auth; guests are anonymous (device-id).
  So the Auth MAU limit is not a factor at guest scale. Enable **leaked-password
  protection** for the admin account (Dashboard → Auth → Passwords) — flagged by
  the security advisor in Phase 1.

---

## Pre-launch checklist

- [ ] **Upgrade off Free** (Pro minimum) and confirm it won't auto-pause.
- [ ] **Raise the Realtime connection limit** to cover peak guests, and/or gate
      per-guest channels.
- [ ] Add a **compute add-on** if a k6 run pins CPU.
- [ ] Put storage behind a **CDN + thumbnails**; confirm egress allotment.
- [ ] Decide on **write rate-limiting** (DB triggers and/or edge WAF).
- [ ] Enable **leaked-password protection** for admin auth.
- [ ] Run `rsvp-load.js` and `dating-load.js` against a **test event** on the
      upgraded project; review `get_advisors(performance)` + `get_logs` after.
- [ ] Separately validate **Realtime** with many real WebSocket clients.
