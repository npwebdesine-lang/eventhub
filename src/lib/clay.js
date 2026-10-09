/**
 * מתכוני ה-Clay המשותפים לכל המסכים. עד עכשיו כל קובץ החזיק עותק משלו של
 * הקבועים האלה, והעותקים נסחפו (רדיוס 2rem / 2.25rem / 2.5rem, גווני באר
 * שונים). הערכים עצמם מוגדרים כטוקנים ב-index.css — כאן רק מרכיבים מהם
 * מחלקות ו-style מוכנים.
 */
import {
  DEFAULT_PRIMARY,
  LIGHT_TEXT,
  buttonPalette,
  darken,
  lighten,
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
