/**
 * מתכוני ה-Clay המשותפים לכל המסכים. עד עכשיו כל קובץ החזיק עותק משלו של
 * הקבועים האלה, והעותקים נסחפו (רדיוס 2rem / 2.25rem / 2.5rem, גווני באר
 * שונים). הערכים עצמם מוגדרים כטוקנים ב-index.css — כאן רק מרכיבים מהם
 * מחלקות ו-style מוכנים.
 */
import {
  CLAY_PAGE_END_HEX,
  CLAY_PAGE_HEX,
  DEFAULT_PRIMARY,
  LIGHT_TEXT,
  buttonPalette,
  darken,
  isParsableColor,
  lighten,
  mix,
  relativeLuminance,
} from "./colors";

export { DEFAULT_PRIMARY };

/** משטח בולט — כרטיס או כפתור משני */
export const CLAY_RAISED = "bg-clay-surface shadow-clay";
/** משטח שקוע — באר, מסילה, אזור תוכן משני */
export const CLAY_INSET = "bg-clay-well shadow-clay-inset";
/** כרטיס סטנדרטי */
export const CLAY_CARD = `rounded-clay ${CLAY_RAISED}`;
/** שדה קלט / select / textarea שקוע במשטח */
export const CLAY_FIELD =
  "w-full p-4 rounded-clay-field outline-none font-bold text-slate-700 placeholder:text-clay-muted bg-clay-well shadow-clay-inset focus:shadow-clay-inset-deep transition-all";
/** כפתור משני בולט (עגול), עם מצב לחוץ */
export const CLAY_BUTTON =
  "bg-clay-surface shadow-clay-md active:shadow-clay-pressed transition-all";
/** כפתור כהה ("דיו") — לפעולה ראשית שלא תלויה בצבע האירוע */
export const CLAY_INK_BUTTON =
  "bg-clay-ink hover:bg-clay-ink-hover text-white shadow-clay-btn transition-all";

/**
 * style לכפתור בצבע האירוע. הרקע והטקסט מגיעים מ-buttonPalette, שמבטיח
 * 4.5:1 — המנהל יכול לבחור כל צבע, גם כזה שטקסט לבן לא נקרא עליו.
 * ה-color כאן גובר על text-white שעל האלמנט, ולכן אין צורך לשנות אותו.
 */
export const clayButtonStyle = (color) => {
  const { background, text } = buttonPalette(color);
  return {
    backgroundColor: background,
    color: text,
    boxShadow: "var(--shadow-clay-btn)",
  };
};

/**
 * רקע מעבר בצבע האירוע לכרטיסי גיבור (כותרת, ספירה לאחור). המעבר הישן
 * הסתיים ב-`${color}cc` — שקיפות 80% מעל רקע בהיר, שהבהירה את הקצה והורידה
 * את הניגודיות של טקסט לבן. עכשיו שני הקצוות אטומים, והקצה השני זז *הרחק*
 * מצבע הטקסט: כהה יותר תחת טקסט לבן, בהיר יותר תחת טקסט כהה — כך הניגודיות
 * לא יורדת לאורך המעבר. הצבע עצמו עובר דרך buttonPalette כמו כפתור.
 */
export const clayHeroStyle = (color) => {
  const { background, text } = buttonPalette(color);
  const lightText = text === LIGHT_TEXT;
  const end = lightText ? darken(background, 0.08) : lighten(background, 0.08);
  return {
    background: `linear-gradient(145deg, ${background}, ${end})`,
    color: text,
    // רקע לתגיות ולכפתורים בתוך כרטיס הגיבור (bg-[var(--hero-chip)]).
    // הגוון זז *הרחק* מצבע הטקסט (כהה תחת טקסט לבן, בהיר תחת טקסט כהה), כך
    // שהניגודיות בתוך התגית רק עולה. לא bg-current/10: בדפדפן בלי
    // color-mix() הגיבוי של Tailwind הוא currentColor אטום, והטקסט נבלע.
    "--hero-chip": lightText ? "rgb(0 0 0 / 0.12)" : "rgb(255 255 255 / 0.3)",
    "--hero-chip-strong": lightText
      ? "rgb(0 0 0 / 0.2)"
      : "rgb(255 255 255 / 0.45)",
  };
};

const backdropCache = new Map();
// בהירות סוף המעבר המקורי — כל בדיקות הניגודיות (clay-muted, accentOn)
// נמדדו מולו, ולכן רקע האירוע אסור שיהיה כהה ממנו.
const MIN_PAGE_END_LUMINANCE = relativeLuminance(CLAY_PAGE_END_HEX);
// עומק המעבר: סוף הדף כהה מתחילתו ב-4%. ב-6% אפילו גוון החימר עצמו היה
// נכשל בבדיקה (0.713 מול 0.724) וכל צבע נפל לברירת המחדל.
const PAGE_END_DEPTH = 0.04;

/**
 * רקע הדף לפי "צבע הרקע" שהמנהל בחר. מערבבים את גוון החימר עם הצבע שנבחר
 * בעוצמה הגבוהה ביותר שעדיין לא מכהה את הדף מתחת למשטח החימר הכהה ביותר —
 * כך פסטלים מופיעים כמעט במלואם, וצבע כהה (למשל #020617, ברירת המחדל
 * הישנה) הופך לגוון עדין במקום לדף כהה שהטקסט עליו לא נקרא.
 * מחזיר null כשאין צבע תקין — ואז נשארים עם ברירת המחדל של החימר.
 */
export const eventBackdrop = (background) => {
  if (!isParsableColor(background)) return null;
  if (backdropCache.has(background)) return backdropCache.get(background);

  const fits = (page) => {
    const pageEnd = darken(page, PAGE_END_DEPTH);
    return relativeLuminance(pageEnd) >= MIN_PAGE_END_LUMINANCE
      ? { page, pageEnd }
      : null;
  };

  let result = null;
  // 1. צבע בהיר: ערבוב עם גוון החימר, מהמלא (100%) ועד חצי — שומר על
  //    החמימות של החימר.
  for (let step = 20; step >= 10 && !result; step -= 1) {
    result = fits(mix(CLAY_PAGE_HEX, background, step / 20));
  }
  // 2. צבע כהה (קרמל #c87740, כחול-לילה #020617): ערבוב עם החימר רק היה
  //    מכהה את הדף, ולכן כמעט כלום לא עובר. במקום זה מבהירים את הצבע עצמו
  //    עד שהוא עובר — הגוון נשמר והמנהל רואה את הבחירה שלו.
  for (let step = 10; step <= 19 && !result; step += 1) {
    result = fits(lighten(background, step / 20));
  }
  backdropCache.set(background, result);
  return result;
};
