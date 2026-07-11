// Shared helpers for the k6 load scripts.

// RFC 4122 v4 UUID that satisfies the app's is_valid_uuidv4() CHECK
// (pattern: ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$)
export function uuidv4() {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
    else if (i === 14) s += "4";
    else if (i === 19) s += hex[((Math.random() * 4) | 0) + 8]; // 8,9,a,b
    else s += hex[(Math.random() * 16) | 0];
  }
  return s;
}

// A phone string that matches the rsvps/rideshares CHECK ^[0-9+\-\s]{7,15}$
export function fakePhone() {
  let n = "05";
  for (let i = 0; i < 8; i++) n += (Math.random() * 10) | 0;
  return n; // 10 digits
}

// Reads required config from environment (-e KEY=VALUE) and fails loudly if
// anything is missing, so a misconfigured run can't silently hit the wrong
// project or event.
export function config() {
  const url = __ENV.SUPABASE_URL;
  const key = __ENV.ANON_KEY;
  const eventId = __ENV.EVENT_ID;
  if (!url || !key || !eventId) {
    throw new Error(
      "Missing config. Run with: k6 run -e SUPABASE_URL=... -e ANON_KEY=... -e EVENT_ID=... <script>",
    );
  }
  return { url: url.replace(/\/$/, ""), key, eventId };
}

// Standard PostgREST headers for an anonymous guest identified by deviceId.
export function guestHeaders(key, deviceId, extra) {
  return Object.assign(
    {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "x-device-id": deviceId,
      "Content-Type": "application/json",
    },
    extra || {},
  );
}
