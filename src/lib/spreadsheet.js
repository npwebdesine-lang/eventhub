// תשתית משותפת לקריאת גיליונות (Excel / CSV / ייצוא מ-Google Sheets).
//
// משמשת גם את ייבוא ההושבה וגם את ייבוא רשימת המוזמנים. הלוגיקה המסובכת כאן
// היא זיהוי הקידוד — אין טעם לשכפל אותה פעמיים.
//
// SheetJS נטען דינמית ולכן לא נכנס ל-chunk של Admin: ספרייה של ~490KB שנחוצה
// רק כשמישהו באמת גורר קובץ. הגרסה מותקנת מהרג'יסטרי של SheetJS ולא מ-npm,
// שם הגרסה האחרונה היא 0.18.5 ובה CVE-2023-30533 ו-CVE-2024-22363.

/** נרמול כותרת להשוואה: בלי רישיות, רווחים, גרשיים או פיסוק. */
export const normalizeHeader = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[\s'"״׳._-]/g, "")
    .trim();

// אקסל בעברית נשמר לא פעם ב-windows-1255. TextDecoder עם fatal זורק על בתים
// לא חוקיים ב-UTF-8, ואז נופלים ל-1255 — בלי זה הכותרות חוזרות כג'יבריש
// והזיהוי האוטומטי נכשל בשקט.
export const decodeCsv = (arrayBuffer) => {
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

/** מחזיר את האינדקס של העמודה הראשונה שכותרתה מופיעה ברשימת המועמדים. */
export const findColumn = (headerRow, candidates) =>
  headerRow.findIndex((cell) => candidates.includes(normalizeHeader(cell)));

/**
 * קורא את הגיליון הראשון כמערך של מערכים.
 * raw:false — ערכים חוזרים כטקסט, כי גם מספר שולחן וגם טלפון נשמרים כטקסט
 * (וטלפון שמתחיל ב-0 היה מאבד את הספרה הראשונה כמספר).
 */
export async function readSheetMatrix(file) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name);

  const workbook = isCsv
    ? XLSX.read(decodeCsv(buffer), { type: "string" })
    : XLSX.read(buffer, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("empty_workbook");

  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  if (matrix.length === 0) throw new Error("empty_sheet");
  return { matrix, sheetName };
}
