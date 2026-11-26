// מתנה לזוג ב-bit וב-PayBox: זוג קישורים לכל אפליקציה (חתן, כלה) שבעלי
// האירוע מגדירים בדשבורד. נשמר ב-design_config, בלי עמודה:
//   bit_links    = ["<חתן>", "<כלה>"]   bit_phones = ["<חתן>", "<כלה>"]
//   paybox_links = ["<חתן>", "<כלה>"]
// אירועים ישנים שמרו רק bit_link / bit_phone — הם נקראים כ"קישור 1", ובשמירה
// נכתבים גם הם (הקישור התקין הראשון), כך שקוד ישן ממשיך לעבוד.
//
// האורחים לא מקבלים את הקישורים עצמם אלא את /g/<provider>/<code>: כל סריקה
// או לחיצה עוברת ב-api/gift-redirect.js, שמחלק לסירוגין בין חתן לכלה
// (resolve_gift_redirect). לכן QR מודפס אחד נשאר תקף גם כשהקישורים מתחלפים.
//
// רק https לדומיין של ספק התשלום נחשב תקין — כאן, ב-RPC וב-redirect — כך
// שטעות הקלדה או קישור זדוני לא שולחים אורחים לאתר שמתחזה לתשלום.
import { encodeGuestCode } from "./rsvpLink";

export const GIFT_PROVIDERS = {
  bit: {
    id: "bit",
    label: "bit",
    hosts: ["bitpay.co.il"],
    accent: "#1aa6a0",
    placeholder: "https://www.bitpay.co.il/app/...",
  },
  paybox: {
    id: "paybox",
    label: "PayBox",
    hosts: ["payboxapp.com", "payboxapp.page.link"],
    accent: "#3b6fd4",
    placeholder: "https://links.payboxapp.com/...",
  },
};

// האינדקס במערך = התפקיד. הסדר קובע גם את התור: סריקה 1 → קישור 1.
export const GIFT_SLOTS = ["חתן", "כלה"];

const PHONE_PATTERN = /^[0-9+\-\s]{7,15}$/;

export const isValidGiftUrl = (value, provider) => {
  const config = GIFT_PROVIDERS[provider];
  if (!config) return false;
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return config.hosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

export const isValidBitUrl = (value) => isValidGiftUrl(value, "bit");

export const isValidBitPhone = (value) =>
  PHONE_PATTERN.test(String(value || "").trim());

const pair = (value) => {
  const list = Array.isArray(value) ? value : [];
  return GIFT_SLOTS.map((_, index) => String(list[index] ?? ""));
};

// לעריכה בדשבורד: תמיד שני תאים (חתן, כלה), כולל ערכים לא תקינים שהוקלדו.
export const readGiftPair = (designConfig, provider) => {
  const config = designConfig || {};
  const links = pair(config[`${provider}_links`]);
  const phones = pair(config[`${provider}_phones`]);
  if (provider === "bit" && !Array.isArray(config.bit_links)) {
    links[0] = String(config.bit_link ?? "");
  }
  if (provider === "bit" && !Array.isArray(config.bit_phones)) {
    phones[0] = String(config.bit_phone ?? "");
  }
  return { links, phones };
};

export const validGiftLinks = (designConfig, provider) =>
  readGiftPair(designConfig, provider)
    .links.map((link) => link.trim())
    .filter((link) => isValidGiftUrl(link, provider));

// הקישור הדינמי שמודפס ב-QR ומשמש את כפתור המתנה בהזמנה.
export const buildGiftLink = (origin, provider, eventId) =>
  `${origin}/g/${provider}/${encodeGuestCode(eventId)}`;

// כותרת הכפתור/הגיליון לפי מה שמוגדר: ספק אחד בשמו, שניים — כללי.
export const giftTitle = (gifts) => {
  const providers = Object.values(gifts || {});
  return providers.length === 1 ? `מתנה ב-${providers[0].label}` : "מתנה לזוג";
};

// לאורחים: { bit, paybox } — לכל ספק עם קישור תקין אחד לפחות { url, phones },
// או null כשאין אף ספק, ואז לא מוצג כלום.
export const getGiftOptions = (designConfig, eventId, origin) => {
  const options = {};
  for (const provider of Object.keys(GIFT_PROVIDERS)) {
    if (!validGiftLinks(designConfig, provider).length) continue;
    const { phones } = readGiftPair(designConfig, provider);
    options[provider] = {
      ...GIFT_PROVIDERS[provider],
      url: buildGiftLink(origin, provider, eventId),
      phones: phones
        .map((phone, index) => ({
          role: GIFT_SLOTS[index],
          phone: phone.trim(),
        }))
        .filter((entry) => isValidBitPhone(entry.phone)),
    };
  }
  return Object.keys(options).length ? options : null;
};
