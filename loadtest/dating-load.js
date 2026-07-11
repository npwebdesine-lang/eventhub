// Simulates the Dating module under load: guests browsing profiles, updating
// their own profile, and messaging each other. This is the most read+write
// heavy guest flow and exercises the device-scoped RLS policies.
//
// Each VU has a stable device id (== its guest_id / sender_id), sent as the
// x-device-id header so the RLS WITH CHECK (guest_id = device_id()) passes.
// Query shapes mirror Dating.jsx (paginated profile list, message thread).
//
// Run:
//   k6 run -e SUPABASE_URL=https://<ref>.supabase.co \
//          -e ANON_KEY=<publishable-anon-key> \
//          -e EVENT_ID=<throwaway-test-event-uuid> \
//          loadtest/dating-load.js
//
// WARNING: writes real profiles/messages into EVENT_ID. Use a throwaway event.

import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4, config, guestHeaders } from "./lib.js";

const { url, key, eventId } = config();

const PROFILES_PAGE = 20; // matches Dating.jsx PROFILES_PAGE

export const options = {
  scenarios: {
    dating_activity: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 400 },
        { duration: "3m", target: 800 },
        { duration: "2m", target: 800 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    "http_req_duration{op:profiles_list}": ["p(95)<600"],
    "http_req_duration{op:profile_upsert}": ["p(95)<900"],
    "http_req_duration{op:message_send}": ["p(95)<800"],
  },
};

let deviceId;
let hasProfile = false;

function listProfiles(headers) {
  const q =
    `${url}/rest/v1/dating_profiles?select=id,guest_id,name,age,gender,seeking,connection,location,bio,photo_url` +
    `&event_id=eq.${eventId}&guest_id=neq.${deviceId}&order=created_at.desc&limit=${PROFILES_PAGE}`;
  const res = http.get(q, { headers, tags: { op: "profiles_list" } });
  check(res, { "profiles list 200": (r) => r.status === 200 });
  return res.json();
}

function upsertProfile(headers) {
  const body = JSON.stringify({
    event_id: eventId,
    guest_id: deviceId, // must equal x-device-id for RLS
    name: `Dater ${__VU}`,
    age: 18 + (__VU % 50),
    gender: "אחר",
    seeking: "הכל",
    bio: "load test profile",
  });
  const res = http.post(`${url}/rest/v1/dating_profiles`, body, {
    headers: Object.assign({ Prefer: "return=minimal" }, headers),
    tags: { op: "profile_upsert" },
  });
  // 201 created, or 409 if the (event_id, guest_id) row already exists.
  check(res, { "profile upsert ok": (r) => r.status === 201 || r.status === 409 });
  if (res.status === 201 || res.status === 409) hasProfile = true;
}

function sendMessage(headers, receiverId) {
  const body = JSON.stringify({
    event_id: eventId,
    sender_id: deviceId, // must equal x-device-id for RLS
    receiver_id: receiverId,
    message: `hi from ${__VU} @ ${__ITER}`,
  });
  const res = http.post(`${url}/rest/v1/dating_messages`, body, {
    headers: Object.assign({ Prefer: "return=minimal" }, headers),
    tags: { op: "message_send" },
  });
  check(res, { "message accepted (201)": (r) => r.status === 201 });
}

export default function () {
  if (!deviceId) deviceId = uuidv4();
  const headers = guestHeaders(key, deviceId);

  // Ensure this VU has a profile once, early on.
  if (!hasProfile) upsertProfile(headers);

  // Browse the roster.
  const profiles = listProfiles(headers);

  // Sometimes message someone from the roster (fall back to a random id).
  if (Math.random() < 0.4) {
    const receiver =
      profiles && profiles.length > 0
        ? profiles[(Math.random() * profiles.length) | 0].guest_id
        : uuidv4();
    sendMessage(headers, receiver);
  }

  sleep(Math.random() * 2 + 1);
}
