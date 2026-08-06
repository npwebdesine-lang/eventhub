// העדפות תזונה — מקור אמת יחיד לצד הלקוח.
// הערכים חייבים להישאר זהים ל-check constraint על public.event_guests
// ולוולידציה בתוך public.rsvp_respond. שינוי כאן בלי מיגרציה תואמת
// יגרום ל-23514 (check violation) או ל-invalid_dietary מה-RPC.

export const DIETARY_OPTIONS = [
  { value: "regular", label: "רגיל", emoji: "🥩" },
  { value: "vegetarian", label: "צמחוני", emoji: "🌱" },
  { value: "vegan", label: "טבעוני", emoji: "🥗" },
  { value: "gluten_free", label: "ללא גלוטן", emoji: "🌾" },
  { value: "kids", label: "ילדים", emoji: "🧸" },
];

export const DEFAULT_DIETARY = "regular";

export const DIETARY_VALUES = DIETARY_OPTIONS.map((option) => option.value);

export const DIETARY_LABEL = Object.fromEntries(
  DIETARY_OPTIONS.map((option) => [option.value, option.label]),
);

// שורות ישנות מלפני המיגרציה עלולות להגיע בלי הערך, ולכן נפילה לברירת המחדל.
export const dietaryLabelOf = (value) =>
  DIETARY_LABEL[value] || DIETARY_LABEL[DEFAULT_DIETARY];
