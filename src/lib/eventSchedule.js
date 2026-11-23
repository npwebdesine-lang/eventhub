// לוח הזמנים של האירוע (קבלת פנים, חופה...). נשמר ב-design_config.schedule
// כמערך של { label, time } — אין לו עמודה, כמו og_title. הקורא מנקה את
// הנתונים: שורה בלי תווית או בלי שעה תקינה (HH:MM) פשוט לא מוצגת.
//
// דוגמה: [{ "label": "קבלת פנים", "time": "19:15" }, { "label": "חופה", "time": "20:15" }]

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_ITEMS = 4;

// השלבים שיש להם שדה בהגדרות האירוע בדשבורד.
export const SCHEDULE_FIELDS = [{ label: "קבלת פנים" }, { label: "חופה" }];

// השעה ("HH:MM") של שלב לפי תווית, או "" כשאין.
export const getScheduleTime = (schedule, label) =>
  (Array.isArray(schedule) ? schedule : []).find(
    (item) => item?.label === label,
  )?.time || "";

// מחזיר מערך חדש: שעה ריקה מסירה את השלב, אחרת מעדכנת או מוסיפה אותו.
// שלבים אחרים (שהוזנו ידנית ב-DB) נשמרים. המיון לפי שעה, כי הספירה לאחור
// מכוונת לשלב הראשון ברשימה.
export const setScheduleTime = (schedule, label, time) => {
  const others = (Array.isArray(schedule) ? schedule : []).filter(
    (item) => item?.label !== label,
  );
  const next = time ? [...others, { label, time }] : others;
  return next.sort((a, b) =>
    String(a?.time ?? "").localeCompare(String(b?.time ?? "")),
  );
};

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
