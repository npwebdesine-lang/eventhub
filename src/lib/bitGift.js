// מתנה ב-bit: קישור תשלום (וטלפון לגיבוי) שבעלי האירוע מגדירים בדשבורד.
// נשמר ב-design_config.bit_link / bit_phone — בלי עמודה, כמו לוח הזמנים.
//
// הקישור מוצג לכל אורח שפותח את ההזמנה, ולכן מקבלים רק https לדומיין של
// bit. כך טעות הקלדה, או קישור זדוני שהוזן לאירוע, לא שולחים אורחים לאתר
// אחר שמתחזה לתשלום.

const BIT_HOSTS = ["bitpay.co.il"];
const PHONE_PATTERN = /^[0-9+\-\s]{7,15}$/;

export const isValidBitUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return BIT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

export const isValidBitPhone = (value) =>
  PHONE_PATTERN.test(String(value || "").trim());

// { url, phone } לאורחים, או null כשאין קישור תקין — ואז לא מוצג כלום.
export const getBitGift = (designConfig) => {
  const url = String(designConfig?.bit_link || "").trim();
  if (!isValidBitUrl(url)) return null;
  const phone = String(designConfig?.bit_phone || "").trim();
  return { url, phone: isValidBitPhone(phone) ? phone : "" };
};
