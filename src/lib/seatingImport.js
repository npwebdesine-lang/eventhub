// ייבוא הושבה מקובץ Excel / CSV / Google Sheets.
//
// SheetJS נטען דינמית (import ב-runtime) ולא נכנס ל-chunk של Admin: זו ספרייה
// כבדה שנחוצה רק כשמישהו באמת גורר קובץ.
//
// הגרסה מותקנת מהרג'יסטרי של SheetJS ולא מ-npm: הגרסה האחרונה ב-npm היא
// 0.18.5 ובה CVE-2023-30533 (prototype pollution) ו-CVE-2024-22363 (ReDoS).

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

const normalizeHeader = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\s'"״׳._-]/g, "")
    .trim();

// אקסל בעברית נשמר לא פעם ב-windows-1255. TextDecoder עם fatal זורק על בתים
// לא חוקיים ב-UTF-8, ואז נופלים ל-1255 — בלי זה הכותרות חוזרות כג'יבריש
// והזיהוי האוטומטי נכשל בשקט.
const decodeCsv = (arrayBuffer) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arrayBuffer);
  } catch {
    try {
      return new TextDecoder("windows-1255").decode(arrayBuffer);
    } catch {
      return new TextDecoder("utf-8").decode(arrayBuffer);
    }
  }
};

const findColumn = (headerRow, candidates) =>
  headerRow.findIndex((cell) => candidates.includes(normalizeHeader(cell)));

/**
 * מפענח קובץ הושבה ומחזיר שורות מוכנות לתצוגה מקדימה.
 * לעולם לא זורק על תוכן פגום — שורה בעייתית מסומנת ב-issues ומוצגת למשתמש.
 */
export async function parseSeatingFile(file) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name);

  const workbook = isCsv
    ? XLSX.read(decodeCsv(buffer), { type: "string" })
    : XLSX.read(buffer, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("empty_workbook");

  // header:1 => מערך של מערכים, כדי שנוכל לזהות את הכותרות בעצמנו במקום
  // לסמוך על השורה הראשונה כמפתחות.
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false, // מספרי שולחן חוזרים כטקסט — table_number הוא text בסכימה
  });

  if (matrix.length === 0) throw new Error("empty_sheet");

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
