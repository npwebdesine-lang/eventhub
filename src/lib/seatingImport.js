// ייבוא הושבה מקובץ Excel / CSV / Google Sheets.
// קריאת הגיליון וזיהוי הקידוד יושבים ב-spreadsheet.js, המשותף עם ייבוא המוזמנים.

import { findColumn, readSheetMatrix } from "./spreadsheet.js";

// כותרות מזוהות. ההשוואה מתבצעת אחרי נרמול (lowercase, בלי רווחים/גרשיים),
// ולכן "מס' שולחן" ו-"מספר השולחן" נתפסים גם הם.
const NAME_HEADERS = [
  "שם",
  "שםמלא",
  "שםהאורח",
  "שםאורח",
  "אורח",
  "מוזמן",
  "name",
  "fullname",
  "guest",
  "guestname",
];

const TABLE_HEADERS = [
  "שולחן",
  "מספרשולחן",
  "מסשולחן",
  "מספרהשולחן",
  "שולחןמספר",
  "table",
  "tablenumber",
  "tableno",
  "seat",
  "seating",
];

/**
 * מפענח קובץ הושבה ומחזיר שורות מוכנות לתצוגה מקדימה.
 * לעולם לא זורק על תוכן פגום — שורה בעייתית מסומנת ב-issues ומוצגת למשתמש.
 */
export async function parseSeatingFile(file) {
  const { matrix, sheetName } = await readSheetMatrix(file);

  const headerRow = matrix[0] || [];
  let nameIndex = findColumn(headerRow, NAME_HEADERS);
  let tableIndex = findColumn(headerRow, TABLE_HEADERS);
  const headerDetected = nameIndex !== -1 && tableIndex !== -1;

  // בלי כותרות מזוהות: עמודה ראשונה = שם, שנייה = שולחן, וכל השורות הן נתונים.
  if (!headerDetected) {
    nameIndex = 0;
    tableIndex = 1;
  }

  const dataRows = headerDetected ? matrix.slice(1) : matrix;

  return {
    sheetName,
    headerDetected,
    rows: dataRows
      .map((row, index) => {
        const name = String(row?.[nameIndex] ?? "").trim();
        const tableNumber = String(row?.[tableIndex] ?? "").trim();
        const issues = [];
        if (!name) issues.push("missing_name");
        else if (name.length > 100) issues.push("name_too_long");
        if (!tableNumber) issues.push("missing_table");
        return {
          rowNumber: index + (headerDetected ? 2 : 1),
          name,
          tableNumber,
          issues,
        };
      })
      // שורה ריקה לגמרי היא רק רווח בגיליון, לא שגיאה שכדאי להציג.
      .filter((row) => row.name || row.tableNumber),
  };
}

export const isValidSeatingRow = (row) => row.issues.length === 0;
