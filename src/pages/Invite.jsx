import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  DEFAULT_DIETARY,
  DIETARY_OPTIONS,
  PRIMARY_DIETARY_OPTIONS,
  UNDER_5_DIETARY,
} from "../lib/dietary";
import { isValidUUIDv4 } from "../utils/deviceId";
import {
  Loader2,
  CalendarHeart,
  Clock,
  Car,
  PartyPopper,
  Briefcase,
  CheckCircle2,
  X,
  Send,
  AlertTriangle,
  Users,
  UserPlus,
  Save,
  Navigation,
  MapPin,
} from "lucide-react";
import gsap from "gsap";
import { accentOn } from "../lib/colors";
import { useToast } from "../components/Toast";
import { useModalBehavior } from "../components/Modal";
import {
  CLAY_FIELD,
  CLAY_RAISED,
  DEFAULT_PRIMARY,
  clayButtonStyle,
  clayHeroStyle,
} from "../lib/clay";
import { useEventBackdrop } from "../lib/useEventBackdrop";
import InviteCountdown from "../components/InviteCountdown";

// שלב ייעודי ל"קישור קסם" (?guest_id=). 1-4 נשארים הזרימה העצמאית הקיימת.
const RSVP_STEP_GUEST = 0;
const MAGIC_STATUSES = ["confirmed", "canceled"];

// אדם אחד = שורה אחת. מוזמן שיובא עם כמות (למשל "דוד כהן, 2") נושא את
// הכמות על השורה שלו, אבל בקישור הקסם בני הלוויה נרשמים בשמם, כל אחד בשורה
// משלו. לכן אישור דרך הקישור מאפס את guests_count של השורה ל-1; בלי זה
// "2" מהייבוא ועוד שורה לבן הזוג היו נספרים כ-3 מנות.
const MAGIC_CONFIRMED_COUNT = 1;

const PARTICLE_SIZES = [18, 26, 12, 22, 15, 28];

const PHONE_PATTERN = /^[0-9+\-\s]{7,15}$/; // זהה ל-check constraint על event_guests

// ה-RPC זורק raise exception; PostgREST מחזיר את הטקסט בתוך message.
const RSVP_ERROR_COPY = {
  invalid_guest_name: "השם חייב להכיל בין תו אחד ל-100 תווים.",
  invalid_phone: "מספר הטלפון אינו תקין.",
  invalid_guests_count: "מספר האורחים חייב להיות בין 0 ל-20.",
  invalid_under_5_count: "מספר הילדים עד גיל 5 חייב להיות בין 0 ל-20.",
  invalid_dietary: "העדפת התזונה אינה תקינה.",
  event_not_found: "האירוע לא נמצא.",
  primary_has_no_phone:
    "אי אפשר להוסיף אורחים להזמנה בלי מספר טלפון. פנו לבעלי האירוע.",
  network: "שגיאה בשמירת אישור ההגעה",
};

const rsvpErrorCode = (error) => {
  const message = error?.message || "";
  return (
    Object.keys(RSVP_ERROR_COPY).find((code) => message.includes(code)) ||
    "network"
  );
};

// שורת המיקום — הכתובת עצמה ולא רק כפתור הניווט. עד עכשיו האורח היה צריך
// ללחוץ על "נווט לאירוע" רק כדי לגלות איפה זה.
//
// מחזיר null כשאין מיקום, ולכן כל קורא אחראי גם למרווח התחתון שלו — ראו
// המרווח המותנה על שורת התאריך, כדי שהפריסה לא תתכווץ כשאין כתובת.
const LocationLine = ({
  location,
  primaryColor,
  size = "md",
  className = "",
}) => {
  const text = (location || "").trim();
  if (!text) return null;
  const isSmall = size === "sm";
  return (
    <div
      className={`flex items-center justify-center gap-2 ${className}`}
      title={text}
    >
      <span
        className={`grid place-items-center rounded-full shrink-0 bg-clay-well shadow-[inset_2px_2px_5px_rgba(0,0,0,0.08),inset_-2px_-2px_5px_rgba(255,255,255,0.85)] ${
          isSmall ? "w-6 h-6" : "w-7 h-7"
        }`}
      >
        <MapPin
          size={isSmall ? 12 : 14}
          style={{ color: accentOn(primaryColor) }}
          aria-hidden="true"
        />
      </span>
      <span
        className={`font-medium text-clay-muted ${isSmall ? "text-sm" : "text-base"}`}
      >
        {text}
      </span>
    </div>
  );
};

// בורר העדפת תזונה — משמש גם בכרטיס קישור הקסם וגם לכל אורח בזרימה העצמאית.
// compact=true מקטין לשורת גלולות צרה שמתאימה מתחת לשדה שם.
// options: הנרשם עצמו מקבל PRIMARY_DIETARY_OPTIONS (בלי "מתחת לגיל 5");
// אורחים שנוספו מקבלים את הרשימה המלאה.
const DietaryPicker = ({
  options = DIETARY_OPTIONS,
  value,
  onChange,
  primaryColor,
  disabled,
  compact,
}) => (
  <div
    role="group"
    aria-label="העדפת תזונה"
    className={`flex flex-wrap gap-2 ${compact ? "" : "justify-center"}`}
  >
    {options.map((option) => {
      const active = (value || DEFAULT_DIETARY) === option.value;
      return (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={active}
          onClick={() => onChange(option.value)}
          className={`flex items-center gap-1.5 rounded-full font-bold transition-all disabled:opacity-50 ${
            compact ? "min-h-11 px-3.5 text-xs" : "min-h-11 px-4 text-sm"
          } ${
            active
              ? "text-white active:scale-95"
              : "text-clay-muted bg-clay-well shadow-clay-inset"
          }`}
          style={active ? clayButtonStyle(primaryColor) : undefined}
        >
          <span aria-hidden="true">{option.emoji}</span>
          {option.label}
        </button>
      );
    })}
  </div>
);

// ילדים מתחת לגיל 5 מגיעים אבל אינם מנה בתשלום. אין להם מונה נפרד: הם
// נוספים בכפתור "הוסף אורח" כמו כל אורח, עם העדפת התזונה "ילדים מתחת לגיל 5
// (ללא מנה)" (UNDER_5_DIETARY). ה-DB גוזר מזה את הספירה — ראו lib/dietary.js.

// השלב היחיד של הזרימה העצמאית לפני השליחה: טופס אחד עם כל בני החבורה.
const RSVP_STEP_FORM = 1;
const RSVP_STEP_DUPLICATES = 3;
const RSVP_STEP_SUCCESS = 4;
// מסך האישור אחרי "שמור" בקישור קסם.
const RSVP_STEP_MAGIC_DONE = 5;

