import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import gsap from "gsap";
import { Check, Loader2, Minus, Plus, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { DEFAULT_DIETARY, DIETARY_OPTIONS } from "../lib/dietary";
import { isValidUUIDv4 } from "../utils/deviceId";
import { useToast } from "../components/Toast";
import { CLAY_BUTTON, CLAY_INSET, CLAY_RAISED, DEFAULT_PRIMARY } from "../lib/clay";
import { accentOn } from "../lib/colors";
import { useEventBackdrop } from "../lib/useEventBackdrop";

// עיבוד "קישור קסם" מוואטסאפ: /rsvp-action?id=<uuid>&status=confirmed|canceled
// ה-UUID עצמו הוא ההרשאה — אין ל-anon גישה ישירה לטבלת event_guests, וכל
// הפעולה עוברת דרך ה-RPC rsvp_respond שנוגע אך ורק בשורה הזו.

const VALID_STATUSES = ["confirmed", "canceled"];
const CONFETTI_COUNT = 36;

// אותו Clay כמו שאר האפליקציה (טוקנים משותפים). עד עכשיו לעמוד הזה הייתה
// פלטה משלו — משטח אפור-כחלחל וצבע ברירת מחדל ורוד — והאורח קפץ ממנו
// להזמנה שנראית כמו אפליקציה אחרת. צבע האירוע נשמר לאייקונים ולקונפטי.
const CARD = `rounded-clay-lg ${CLAY_RAISED}`;
const BUTTON = `rounded-full active:scale-95 ${CLAY_BUTTON}`;

const clayVars = (designConfig) => {
  const accent = designConfig?.colors?.primary || DEFAULT_PRIMARY;
  const accent2 = designConfig?.colors?.secondary || accent;
  return {
    // משמש לאייקונים על המשטח — מוכהה עד 4.5:1 אם צריך.
    "--clay-accent": accentOn(accent),
    // קונפטי בלבד (קישוטי) — הצבעים המקוריים של האירוע.
    "--confetti-1": accent,
    "--confetti-2": accent2,
  };
};

const ERROR_COPY = {
  guest_not_found: "הקישור אינו תקין — לא מצאנו את ההזמנה הזו.",
  invalid_status: "הקישור אינו תקין.",
  invalid_guests_count: "מספר האורחים חייב להיות בין 0 ל-20.",
  invalid_notes: "ההערה ארוכה מדי.",
  invalid_dietary: "העדפת התזונה אינה תקינה.",
  invalid_link: "הקישור אינו תקין.",
  network: "תקלה בחיבור, נסו שוב.",
};

// ה-RPC זורק raise exception; PostgREST מחזיר את הטקסט בתוך message.
const errorCodeFrom = (error) => {
  const message = error?.message || "";
  const known = Object.keys(ERROR_COPY).find((code) => message.includes(code));
  return known || "network";
};

export default function RsvpAction() {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const guestId = searchParams.get("id");
  const requestedStatus = searchParams.get("status");
  const linkIsValid =
    isValidUUIDv4(guestId) && VALID_STATUSES.includes(requestedStatus);

  const [result, setResult] = useState(null);
  useEventBackdrop(result?.design_config?.colors?.background);
  const [errorCode, setErrorCode] = useState(
    linkIsValid ? null : "invalid_link",
  );
  const [loading, setLoading] = useState(linkIsValid);
  const [saving, setSaving] = useState(false);
  const [guestsCount, setGuestsCount] = useState(1);
  const [notes, setNotes] = useState("");
  const [dietary, setDietary] = useState(DEFAULT_DIETARY);

  const confettiRef = useRef(null);
  const countTimeoutRef = useRef(null);

  const respond = useCallback(
    async ({ status, count, guestNotes, mealChoice }) => {
      const { data, error } = await supabase.rpc("rsvp_respond", {
        p_guest_id: guestId,
        p_status: status,
        p_guests_count: count ?? null,
        p_notes: guestNotes ?? null,
        // null משאיר את הבחירה הקיימת (coalesce ב-RPC) — כך שעדכון כמות
        // או הערה לא דורס את העדפת התזונה.
        p_dietary: mealChoice ?? null,
      });
      if (error) throw error;
      // returns table(...) → מערך עם שורה אחת
      return Array.isArray(data) ? data[0] : data;
    },
    [guestId],
  );

  // הקישור מבצע את העדכון מיד עם הטעינה — סיבוב רשת אחד, בלי מסך ביניים.
  useEffect(() => {
    if (!linkIsValid) return;
    let isMounted = true;

    (async () => {
      try {
        const row = await respond({ status: requestedStatus });
        if (!isMounted) return;
        setResult(row);
        setGuestsCount(row?.guests_count ?? 1);
        setNotes(row?.notes ?? "");
        setDietary(row?.dietary ?? DEFAULT_DIETARY);
      } catch (error) {
        if (!isMounted) return;
        setErrorCode(errorCodeFrom(error));
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [linkIsValid, requestedStatus, respond]);

  // קונפטי רק באישור, ורק אם המשתמש לא ביקש להפחית תנועה.
  useEffect(() => {
    if (result?.status !== "confirmed") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const container = confettiRef.current;
    if (!container) return;

    const tweens = Array.from(container.children).map((piece) =>
      gsap.fromTo(
        piece,
        { y: -40, opacity: 1, rotation: 0 },
        {
          y: () => 320 + Math.random() * 220,
          x: () => (Math.random() - 0.5) * 260,
          rotation: () => (Math.random() - 0.5) * 720,
          opacity: 0,
          duration: 1.6 + Math.random() * 1.1,
          delay: Math.random() * 0.35,
          ease: "power1.out",
        },
      ),
    );

    return () => tweens.forEach((tween) => tween.kill());
  }, [result?.status]);

  useEffect(() => {
    return () => clearTimeout(countTimeoutRef.current);
  }, []);

  // מחזיר את השורה שנשמרה, או null בכישלון, כדי שבחירה בדידה (תזונה)
  // תוכל לחזור לערך הקודם במקום להישאר על מצב שלא נשמר.
  const persist = async (payload) => {
    setSaving(true);
    try {
      const row = await respond({ status: result.status, ...payload });
      setResult(row);
      return row;
    } catch (error) {
      showToast(ERROR_COPY[errorCodeFrom(error)], "error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // דחיית שמירה כדי שלחיצות רצופות על +/- לא ייצרו קריאה לכל לחיצה.
  const changeCount = (delta) => {
    const next = Math.min(20, Math.max(0, guestsCount + delta));
    if (next === guestsCount) return;
    setGuestsCount(next);
    clearTimeout(countTimeoutRef.current);
    countTimeoutRef.current = setTimeout(
      () => persist({ count: next, guestNotes: notes }),
      700,
    );
  };

  const saveNotes = () => {
    if ((result?.notes ?? "") === notes) return;
    persist({ count: guestsCount, guestNotes: notes });
  };

  const changeDietary = async (value) => {
    if (value === dietary) return;
    const previous = dietary;
    setDietary(value); // אופטימי — הלחיצה מרגישה מיידית
    const row = await persist({
      count: guestsCount,
      guestNotes: notes,
      mealChoice: value,
    });
    if (!row) setDietary(previous);
  };

  const flipStatus = () => {
    const next = result.status === "confirmed" ? "canceled" : "confirmed";
    persist({ status: next, count: guestsCount, guestNotes: notes });
  };

  const styleVars = clayVars(result?.design_config);
  const confirmed = result?.status === "confirmed";

  if (loading) {
    return (
      <div
        dir="rtl"
        style={clayVars(null)}
        className="min-h-screen flex items-center justify-center bg-clay-gradient"
      >
        <Loader2
          className="animate-spin"
          size={44}
          style={{ color: "var(--clay-accent)" }}
        />
      </div>
    );
  }

  if (errorCode) {
    return (
      <div
        dir="rtl"
        style={clayVars(null)}
        className="min-h-screen flex items-center justify-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-clay-gradient"
      >
        <div className={`${CARD} w-full max-w-md p-10 text-center`}>
          <div
            className={`${CLAY_INSET} mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full`}
          >
            <X size={34} className="text-clay-muted" />
          </div>
          <h1 className="mb-3 text-2xl font-black text-slate-700">אופס</h1>
          <p className="text-clay-muted">{ERROR_COPY[errorCode]}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={styleVars}
      className="min-h-screen flex items-center justify-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-clay-gradient"
    >
      <div className={`${CARD} relative w-full max-w-md p-9 text-center`}>
        {confirmed && (
          <div
            ref={confettiRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center overflow-visible"
          >
            {Array.from({ length: CONFETTI_COUNT }).map((_, index) => (
              <span
                key={index}
                className="absolute h-2.5 w-2.5 rounded-[3px]"
                style={{
                  background:
                    index % 2 ? "var(--confetti-1)" : "var(--confetti-2)",
                }}
              />
            ))}
          </div>
        )}

        <div
          className={`${CLAY_INSET} mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full`}
        >
          {confirmed ? (
            <Check size={44} style={{ color: "var(--clay-accent)" }} />
          ) : (
            <X size={40} className="text-clay-muted" />
          )}
        </div>

        <h1 className="mb-2 text-2xl font-black text-slate-700">
          היי {result?.guest_name || ""},
        </h1>
        <p className="mb-8 text-lg text-clay-muted">
          {confirmed ? "אישרנו את הגעתך! 🎉" : "נשמח לראותך בפעם הבאה 💛"}
        </p>

        {confirmed && (
          <>
            <div className={`${CLAY_INSET} mb-5 rounded-3xl p-4`}>
              <p className="mb-3 text-sm font-semibold text-clay-muted">
                כמה אורחים?
              </p>
              <div className="flex items-center justify-center gap-5">
                <button
                  type="button"
                  onClick={() => changeCount(-1)}
                  aria-label="פחות אורחים"
                  className={`${BUTTON} grid h-11 w-11 place-items-center`}
                >
                  <Minus size={18} className="text-slate-600" />
                </button>
                <span className="w-10 text-2xl font-bold text-slate-700">
                  {guestsCount}
                </span>
                <button
                  type="button"
                  onClick={() => changeCount(1)}
                  aria-label="עוד אורחים"
                  className={`${BUTTON} grid h-11 w-11 place-items-center`}
                >
                  <Plus size={18} className="text-slate-600" />
                </button>
              </div>
            </div>

            <div className={`${CLAY_INSET} mb-5 rounded-3xl p-4`}>
              <p className="mb-3 text-sm font-semibold text-clay-muted">
                העדפת תזונה
              </p>
              <div
                role="group"
                aria-label="העדפת תזונה"
                className="flex flex-wrap justify-center gap-2"
              >
                {DIETARY_OPTIONS.map((option) => {
                  const active = dietary === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => changeDietary(option.value)}
                      disabled={saving}
                      aria-pressed={active}
                      className={`flex items-center gap-1.5 rounded-full min-h-11 px-3.5 text-sm font-bold transition-all disabled:opacity-60 ${
                        active
                          ? `${CLAY_INSET} text-slate-800`
                          : `${BUTTON} text-clay-muted`
                      }`}
                    >
                      <span aria-hidden="true">{option.emoji}</span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={saveNotes}
              maxLength={500}
              rows={2}
              placeholder="הערות (אלרגיות, הסעה...)"
              className={`${CLAY_INSET} mb-6 w-full resize-none rounded-3xl p-4 text-slate-700 placeholder:text-clay-muted focus:outline-none`}
            />
          </>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={flipStatus}
            disabled={saving}
            className="min-h-11 py-3 text-sm font-semibold text-clay-muted underline-offset-4 hover:underline disabled:opacity-50"
          >
            {confirmed ? "טעות? עבור לביטול" : "שינית את דעתך? אשר הגעה"}
          </button>

          {result?.event_id && (
            <Link
              to={`/invite/${result.event_id}`}
              className={`${BUTTON} w-full px-6 py-4 font-bold text-slate-700`}
            >
              לפרטי האירוע ←
            </Link>
          )}
        </div>

        <p className="mt-6 h-4 text-xs text-clay-muted">
          {saving ? "שומר..." : ""}
        </p>
      </div>
    </div>
  );
}
