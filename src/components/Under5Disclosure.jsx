import React from "react";

// חשיפה הדרגתית של מונה "תינוקות עד גיל 5". רוב האורחים לא מגיעים עם
// תינוקות, ולכן כברירת מחדל מוצג רק כפתור טקסט עדין; המונה עצמו (children)
// נפתח בלחיצה, או מראש כשכבר נשמר ערך גדול מ-0.
//
// הפתיחה היא מעבר של grid-template-rows מ-0fr ל-1fr: הגובה מונפש בלי למדוד
// אותו ב-JS, והגיליון שמסביב גדל בצורה חלקה במקום לקפוץ. invisible על החלק
// הסגור מוציא אותו מסדר ה-Tab ומקוראי מסך.
const PANEL =
  "grid transition-all duration-300 ease-out motion-reduce:transition-none";
const SHOWN = "grid-rows-[1fr] opacity-100";
const HIDDEN = "grid-rows-[0fr] opacity-0 invisible";

export default function Under5Disclosure({ open, onOpen, disabled, children }) {
  return (
    <div>
      <div className={`${PANEL} ${open ? HIDDEN : SHOWN}`}>
        <div className="min-h-0 overflow-hidden text-center">
          <button
            type="button"
            onClick={onOpen}
            disabled={disabled}
            aria-expanded={open}
            className="mt-2 min-h-11 rounded-full px-4 text-sm font-bold text-clay-muted underline-offset-4 transition-colors hover:text-slate-600 hover:underline active:scale-[0.98] disabled:opacity-50"
          >
            + מגיעים עם תינוקות עד גיל 5?
          </button>
        </div>
      </div>
      <div className={`${PANEL} ${open ? SHOWN : HIDDEN}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="pt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
