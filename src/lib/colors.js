/**
 * חישובי ניגודיות לפי WCAG 2.x.
 *
 * צבע המותג נבחר על ידי מנהל האירוע, ולכן אסור להניח שטקסט לבן עליו קריא:
 * ברירת המחדל #8fa7b8 נותנת ללבן 2.5:1 בלבד (נדרש 4.5:1). הפונקציות כאן
 * בוחרות צבע טקסט לפי ניגודיות אמיתית, ומכהות צבע מבטא שמשמש כטקסט על משטח
 * החימר עד שהוא עובר את הסף.
 */

// ערכים קבועים כמחרוזות hex כי החישוב צריך ערכי RGB. הם תואמים לטוקנים
// ב-index.css (--color-clay-page, --color-clay-primary).
export const CLAY_PAGE_HEX = "#eceadf";
// הגוון הכהה ביותר של רקע הדף (סוף המעבר) — המקרה הגרוע לניגודיות.
export const CLAY_PAGE_END_HEX = "#e2ddd0";
export const DEFAULT_PRIMARY = "#8fa7b8";
export const DARK_TEXT = "#1e293b";
export const LIGHT_TEXT = "#ffffff";

const AA_TEXT = 4.5;

// "#abc" / "#aabbcc" / "aabbcc" / "rgb(1, 2, 3)" -> [r, g, b], או null לערך
// לא תקין — ואז הקוראים נופלים לברירת המחדל במקום לזרוק. rgb() נתמך כי שדה
// הצבע בניהול מציע אותו במפורש.
const parseHex = (hex) => {
  if (typeof hex !== "string") return null;
  const rgbMatch = hex
    .trim()
    .match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i);
  if (rgbMatch) {
    const channels = rgbMatch.slice(1, 4).map(Number);
    return channels.every((c) => c <= 255) ? channels : null;
  }
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
};

const toHex = (rgb) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Relative luminance (0–1) לפי WCAG. */
export const relativeLuminance = (hex) => {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** יחס ניגודיות WCAG בין שני צבעים (1–21). */
export const contrastRatio = (a, b) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * בהירות נתפסת (0–255). נשאר לתאימות לאחור בלבד — להחלטות על צבע טקסט
 * להשתמש ב-getTextColor, שמבוסס על ניגודיות אמיתית.
 */
export const getLuminance = (hex) => {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb;
  return (r * 299 + g * 587 + b * 114) / 1000;
};

/**
 * צבע טקסט קריא (כהה או לבן) על רקע נתון — זה שנותן את הניגודיות הגבוהה
 * יותר. לבן מועדף כשהוא עובר AA, כדי לשמור על המראה של כפתור צבעוני.
 */
export const getTextColor = (bgHex) => {
  const bg = normalizeColor(bgHex);
  if (contrastRatio(LIGHT_TEXT, bg) >= AA_TEXT) return LIGHT_TEXT;
  return contrastRatio(DARK_TEXT, bg) >= contrastRatio(LIGHT_TEXT, bg)
    ? DARK_TEXT
    : LIGHT_TEXT;
};

/** צבע תקין כ-hex, או צבע ברירת המחדל לערך שלא ניתן לפענח. */
export const normalizeColor = (color) =>
  toHex(parseHex(color) || parseHex(DEFAULT_PRIMARY));

/**
 * רקע וטקסט לכפתור בצבע האירוע. לבן כשהוא עובר AA, אחרת טקסט כהה כשהוא
 * עובר. לגווני ביניים (#3b82f6, #f43f5e) שאף אחד מהשניים לא עובר עליהם,
 * מכהים את הרקע בהדרגה עד שלבן עובר — הגוון נשמר, הכפתור קריא.
 */
export const buttonPalette = (color) => {
  const base = normalizeColor(color);
  if (contrastRatio(LIGHT_TEXT, base) >= AA_TEXT) {
    return { background: base, text: LIGHT_TEXT };
  }
  if (contrastRatio(DARK_TEXT, base) >= AA_TEXT) {
    return { background: base, text: DARK_TEXT };
  }
  let background = base;
  for (let step = 1; step <= 20; step += 1) {
    background = darken(base, step * 0.05);
    if (contrastRatio(LIGHT_TEXT, background) >= AA_TEXT) break;
  }
  return { background, text: LIGHT_TEXT };
};

/** מכהה צבע במקדם 0–1 (0.1 = כהה ב-10%). ערך לא תקין חוזר כברירת המחדל. */
export const darken = (hex, amount) => {
  const rgb = parseHex(hex) || parseHex(DEFAULT_PRIMARY);
  return toHex(rgb.map((c) => c * (1 - amount)));
};

/** ערבוב ליניארי בין שני צבעים: t=0 מחזיר את a, t=1 את b. */
export const mix = (a, b, t) => {
  const ca = parseHex(a) || parseHex(DEFAULT_PRIMARY);
  const cb = parseHex(b) || ca;
  return toHex(ca.map((c, i) => c + (cb[i] - c) * t));
};

/** האם הערך ניתן לפענוח כצבע (hex או rgb()). */
export const isParsableColor = (color) => parseHex(color) !== null;

/** מבהיר צבע במקדם 0–1 (ערבוב עם לבן). */
export const lighten = (hex, amount) => {
  const rgb = parseHex(hex) || parseHex(DEFAULT_PRIMARY);
  return toHex(rgb.map((c) => c + (255 - c) * amount));
};

const accentCache = new Map();

/**
 * צבע מבטא שמשמש כטקסט או אייקון על משטח החימר: אם הוא לא עובר 4.5:1
 * מול רקע הדף הכהה ביותר, מכהים אותו בהדרגה (ערבוב עם שחור) עד שהוא
 * עובר. הגוון נשמר, רק הבהירות יורדת — כך צבע המותג עדיין מזוהה.
 */
export const accentOn = (hex, bgHex = CLAY_PAGE_END_HEX) => {
  const key = `${hex}|${bgHex}`;
  if (accentCache.has(key)) return accentCache.get(key);

  const rgb = parseHex(hex) || parseHex(DEFAULT_PRIMARY);
  let result = toHex(rgb);
  for (let step = 0; step <= 20; step += 1) {
    const factor = 1 - step * 0.05;
    const candidate = toHex(rgb.map((c) => c * factor));
    result = candidate;
    if (contrastRatio(candidate, bgHex) >= AA_TEXT) break;
  }
  accentCache.set(key, result);
  return result;
};
