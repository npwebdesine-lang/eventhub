import { useEffect } from "react";
import { eventBackdrop } from "./clay";

// המשתנים שמהם נבנה רקע הדף: bg-clay-gradient, bg-clay-page וגם body
// (index.css) קוראים אותם, ולכן הגדרה אחת על <html> צובעת את כל הדף —
// כולל אזור הגלילה-מעבר (overscroll) — בלי לגעת בכל return בכל עמוד.
const PAGE_VAR = "--color-clay-page";
const PAGE_END_VAR = "--color-clay-page-end";

/**
 * צובע את רקע הדף לפי "צבע הרקע" של האירוע כל עוד העמוד מוצג, ומחזיר את
 * ברירת המחדל של החימר ביציאה (כך שמסך הניהול, למשל, לא נצבע).
 * ערך חסר או לא תקין משאיר את ברירת המחדל.
 */
export const useEventBackdrop = (background) => {
  useEffect(() => {
    const backdrop = eventBackdrop(background);
    if (!backdrop) return undefined;

    const root = document.documentElement;
    root.style.setProperty(PAGE_VAR, backdrop.page);
    root.style.setProperty(PAGE_END_VAR, backdrop.pageEnd);

    // שורת הסטטוס באנדרואיד / סרגל הדפדפן — באותו גוון כמו הדף.
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const previousTheme = themeMeta?.getAttribute("content");
    themeMeta?.setAttribute("content", backdrop.page);

    return () => {
      root.style.removeProperty(PAGE_VAR);
      root.style.removeProperty(PAGE_END_VAR);
      if (themeMeta && previousTheme) {
        themeMeta.setAttribute("content", previousTheme);
      }
    };
  }, [background]);
};
