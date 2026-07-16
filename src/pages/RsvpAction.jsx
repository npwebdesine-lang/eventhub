import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import gsap from "gsap";
import { Check, Loader2, Minus, Plus, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { isValidUUIDv4 } from "../utils/deviceId";
import { sanitize } from "../utils/sanitize";
import { useToast } from "../components/Toast";

// עיבוד "קישור קסם" מוואטסאפ: /rsvp-action?id=<uuid>&status=confirmed|canceled
// ה-UUID עצמו הוא ההרשאה — אין ל-anon גישה ישירה לטבלת event_guests, וכל
// הפעולה עוברת דרך ה-RPC rsvp_respond שנוגע אך ורק בשורה הזו.

const VALID_STATUSES = ["confirmed", "canceled"];
const CONFETTI_COUNT = 36;

// Claymorphism: משטח בהיר תמיד (הבלטה/שקיעה לא נקראות על רקע כהה),
// גוון לפי צבעי האירוע.
const CLAY_CARD =
  "rounded-[2.5rem] bg-[var(--clay-surface)] shadow-[10px_10px_24px_var(--clay-shadow),-10px_-10px_24px_var(--clay-light)]";
const CLAY_INSET =
  "shadow-[inset_6px_6px_12px_var(--clay-shadow),inset_-6px_-6px_12px_var(--clay-light)]";
const CLAY_BUTTON =
  "rounded-2xl transition-transform active:scale-95 shadow-[6px_6px_14px_var(--clay-shadow),-6px_-6px_14px_var(--clay-light)] active:shadow-[inset_4px_4px_10px_var(--clay-shadow),inset_-4px_-4px_10px_var(--clay-light)]";

const FALLBACK_ACCENT = "#f9a8d4";

const clayVars = (designConfig) => {
  const accent = designConfig?.colors?.primary || FALLBACK_ACCENT;
  const accent2 = designConfig?.colors?.secondary || accent;
  return {
    "--clay-accent": accent,
    "--clay-accent-2": accent2,
    // גוון פסטלי רך הנגזר מצבע האירוע, כדי שהאורח לא יקפוץ למסך "זר"
    "--clay-surface": `color-mix(in srgb, ${accent} 8%, #eff2f7)`,
    "--clay-shadow": "rgba(9, 12, 24, 0.16)",
    "--clay-light": "rgba(255, 255, 255, 0.9)",
  };
};

const ERROR_COPY = {
  guest_not_found: "הקישור אינו תקין — לא מצאנו את ההזמנה הזו.",
  invalid_status: "הקישור אינו תקין.",
  invalid_guests_count: "מספר האורחים חייב להיות בין 0 ל-20.",
  invalid_notes: "ההערה ארוכה מדי.",
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
  const [errorCode, setErrorCode] = useState(linkIsValid ? null : "invalid_link");
  const [loading, setLoading] = useState(linkIsValid);
  const [saving, setSaving] = useState(false);
  const [guestsCount, setGuestsCount] = useState(1);
  const [notes, setNotes] = useState("");

  const confettiRef = useRef(null);
  const countTimeoutRef = useRef(null);

  const respond = useCallback(
    async ({ status, count, guestNotes }) => {
      const { data, error } = await supabase.rpc("rsvp_respond", {
        p_guest_id: guestId,
        p_status: status,
        p_guests_count: count ?? null,
        p_notes: guestNotes ?? null,
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

  const persist = async (payload) => {
    setSaving(true);
    try {
      const row = await respond({ status: result.status, ...payload });
      setResult(row);
    } catch (error) {
      showToast(ERROR_COPY[errorCodeFrom(error)], "error");
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
        className="min-h-screen flex items-center justify-center bg-[var(--clay-surface)]"
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
        className="min-h-screen flex items-center justify-center p-6 bg-[var(--clay-surface)]"
      >
        <div className={`${CLAY_CARD} w-full max-w-md p-10 text-center`}>
          <div
            className={`${CLAY_INSET} mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full`}
          >
            <X size={34} className="text-slate-400" />
          </div>
          <h1 className="mb-3 text-2xl font-bold text-slate-700">אופס</h1>
          <p className="text-slate-500">{ERROR_COPY[errorCode]}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={styleVars}
      className="min-h-screen flex items-center justify-center p-6 bg-[var(--clay-surface)]"
    >
      <div className={`${CLAY_CARD} relative w-full max-w-md p-9 text-center`}>
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
                    index % 2 ? "var(--clay-accent)" : "var(--clay-accent-2)",
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
            <X size={40} className="text-slate-400" />
          )}
        </div>

        <h1 className="mb-2 text-2xl font-bold text-slate-700">
          היי {sanitize(result?.guest_name || "")},
        </h1>
        <p className="mb-8 text-lg text-slate-500">
          {confirmed ? "אישרנו את הגעתך! 🎉" : "נשמח לראותך בפעם הבאה 💛"}
        </p>

        {confirmed && (
          <>
            <div className={`${CLAY_INSET} mb-5 rounded-3xl p-4`}>
              <p className="mb-3 text-sm font-semibold text-slate-500">
                כמה אורחים?
              </p>
              <div className="flex items-center justify-center gap-5">
                <button
                  type="button"
                  onClick={() => changeCount(-1)}
                  aria-label="פחות אורחים"
                  className={`${CLAY_BUTTON} grid h-11 w-11 place-items-center bg-[var(--clay-surface)]`}
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
                  className={`${CLAY_BUTTON} grid h-11 w-11 place-items-center bg-[var(--clay-surface)]`}
                >
                  <Plus size={18} className="text-slate-600" />
                </button>
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={saveNotes}
              maxLength={500}
              rows={2}
              placeholder="הערות (אלרגיות, הסעה...)"
              className={`${CLAY_INSET} mb-6 w-full resize-none rounded-3xl bg-transparent p-4 text-slate-700 placeholder:text-slate-400 focus:outline-none`}
            />
          </>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={flipStatus}
            disabled={saving}
            className="text-sm font-semibold text-slate-500 underline-offset-4 hover:underline disabled:opacity-50"
          >
            {confirmed ? "טעות? עבור לביטול" : "שינית את דעתך? אשר הגעה"}
          </button>

          {result?.event_id && (
            <Link
              to={`/invite/${result.event_id}`}
              className={`${CLAY_BUTTON} w-full bg-[var(--clay-surface)] px-6 py-4 font-bold text-slate-700`}
            >
              לפרטי האירוע ←
            </Link>
          )}
        </div>

        <p className="mt-6 h-4 text-xs text-slate-400">
          {saving ? "שומר..." : ""}
        </p>
      </div>
    </div>
  );
}
