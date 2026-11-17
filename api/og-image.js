// תמונת תצוגה מקדימה (og:image) מותאמת לוואטסאפ.
//
// הבעיה: תמונות ההזמנה שמשתמשים מעלים הן לרוב צילומים של מגה-בייט ומעלה.
// וואטסאפ מוותר על תמונות כבדות (בערך מעל 300KB) ומציג קישור טקסט יבש.
// Image Transformations של Supabase לא זמינות בתוכנית הנוכחית, ולכן החיתוך
// נעשה כאן: 1200x630 (יחס 1.91:1 של Open Graph), JPEG דחוס, ונשמר ב-CDN.
//
// הפונקציה מקבלת רק id של אירוע — לא URL של תמונה. כך אי אפשר להשתמש בה
// כפרוקסי לכתובות שרירותיות (SSRF): היא מושכת רק את invite_image של האירוע,
// ורק אם הוא יושב ב-Storage של הפרויקט שלנו.

import sharp from "sharp";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

async function fetchInviteImageUrl(eventId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}&select=design_config&limit=1`,
    {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      signal: AbortSignal.timeout(2500),
    },
  );
  if (!response.ok) return null;
  const rows = await response.json();
  const url = rows?.[0]?.design_config?.invite_image;
  if (typeof url !== "string") return null;
  // רק קבצים מה-Storage הציבורי של הפרויקט שלנו.
  const allowedPrefix = `${SUPABASE_URL}/storage/v1/object/public/`;
  return url.startsWith(allowedPrefix) ? url : null;
}

export default async function handler(request, response) {
  const eventId = String(request.query?.id || "");
  if (!UUID_RE.test(eventId) || !SUPABASE_URL || !SUPABASE_KEY) {
    response.status(404).end();
    return;
  }

  let sourceUrl = null;
  try {
    sourceUrl = await fetchInviteImageUrl(eventId);
  } catch {
    sourceUrl = null;
  }
  if (!sourceUrl) {
    response.redirect(302, "/icon-512.png");
    return;
  }

  try {
    const source = await fetch(sourceUrl, { signal: AbortSignal.timeout(5000) });
    if (!source.ok) throw new Error("source_unavailable");
    const input = Buffer.from(await source.arrayBuffer());

    // תמונות זוג הן כמעט תמיד לאורך (2:3), וחיתוך ל-1.91:1 חותך פנים. לכן
    // התמונה המלאה מוצגת במרכז, מעל גרסה מטושטשת ומוגדלת שלה שממלאת את
    // המסגרת — עובד לכל יחס בלי לאבד אף אחד מהתמונה.
    const options = { limitInputPixels: 60_000_000 };
    // rotate() מכבד EXIF — צילומי טלפון אחרת יוצאים על הצד.
    const background = await sharp(input, options)
      .rotate()
      .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover" })
      .blur(28)
      .modulate({ brightness: 0.8 })
      .toBuffer();
    const foreground = await sharp(input, options)
      .rotate()
      .resize(OG_WIDTH, OG_HEIGHT, { fit: "inside" })
      .toBuffer();

    const output = await sharp(background)
      .composite([{ input: foreground, gravity: "centre" }])
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    response
      .setHeader("Content-Type", "image/jpeg")
      .setHeader("Content-Length", String(output.length))
      // שם הקובץ ב-Storage כולל חותמת זמן, וכתובת התמונה בעמוד כוללת אותה
      // כפרמטר v — החלפת תמונה מייצרת כתובת חדשה, אז מותר לשמור לאורך זמן.
      .setHeader(
        "Cache-Control",
        "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
      )
      .status(200)
      .send(output);
  } catch {
    // עדיף התמונה המקורית (אולי כבדה) מאשר כלום.
    response.redirect(302, sourceUrl);
  }
}
