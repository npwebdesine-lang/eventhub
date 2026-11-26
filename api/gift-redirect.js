// QR יחיד למתנה: /g/<provider>/<event code> → 302 לקישור ה-bit / PayBox.
//
// כל סריקה מקבלת את הקישור הבא בתור (חתן, כלה, חתן...) מה-RPC
// resolve_gift_redirect, שמקדם מונה אטומי. הקישורים עצמם נשמרים ב-
// design_config, כך שבעלי האירוע יכולים להחליף אותם בלי להדפיס QR חדש.
//
// הקוד הוא ה-UUID של האירוע ב-base64url — אותה אריזה כמו /i/<code> (ראו
// src/lib/rsvpLink.js ו-api/invite.js).
//
// בוטים של תצוגה מקדימה (וואטסאפ, טלגרם...) מקבלים דף OG קטן ולא מקדמים את
// המונה: אחרת כל שיתוף של הקישור בקבוצה "שורף" תור ומשבש את החלוקה.

import { Buffer } from "node:buffer";
import process from "node:process";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

const CODE_RE = /^[A-Za-z0-9_-]{22}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROVIDERS = {
  bit: {
    label: "bit",
    hosts: ["bitpay.co.il"],
  },
  paybox: {
    label: "PayBox",
    hosts: ["payboxapp.com", "payboxapp.page.link"],
  },
};

// בוטים שפותחים קישורים כדי לבנות תצוגה מקדימה, לא אנשים שסורקים.
const PREVIEW_BOT_RE =
  /whatsapp|telegrambot|facebookexternalhit|facebookcatalog|twitterbot|discordbot|slackbot|linkedinbot|skypeuripreview|applebot|googlebot|bingbot|embedly|pinterest|vkshare|redditbot|iframely/i;

const NO_STORE = "no-store, no-cache, must-revalidate, max-age=0";

const decodeCode = (code) => {
  const hex = Buffer.from(code, "base64url").toString("hex");
  if (hex.length !== 32) return null;
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return UUID_RE.test(uuid) ? uuid : null;
};

// בדיקה שנייה, בלתי תלויה ב-DB: לא מפנים לשום דבר שאינו https לדומיין של
// ספק התשלום. גם אם ה-RPC ישתנה בעתיד, /g/ לא יהפוך ל-open redirect.
const isAllowedTarget = (value, provider) => {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return PROVIDERS[provider].hosts.some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
};

async function resolveTarget(eventId, provider) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/resolve_gift_redirect`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_event_id: eventId, p_provider: provider }),
      signal: AbortSignal.timeout(3000),
    },
  );
  if (!response.ok) return null;
  const target = await response.json();
  return typeof target === "string" ? target : null;
}

const previewHtml = (label) => {
  const title = `מתנה לזוג ב-${label} 🎁`;
  const description = `סורקים ושולחים מתנה ב-${label}.`;
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="robots" content="noindex" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Eventick" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta name="description" content="${description}" />
</head>
<body><p>${description}</p></body>
</html>`;
};

export default async function handler(request, response) {
  const provider = String(request.query?.p || "").toLowerCase();
  const code = String(request.query?.e || "");
  const config = PROVIDERS[provider];
  const eventId = CODE_RE.test(code) ? decodeCode(code) : null;

  // קישור שבור: לדף הבית, לא לשום מקום חיצוני.
  if (!config || !eventId) {
    response.setHeader("Cache-Control", NO_STORE);
    response.redirect(302, "/");
    return;
  }

  const userAgent = String(request.headers["user-agent"] || "");
  // HEAD (בדיקות קישור, prefetch) ובוטי תצוגה מקדימה לא נחשבים סריקה.
  if (request.method === "HEAD" || PREVIEW_BOT_RE.test(userAgent)) {
    response
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .setHeader("Cache-Control", NO_STORE)
      .setHeader("X-Robots-Tag", "noindex")
      .status(200)
      .send(previewHtml(config.label));
    return;
  }

  let target = null;
  try {
    target = await resolveTarget(eventId, provider);
  } catch {
    target = null;
  }

  response.setHeader("Cache-Control", NO_STORE);
  response.setHeader("X-Robots-Tag", "noindex");
  // אין קישור מוגדר (או תקלה): להזמנה של האירוע, שם יש את פרטי המתנה.
  response.redirect(
    302,
    target && isAllowedTarget(target, provider) ? target : `/i/${code}`,
  );
}
