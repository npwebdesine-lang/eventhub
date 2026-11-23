// גיליון "מתנה ב-bit" לאורחים: מעבר לתשלום, טלפון לגיבוי להעתקה, וקוד QR
// שאפשר להראות לחברים בשולחן. ה-QR נטען רק כשמבקשים אותו — הספרייה כבדה
// מכדי להכביד בשבילה על כל פתיחה של ההזמנה.
import React, { Suspense, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, QrCode } from "lucide-react";
import Modal from "./Modal";

const QrCodeView = React.lazy(() => import("./QrCodeView"));

// צבע ההדגשה של bit (טורקיז), בעדינות — לא לוגו.
export const BIT_ACCENT = "#1aa6a0";

const BitGiftModal = ({ open, onClose, gift }) => {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!gift) return null;

  const close = () => {
    setShowQr(false);
    setCopied(false);
    onClose();
  };

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(gift.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // בלי הרשאת לוח: המספר גלוי על המסך, ואפשר לסמן ולהעתיק ידנית.
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="מתנה ב-bit 🎁"
      size="sm"
      variant="sheet"
    >
      <div className="space-y-4 text-center">
        <p className="text-slate-600 font-medium leading-relaxed">
          רוצים לפנק? אפשר לשלוח מתנה ישירות ב-bit.
        </p>

        <a
          href={gift.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full min-h-12 py-3.5 rounded-full flex items-center justify-center gap-2 font-black text-white active:scale-[0.97] transition-transform"
          style={{
            backgroundColor: BIT_ACCENT,
            boxShadow:
              "6px 6px 14px rgba(0,0,0,0.14), -4px -4px 10px rgba(255,255,255,0.6), inset 2px 2px 4px rgba(255,255,255,0.25), inset -2px -2px 4px rgba(0,0,0,0.12)",
          }}
        >
          <ExternalLink size={18} /> מעבר לתשלום ב-bit
        </a>

        {gift.phone && (
          <div className="rounded-clay-field bg-clay-well shadow-clay-inset p-3 text-right">
            <p className="text-xs font-bold text-clay-muted mb-1.5 pr-1">
              מספר טלפון לגיבוי ב-bit
            </p>
            <div className="flex items-center gap-2">
              <span
                className="flex-1 min-w-0 font-black text-slate-700 text-lg tabular-nums select-all text-left"
                dir="ltr"
              >
                {gift.phone}
              </span>
              <button
                type="button"
                onClick={copyPhone}
                className="shrink-0 min-h-11 px-4 rounded-full flex items-center gap-1.5 text-sm font-bold text-slate-600 bg-clay-chip shadow-clay-md active:shadow-clay-pressed transition-all"
                aria-label="העתקת מספר הטלפון"
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
        )}

        <button
          type="button"
          onClick={() => setShowQr((value) => !value)}
          aria-expanded={showQr}
          className="w-full min-h-11 py-3 rounded-full flex items-center justify-center gap-2 font-bold text-slate-600 bg-clay-chip shadow-clay-md active:shadow-clay-pressed transition-all"
        >
          <QrCode size={18} /> {showQr ? "הסתר QR" : "הצג QR לסריקה"}
        </button>

        {showQr && (
          <div className="flex flex-col items-center gap-2 pt-1">
            <Suspense
              fallback={
                <div className="w-[236px] h-[236px] flex items-center justify-center">
                  <Loader2 className="animate-spin text-clay-muted" />
                </div>
              }
            >
              <QrCodeView
                data={gift.url}
                size={220}
                label="קוד QR לתשלום ב-bit"
              />
            </Suspense>
            <p className="text-xs text-clay-muted font-medium">
              סרקו מטלפון אחר כדי לפתוח את התשלום
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BitGiftModal;
