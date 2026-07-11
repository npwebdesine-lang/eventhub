// Simulates a flood of guests submitting RSVPs, as happens when an invite link
// is shared and everyone responds in the same evening.
//
// Each virtual user POSTs to /rest/v1/rsvps with the same payload shape the app
// sends (Invite.jsx executeSubmit), respecting the Phase 1 constraints
// (phone format, name lengths) and the anon INSERT RLS policy.
//
// Run:
//   k6 run -e SUPABASE_URL=https://<ref>.supabase.co \
//          -e ANON_KEY=<publishable-anon-key> \
//          -e EVENT_ID=<throwaway-test-event-uuid> \
//          loadtest/rsvp-load.js
//
// WARNING: this writes real rows into EVENT_ID. Use a dedicated test event and
// clean it up afterwards (see loadtest/README.md).

import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4, fakePhone, config, guestHeaders } from "./lib.js";

const { url, key, eventId } = config();

export const options = {
  scenarios: {
    rsvp_flood: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 500 }, // ramp to 500 concurrent guests
        { duration: "3m", target: 1000 }, // push to 1000
        { duration: "2m", target: 1000 }, // hold peak
        { duration: "1m", target: 0 }, // ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // <1% errors
    http_req_duration: ["p(95)<800"], // 95% under 800ms
    "http_req_duration{op:rsvp_insert}": ["p(95)<800"],
  },
};

// Per-VU stable device identity (a guest keeps one device id).
let deviceId;

export default function () {
  if (!deviceId) deviceId = uuidv4();

  const groupId = `load_${deviceId.slice(0, 8)}`;
  const payload = JSON.stringify({
    event_id: eventId,
    group_id: groupId,
    submitter_name: `LoadGuest ${__VU}`,
    submitter_phone: fakePhone(),
    guest_name: `Guest ${__VU}-${__ITER}`,
  });

  const res = http.post(`${url}/rest/v1/rsvps`, payload, {
    headers: guestHeaders(key, deviceId, { Prefer: "return=minimal" }),
    tags: { op: "rsvp_insert" },
  });

  check(res, {
    "rsvp accepted (201)": (r) => r.status === 201,
  });

  // Guests don't submit in a tight loop; pace roughly one submit per VU.
  sleep(Math.random() * 3 + 1);
}
