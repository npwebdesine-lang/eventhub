// כרטיס "מודול מתנה דיגיטלית (bit / PayBox)" בהגדרות האירוע: תוסף שמודלק
// לכל אירוע (design_config.gift_enabled), באותו סגנון כמו כרטיסי המודולים
// האחרים. דולק: הגדרות הקישורים וה-QR לכל ספק (GiftLinksSettings). כבוי:
// הכל מוסתר — בדשבורד, בהזמנה וב-/g/ — אבל הקישורים לא נמחקים, וחוזרים
// בהדלקה. הכלל עצמו (כולל ברירת המחדל לאירועים ישנים) ב-isGiftEnabled.
import { Gift } from "lucide-react";
import GiftLinksSettings from "./GiftLinksSettings";
import { GIFT_PROVIDERS, isGiftEnabled, readGiftPair } from "../lib/bitGift";

const GiftModuleSettings = ({
  designConfig,
  onChange,
  canShowQr,
  onOpenQr,
}) => {
  const giftOn = isGiftEnabled(designConfig);
  const hasSavedLinks = Object.keys(GIFT_PROVIDERS).some((provider) =>
    readGiftPair(designConfig, provider).links.some((link) => link.trim()),
  );

  return (
    <div
      className={`border-2 rounded-3xl p-5 md:p-6 transition-all space-y-4 ${giftOn ? "border-teal-500 bg-teal-50/30" : "border-clay-well-deep"}`}
    >
      <div className="flex justify-between items-start gap-3">
        <div
          className={`flex items-center gap-3 ${giftOn ? "" : "opacity-60 grayscale"}`}
        >
          <div
            className={`p-3 rounded-xl shrink-0 ${giftOn ? "bg-teal-500 text-white" : "bg-slate-200 text-clay-muted"}`}
          >
            <Gift size={24} />
          </div>
          <div>
            <h4
              id="gift-module-title"
              className="font-black text-lg text-slate-800"
            >
              מודול מתנה דיגיטלית (bit / PayBox)
            </h4>
            <span className="text-xs font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
              תוסף
            </span>
          </div>
        </div>
        <label className="relative inline-flex items-center justify-center min-h-11 min-w-11 cursor-pointer shrink-0">
          <input
            type="checkbox"
            className="sr-only peer"
            aria-labelledby="gift-module-title"
            checked={giftOn}
            onChange={(e) => onChange({ gift_enabled: e.target.checked })}
          />
          <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500/50 rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-clay-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
        </label>
      </div>

      {giftOn ? (
        Object.keys(GIFT_PROVIDERS).map((provider) => (
          <GiftLinksSettings
            key={provider}
            provider={provider}
            designConfig={designConfig}
            onChange={onChange}
            canShowQr={canShowQr}
            onOpenQr={() => onOpenQr(provider)}
          />
        ))
      ) : (
        <p className="text-xs text-clay-muted font-medium leading-relaxed">
          {hasSavedLinks
            ? "המודול כבוי: האורחים לא רואים כפתור מתנה, וסריקת QR מודפס מובילה להזמנה. הקישורים השמורים נשארים ויחזרו כשתדליקו מחדש."
            : "הדליקו כדי להוסיף קישורי bit ו-PayBox לחתן ולכלה, עם QR יחיד מתחלף להדפסה."}
        </p>
      )}
    </div>
  );
};

export default GiftModuleSettings;
