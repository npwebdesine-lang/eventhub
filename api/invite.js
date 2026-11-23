// הזרקת תגיות Open Graph דינמיות לעמוד ההזמנה.
//
// הבעיה: Eventick הוא SPA של Vite. הקוראים של וואטסאפ/פייסבוק/טוויטר לא מריצים
// JavaScript, ולכן כל /invite/:id נראה להם כמו index.html הגנרי — הכותרת
// "Eventick", בלי תמונה ובלי תיאור.
//
// הפתרון: כל בקשה ל-/invite/:id עוברת דרך הפונקציה הזו (ראו rewrites ב-
// vercel.json). היא מושכת את פרטי האירוע, מזריקה את התגיות ל-HTML ומחזירה
// את אותו index.html בדיוק — כך שהאפליקציה עולה רגיל אצל משתמש אמיתי.
//
// מכוון: אין כאן זיהוי User-Agent. הגשת HTML שונה לקוראים ולבני אדם היא
// cloaking, מנועי חיפוש מענישים על זה, והיא נשברת בכל פעם שוואטסאפ משנה את
// ה-UA שלו. כולם מקבלים את אותו עמוד.

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

// ה-UUID מגיע מה-URL ונשלח כפרמטר שאילתה ל-PostgREST. בלי הבדיקה הזו אפשר
// היה להזריק מפעילי סינון (eq/or/...) לשאילתה.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// שמות אירועים נכתבים על ידי משתמשים. בלי בריחה, שם שמכיל " היה סוגר את
// המאפיין ומאפשר הזרקת HTML לתוך העמוד; גם & פשוט (כמו ב"נתיב & אוראל")
// שובר את התגית.
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// event_date הוא עמודת date ("2026-12-30"). new Date() על מחרוזת כזו מפרש
// אותה כחצות UTC, ואז פורמט באזור זמן מערבי מזיז יום אחורה. מפרקים ידנית.
const formatHebrewDate = (isoDate) => {
  if (!isoDate) return "";
  const [year, month, day] = String(isoDate).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
};

