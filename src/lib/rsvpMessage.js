import { getScheduleTime } from "./eventSchedule";
import { buildRsvpLink } from "./rsvpLink";

// הודעת "קישור הקסם" לוואטסאפ — אחת לכל אורח, או אחת לחבורה (אז guest הוא
// החבר הראשון, וה-RPC rsvp_guest_group טוען דרכו את כל מי שחולק את הטלפון).
//
// הקישור הוא קישור "צפייה ועדכון" בלי סטטוס: הוא פותח את ההזמנה האישית,
// ושם האורח מאשר/מבטל, משנה כמות ובוחר מנה. קישור עם ?s=1 היה מאשר הגעה
// כבר בלחיצה, וזה לא מה שההודעה מבטיחה.
//
// ההודעה נבנית כמערך שורות שמחובר ב-"\n" ולא כמחרוזת אחת עם שבירות בקוד:
// כך אין רווחים נגררים, ופורמט אוטומטי לא יכול לשנות את הטקסט. שורה ריקה =
// "". מי שבונה קישור וואטסאפ חייב לעטוף ב-encodeURIComponent (ה-"\n" הופך
// ל-%0A). כוכביות = הדגשה בוואטסאפ.

// event_date נשמר כ-"YYYY-MM-DD". new Date("2026-12-24") הוא חצות UTC, ובאזור
// זמן שלילי זה היה יוצא יום קודם — לכן התאריך נבנה מקומית מהרכיבים.
export const formatEventDate = (eventDate) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(eventDate || ""));
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

// event: { name, event_date, location, design_config } — מה שיש בטופס האירוע.
// כל שורת פרט (תאריך, מקום, קבלת פנים, חופה) נשמטת כשאין לה ערך, בלי להשאיר
// שורה ריקה או "**" יתום.
export const buildRsvpMessage = (guest, event, origin) => {
  const name = String(guest?.guest_name ?? "").trim();
  const title = String(event?.name ?? "").trim();
  const date = formatEventDate(event?.event_date);
  const location = String(event?.location ?? "").trim();
  const schedule = event?.design_config?.schedule;
  const reception = getScheduleTime(schedule, "קבלת פנים");
  const chuppah = getScheduleTime(schedule, "חופה");

  const details = [
    date && `📅 *${date}*`,
    location && `📍 *${location}*`,
    reception && `🥂 קבלת פנים: *${reception}*`,
    chuppah && `✨ חופה וקידושין: *${chuppah}*`,
  ].filter(Boolean);

  return [
    name ? `היי ${name}! 💍✨` : "היי! 💍✨",
    title
      ? `${title} מתקרבת בצעדי ענק ואנחנו מתרגשים לחגוג איתכם!`
      : "האירוע מתקרב בצעדי ענק ואנחנו מתרגשים לחגוג איתכם!",
    ...(details.length ? ["", ...details] : []),
    "",
    "זו ההזדמנות לוודא שהכל מעודכן אצלנו (אישור הגעה, כמות אורחים או העדפת מנה) — וגם להיכנס להזמנה האישית שלכם:",
    "",
    "💌 *לצפייה בהזמנה האישית ועדכון פרטים לחצו כאן:*",
    buildRsvpLink(origin, guest.id),
    "",
    "מחכים לראותכם ברחבה! 🥂💃🕺",
  ].join("\n");
};
