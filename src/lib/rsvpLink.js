// קישורי קסם קצרים לוואטסאפ: /r/<code>?s=1 (אישור) | /r/<code>?s=0 (ביטול)
//
// הקישור הקודם היה /invite/<uuid>?guest_id=<uuid>&status=confirmed — שני
// מזהים של 36 תווים ופרמטרים מילוליים. מזהה האירוע מיותר (הוא נגזר מהאורח),
// ואת מזהה האורח אפשר לארוז: UUID הוא 16 בתים, וב-base64url הם 22 תווים
// במקום 36.
//
// מכוון: זו אריזה מחדש של אותו UUID ולא קוד קצר חדש. ה-UUID הוא ההרשאה
// (מי שמחזיק בו יכול לערוך את האישור), ולכן קוד של 6-8 תווים היה מקצר את
// הקישור במחיר של הרשאה שאפשר לנחש. כך נשמרת כל האנטרופיה, ואין צורך
// בעמודה או במיגרציה.

const CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export const RSVP_LINK_STATUS = { confirmed: "1", canceled: "0" };

export const statusFromLinkParam = (param) =>
  Object.keys(RSVP_LINK_STATUS).find(
    (status) => RSVP_LINK_STATUS[status] === param,
  ) || null;

export const encodeGuestCode = (uuid) => {
  const hex = String(uuid || "").replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  const binary = hex
    .match(/.{2}/g)
    .map((byte) => String.fromCharCode(parseInt(byte, 16)))
    .join("");
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

// מחזיר UUID באותיות קטנות, או null לכל קלט שאינו קוד תקין.
export const decodeGuestCode = (code) => {
  if (!CODE_PATTERN.test(code || "")) return null;
  try {
    const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/") + "==");
    if (binary.length !== 16) return null;
    const hex = Array.from(binary, (char) =>
      char.charCodeAt(0).toString(16).padStart(2, "0"),
    ).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
};

// אותה אריזה משמשת גם לקישור ההזמנה הכללי של האירוע: /i/<code> במקום
// /invite/<uuid>. מזהה האירוע ממילא גלוי בקישור הארוך, כך שאין כאן שינוי
// בהרשאות — רק בקיצור.
export const buildInviteLink = (origin, eventId) =>
  `${origin}/i/${encodeGuestCode(eventId)}`;

// בלי status: קישור "צפייה ועדכון" — פותח את ההזמנה האישית של האורח (וכל
// החבורה) בלי להחיל אישור או ביטול. עם status: הלחיצה עצמה היא התשובה.
export const buildRsvpLink = (origin, guestId, status) => {
  const base = `${origin}/r/${encodeGuestCode(guestId)}`;
  return status && RSVP_LINK_STATUS[status]
    ? `${base}?s=${RSVP_LINK_STATUS[status]}`
    : base;
};
