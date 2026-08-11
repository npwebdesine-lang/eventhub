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

// שתי דרכים להשיג את המעטפת, לפי הסדר:
//   1. מהדיסק — dist/index.html נארז עם הפונקציה דרך functions.includeFiles.
//   2. מהרשת — אם האריזה לא כללה אותו. /index.html הוא קובץ סטטי אמיתי,
//      ו-Vercel בודק את מערכת הקבצים לפני ה-rewrites, ולכן אין כאן לולאה.
async function loadShell(origin) {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return await readFile(join(process.cwd(), "dist", "index.html"), "utf8");
  } catch {
    const response = await fetch(`${origin}/index.html`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error("shell_unavailable");
    return await response.text();
  }
}

const buildTags = ({ title, description, image, url }) => {
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
      `<meta property="og:image:alt" content="${escapeHtml(title)}" />`,
      `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    );
  }
  return tags.join("\n    ");
};

export default async function handler(request, response) {
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const proto = request.headers["x-forwarded-proto"] || "https";
  const origin = `${proto}://${host}`;

  const eventId = String(request.query?.id || "");
  const canonical = `${origin}/invite/${eventId}`;

  let shell;
  try {
    shell = await loadShell(origin);
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

  const description =
    [dateText, locationText].filter(Boolean).join(" | ") +
    (dateText || locationText
      ? ". לחצו לפרטים ואישור הגעה!"
      : "לחצו לפרטים ואישור הגעה!");

  const image = event.design_config?.invite_image || `${origin}/icon-512.png`;

  const injected = buildTags({
    title: eventName,
    description,
    image,
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
