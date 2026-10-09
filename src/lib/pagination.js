// עימוד לפי מצביע (keyset) עבור פידים שממוינים מהחדש לישן.
//
// offset לא מתאים לפיד חי: כל תמונה שנוספת בזמן הגלילה מזיזה את כל השורות
// מקום אחד, והעמוד הבא מחזיר שוב שורות שכבר מוצגות (ו-React מקבל keys כפולים).
// במקום "דלג על N" מבקשים "ישנות מהשורה האחרונה שראיתי". id שובר שוויון בין
// שורות עם אותו created_at, ולכן גם הוא חייב להיות במיון.
//
// השאילתה חייבת להיות ממוינת created_at desc ואז id desc.

export const orderNewestFirst = (query) =>
  query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

// cursor הוא השורה האחרונה של העמוד הקודם ({ created_at, id }), או null
// לעמוד הראשון. הגרשיים נחוצים כי בחותמת זמן יש ':' ו-'.', שהם תווים שמורים
// בתחביר or() של PostgREST.
export const olderThan = (query, cursor) =>
  cursor
    ? query.or(
        `created_at.lt."${cursor.created_at}",and(created_at.eq."${cursor.created_at}",id.lt.${cursor.id})`,
      )
    : query;

// הוספה לסוף בלי כפילויות — הגנה נוספת למקרה ששורה הגיעה גם ב-Realtime.
export const appendUnique = (prev, rows) => {
  const seen = new Set(prev.map((row) => row.id));
  return [...prev, ...rows.filter((row) => !seen.has(row.id))];
};
