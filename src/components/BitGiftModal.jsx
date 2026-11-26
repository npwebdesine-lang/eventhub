// גיליון "מתנה לזוג" לאורחים: מעבר לתשלום ב-bit ו/או PayBox, טלפונים לגיבוי
// להעתקה, וקוד QR שאפשר להראות לחברים בשולחן. ה-QR נטען רק כשמבקשים אותו —
// הספרייה כבדה מכדי להכביד בשבילה על כל פתיחה של ההזמנה.
//
// gifts = getGiftOptions(...) (ראו lib/bitGift.js). כל url כאן הוא הקישור
// הדינמי /g/<provider>/<code>, שמחלק לסירוגין בין חתן לכלה.
import React, { Suspense, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, QrCode } from "lucide-react";
import Modal from "./Modal";
import { giftTitle } from "../lib/bitGift";

const QrCodeView = React.lazy(() => import("./QrCodeView"));

const PAY_BUTTON_SHADOW =
  "6px 6px 14px rgba(0,0,0,0.14), -4px -4px 10px rgba(255,255,255,0.6), inset 2px 2px 4px rgba(255,255,255,0.25), inset -2px -2px 4px rgba(0,0,0,0.12)";

const PhoneRow = ({ label, phone }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // בלי הרשאת לוח: המספר גלוי על המסך, ואפשר לסמן ולהעתיק ידנית.
    }
  };
  return (
    <div className="rounded-clay-field bg-clay-well shadow-clay-inset p-3 text-right">
      <p className="text-xs font-bold text-clay-muted mb-1.5 pr-1">{label}</p>
      <div className="flex items-center gap-2">
        <span
          className="flex-1 min-w-0 font-black text-slate-700 text-lg tabular-nums select-all text-left"
          dir="ltr"
        >
          {phone}
        </span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 min-h-11 px-4 rounded-full flex items-center gap-1.5 text-sm font-bold text-slate-600 bg-clay-chip shadow-clay-md active:shadow-clay-pressed transition-all"
          aria-label={`העתקת ${label}`}
        >
          {copied ? (
            <>
              <Check size={16} className="text-emerald-700" /> הועתק
            </>
          ) : (
            <>
              <Copy size={16} /> העתקה
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const BitGiftModal = ({ open, onClose, gifts }) => {
  const [qrProvider, setQrProvider] = useState(null);

  if (!gifts) return null;
  const providers = Object.values(gifts);

  const close = () => {
    setQrProvider(null);
    onClose();
  };

  const qrGift = qrProvider ? gifts[qrProvider] : null;

  return (
    <Modal
      open={open}
      onClose={close}
      title={`${giftTitle(gifts)} 🎁`}
      size="sm"
      variant="sheet"
    >
      <div className="space-y-4 text-center">
        <p className="text-slate-600 font-medium leading-relaxed">
          רוצים לפנק? אפשר לשלוח מתנה ישירות{" "}
          {providers.map((gift, index) => (
            <React.Fragment key={gift.id}>
              {index > 0 && " או "}
              {/* "ב-PayBox." נשבר באמצע השורה בלי זה */}
              <span className="whitespace-nowrap">
                ב-{gift.label}
                {index === providers.length - 1 && "."}
              </span>
            </React.Fragment>
          ))}
        </p>

        {providers.map((gift) => (
          <a
            key={gift.id}
            href={gift.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-12 py-3.5 rounded-full flex items-center justify-center gap-2 font-black text-white active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: gift.accent,
              boxShadow: PAY_BUTTON_SHADOW,
            }}
          >
            <ExternalLink size={18} /> מעבר לתשלום ב-{gift.label}
          </a>
        ))}

        {providers.flatMap((gift) =>
          gift.phones.map((entry) => (
            <PhoneRow
              key={`${gift.id}-${entry.role}`}
              label={`מספר טלפון ב-${gift.label} (${entry.role})`}
              phone={entry.phone}
            />
          )),
        )}

        <div className="flex gap-2">
          {providers.map((gift) => {
            const active = qrProvider === gift.id;
            return (
              <button
                key={gift.id}
                type="button"
                onClick={() => setQrProvider(active ? null : gift.id)}
                aria-expanded={active}
                className="flex-1 min-h-11 py-3 rounded-full flex items-center justify-center gap-2 font-bold text-slate-600 bg-clay-chip shadow-clay-md active:shadow-clay-pressed transition-all"
              >
                <QrCode size={18} />
                {active
                  ? "הסתר QR"
                  : providers.length > 1
                    ? `QR ל-${gift.label}`
                    : "הצג QR לסריקה"}
              </button>
            );
          })}
        </div>

        {qrGift && (
          <div className="flex flex-col items-center gap-2 pt-1">
            <Suspense
              fallback={
                <div className="w-[236px] h-[236px] flex items-center justify-center">
                  <Loader2 className="animate-spin text-clay-muted" />
                </div>
              }
            >
              <QrCodeView
                data={qrGift.url}
                size={220}
                label={`קוד QR לתשלום ב-${qrGift.label}`}
              />
            </Suspense>
            <p className="text-xs text-clay-muted font-medium">
              סרקו מטלפון אחר כדי לפתוח את התשלום ב-{qrGift.label}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BitGiftModal;
