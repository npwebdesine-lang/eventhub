// העדפות תזונה — מקור אמת יחיד לצד הלקוח.
// הערכים חייבים להישאר זהים ל-check constraint על public.event_guests
// ולוולידציה בתוך public.rsvp_respond / rsvp_self_register /
// rsvp_add_companion. שינוי כאן בלי מיגרציה תואמת יגרום ל-23514 (check
// violation) או ל-invalid_dietary מה-RPC.

// ילד מתחת לגיל 5: מגיע, אבל לא מנה בתשלום. נרשם כאורח בשמו עם ההעדפה הזו,
// וטריגר ב-DB (event_guests_sync_under_5) קובע לשורה guests_count = 0
// ו-under_5_count = 1 — כך שסכום המנות לאולם לא כולל אותו, והוא נספר בסכום
// "תינוקות (ללא מנה)".
export const UNDER_5_DIETARY = "under_5";

export const DIETARY_OPTIONS = [
  { value: "regular", label: "רגיל", emoji: "🥩" },
  { value: "vegetarian", label: "צמחוני", emoji: "🌱" },
  { value: "vegan", label: "טבעוני", emoji: "🥗" },
  { value: "gluten_free", label: "ללא גלוטן", emoji: "🌾" },
  // "מנת ילדים" ולא "ילדים": זו מנה בתשלום, וצריך להבדיל אותה בבירור
  // מהאפשרות שמתחתיה, שהיא בלי מנה.
  { value: "kids", label: "מנת ילדים", emoji: "🧸" },
  {
    value: UNDER_5_DIETARY,
    label: "ילדים מתחת לגיל 5 (ללא מנה)",
    emoji: "🍼",
  },
];

// האפשרויות למי שממלא את הטופס על עצמו — הוא בהכרח לא ילד מתחת לגיל 5.
// "מתחת לגיל 5" מוצעת רק לאורחים שנוספים בכפתור "הוסף אורח".
export const PRIMARY_DIETARY_OPTIONS = DIETARY_OPTIONS.filter(
  (option) => option.value !== UNDER_5_DIETARY,
);

export const DEFAULT_DIETARY = "regular";

export const DIETARY_VALUES = DIETARY_OPTIONS.map((option) => option.value);

export const DIETARY_LABEL = Object.fromEntries(
  DIETARY_OPTIONS.map((option) => [option.value, option.label]),
);

// שורות ישנות מלפני המיגרציה עלולות להגיע בלי הערך, ולכן נפילה לברירת המחדל.
export const dietaryLabelOf = (value) =>
  DIETARY_LABEL[value] || DIETARY_LABEL[DEFAULT_DIETARY];