async function fetchEvent(eventId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const url =
    `${SUPABASE_URL}/rest/v1/events` +
    `?id=eq.${eventId}&select=name,event_date,location,design_config&limit=1`;

  const response = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    // הקורא של וואטסאפ מוותר מהר; עדיף להגיש את המעטפת בלי תגיות מאשר לתקוע
    // את הבקשה עד timeout.
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// קישורי הקסם הקצרים (/r/<code>?s=1) מגיעים לכאן עם g=<code> במקום id, כדי
// שגם להם תהיה תצוגה מקדימה של האירוע בוואטסאפ. הקוד הוא ה-UUID של האורח
// ב-base64url (ראו src/lib/rsvpLink.js); ממנו נגזר האירוע.
const GUEST_CODE_RE = /^[A-Za-z0-9_-]{22}$/;

const decodeGuestCode = (code) => {
  const hex = Buffer.from(code, "base64url").toString("hex");
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// קריאה בלבד דרך אותו RPC שהאפליקציה משתמשת בו — ל-anon אין גישה ישירה
// ל-event_guests. מהתשובה נלקח רק event_id; שום פרט של האורח לא נכנס ל-HTML,
// שנשמר ב-CDN.
async function fetchGuestEventId(guestId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rsvp_guest_group`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_guest_id: guestId }),
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) return null;
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  const row = rows.find((entry) => entry.is_self) || rows[0];
  return typeof row.event_id === "string" ? row.event_id : null;
}

// מקור אמת ל-origin. לא נגזר מכותרות הבקשה:
//   Host ו-X-Forwarded-Host נשלטים על ידי הלקוח. אם הם היו מרכיבים את
//   ה-origin, בקשה עם X-Forwarded-Host: evil.com הייתה גורמת לתשובה להיכתב
//   עם og:url של evil.com — והתשובה נשמרת ב-CDN (s-maxage), כך שכל מי
//   שביקש אחריה היה מקבל את הגרסה המורעלת. זה cache poisoning קלאסי דרך
//   קלט לא ממופתח.
//
// VERCEL_PROJECT_PRODUCTION_URL ו-VERCEL_URL מוזרקים על ידי הפלטפורמה ואינם
// ניתנים לזיוף מהרשת.
const TRUSTED_ORIGIN =
  process.env.PUBLIC_ORIGIN ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "");

// כתובת הדפלוימנט עצמו — משמשת רק לנפילה לקריאת המעטפת ברשת.
const SELF_ORIGIN = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "";

// שתי דרכים להשיג את המעטפת, לפי הסדר:
//   1. מהדיסק — dist/index.html נארז עם הפונקציה דרך functions.includeFiles.
//   2. מהרשת, מהדפלוימנט של עצמנו בלבד. /index.html הוא קובץ סטטי אמיתי,
//      ו-Vercel בודק את מערכת הקבצים לפני ה-rewrites, ולכן אין כאן לולאה.
//
// ה-origin כאן חייב להגיע מהפלטפורמה ולא מהבקשה: הגוף שמוחזר מה-fetch הופך
// להיות גוף התשובה שלנו כמות שהוא. origin שנשלט על ידי תוקף היה גורם לנו
// להגיש HTML זר מהדומיין שלנו.
async function loadShell() {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return await readFile(join(process.cwd(), "dist", "index.html"), "utf8");
  } catch {
    if (!SELF_ORIGIN) throw new Error("shell_unavailable");
    const response = await fetch(`${SELF_ORIGIN}/index.html`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error("shell_unavailable");
    return await response.text();
  }
}

const buildTags = ({ title, description, image, fallbackImage, url }) => {
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Eventick" />`,
    `<meta property="og:locale" content="he_IL" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    // summary_large_image הוא מה שהופך את התצוגה המקדימה לתמונה גדולה
    // במקום תמונה ממוזערת בצד.
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];
  if (image) {
    tags.push(
      `<meta property="og:image" content="${escapeHtml(image)}" />`,
      `<meta property="og:image:secure_url" content="${escapeHtml(image)}" />`,
      `<meta property="og:image:type" content="image/jpeg" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${escapeHtml(title)}" />`,
      `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    );
  } else {
    // בלי תמונת הזמנה: האייקון, בלי מידות 1200x630 שהוא לא עומד בהן.
    tags.push(
      `<meta property="og:image" content="${escapeHtml(fallbackImage)}" />`,
    );
  }
  return tags.join("\n    ");
};

export default async function handler(request, response) {
  // בפיתוח מקומי אין משתני פלטפורמה, ואז נופלים ל-Host. זה בטוח כאן: מחוץ
  // ל-Vercel אין CDN שישמור תשובה מורעלת, והכתובת משמשת רק לתגיות.
  const origin =
    TRUSTED_ORIGIN ||
    SELF_ORIGIN ||
    `${request.headers["x-forwarded-proto"] || "http"}://${request.headers.host}`;

  let eventId = String(request.query?.id || "");
  const guestCode = String(request.query?.g || "");
  // הקישור הכללי הקצר (/i/<code>): אותה אריזה, אבל של ה-UUID של האירוע
  // עצמו — מפענחים ישירות, בלי RPC. UUID_RE בהמשך בודק את התוצאה.
  const eventCode = String(request.query?.e || "");
  if (!eventId && GUEST_CODE_RE.test(eventCode)) {
    try {
      eventId = decodeGuestCode(eventCode) || "";
    } catch {
      eventId = "";
    }
  }
  if (!eventId && GUEST_CODE_RE.test(guestCode)) {
    try {
      const guestId = decodeGuestCode(guestCode);
      // UUID_RE שוב: הערך נשלח הלאה ל-PostgREST, כמו id שמגיע מה-URL.
      if (guestId && UUID_RE.test(guestId)) {
        eventId = (await fetchGuestEventId(guestId)) || "";
      }
    } catch {
      eventId = ""; // קישור שלא פוענח מקבל את המעטפת בלי תצוגה מקדימה
    }
  }
  const canonical = `${origin}/invite/${eventId}`;

  let shell;
  try {
    shell = await loadShell();
  } catch {
    // בלי המעטפת אין מה להגיש: המשתמש חייב את תגיות ה-script עם ה-hash
    // של הבילד הנוכחי, ואי אפשר לנחש אותן.
    response.status(502).send("Unable to load application shell");
    return;
  }

  let event = null;
  if (UUID_RE.test(eventId)) {
    try {
      event = await fetchEvent(eventId);
    } catch {
      event = null; // אירוע שלא נטען לא שובר את העמוד — רק את התצוגה המקדימה
    }
  }

  // אירוע לא קיים: מגישים את המעטפת כמו שהיא. ה-SPA כבר מציג
  // "ההזמנה לא נמצאה :(" ואין טעם להמציא תצוגה מקדימה לאירוע שאינו קיים.
  if (!event) {
    response
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .setHeader("Cache-Control", "public, s-maxage=60")
      .status(200)
      .send(shell);
    return;
  }

  const eventName = (event.name || "").trim() || "אירוע";
  const dateText = formatHebrewDate(event.event_date);
  const locationText = (event.location || "").trim();

  // לוח הזמנים (design_config.schedule) — אותו ניקוי כמו ב-
  // src/lib/eventSchedule.js: רק שורות עם תווית ושעה HH:MM.
  const scheduleText = (
    Array.isArray(event.design_config?.schedule)
      ? event.design_config.schedule
      : []
  )
    .map((item) => ({
      label: String(item?.label ?? "").trim(),
      time: String(item?.time ?? "").trim(),
    }))
    .filter((item) => item.label && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))
    .slice(0, 4)
    .map((item) => `${item.label} ${item.time}`)
    .join(" · ");

  const description =
    [dateText, scheduleText, locationText].filter(Boolean).join(" | ") +
    (dateText || scheduleText || locationText
      ? ". לחצו לפרטים ואישור הגעה!"
      : "לחצו לפרטים ואישור הגעה!");

  // כותרת מזמינה במקום שם האירוע היבש. אפשר לדרוס פר-אירוע דרך
  // design_config.og_title (למשל "בואו לאשר הגעה לחתונה של נתיב ואוראל").
  const customTitle = String(event.design_config?.og_title || "").trim();
  const title = customTitle || `בואו לאשר הגעה ל${eventName}`;

  // התמונה המקורית לרוב כבדה מדי לוואטסאפ; api/og-image מגיש גרסה של
  // 1200x630. v משתנה כשהתמונה מוחלפת, כדי לעקוף את המטמון.
  const inviteImage = event.design_config?.invite_image;
  const image = inviteImage
    ? `${origin}/api/og-image?id=${eventId}&v=${createHash("sha1").update(String(inviteImage)).digest("hex").slice(0, 10)}`
    : null;

  const injected = buildTags({
    title,
    description,
    image,
    fallbackImage: `${origin}/icon-512.png`,
    url: canonical,
  });

  const html = shell
    // <title> הקיים הוא "Eventick" — מחליפים אותו בשם האירוע כדי שהכרטיסייה
    // וגם קוראים שנופלים חזרה ל-title יראו את השם הנכון.
    .replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeHtml(eventName)}</title>`,
    )
    .replace("</head>", `  ${injected}\n  </head>`);

  response
    .setHeader("Content-Type", "text/html; charset=utf-8")
    // התצוגה המקדימה נשמרת ב-CDN כדי שלא כל שיתוף בוואטסאפ יפנה ל-Supabase.
    // stale-while-revalidate מגיש מיד גם כשהמטמון התיישן.
    .setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=86400",
    )
    .status(200)
    .send(html);
}
