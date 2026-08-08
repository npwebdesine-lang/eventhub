// ייבוא רשימת מוזמנים מקובץ Excel / CSV / Google Sheets, עבור השליחה
// החצי-אוטומטית בוואטסאפ.

import { findColumn, readSheetMatrix } from "./spreadsheet.js";

const NAME_HEADERS = [
  "שם",
  "שםמלא",
  "שםהאורח",
  "שםאורח",
  "שםהמוזמן",
  "אורח",
  "מוזמן",
  "name",
  "fullname",
  "guest",
  "guestname",
];

const PHONE_HEADERS = [
  "טלפון",
  "נייד",
  "מספר",
  "מספרטלפון",
  "מספרנייד",
  "טלפוןנייד",
  "פלאפון",
  "סלולרי",
  "phone",
  "mobile",
  "cell",
  "phonenumber",
  "tel",
];

const COUNT_HEADERS = [
  "כמות",
  "מספראורחים",
  "כמותאורחים",
  "אורחים",
  "count",
  "guests",
  "guestscount",
  "quantity",
];

/**
 * מנרמל טלפון ישראלי לפורמט שוואטסאפ מצפה לו: ספרות בלבד עם קידומת 972.
 * מחזיר null אם לא נשאר מספר סביר — הקורא מסמן את השורה במקום להמציא ערך.
 *
 *   050-123-4567   -> 972501234567
 *   +972 50 1234567 -> 972501234567
 *   0501234567     -> 972501234567
 */
export const normalizeIsraeliPhone = (raw) => {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;

  // 00972... — קידומת חיוג בינלאומית בכתיב הישן
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("972")) {
    // 9720501234567 — קידומת בינלאומית שנשאר אחריה 0 מקומי
    const rest = digits.slice(3).replace(/^0+/, "");
    digits = `972${rest}`;
  } else if (digits.startsWith("0")) {
    digits = `972${digits.slice(1)}`;
  } else if (digits.length >= 8 && digits.length <= 10) {
    // מספר מקומי בלי 0 מוביל
    digits = `972${digits}`;
  }

  // 972 + 8..12 ספרות. חוסם גם מחרוזות ארוכות מדי שלא יעברו את ה-check
  // constraint על העמודה (7-15 תווים).
  if (!/^972\d{8,11}$/.test(digits)) return null;
  return digits;
};

/**
 * מפענח קובץ מוזמנים. לא זורק על תוכן פגום — שורה בעייתית מסומנת ב-issues.
 */
export async function parseGuestFile(file) {
  const { matrix, sheetName } = await readSheetMatrix(file);

  const headerRow = matrix[0] || [];
  let nameIndex = findColumn(headerRow, NAME_HEADERS);
  let phoneIndex = findColumn(headerRow, PHONE_HEADERS);
  const countIndex = findColumn(headerRow, COUNT_HEADERS);
  const headerDetected = nameIndex !== -1 && phoneIndex !== -1;

  // בלי כותרות מזוהות: עמודה ראשונה = שם, שנייה = טלפון, וכל השורות נתונים.
  if (!headerDetected) {
    nameIndex = 0;
    phoneIndex = 1;
  }

  const dataRows = headerDetected ? matrix.slice(1) : matrix;

  return {
    sheetName,
    headerDetected,
    rows: dataRows
      .map((row, index) => {
        const name = String(row?.[nameIndex] ?? "").trim();
        const rawPhone = String(row?.[phoneIndex] ?? "").trim();
        const phone = normalizeIsraeliPhone(rawPhone);

        // תא ריק פירושו "לא צוין" ולכן 1, לא 0: Number("") הוא 0 ועובר את
        // בדיקת התקינות, מה שהיה רושם את האורח עם אפס מקומות.
        let guestsCount = 1;
        if (countIndex !== -1) {
          const rawCount = String(row?.[countIndex] ?? "").trim();
          if (rawCount) {
            const parsed = Number(rawCount);
            if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 20) {
              guestsCount = parsed;
            }
          }
        }

        const issues = [];
        if (!name) issues.push("missing_name");
        else if (name.length > 100) issues.push("name_too_long");
        // טלפון חסר אינו פוסל: אפשר לשמור את האורח ולהעתיק לו את ההודעה ידנית.
        if (rawPhone && !phone) issues.push("invalid_phone");

        return {
          rowNumber: index + (headerDetected ? 2 : 1),
          name,
          rawPhone,
          phone,
          guestsCount,
          issues,
        };
      })
      .filter((row) => row.name || row.rawPhone),
  };
}

// שורה נשמרת אם יש לה שם ואין טלפון שגוי. טלפון ריק מותר.
export const isValidGuestRow = (row) => row.issues.length === 0;
