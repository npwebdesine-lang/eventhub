// לוח הזמנים של האירוע (קבלת פנים, חופה...). נשמר ב-design_config.schedule
// כמערך של { label, time } — אין לו עמודה, כמו og_title. הקורא מנקה את
// הנתונים: שורה בלי תווית או בלי שעה תקינה (HH:MM) פשוט לא מוצגת.
//
// דוגמה: [{ "label": "קבלת פנים", "time": "19:15" }, { "label": "חופה", "time": "20:15" }]

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_ITEMS = 4;

export const getEventSchedule = (designConfig) => {
  const raw = designConfig?.schedule;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      label: String(item?.label ?? "").trim(),
      time: String(item?.time ?? "").trim(),
    }))
    .filter((item) => item.label && TIME_PATTERN.test(item.time))
    .slice(0, MAX_ITEMS);
};
