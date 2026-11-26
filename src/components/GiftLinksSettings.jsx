// הגדרות "קישור דינמי מתחלף" לספק תשלום אחד (bit / PayBox) בהגדרות האירוע:
// קישור לחתן וקישור לכלה (ול-bit גם טלפון לגיבוי לכל אחד), וכפתור ל-QR
// היחיד שמודפס. ה-QR מצביע על /g/<provider>/<code>, שמחלק את הסריקות
// לסירוגין בין הקישורים השמורים — ראו lib/bitGift.js ו-api/gift-redirect.js.
import { QrCode } from "lucide-react";
import {
  GIFT_PROVIDERS,
  GIFT_SLOTS,
  isValidBitPhone,
  isValidGiftUrl,
  readGiftPair,
} from "../lib/bitGift";

const FIELD =
  "w-full min-w-0 p-4 bg-clay-surface shadow-clay-inset rounded-xl focus:ring-2 focus:ring-clay-ink/40 outline-none text-sm text-left";

const GiftLinksSettings = ({
  provider,
  designConfig,
  onChange,
  canShowQr,
  onOpenQr,
}) => {
  const config = GIFT_PROVIDERS[provider];
  const { links, phones } = readGiftPair(designConfig, provider);
  const withPhones = provider === "bit";
  const validCount = links.filter((link) =>
    isValidGiftUrl(link.trim(), provider),
  ).length;

  // נכתב תמיד כזוג מלא, כך שהמיקום (חתן/כלה) נשמר גם כשתא אחד ריק.
  const setSlot = (key, index, value) => {
    const next = [...(key === "links" ? links : phones)];
    next[index] = value;
    onChange({ [`${provider}_${key}`]: next });
  };

  return (
    <div className="space-y-3 bg-clay-well shadow-clay-inset p-4 rounded-2xl">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: config.accent }}
              aria-hidden="true"
            />
            {config.label} (קישור דינמי מתחלף)
          </p>
          <p className="text-xs text-clay-muted mt-1 leading-relaxed">
            אופציונלי. QR אחד שמודפס פעם אחת: כל סריקה פותחת לסירוגין את הקישור
            של החתן ואת של הכלה. אפשר להחליף קישורים בכל שלב בלי להדפיס מחדש.
          </p>
        </div>
        {validCount > 0 && (
          <button
            type="button"
            onClick={onOpenQr}
            disabled={!canShowQr}
            className="shrink-0 flex items-center justify-center gap-2 bg-clay-ink hover:bg-clay-ink-hover text-white shadow-clay-btn px-4 py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
          >
            <QrCode size={16} /> הצג / הורד QR יחיד ל-{config.label}
          </button>
        )}
      </div>
      {validCount > 0 && !canShowQr && (
        <p className="text-xs font-bold text-clay-muted">
          שמרו את האירוע כדי ליצור את קוד ה-QR.
        </p>
      )}

      {GIFT_SLOTS.map((role, index) => {
        const link = links[index];
        const linkInvalid =
          link.trim() !== "" && !isValidGiftUrl(link.trim(), provider);
        const phone = phones[index];
        const phoneInvalid = phone.trim() !== "" && !isValidBitPhone(phone);
        const linkId = `${provider}-link-${index}`;
        const phoneId = `${provider}-phone-${index}`;
        return (
          <div key={role} className="space-y-1.5 pt-1">
            <label
              htmlFor={linkId}
              className="text-xs font-bold text-slate-700 block"
            >
              קישור {config.label} {index + 1} ({role})
            </label>
            <input
              id={linkId}
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setSlot("links", index, e.target.value)}
              placeholder={config.placeholder}
              aria-invalid={linkInvalid}
              aria-describedby={linkInvalid ? `${linkId}-error` : undefined}
              className={FIELD}
              dir="ltr"
            />
            {linkInvalid && (
              <p
                id={`${linkId}-error`}
                className="text-xs font-bold text-rose-700"
              >
                הקישור צריך להתחיל ב-https:// ולהיות של {config.label} (
                {config.hosts.join(" / ")}).
              </p>
            )}
            {withPhones && (
              <>
                <label
                  htmlFor={phoneId}
                  className="text-xs font-bold text-clay-muted block pt-1"
                >
                  טלפון לגיבוי ב-{config.label} ({role}, אופציונלי)
                </label>
                <input
                  id={phoneId}
                  type="tel"
                  value={phone}
                  onChange={(e) => setSlot("phones", index, e.target.value)}
                  placeholder="050-0000000"
                  aria-invalid={phoneInvalid}
                  className={FIELD}
                  dir="ltr"
                />
                {phoneInvalid && (
                  <p className="text-xs font-bold text-rose-700">
                    מספר הטלפון אינו תקין.
                  </p>
                )}
              </>
            )}
          </div>
        );
      })}

      {validCount === 1 && (
        <p className="text-xs text-clay-muted">
          מוגדר קישור אחד בלבד — כל הסריקות יגיעו אליו.
        </p>
      )}
    </div>
  );
};

export default GiftLinksSettings;
