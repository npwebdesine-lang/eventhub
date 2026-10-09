// גישה בטוחה ל-localStorage. בדפדפן שחוסם נתוני אתר (Safari/Chrome עם חסימת
// עוגיות, חלק מהדפדפנים בתוך אפליקציות) כל קריאה ל-localStorage זורקת
// SecurityError — וקריאה כזו בזמן רינדור הפילה את כל הדף אל ה-ErrorBoundary.
//
// כשהאחסון חסום הערכים נשמרים בזיכרון לאורך הסשן בלבד: האורח יכול להירשם
// ולהשתמש באפליקציה, הנתונים פשוט לא שורדים רענון — המקסימום שדפדפן כזה מאפשר.
const memoryFallback = new Map();

export const safeGetItem = (key) => {
  try {
    const value = localStorage.getItem(key);
    return value ?? memoryFallback.get(key) ?? null;
  } catch {
    return memoryFallback.get(key) ?? null;
  }
};

export const safeSetItem = (key, value) => {
  const stringValue = String(value);
  memoryFallback.set(key, stringValue);
  try {
    localStorage.setItem(key, stringValue);
  } catch {
    // האחסון חסום או מלא — הערך נשאר בזיכרון לסשן הנוכחי.
  }
};

export const safeRemoveItem = (key) => {
  memoryFallback.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // אין מה לנקות באחסון חסום.
  }
};

// JSON פגום (עריכה ידנית, גרסה ישנה) מחזיר את ערך ברירת המחדל במקום לזרוק.
export const safeGetJSON = (key, fallback) => {
  const raw = safeGetItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};