// תואם לתקרה של rsvp_self_register (עד 20 שורות לחבורה).
const MAX_PARTY = 20;

const newGuestDraft = (key) => ({ key, name: "", dietary: DEFAULT_DIETARY });

const ADD_GUEST_BUTTON =
  "w-full min-h-12 rounded-full flex items-center justify-center gap-2 font-bold text-slate-600 bg-clay-chip shadow-clay-md active:shadow-clay-pressed transition-all disabled:opacity-40";

// כפתורי פעולה משותפים (Moved outside to prevent re-mounting)
const ActionButtons = ({
  theme,
  active_modules,
  location,
  id,
  primaryColor,
  setShowRsvp,
  setRsvpStep,
  initialRsvpStep = 1,
  navigate,
}) => {
  const isLight = theme === "light";
  return (
    <div
      className="fade-up-item mt-8 pt-8 border-t border-opacity-20 space-y-4 relative z-20"
      style={{ borderColor: isLight ? "#00000022" : "#ffffff22" }}
    >
      {active_modules?.rsvp !== false && (
        <button
          onClick={() => {
            setShowRsvp(true);
            setRsvpStep(initialRsvpStep);
          }}
          className="w-full flex items-center justify-center gap-3 text-white font-black py-4 rounded-full text-lg active:scale-[0.97] transition-transform"
          style={clayButtonStyle(primaryColor)}
        >
          <CheckCircle2 size={24} /> אישור הגעה (RSVP)
        </button>
      )}
      <div className="flex flex-col md:flex-row gap-3">
        {location && (
          <a
            href={`https://waze.com/ul?q=${encodeURIComponent(location)}&navigate=yes`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 flex items-center justify-center gap-2 font-bold py-4 rounded-full text-sm transition-all active:scale-95 text-clay-ink ${CLAY_RAISED} active:shadow-clay-pressed`}
            title={`ניווט אל: ${location}`}
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
              style={clayButtonStyle(DEFAULT_PRIMARY)}
            >
              <Navigation size={15} />
            </span>
            נווט לאירוע
          </a>
        )}
        {active_modules?.rideshare && (
          <button
            onClick={() => navigate(`/rideshare?event=${id}`)}
            className={`flex-1 flex items-center justify-center gap-2 font-bold py-4 rounded-full text-sm transition-all active:scale-95 text-clay-ink ${CLAY_RAISED} active:shadow-clay-pressed`}
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
              style={clayButtonStyle("#cf9a8c")}
            >
              <Car size={15} />
            </span>
            לוח טרמפים
          </button>
        )}
      </div>
    </div>
  );
};

const Invite = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [eventData, setEventData] = useState(null);
  useEventBackdrop(eventData?.design_config?.colors?.background);
  const [loading, setLoading] = useState(true);

  // ----------------------------------------
  // RSVP States (Multi-step Form)
  // ----------------------------------------
  const [showRsvp, setShowRsvp] = useState(false);
  const [rsvpStep, setRsvpStep] = useState(1);
  // אדם אחד = שורה אחת = העדפת תזונה אחת. הראשון ברשימה הוא הנרשם עצמו,
  // והשאר נוספים בכפתור "הוסף אורח". לכל אורח key יציב (ולא האינדקס), כדי
  // שהסרת אורח מאמצע הרשימה לא תעביר את מה שהוקלד אצל השכן לכרטיס אחר.
  const guestKeyRef = useRef(1);
  const [guests, setGuests] = useState(() => [newGuestDraft(0)]);
  // הערה אחת לכל החבורה — נשמרת על השורה של הנרשם הראשי.
  const [rsvpNotes, setRsvpNotes] = useState("");
  const [submitterPhone, setSubmitterPhone] = useState("");
  const [duplicateWarnings, setDuplicateWarnings] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ----------------------------------------
  // Magic link: /invite/:id?guest_id=<uuid>
  // ----------------------------------------
  const magicGuestId = searchParams.get("guest_id");
  const magicStatusHint = searchParams.get("status");
  const [magicGuest, setMagicGuest] = useState(null);
  // שאר בני החבורה — שורות אמיתיות ב-event_guests שחולקות את אותו טלפון.
  const [magicCompanions, setMagicCompanions] = useState([]);
  const [newCompanionName, setNewCompanionName] = useState("");
  const [newCompanionDietary, setNewCompanionDietary] =
    useState(DEFAULT_DIETARY);
  // טופס המשנה של "הוסף אורח" — נפתח בלחיצה ונסגר אחרי שמירה או ביטול.
  const [companionDraftOpen, setCompanionDraftOpen] = useState(false);
  const [companionBusy, setCompanionBusy] = useState(false);
  const [magicNotes, setMagicNotes] = useState("");
  const [magicDietary, setMagicDietary] = useState(DEFAULT_DIETARY);
  const [magicSaving, setMagicSaving] = useState(false);

  // Refs לאנימציות רקע
  const bgDecor1 = useRef(null);
  const bgDecor2 = useRef(null);

  // Lock background scroll while the RSVP sheet is open. No onClose on
  // purpose: Escape must not dismiss the form, saving is the only way out.
  useModalBehavior({ open: showRsvp });

  useEffect(() => {
    let isMounted = true;
    const fetchEvent = async () => {
      try {
        const { data, error } = await supabase
          .from("events")
          // רק מה שהדף מציג — בלי owner_id/short_code שאין לאורח סיבה לקבל.
          .select(
            "id, name, event_date, location, design_config, active_modules",
          )
          .eq("id", id)
          .single();
        if (error) throw error;
        if (isMounted) setEventData(data);
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (id) fetchEvent();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // זיהוי אורח מקישור קסם. anon לא יכול לקרוא את event_guests ישירות (אין לו
  // policy), ולכן הקריאה עוברת דרך ה-RPC rsvp_guest_lookup — read-only, כך
  // שנחיתה על הדף לא יוצרת תשובה ולא מזיזה responded_at.
  useEffect(() => {
    if (!magicGuestId || !isValidUUIDv4(magicGuestId)) return;
    let isMounted = true;

    (async () => {
      try {
        // rsvp_guest_group מחזיר את כל בני החבורה (אותו טלפון), כי כל אדם
        // הוא שורה נפרדת עם ההעדפה שלו. is_self מסמן את מי שהקישור שייך לו.
        const { data, error } = await supabase.rpc("rsvp_guest_group", {
          p_guest_id: magicGuestId,
        });
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        const row = rows.find((entry) => entry.is_self) || rows[0];
        // מזהה לא מוכר, או אורח ששייך לאירוע אחר — נפילה שקטה לזרימה העצמאית
        // במקום לפנות לאדם הלא נכון בשמו.
        if (!isMounted || !row || row.event_id !== id) return;

        // ההודעה בוואטסאפ מבטיחה "לאישור / לביטול" בלחיצה אחת, ולכן status
        // שמגיע ב-URL מוחל מיד. הקישור הקצר (/r/<code>?s=1) מגיע לכאן דרך
        // RsvpLink.jsx, שמתרגם אותו לפרמטרים האלה.
        //
        // אישור דרך קישור קסם מאפס את guests_count של השורה ל-1 (ראו
        // MAGIC_CONFIRMED_COUNT). לכן קישור "לאישור" מוחל גם כשהסטטוס כבר
        // confirmed אבל המונה עדיין גדול מ-1 — למשל מוזמן שיובא עם כמות 2
        // וסומן כמאושר ידנית על ידי המנהל.
        const confirming = magicStatusHint === "confirmed";
        let finalRow = row;
        if (
          MAGIC_STATUSES.includes(magicStatusHint) &&
          (row.status !== magicStatusHint ||
            (confirming && row.guests_count !== MAGIC_CONFIRMED_COUNT))
        ) {
          const { data: applied, error: applyError } = await supabase.rpc(
            "rsvp_respond",
            {
              p_guest_id: magicGuestId,
              p_status: magicStatusHint,
              p_guests_count: confirming ? MAGIC_CONFIRMED_COUNT : null,
              p_notes: null,
              p_dietary: null,
            },
          );
          if (!isMounted) return;
          if (!applyError) {
            finalRow = (Array.isArray(applied) ? applied[0] : applied) || row;
          }
        }

        setMagicGuest(finalRow);
        setMagicNotes(finalRow.notes ?? "");
        setMagicDietary(finalRow.dietary ?? DEFAULT_DIETARY);
        setMagicCompanions(rows.filter((entry) => !entry.is_self));
        setShowRsvp(true);
        setRsvpStep(RSVP_STEP_GUEST);
      } catch (error) {
        console.error(error);
        // גם כאן: שקט, והזרימה העצמאית נשארת זמינה.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [magicGuestId, magicStatusHint, id]);

  // --- קסם האנימציות של GSAP ---
  useEffect(() => {
    if (loading || !eventData) return;

    const template = eventData.design_config?.invite_template || "modern";
    // Collect every tween so the infinite (repeat: -1) background loops are
    // killed on unmount / template change instead of running forever.
    const tweens = [];

    // אנימציית כניסה משותפת לכל התבניות (Fade Up Stagger)
    tweens.push(
      gsap.fromTo(
        ".fade-up-item",
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.1,
          ease: "power3.out",
          delay: 0.1,
        },
      ),
    );

    // אנימציות רקע ייחודיות לכל תבנית
    if (template === "modern") {
      tweens.push(
        gsap.to([bgDecor1.current, bgDecor2.current], {
          x: "random(-60, 60)",
          y: "random(-60, 60)",
          scale: "random(0.8, 1.2)",
          duration: "random(4, 8)",
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        }),
      );
    } else if (template === "elegant") {
      tweens.push(
        gsap.to(".elegant-particle", {
          y: "random(-80, 80)",
          x: "random(-40, 40)",
          scale: "random(0.6, 1.4)",
          opacity: "random(0.1, 0.4)",
          duration: "random(4, 9)",
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: { amount: 2, from: "random" },
        }),
        gsap.to(".pulse-ring", {
          scale: 1.05,
          opacity: 0.4,
          duration: 2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        }),
      );
    } else if (template === "corporate") {
      tweens.push(
        gsap.to(bgDecor1.current, {
          rotation: 360,
          duration: 60,
          repeat: -1,
          ease: "linear",
        }),
      );
    }

    return () => tweens.forEach((t) => t.kill());
  }, [loading, eventData]);

  useEffect(() => {
    if (showRsvp)
      gsap.fromTo(
        ".step-anim",
        { opacity: 0, x: 20 },
        { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" },
      );
  }, [rsvpStep, showRsvp]);

  // מסלול קישור הקסם: כל שמירה עוברת ב-RPC אחד שמעדכן את השורה הקיימת
  // ב-event_guests. שדות שלא נשלחים נשארים כפי שהם (coalesce ב-RPC), ולכן
  // עדכון כמות לא דורס תזונה ולהפך.
  const saveMagicResponse = async (overrides = {}) => {
    if (!magicGuest) return null;
    const status = overrides.status ?? magicGuest.status;
    const payload = {
      status,
      // שורה מאושרת היא תמיד אדם אחד (MAGIC_CONFIRMED_COUNT). בביטול נשלח
      // null, שמשאיר את הערך הקיים (coalesce ב-RPC): שורה מבוטלת לא נספרת
      // במנות, ואין סיבה למחוק את הכמות שהמנהל הזין בייבוא.
      count: status === "confirmed" ? MAGIC_CONFIRMED_COUNT : null,
      notes: overrides.notes ?? magicNotes,
      dietary: overrides.dietary ?? magicDietary,
    };
    setMagicSaving(true);
    try {
      const { data, error } = await supabase.rpc("rsvp_respond", {
        p_guest_id: magicGuestId,
        p_status: payload.status,
        p_guests_count: payload.count,
        p_notes: payload.notes || null,
        p_dietary: payload.dietary,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) || null;
      if (row) {
        setMagicGuest(row);
        setMagicNotes(row.notes ?? "");
        setMagicDietary(row.dietary ?? DEFAULT_DIETARY);
      }
      return row;
    } catch (err) {
      console.error("Magic RSVP error:", err);
      showToast("שגיאה בשמירת אישור ההגעה", "error");
      return null;
    } finally {
      setMagicSaving(false);
    }
  };

  const changeMagicDietary = async (value) => {
    const previous = magicDietary;
    setMagicDietary(value); // אופטימי
    const row = await saveMagicResponse({ dietary: value });
    if (!row) setMagicDietary(previous);
  };

  // הגדלת החבורה מוסיפה שורה אמיתית ולא מגדילה מונה: לאדם החדש יש שם משלו
  // והעדפת תזונה משלו. השורה הראשית נשארת guests_count = 1.
  const addCompanion = async () => {
    const name = newCompanionName.trim();
    if (!name) {
      showToast("אנא הזינו שם", "warning");
      return false;
    }
    // רשת ביטחון: אם השורה הראשית עדיין נושאת כמות גדולה מ-1 (נחיתה בלי
    // status על שורה שכבר אושרה), מאפסים אותה לפני שנוספת שורה לבן לוויה —
    // אחרת אותו אדם נספר פעמיים, פעם במונה ופעם בשמו.
    if ((magicGuest?.guests_count ?? 1) !== MAGIC_CONFIRMED_COUNT) {
      const row = await saveMagicResponse();
      if (!row) return false;
    }
    setCompanionBusy(true);
    try {
      const { data, error } = await supabase.rpc("rsvp_add_companion", {
        p_primary_guest_id: magicGuestId,
        p_guest_name: name,
        p_dietary: newCompanionDietary,
      });
      if (error) throw error;
      setMagicCompanions((prev) => [
        ...prev,
        {
          id: data,
          guest_name: name,
          dietary: newCompanionDietary,
          status: magicGuest?.status ?? "confirmed",
          guests_count: 1,
          is_self: false,
        },
      ]);
      setNewCompanionName("");
      setNewCompanionDietary(DEFAULT_DIETARY);
      setCompanionDraftOpen(false);
      return true;
    } catch (err) {
      console.error("add companion:", err);
      showToast(RSVP_ERROR_COPY[rsvpErrorCode(err)], "error");
      return false;
    } finally {
      setCompanionBusy(false);
    }
  };

  const removeCompanion = async (companionId) => {
    setCompanionBusy(true);
    const previous = magicCompanions;
    setMagicCompanions((prev) => prev.filter((c) => c.id !== companionId));
    try {
      const { error } = await supabase.rpc("rsvp_remove_companion", {
        p_primary_guest_id: magicGuestId,
        p_companion_id: companionId,
      });
      if (error) throw error;
    } catch (err) {
      console.error("remove companion:", err);
      showToast("לא הצלחנו להסיר את האורח", "error");
      setMagicCompanions(previous); // החזרה למצב הקודם
    } finally {
      setCompanionBusy(false);
    }
  };

  // כל בן חבורה הוא שורה עצמאית, ולכן ההעדפה שלו נשמרת דרך rsvp_respond
  // על ה-id שלו — לא על השורה הראשית.
  const changeCompanionDietary = async (companion, value) => {
    const previous = companion.dietary;
    setMagicCompanions((prev) =>
      prev.map((c) => (c.id === companion.id ? { ...c, dietary: value } : c)),
    );
    const { error } = await supabase.rpc("rsvp_respond", {
      p_guest_id: companion.id,
      p_status: companion.status ?? "confirmed",
      p_guests_count: null,
      p_notes: null,
      p_dietary: value,
    });
    if (error) {
      console.error(error);
      showToast("העדפת התזונה לא נשמרה", "error");
      setMagicCompanions((prev) =>
        prev.map((c) =>
          c.id === companion.id ? { ...c, dietary: previous } : c,
        ),
      );
    }
  };

  // "שמור": הבחירות עצמן כבר נשמרות תוך כדי (סטטוס, תזונה, אורחים), כך
  // שסגירת הדף בלי ללחוץ לא מאבדת כלום. הכפתור שומר את מה שעוד פתוח — הערה
  // שלא יצאו ממנה, אורח שהוקלד ולא נשמר — ומציג אישור ברור שהתשובה התקבלה.
  //
  // הכפתור לא מושבת בזמן שמירה אוטומטית אחרת (magicSaving), ומבנה התוכן שלו
  // לא מתחלף לספינר: יציאה משדה ההערות מפעילה שמירה ברגע הלחיצה (mousedown),
  // וכפתור שהופך ל-disabled או שהאלמנט שנלחץ נעלם ממנו לפני ה-mouseup בולע
  // את הלחיצה — האורח היה לוחץ "שמור" ושום דבר לא קרה. כפילות נמנעת ב-ref.
  const magicSaveInFlight = useRef(false);
  const handleMagicSave = async () => {
    if (!MAGIC_STATUSES.includes(magicGuest?.status)) return;
    if (magicSaveInFlight.current) return;
    magicSaveInFlight.current = true;
    try {
      await runMagicSave();
    } finally {
      magicSaveInFlight.current = false;
    }
  };

  const runMagicSave = async () => {
    if (
      magicGuest.status === "confirmed" &&
      companionDraftOpen &&
      newCompanionName.trim()
    ) {
      const added = await addCompanion();
      if (!added) return;
    }
    const row = await saveMagicResponse();
    if (row) setRsvpStep(RSVP_STEP_MAGIC_DONE);
  };

  const closeCompanionDraft = () => {
    setCompanionDraftOpen(false);
    setNewCompanionName("");
    setNewCompanionDietary(DEFAULT_DIETARY);
  };

  const addGuest = () =>
    setGuests((prev) =>
      prev.length >= MAX_PARTY
        ? prev
        : [...prev, newGuestDraft(guestKeyRef.current++)],
    );

  // הנרשם עצמו (הראשון) אינו ניתן להסרה — בלעדיו אין למי לשייך את ההרשמה.
  const removeGuest = (key) =>
    setGuests((prev) =>
      prev.filter((guest, index) => index === 0 || guest.key !== key),
    );

  const updateGuest = (key, patch) =>
    setGuests((prev) =>
      prev.map((guest) => (guest.key === key ? { ...guest, ...patch } : guest)),
    );

  // ההרשמה כולה עוברת ב-RPC: ל-anon אין policy על event_guests ולכן הוא לא
  // יכול לקרוא או לכתוב אותה ישירות. שתי הפונקציות security definer מגבילות
  // אותו בדיוק לשתי הפעולות האלה.
  const handleVerifyBeforeSubmit = async (e) => {
    e.preventDefault();
    if (guests.some((guest) => !guest.name.trim()) || !submitterPhone.trim()) {
      showToast("אנא מלאו את כל השמות ואת מספר הטלפון", "warning");
      return;
    }
    if (!PHONE_PATTERN.test(submitterPhone.trim())) {
      showToast("מספר הטלפון אינו תקין", "warning");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("rsvp_check_duplicates", {
        p_event_id: id,
        p_names: guests.map((guest) => guest.name.trim()),
      });
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        setDuplicateWarnings(data);
        setRsvpStep(RSVP_STEP_DUPLICATES);
      } else {
        await executeSubmit();
      }
    } catch (err) {
      console.error(err);
      showToast("תקלה בבדיקת הנתונים", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // אדם אחד = שורה אחת = העדפת תזונה אחת. ה-RPC מקבל מערך מסודר ומכניס שורה
  // לכל אדם, כולן עם אותו טלפון — הטלפון הוא מפתח הקיבוץ בצד המנהל.
  const executeSubmit = async () => {
    setIsSubmitting(true);
    try {
      const party = guests
        .map((guest) => ({ name: guest.name.trim(), dietary: guest.dietary }))
        .filter((guest) => guest.name);

      const { error } = await supabase.rpc("rsvp_self_register", {
        p_event_id: id,
        p_phone: submitterPhone.trim(),
        p_guests: party,
        p_notes: rsvpNotes.trim() || null,
      });
      if (error) throw error;

      setRsvpStep(RSVP_STEP_SUCCESS);
      setTimeout(() => {
        setShowRsvp(false);
        setRsvpStep(RSVP_STEP_FORM);
        guestKeyRef.current = 1;
        setGuests([newGuestDraft(0)]);
        setRsvpNotes("");
        setSubmitterPhone("");
      }, 4000);
    } catch (err) {
      console.error("Submit Error:", err);
      showToast(RSVP_ERROR_COPY[rsvpErrorCode(err)], "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-clay-gradient">
        <Loader2 className="animate-spin text-clay-muted" size={48} />
      </div>
    );
  if (!eventData)
    return (
      <div className="min-h-screen flex items-center justify-center text-clay-muted text-xl font-bold bg-clay-gradient">
        ההזמנה לא נמצאה :(
      </div>
    );

  const { name, event_date, location, design_config, active_modules } =
    eventData;
  const primaryColor = design_config?.colors?.primary || DEFAULT_PRIMARY;
  const template = design_config?.invite_template || "modern";
  const inviteImage = design_config?.invite_image;

  const renderTemplate = () => {
    if (template === "elegant") {
      return (
        <div
          className="min-h-screen flex flex-col items-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center relative overflow-hidden bg-clay-gradient"
          dir="rtl"
        >
          {/* אנימציית רקע - חלקיקים מרחפים */}
          <div className="absolute inset-0 pointer-events-none z-0">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="elegant-particle absolute rounded-full opacity-20 blur-[2px]"
                style={{
                  backgroundColor: primaryColor,
                  // גדלים קבועים: Math.random() בזמן רינדור הגריל גודל חדש
                  // בכל רינדור (כל הקלדה בטופס ה-RSVP) והחלקיקים "קפצו".
                  width: `${PARTICLE_SIZES[i]}px`,
                  height: `${PARTICLE_SIZES[i]}px`,
                  top: `${[10, 20, 70, 80, 40, 60][i]}%`,
                  left: `${[10, 80, 20, 90, 50, 70][i]}%`,
                }}
              ></div>
            ))}
          </div>

          <div className="w-full max-w-md mx-auto pt-8 pb-20 relative z-10">
            <h1
              className="fade-up-item text-4xl md:text-5xl font-serif font-bold mb-2"
              style={{ color: accentOn(primaryColor) }}
            >
              {name}
            </h1>
            <p className="fade-up-item text-clay-muted font-medium uppercase tracking-widest text-sm mb-10">
              מתרגשים להזמין אתכם
            </p>
            <div className="fade-up-item relative w-64 h-64 mx-auto mb-12">
              <div
                className="pulse-ring absolute inset-[-8px] rounded-full opacity-20"
                style={{ backgroundColor: primaryColor }}
              ></div>
              <div
                className="absolute inset-0 rounded-full border-[6px]"
                style={{ borderColor: primaryColor }}
              ></div>
              {inviteImage ? (
                <img
                  src={inviteImage}
                  className="w-full h-full object-cover rounded-full p-1 relative z-10 bg-clay-page shadow-clay"
                  alt="Event Cover"
                />
              ) : (
                <div className="w-full h-full rounded-full flex items-center justify-center p-1 relative z-10 bg-clay-well shadow-clay-inset-deep">
                  <CalendarHeart size={48} className="text-slate-300" />
                </div>
              )}
            </div>
            <InviteCountdown
              eventDate={event_date}
              variant="elegant"
              primaryColor={primaryColor}
            />
            <p
              className={`fade-up-item text-clay-muted font-medium ${
                location ? "mb-2" : "mb-8"
              }`}
            >
              ב- {new Date(event_date).toLocaleDateString("he-IL")}
            </p>
            <LocationLine
              location={location}
              primaryColor={primaryColor}
              className="fade-up-item mb-8"
            />
            <ActionButtons
              theme="light"
              active_modules={active_modules}
              id={id}
              location={location}
              primaryColor={primaryColor}
              setShowRsvp={setShowRsvp}
              setRsvpStep={setRsvpStep}
              initialRsvpStep={magicGuest ? RSVP_STEP_GUEST : 1}
              navigate={navigate}
            />
          </div>
        </div>
      );
    }

    if (template === "corporate") {
      return (
        <div
          className="min-h-screen flex flex-col items-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center relative overflow-hidden bg-clay-gradient"
          dir="rtl"
        >
          <div
            ref={bgDecor1}
            className="absolute -top-40 -left-40 w-96 h-96 rounded-[40%] opacity-5 pointer-events-none"
            style={{ border: `10px solid ${primaryColor}` }}
          ></div>
          <div className="w-full max-w-md mx-auto mt-12 relative z-10 pb-20">
            <div className="fade-up-item h-24 flex items-center justify-center mb-8">
              {inviteImage ? (
                <img
                  src={inviteImage}
                  className="max-h-full max-w-full object-contain"
                  alt="Company Logo"
                />
              ) : (
                <div className="w-16 h-16 rounded-clay-field flex items-center justify-center bg-clay-well shadow-clay-inset-deep">
                  <Briefcase className="text-clay-muted" size={32} />
                </div>
              )}
            </div>
            <div
              className={`fade-up-item rounded-t-[2.25rem] pt-8 pb-16 px-6 ${CLAY_RAISED}`}
              style={{ borderTop: `4px solid ${primaryColor}` }}
            >
              <p className="text-clay-muted text-sm font-bold uppercase tracking-widest mb-2">
                Countdown Until
              </p>
              <h1 className="text-3xl font-black text-slate-800 mb-2">
                {name}
              </h1>
              <p className="text-clay-muted font-medium text-sm flex justify-center items-center gap-2">
                <Clock size={16} />{" "}
                {new Date(event_date).toLocaleDateString("he-IL")}
              </p>
              <LocationLine
                location={location}
                primaryColor={primaryColor}
                size="sm"
                className="mt-2"
              />
            </div>
            <div
              className="fade-up-item rounded-[2rem] -mt-8 mx-4 p-6 relative z-20"
              style={{
                ...clayHeroStyle(primaryColor),
                boxShadow:
                  "9px 9px 24px rgba(0,0,0,0.16), -7px -7px 18px rgba(255,255,255,0.55), inset 2px 2px 5px rgba(255,255,255,0.25), inset -2px -2px 5px rgba(0,0,0,0.12)",
              }}
            >
              <InviteCountdown
                eventDate={event_date}
                variant="corporate"
                primaryColor={primaryColor}
              />
            </div>
            <div
              className={`fade-up-item mt-8 p-6 rounded-clay relative z-30 ${CLAY_RAISED}`}
            >
              <ActionButtons
                theme="light"
                active_modules={active_modules}
                id={id}
                location={location}
                primaryColor={primaryColor}
                setShowRsvp={setShowRsvp}
                setRsvpStep={setRsvpStep}
                initialRsvpStep={magicGuest ? RSVP_STEP_GUEST : 1}
                navigate={navigate}
              />
            </div>
          </div>
        </div>
      );
    }

    // --- תבנית מודרנית / מסיבה ---
    // המשטח החימר קבוע ובהיר; הצבע הדינמי של האירוע נשמר לאלמנטים
    const headerTextColor = "text-slate-700";
    const subTextColor = "text-clay-muted";

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] relative overflow-hidden text-center bg-clay-gradient"
        dir="rtl"
      >
        {/* Blobs חיים וזזים - משתמשים בצבע ה-Primary (עדינים על משטח החימר) */}
        <div
          ref={bgDecor1}
          className="absolute top-[-10%] left-[-10%] w-96 h-96 blur-[120px] rounded-full pointer-events-none opacity-20"
          style={{ backgroundColor: primaryColor }}
        ></div>
        <div
          ref={bgDecor2}
          className="absolute bottom-[-10%] right-[-10%] w-80 h-80 blur-[100px] rounded-full pointer-events-none opacity-15"
          style={{ backgroundColor: primaryColor }}
        ></div>

        <div className="relative z-10 w-full max-w-lg mx-auto pb-20">
          <div className="fade-up-item mx-auto w-[132px] h-[132px] rounded-full flex items-center justify-center mb-8 bg-clay-page shadow-clay">
            {inviteImage ? (
              <img
                src={inviteImage}
                className="w-[104px] h-[104px] object-cover rounded-full shadow-[inset_4px_4px_9px_rgba(0,0,0,0.12)]"
                alt="Event Cover"
              />
            ) : (
              <div
                className="w-[104px] h-[104px] rounded-full flex items-center justify-center shadow-[inset_4px_4px_9px_rgba(0,0,0,0.12),inset_-4px_-4px_9px_rgba(255,255,255,0.35)]"
                style={clayHeroStyle(primaryColor)}
              >
                <PartyPopper size={40} />
              </div>
            )}
          </div>

          <div
            className={`fade-up-item mb-2 font-bold tracking-widest uppercase text-sm`}
            style={{ color: accentOn(primaryColor) }}
          >
            Save The Date
          </div>
          <h1
            className={`fade-up-item text-5xl md:text-6xl font-black ${headerTextColor} mb-6 leading-tight`}
          >
            {name}
          </h1>
          <p
            className={`fade-up-item text-xl ${subTextColor} ${
              location ? "mb-3" : "mb-12"
            } font-medium flex items-center justify-center gap-2`}
          >
            <Clock size={20} />{" "}
            {new Date(event_date).toLocaleDateString("he-IL")}
          </p>
          <LocationLine
            location={location}
            primaryColor={primaryColor}
            className="fade-up-item mb-12"
          />

          <InviteCountdown
            eventDate={event_date}
            variant="modern"
            primaryColor={primaryColor}
          />

          <ActionButtons
            theme="light"
            active_modules={active_modules}
            id={id}
            location={location}
            primaryColor={primaryColor}
            setShowRsvp={setShowRsvp}
            setRsvpStep={setRsvpStep}
            initialRsvpStep={magicGuest ? RSVP_STEP_GUEST : 1}
            navigate={navigate}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      {renderTemplate()}

      {/* פופ-אפ אישורי הגעה רב שלבי */}
      {showRsvp && (
        <div
          className="fixed inset-0 bg-[rgba(74,82,89,0.28)] z-[100] flex items-end md:items-center justify-center pt-[max(1rem,env(safe-area-inset-top))] md:pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="אישור הגעה"
        >
          <div className="bg-clay-sheet w-full max-w-lg md:rounded-clay-lg rounded-t-[38px] p-6 md:p-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-14px_40px_rgba(0,0,0,0.16)] relative max-h-full overflow-y-auto clay-scroll">
            {/* Grab handle */}
            <div className="w-[52px] h-1.5 rounded-full bg-[#cfcabc] mx-auto mb-2 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.12)]" />

            {rsvpStep === RSVP_STEP_GUEST && magicGuest && (
              <div className="step-anim pt-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-clay-well shadow-clay-inset-deep">
                  {magicGuest.status === "canceled" ? (
                    <X size={32} className="text-clay-muted" />
                  ) : (
                    <CheckCircle2
                      size={32}
                      style={{ color: accentOn(primaryColor) }}
                    />
                  )}
                </div>
                <h2
                  className={`text-2xl font-black text-slate-700 text-center ${
                    magicGuest.status === "confirmed" ? "mb-6" : "mb-1"
                  }`}
                >
                  היי {magicGuest.guest_name},
                </h2>
                {magicGuest.status !== "confirmed" && (
                  <p className="text-clay-muted font-medium text-center mb-6 text-sm">
                    {magicGuest.status === "canceled"
                      ? "תודה על העדכון, תחסרו לנו מאוד! ניפגש בשמחות."
                      : "נשמח לדעת אם תגיעו"}
                  </p>
                )}

                <div className="flex gap-3 mb-6">
                  {[
                    { value: "confirmed", label: "מגיע/ה" },
                    { value: "canceled", label: "לא אגיע" },
                  ].map((option) => {
                    const active = magicGuest.status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={magicSaving}
                        onClick={() =>
                          saveMagicResponse({ status: option.value })
                        }
                        className={`flex-1 font-bold py-4 rounded-full transition-all disabled:opacity-50 ${
                          active
                            ? "text-white active:scale-[0.97]"
                            : "text-slate-600 bg-clay-chip shadow-clay-md"
                        }`}
                        style={
                          active ? clayButtonStyle(primaryColor) : undefined
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {magicGuest.status === "confirmed" && (
                  <>
                    {/* ההעדפה שלך — השורה שהקישור שייך לה */}
                    <div className="rounded-clay-field p-4 mb-4 bg-clay-well shadow-clay-inset">
                      <p className="text-xs font-bold text-clay-muted mb-3">
                        העדפת התזונה שלך
                      </p>
                      <DietaryPicker
                        options={
                          magicDietary === UNDER_5_DIETARY
                            ? DIETARY_OPTIONS
                            : PRIMARY_DIETARY_OPTIONS
                        }
                        value={magicDietary}
                        onChange={changeMagicDietary}
                        primaryColor={primaryColor}
                        disabled={magicSaving}
                        compact
                      />
                    </div>

                    {/* כל מי שמגיע איתך הוא שורה נפרדת עם העדפה משלו */}
                    <div className="rounded-clay-field p-4 mb-4 bg-clay-well shadow-clay-inset">
                      <p className="text-xs font-bold text-clay-muted mb-3">
                        מי מגיע איתך?
                      </p>

                      <div className="space-y-3">
                        {magicCompanions.map((companion) => (
                          <div
                            key={companion.id}
                            className="rounded-[1.2rem] bg-clay-surface p-3 shadow-[4px_4px_10px_rgba(0,0,0,0.06),-4px_-4px_10px_rgba(255,255,255,0.9)]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-700">
                                {companion.guest_name}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeCompanion(companion.id)}
                                disabled={companionBusy}
                                aria-label={`הסרת ${companion.guest_name}`}
                                className="w-11 h-11 -m-1.5 shrink-0 flex items-center justify-center rounded-full text-clay-muted transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <div className="mt-2">
                              <DietaryPicker
                                value={companion.dietary}
                                onChange={(value) =>
                                  changeCompanionDietary(companion, value)
                                }
                                primaryColor={primaryColor}
                                disabled={companionBusy}
                                compact
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* "הוסף אורח" פותח טופס משנה לאדם אחד: שם + העדפת
                          תזונה. השמירה יוצרת לו שורה משלו באותה חבורה. */}
                      {companionDraftOpen ? (
                        <div className="rsvp-card-in mt-3 rounded-[1.2rem] bg-clay-surface p-3 shadow-clay-inset">
                          <input
                            type="text"
                            autoFocus
                            value={newCompanionName}
                            onChange={(e) =>
                              setNewCompanionName(e.target.value)
                            }
                            maxLength={100}
                            placeholder="שם האורח"
                            aria-label="שם האורח"
                            className={`${CLAY_FIELD} bg-clay-well mb-2`}
                          />
                          <DietaryPicker
                            value={newCompanionDietary}
                            onChange={setNewCompanionDietary}
                            primaryColor={primaryColor}
                            disabled={companionBusy}
                            compact
                          />
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={closeCompanionDraft}
                              disabled={companionBusy}
                              className="flex-1 rounded-full py-3 font-bold text-slate-600 bg-clay-chip shadow-clay-md active:shadow-clay-pressed transition-all disabled:opacity-40"
                            >
                              ביטול
                            </button>
                            <button
                              type="button"
                              onClick={addCompanion}
                              disabled={
                                companionBusy || !newCompanionName.trim()
                              }
                              className="flex-1 rounded-full py-3 font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40"
                              style={clayButtonStyle(primaryColor)}
                            >
                              {companionBusy ? "שומר..." : "שמירה"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        magicCompanions.length + 1 < MAX_PARTY && (
                          <button
                            type="button"
                            onClick={() => setCompanionDraftOpen(true)}
                            disabled={companionBusy}
                            className={`${ADD_GUEST_BUTTON} mt-3`}
                          >
                            <UserPlus size={18} /> הוסף אורח
                          </button>
                        )
                      )}
                    </div>

                    {/* הערה כללית אחת לכל החבורה — תמיד אחרונה בטופס */}
                    <label
                      htmlFor="magic-notes"
                      className="block text-xs font-bold text-clay-muted pr-2 mb-1"
                    >
                      הערות כלליות (לכל החבורה)
                    </label>
                    <textarea
                      id="magic-notes"
                      value={magicNotes}
                      onChange={(e) => setMagicNotes(e.target.value)}
                      onBlur={() => {
                        if ((magicGuest.notes ?? "") !== magicNotes) {
                          saveMagicResponse({ notes: magicNotes });
                        }
                      }}
                      maxLength={500}
                      rows={2}
                      placeholder="הערות (אלרגיות, הסעה...)"
                      className={`${CLAY_FIELD} resize-none mb-2`}
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={handleMagicSave}
                  disabled={!MAGIC_STATUSES.includes(magicGuest.status)}
                  aria-busy={magicSaving || companionBusy}
                  className="mt-4 w-full text-white font-black text-lg py-4 rounded-full flex justify-center items-center gap-2 active:scale-[0.97] transition-all disabled:opacity-50"
                  style={clayButtonStyle(primaryColor)}
                >
                  {/* שני האייקונים תמיד ב-DOM ורק מוחלפים בנראות — ראו
                      handleMagicSave למה התוכן לא מתחלף. */}
                  <Loader2
                    aria-hidden="true"
                    className={`animate-spin ${magicSaving || companionBusy ? "" : "hidden"}`}
                    size={20}
                  />
                  <Save
                    aria-hidden="true"
                    className={magicSaving || companionBusy ? "hidden" : ""}
                    size={20}
                  />
                  שמור
                </button>
                {!MAGIC_STATUSES.includes(magicGuest.status) && (
                  <p className="mt-2 text-center text-xs font-bold text-clay-muted">
                    בחרו "מגיע/ה" או "לא אגיע" כדי לשמור
                  </p>
                )}
              </div>
            )}

            {rsvpStep === RSVP_STEP_MAGIC_DONE && magicGuest && (
              <div className="step-anim py-10 text-center" role="status">
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-clay-well shadow-clay-inset-deep">
                  {magicGuest.status === "confirmed" ? (
                    <CheckCircle2 size={48} className="text-[#7d9a86]" />
                  ) : (
                    <CalendarHeart
                      size={44}
                      style={{ color: accentOn(primaryColor) }}
                    />
                  )}
                </div>
                <h2 className="text-3xl font-black text-slate-700 mb-2">
                  {magicGuest.status === "confirmed"
                    ? "נתראה בחתונה!"
                    : "לא נורא, נתראה בשמחות"}
                </h2>
                <p className="text-clay-muted font-medium mb-8">
                  התשובה נשמרה. אפשר לעדכן אותה בכל שלב דרך אותו קישור.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRsvpStep(RSVP_STEP_GUEST)}
                    className="flex-1 text-slate-600 font-bold py-4 rounded-full transition-all bg-clay-chip shadow-clay-md active:shadow-clay-pressed"
                  >
                    עריכה
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRsvp(false)}
                    className="flex-1 text-white font-bold py-4 rounded-full transition-all active:scale-[0.97]"
                    style={clayButtonStyle(primaryColor)}
                  >
                    סגירה
                  </button>
                </div>
              </div>
            )}

            {rsvpStep === RSVP_STEP_FORM && (
              <form
                onSubmit={handleVerifyBeforeSubmit}
                className="step-anim pt-4"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-clay-well shadow-clay-inset-deep">
                  <Users size={32} style={{ color: accentOn(primaryColor) }} />
                </div>
                <h2 className="text-2xl font-black text-slate-700 mb-2 text-center">
                  אישור הגעה
                </h2>
                <p className="text-clay-muted font-medium text-center mb-6 text-sm">
                  נשמח לדעת מי מגיע
                </p>

                <div className="space-y-4 mb-8">
                  <div className="space-y-1">
                    <label
                      htmlFor="rsvp-phone"
                      className="text-xs font-bold text-clay-muted pr-2"
                    >
                      טלפון
                    </label>
                    <input
                      id="rsvp-phone"
                      type="tel"
                      required
                      placeholder="050-0000000"
                      dir="ltr"
                      value={submitterPhone}
                      onChange={(e) => setSubmitterPhone(e.target.value)}
                      className={`${CLAY_FIELD} text-left`}
                    />
                  </div>

                  {/* כרטיס לכל אדם: שם + העדפת תזונה. הראשון הוא הנרשם עצמו;
                      כל לחיצה על "הוסף אורח" מוסיפה כרטיס נוסף — גם לתינוק,
                      שנבחרת לו ההעדפה "ילדים מתחת לגיל 5 (ללא מנה)". */}
                  <div className="space-y-3">
                    {guests.map((guest, index) => {
                      const title =
                        index === 0 ? "הפרטים שלך" : `אורח נוסף ${index}`;
                      return (
                        <div
                          key={guest.key}
                          className={`rounded-clay-field bg-clay-well p-3 shadow-clay-inset ${
                            index > 0 ? "rsvp-card-in" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2 min-h-8">
                            <span className="text-xs font-bold text-clay-muted pr-1">
                              {title}
                            </span>
                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => removeGuest(guest.key)}
                                aria-label={`הסרת ${guest.name.trim() || title}`}
                                className="w-11 h-11 -m-1.5 shrink-0 flex items-center justify-center rounded-full text-clay-muted transition-colors hover:bg-rose-50 hover:text-rose-700"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            required
                            maxLength={100}
                            // כרטיס שנוסף זה עתה מקבל פוקוס, כדי שאפשר יהיה
                            // להקליד שם מיד אחרי הלחיצה על "הוסף אורח".
                            autoFocus={index > 0}
                            placeholder={index === 0 ? "השם שלך" : "שם האורח"}
                            aria-label={index === 0 ? "השם שלך" : title}
                            value={guest.name}
                            onChange={(e) =>
                              updateGuest(guest.key, { name: e.target.value })
                            }
                            className={`${CLAY_FIELD} bg-clay-surface`}
                          />
                          <div className="mt-3">
                            <DietaryPicker
                              options={
                                index === 0
                                  ? PRIMARY_DIETARY_OPTIONS
                                  : DIETARY_OPTIONS
                              }
                              value={guest.dietary}
                              onChange={(value) =>
                                updateGuest(guest.key, { dietary: value })
                              }
                              primaryColor={primaryColor}
                              compact
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {guests.length < MAX_PARTY && (
                    <button
                      type="button"
                      onClick={addGuest}
                      className={ADD_GUEST_BUTTON}
                    >
                      <UserPlus size={18} /> הוסף אורח
                    </button>
                  )}

                  {/* הערה כללית אחת לכל החבורה — תמיד אחרונה בטופס */}
                  <div className="space-y-1">
                    <label
                      htmlFor="rsvp-notes"
                      className="text-xs font-bold text-clay-muted pr-2"
                    >
                      הערות כלליות (לכל החבורה)
                    </label>
                    <textarea
                      id="rsvp-notes"
                      value={rsvpNotes}
                      onChange={(e) => setRsvpNotes(e.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="אלרגיות, הסעה, כל דבר שחשוב שנדע..."
                      className={`${CLAY_FIELD} resize-none`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full text-white font-bold py-4 rounded-full flex justify-center items-center gap-2 active:scale-[0.97] transition-all disabled:opacity-50"
                  style={clayButtonStyle(primaryColor)}
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <>
                      <Send size={20} /> שלח אישור הגעה
                    </>
                  )}
                </button>
              </form>
            )}

            {rsvpStep === RSVP_STEP_DUPLICATES && (
              <div className="step-anim pt-4 text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-clay-well shadow-clay-inset-deep">
                  <AlertTriangle size={40} className="text-amber-800" />
                </div>
                <h2 className="text-2xl font-black text-slate-700 mb-2">
                  שימו לב!
                </h2>
                <p className="text-slate-600 text-sm font-medium mb-6 leading-snug">
                  המערכת זיהתה שחלק מהשמות שהזנתם כבר אישרו הגעה בעבר:
                </p>
                <div className="rounded-clay-field p-4 mb-8 text-right space-y-2 bg-clay-well shadow-clay-inset">
                  {duplicateWarnings.map((dup, idx) => (
                    <p
                      key={idx}
                      className="text-sm font-bold text-amber-800 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0"></span>
                      השם "{dup.guest_name || ""}" כבר רשום באירוע
                    </p>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRsvpStep(RSVP_STEP_FORM)}
                    className="flex-1 text-slate-600 font-bold py-4 rounded-full transition-all bg-clay-chip shadow-clay-md active:shadow-clay-pressed"
                  >
                    חזור לתיקון
                  </button>
                  <button
                    onClick={executeSubmit}
                    disabled={isSubmitting}
                    className="flex-1 text-white font-bold py-4 rounded-full transition-all active:scale-[0.97] flex justify-center items-center"
                    style={clayButtonStyle(primaryColor)}
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      "המשך בכל זאת"
                    )}
                  </button>
                </div>
              </div>
            )}

            {rsvpStep === RSVP_STEP_SUCCESS && (
              <div className="step-anim py-12 text-center">
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-clay-well shadow-clay-inset-deep">
                  <CheckCircle2 size={48} className="text-[#7d9a86]" />
                </div>
                <h2 className="text-3xl font-black text-slate-700 mb-2">
                  נתראה בחתונה!
                </h2>
                <p className="text-clay-muted font-medium text-lg">
                  אישור ההגעה נקלט בהצלחה.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Invite;
