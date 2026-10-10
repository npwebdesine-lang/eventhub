import { memo, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { accentOn } from "../lib/colors";
import { CLAY_RAISED } from "../lib/clay";

const ZERO = { days: 0, hours: 0, minutes: 0, seconds: 0 };

const computeTimeLeft = (target) => {
  const difference = +target - Date.now();
  if (!(difference > 0)) return ZERO;
  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
};

const pad = (n) => n.toString().padStart(2, "0");

/**
 * הספירה לאחור יושבת ברכיב משלה כדי שהטיק של כל שנייה ירנדר רק אותה, ולא
 * את כל דף ההזמנה (טופס ה-RSVP, החלקיקים של התבנית האלגנטית וכו').
 *
 * החישוב הראשון סינכרוני (lazy initial state): בגרסה הקודמת המצב ההתחלתי
 * היה אפסים, ולכן הרינדור הראשון הציג לרגע "היום זה קורה!" ואנימציית
 * הכניסה של GSAP רצה על האלמנט הלא נכון.
 */
const useCountdown = (eventDate) => {
  const [timeLeft, setTimeLeft] = useState(() =>
    eventDate ? computeTimeLeft(new Date(`${eventDate}T19:00:00`)) : ZERO,
  );

  useEffect(() => {
    if (!eventDate) return undefined;
    const date = new Date(`${eventDate}T19:00:00`);
    let timer = null;
    const tick = () => {
      const next = computeTimeLeft(date);
      setTimeLeft(next);
      // אחרי שהגענו לאפס אין מה לספור — לא משאירים interval רץ.
      if (next === ZERO && timer) clearInterval(timer);
      return next;
    };
    if (tick() === ZERO) return undefined;
    timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [eventDate]);

  return timeLeft;
};

const InviteCountdown = ({ eventDate, variant, primaryColor }) => {
  const timeLeft = useCountdown(eventDate);
  const isHappeningNow = timeLeft === ZERO;
  const accent = accentOn(primaryColor);

  if (variant === "elegant") {
    if (isHappeningNow) {
      return (
        <h2
          className="fade-up-item text-3xl font-bold mb-10"
          style={{ color: accent }}
        >
          היום זה קורה!
        </h2>
      );
    }
    const units = [
      [timeLeft.seconds, "שניות"],
      [timeLeft.minutes, "דקות"],
      [timeLeft.hours, "שעות"],
      [timeLeft.days, "ימים"],
    ];
    return (
      <div
        className="fade-up-item flex justify-center items-center gap-4 mb-10"
        dir="ltr"
      >
        {units.map(([value, label], i) => (
          <div key={label} className="contents">
            {i > 0 && <div className="h-8 w-[1px] bg-slate-200"></div>}
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold" style={{ color: accent }}>
                {pad(value)}
              </span>
              <span className="text-xs font-bold text-clay-muted">{label}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "corporate") {
    // הכרטיס עצמו (צבע האירוע + צל) נשאר בדף; כאן רק התוכן שמשתנה.
    if (isHappeningNow) {
      return (
        <div className="py-4">
          <h2 className="text-2xl font-black">האירוע מתחיל היום!</h2>
        </div>
      );
    }
    const units = [
      [timeLeft.days, "Days"],
      [timeLeft.hours, "Hours"],
      [timeLeft.minutes, "Min"],
      [timeLeft.seconds, "Sec"],
    ];
    return (
      <div className="flex justify-between items-center" dir="ltr">
        {units.map(([value, label], i) => (
          <div key={label} className="contents">
            {i > 0 && (
              <span className="text-2xl font-bold opacity-50 mb-4">:</span>
            )}
            <div className="flex flex-col items-center flex-1">
              <span className="text-4xl font-black tracking-tight">
                {pad(value)}
              </span>
              <span className="text-[10px] font-bold uppercase mt-1">
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // modern
  if (isHappeningNow) {
    return (
      <div className={`fade-up-item mb-12 p-6 rounded-clay ${CLAY_RAISED}`}>
        <Sparkles
          className="mx-auto mb-3 text-yellow-400 animate-pulse"
          size={48}
        />
        <h2 className="text-3xl font-black text-slate-700 mb-2">
          היום זה קורה!
        </h2>
        <p className="text-clay-muted">ההמתנה הסתיימה. נתראה בקרוב.</p>
      </div>
    );
  }
  const units = [
    [timeLeft.seconds, "שניות"],
    [timeLeft.minutes, "דקות"],
    [timeLeft.hours, "שעות"],
    [timeLeft.days, "ימים"],
  ];
  return (
    <div
      className="fade-up-item flex justify-center gap-3 md:gap-4 mb-12"
      dir="ltr"
    >
      {units.map(([value, label]) => (
        <div key={label} className="flex flex-col items-center">
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-[24px] flex items-center justify-center text-2xl md:text-3xl font-black bg-clay-well-deep shadow-clay-inset-deep"
            style={{ color: accent }}
          >
            {pad(value)}
          </div>
          <span className="text-xs font-bold mt-3 text-clay-muted">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default memo(InviteCountdown);
