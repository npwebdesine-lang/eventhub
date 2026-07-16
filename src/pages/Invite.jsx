import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Loader2,
  CalendarHeart,
  Clock,
  Sparkles,
  Car,
  PartyPopper,
  Briefcase,
  CheckCircle2,
  X,
  Send,
  AlertTriangle,
  Users,
  ChevronLeft,
  ChevronRight,
  Navigation,
} from "lucide-react";
import gsap from "gsap";
import { getLuminance } from "../lib/colors";
import { useToast } from "../components/Toast";
import { useModalBehavior } from "../components/Modal";

/* ============================================================
   SOFT-CLAY / NEUMORPHISM DESIGN TOKENS  (Eventick RSVP Clay)
   Page rests on a warm neutral gradient (#eceadf → #e2ddd0).
   Raised surfaces (#f0eee7) pop out with a dual shadow; wells
   (#eeece5 / #e4e0d5) are carved in with inset shadows.
   ------------------------------------------------------------ */
const CLAY_BG = "#eceadf";
const CLAY_PAGE_BG = "linear-gradient(160deg, #eceadf 0%, #e2ddd0 100%)";
const CLAY =
  "bg-[#f0eee7] shadow-[8px_8px_20px_rgba(0,0,0,0.09),-8px_-8px_20px_rgba(255,255,255,0.9)]";
const CLAY_INSET =
  "bg-[#eeece5] shadow-[inset_5px_5px_10px_rgba(0,0,0,0.07),inset_-5px_-5px_10px_rgba(255,255,255,0.85)]";
const clayBtn = (color) => ({
  backgroundColor: color,
  boxShadow: `5px 5px 14px rgba(0,0,0,0.14), -4px -4px 12px rgba(255,255,255,0.7), inset 2px 2px 4px rgba(255,255,255,0.35), inset -2px -2px 4px rgba(0,0,0,0.12)`,
});
const clayFieldCls =
  "w-full p-4 rounded-[1.4rem] outline-none font-bold text-slate-700 placeholder:text-slate-400 bg-[#eeece5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.07),inset_-4px_-4px_9px_rgba(255,255,255,0.85)] focus:shadow-[inset_5px_5px_11px_rgba(0,0,0,0.09),inset_-5px_-5px_11px_rgba(255,255,255,0.9)] transition-all";

// כפתורי פעולה משותפים (Moved outside to prevent re-mounting)
const ActionButtons = ({
  theme,
  active_modules,
  location,
  id,
  primaryColor,
  setShowRsvp,
  setRsvpStep,
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
            setRsvpStep(1);
          }}
          className="w-full flex items-center justify-center gap-3 text-white font-black py-4 rounded-full text-lg active:scale-[0.97] transition-transform"
          style={clayBtn(primaryColor)}
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
            className={`flex-1 flex items-center justify-center gap-2 font-bold py-4 rounded-full text-sm transition-all active:scale-95 text-[#5b6169] ${CLAY} active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)]`}
            title={`ניווט אל: ${location}`}
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
              style={clayBtn("#8fa7b8")}
            >
              <Navigation size={15} />
            </span>
            נווט לאירוע
          </a>
        )}
        {active_modules?.rideshare && (
          <button
            onClick={() => navigate(`/rideshare?event=${id}`)}
            className={`flex-1 flex items-center justify-center gap-2 font-bold py-4 rounded-full text-sm transition-all active:scale-95 text-[#5b6169] ${CLAY} active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)]`}
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
              style={clayBtn("#cf9a8c")}
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
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // ----------------------------------------
  // RSVP States (Multi-step Form)
  // ----------------------------------------
  const [showRsvp, setShowRsvp] = useState(false);
  const [rsvpStep, setRsvpStep] = useState(1);
  const [guestCount, setGuestCount] = useState(1);
  const [guestNames, setGuestNames] = useState([""]);
  const [submitterPhone, setSubmitterPhone] = useState("");
  const [duplicateWarnings, setDuplicateWarnings] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs לאנימציות רקע
  const bgDecor1 = useRef(null);
  const bgDecor2 = useRef(null);

  // Lock background scroll while the RSVP sheet is open; Escape closes it
  // (except on the success step, which auto-dismisses).
  useModalBehavior({
    open: showRsvp,
    onClose: () => {
      if (rsvpStep !== 4) setShowRsvp(false);
    },
  });

  useEffect(() => {
    let isMounted = true;
    const fetchEvent = async () => {
      try {
        const { data, error } = await supabase
          .from("events")
          .select("*")
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

  useEffect(() => {
    if (!eventData?.event_date) return;
    const targetDate = new Date(`${eventData.event_date}T19:00:00`);
    const calculateTimeLeft = () => {
      const difference = +targetDate - +new Date();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [eventData]);

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

  const handleCountNext = () => {
    const newNames = [...guestNames];
    while (newNames.length < guestCount) newNames.push("");
    if (newNames.length > guestCount) newNames.length = guestCount;
    setGuestNames(newNames);
    setRsvpStep(2);
  };

  const handleNameChange = (index, value) => {
    const updatedNames = [...guestNames];
    updatedNames[index] = value;
    setGuestNames(updatedNames);
  };

  const handleVerifyBeforeSubmit = async (e) => {
    e.preventDefault();
    if (guestNames.some((name) => !name.trim()) || !submitterPhone.trim()) {
      showToast("אנא מלאו את כל השמות ואת מספר הטלפון", "warning");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("rsvps")
        .select("guest_name, submitter_name")
        .eq("event_id", id)
        .in(
          "guest_name",
          guestNames.map((n) => n.trim()),
        );
      if (error) throw error;
      if (data && data.length > 0) {
        setDuplicateWarnings(data);
        setRsvpStep(3);
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

  const executeSubmit = async () => {
    setIsSubmitting(true);
    try {
      const groupId = `group_${crypto.randomUUID().split("-")[0]}`;
      const submitterName = guestNames[0].trim();
      const inserts = guestNames.map((name) => ({
        event_id: id,
        group_id: groupId,
        submitter_name: submitterName,
        submitter_phone: submitterPhone,
        guest_name: name.trim(),
      }));

      // מעבר מ-upsert ל-insert רגיל כדי למנוע את שגיאת 400 של ה-Unique Constraint
      const { error } = await supabase.from("rsvps").insert(inserts);

      if (error) throw error;

      setRsvpStep(4);
      setTimeout(() => {
        setShowRsvp(false);
        setRsvpStep(1);
        setGuestCount(1);
        setGuestNames([""]);
        setSubmitterPhone("");
      }, 4000);
    } catch (err) {
      console.error("Submit Error:", err);
      showToast("שגיאה בשמירת אישור ההגעה", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: CLAY_PAGE_BG }}
      >
        <Loader2 className="animate-spin text-slate-400" size={48} />
      </div>
    );
  if (!eventData)
    return (
      <div
        className="min-h-screen flex items-center justify-center text-slate-500 text-xl font-bold"
        style={{ background: CLAY_PAGE_BG }}
      >
        ההזמנה לא נמצאה :(
      </div>
    );

  const { name, event_date, location, design_config, active_modules } =
    eventData;
  const primaryColor = design_config?.colors?.primary || "#8fa7b8";
  const template = design_config?.invite_template || "modern";
  const inviteImage = design_config?.invite_image;

  const isHappeningNow =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  const renderTemplate = () => {
    if (template === "elegant") {
      return (
        <div
          className="min-h-screen flex flex-col items-center p-6 text-center relative overflow-hidden"
          style={{ background: CLAY_PAGE_BG }}
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
                  width: `${Math.random() * 20 + 10}px`,
                  height: `${Math.random() * 20 + 10}px`,
                  top: `${[10, 20, 70, 80, 40, 60][i]}%`,
                  left: `${[10, 80, 20, 90, 50, 70][i]}%`,
                }}
              ></div>
            ))}
          </div>

          <div className="w-full max-w-md mx-auto pt-8 pb-20 relative z-10">
            <h1
              className="fade-up-item text-4xl md:text-5xl font-serif font-bold mb-2"
              style={{ color: primaryColor }}
            >
              {name}
            </h1>
            <p className="fade-up-item text-slate-400 font-medium uppercase tracking-widest text-sm mb-10">
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
                  className="w-full h-full object-cover rounded-full p-1 relative z-10 bg-[#ece9df] shadow-[9px_9px_20px_rgba(0,0,0,0.1),-9px_-9px_20px_rgba(255,255,255,0.9)]"
                  alt="Event Cover"
                />
              ) : (
                <div className="w-full h-full rounded-full flex items-center justify-center p-1 relative z-10 bg-[#eeece5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.85)]">
                  <CalendarHeart size={48} className="text-slate-300" />
                </div>
              )}
            </div>
            {!isHappeningNow ? (
              <div
                className="fade-up-item flex justify-center items-center gap-4 mb-10"
                dir="ltr"
              >
                <div className="flex flex-col items-center">
                  <span
                    className="text-3xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {timeLeft.seconds.toString().padStart(2, "0")}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    שניות
                  </span>
                </div>
                <div className="h-8 w-[1px] bg-slate-200"></div>
                <div className="flex flex-col items-center">
                  <span
                    className="text-3xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {timeLeft.minutes.toString().padStart(2, "0")}
                  </span>
                  <span className="text-xs font-bold text-slate-400">דקות</span>
                </div>
                <div className="h-8 w-[1px] bg-slate-200"></div>
                <div className="flex flex-col items-center">
                  <span
                    className="text-3xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {timeLeft.hours.toString().padStart(2, "0")}
                  </span>
                  <span className="text-xs font-bold text-slate-400">שעות</span>
                </div>
                <div className="h-8 w-[1px] bg-slate-200"></div>
                <div className="flex flex-col items-center">
                  <span
                    className="text-3xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {timeLeft.days.toString().padStart(2, "0")}
                  </span>
                  <span className="text-xs font-bold text-slate-400">ימים</span>
                </div>
              </div>
            ) : (
              <h2
                className="fade-up-item text-3xl font-bold mb-10"
                style={{ color: primaryColor }}
              >
                היום זה קורה!
              </h2>
            )}
            <p className="fade-up-item text-slate-500 font-medium mb-8">
              ב- {new Date(event_date).toLocaleDateString("he-IL")}
            </p>
            <ActionButtons
              theme="light"
              active_modules={active_modules}
              id={id}
              location={location}
              primaryColor={primaryColor}
              setShowRsvp={setShowRsvp}
              setRsvpStep={setRsvpStep}
              navigate={navigate}
            />
          </div>
        </div>
      );
    }

    if (template === "corporate") {
      return (
        <div
          className="min-h-screen flex flex-col items-center p-6 text-center relative overflow-hidden"
          style={{ background: CLAY_PAGE_BG }}
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
                <div className="w-16 h-16 rounded-[1.4rem] flex items-center justify-center bg-[#eeece5] shadow-[inset_3px_3px_7px_rgba(0,0,0,0.09),inset_-3px_-3px_7px_rgba(255,255,255,0.85)]">
                  <Briefcase className="text-slate-400" size={32} />
                </div>
              )}
            </div>
            <div
              className={`fade-up-item rounded-t-[2.25rem] pt-8 pb-16 px-6 ${CLAY}`}
              style={{ borderTop: `4px solid ${primaryColor}` }}
            >
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2">
                Countdown Until
              </p>
              <h1 className="text-3xl font-black text-slate-800 mb-2">
                {name}
              </h1>
              <p className="text-slate-500 font-medium text-sm flex justify-center items-center gap-2">
                <Clock size={16} />{" "}
                {new Date(event_date).toLocaleDateString("he-IL")}
              </p>
            </div>
            <div
              className="fade-up-item rounded-[2rem] -mt-8 mx-4 p-6 relative z-20 text-white"
              style={{
                background: `linear-gradient(145deg, ${primaryColor}, ${primaryColor}cc)`,
                boxShadow:
                  "9px 9px 24px rgba(0,0,0,0.16), -7px -7px 18px rgba(255,255,255,0.55), inset 2px 2px 5px rgba(255,255,255,0.25), inset -2px -2px 5px rgba(0,0,0,0.12)",
              }}
            >
              {!isHappeningNow ? (
                <div className="flex justify-between items-center" dir="ltr">
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-4xl font-black tracking-tight">
                      {timeLeft.days.toString().padStart(2, "0")}
                    </span>
                    <span className="text-[10px] font-bold uppercase opacity-80 mt-1">
                      Days
                    </span>
                  </div>
                  <span className="text-2xl font-bold opacity-50 mb-4">:</span>
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-4xl font-black tracking-tight">
                      {timeLeft.hours.toString().padStart(2, "0")}
                    </span>
                    <span className="text-[10px] font-bold uppercase opacity-80 mt-1">
                      Hours
                    </span>
                  </div>
                  <span className="text-2xl font-bold opacity-50 mb-4">:</span>
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-4xl font-black tracking-tight">
                      {timeLeft.minutes.toString().padStart(2, "0")}
                    </span>
                    <span className="text-[10px] font-bold uppercase opacity-80 mt-1">
                      Min
                    </span>
                  </div>
                  <span className="text-2xl font-bold opacity-50 mb-4">:</span>
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-4xl font-black tracking-tight">
                      {timeLeft.seconds.toString().padStart(2, "0")}
                    </span>
                    <span className="text-[10px] font-bold uppercase opacity-80 mt-1">
                      Sec
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  <h2 className="text-2xl font-black">האירוע מתחיל היום!</h2>
                </div>
              )}
            </div>
            <div
              className={`fade-up-item mt-8 p-6 rounded-[2.25rem] relative z-30 ${CLAY}`}
            >
              <ActionButtons
                theme="light"
                active_modules={active_modules}
                id={id}
                location={location}
                primaryColor={primaryColor}
                setShowRsvp={setShowRsvp}
                setRsvpStep={setRsvpStep}
                navigate={navigate}
              />
            </div>
          </div>
        </div>
      );
    }

    // --- תבנית מודרנית / מסיבה ---
    // המשטח החימר קבוע ובהיר; הצבע הדינמי של האירוע נשמר לאלמנטים
    const isLightBg = getLuminance(CLAY_BG) > 150;
    const headerTextColor = "text-slate-700";
    const subTextColor = "text-slate-500";

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden text-center"
        style={{ background: CLAY_PAGE_BG }}
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
          <div className="fade-up-item mx-auto w-[132px] h-[132px] rounded-full flex items-center justify-center mb-8 bg-[#ece9df] shadow-[9px_9px_20px_rgba(0,0,0,0.1),-9px_-9px_20px_rgba(255,255,255,0.9)]">
            {inviteImage ? (
              <img
                src={inviteImage}
                className="w-[104px] h-[104px] object-cover rounded-full shadow-[inset_4px_4px_9px_rgba(0,0,0,0.12)]"
                alt="Event Cover"
              />
            ) : (
              <div
                className="w-[104px] h-[104px] rounded-full flex items-center justify-center text-white shadow-[inset_4px_4px_9px_rgba(0,0,0,0.12),inset_-4px_-4px_9px_rgba(255,255,255,0.35)]"
                style={{
                  background: `linear-gradient(145deg, ${primaryColor}, ${primaryColor}cc)`,
                }}
              >
                <PartyPopper size={40} />
              </div>
            )}
          </div>

          <div
            className={`fade-up-item mb-2 font-bold tracking-widest uppercase text-sm`}
            style={{ color: primaryColor }}
          >
            Save The Date
          </div>
          <h1
            className={`fade-up-item text-5xl md:text-6xl font-black ${headerTextColor} mb-6 leading-tight`}
          >
            {name}
          </h1>
          <p
            className={`fade-up-item text-xl ${subTextColor} mb-12 font-medium flex items-center justify-center gap-2`}
          >
            <Clock size={20} />{" "}
            {new Date(event_date).toLocaleDateString("he-IL")}
          </p>

          {!isHappeningNow ? (
            <div
              className="fade-up-item flex justify-center gap-3 md:gap-4 mb-12"
              dir="ltr"
            >
              <div className="flex flex-col items-center">
                <div
                  className="w-16 h-16 md:w-20 md:h-20 rounded-[24px] flex items-center justify-center text-2xl md:text-3xl font-black bg-[#e4e0d5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.8)]"
                  style={{ color: primaryColor }}
                >
                  {timeLeft.seconds.toString().padStart(2, "0")}
                </div>
                <span className="text-xs font-bold mt-3 text-[#9a9484]">
                  שניות
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="w-16 h-16 md:w-20 md:h-20 rounded-[24px] flex items-center justify-center text-2xl md:text-3xl font-black bg-[#e4e0d5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.8)]"
                  style={{ color: primaryColor }}
                >
                  {timeLeft.minutes.toString().padStart(2, "0")}
                </div>
                <span className="text-xs font-bold mt-3 text-[#9a9484]">
                  דקות
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="w-16 h-16 md:w-20 md:h-20 rounded-[24px] flex items-center justify-center text-2xl md:text-3xl font-black bg-[#e4e0d5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.8)]"
                  style={{ color: primaryColor }}
                >
                  {timeLeft.hours.toString().padStart(2, "0")}
                </div>
                <span className="text-xs font-bold mt-3 text-[#9a9484]">
                  שעות
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="w-16 h-16 md:w-20 md:h-20 rounded-[24px] flex items-center justify-center text-2xl md:text-3xl font-black bg-[#e4e0d5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.8)]"
                  style={{ color: primaryColor }}
                >
                  {timeLeft.days.toString().padStart(2, "0")}
                </div>
                <span className="text-xs font-bold mt-3 text-[#9a9484]">
                  ימים
                </span>
              </div>
            </div>
          ) : (
            <div className={`fade-up-item mb-12 p-6 rounded-[2.25rem] ${CLAY}`}>
              <Sparkles
                className="mx-auto mb-3 text-yellow-400 animate-pulse"
                size={48}
              />
              <h2 className={`text-3xl font-black ${headerTextColor} mb-2`}>
                היום זה קורה!
              </h2>
              <p className={subTextColor}>ההמתנה הסתיימה. נתראה בקרוב.</p>
            </div>
          )}

          <ActionButtons
            theme={isLightBg ? "light" : "dark"}
            active_modules={active_modules}
            id={id}
            location={location}
            primaryColor={primaryColor}
            setShowRsvp={setShowRsvp}
            setRsvpStep={setRsvpStep}
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
          className="fixed inset-0 bg-[rgba(74,82,89,0.28)] z-[100] flex items-end md:items-center justify-center animate-in fade-in"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="אישור הגעה"
          onClick={() => {
            if (rsvpStep !== 4) setShowRsvp(false);
          }}
        >
          <div
            className="bg-[#e8e4da] w-full max-w-lg md:rounded-[2.5rem] rounded-t-[38px] p-6 md:p-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-14px_40px_rgba(0,0,0,0.16)] relative max-h-[90vh] overflow-y-auto hide-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle */}
            <div className="w-[52px] h-1.5 rounded-full bg-[#cfcabc] mx-auto mb-2 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.12)]" />
            {rsvpStep !== 4 && (
              <button
                onClick={() => setShowRsvp(false)}
                className="absolute top-6 right-6 p-2 rounded-full text-slate-500 z-10 bg-[#e9e6dc] shadow-[3px_3px_7px_rgba(0,0,0,0.08),-3px_-3px_7px_rgba(255,255,255,0.9)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.1),inset_-2px_-2px_5px_rgba(255,255,255,0.8)] transition-all"
                aria-label="סגור"
              >
                <X size={20} />
              </button>
            )}

            {rsvpStep === 1 && (
              <div className="step-anim pt-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#eeece5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.85)]">
                  <Users size={32} style={{ color: primaryColor }} />
                </div>
                <h2 className="text-2xl font-black text-slate-700 mb-2 text-center">
                  אישור הגעה
                </h2>
                <p className="text-slate-500 font-medium text-center mb-8 text-sm">
                  כמה תגיעו סך הכל? (כולל אותך)
                </p>

                <div className="flex items-center justify-center gap-6 mb-10">
                  <button
                    type="button"
                    onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                    className="w-14 h-14 rounded-full text-slate-600 font-black text-2xl flex items-center justify-center transition-all bg-[#e9e6dc] shadow-[5px_5px_12px_rgba(0,0,0,0.08),-5px_-5px_12px_rgba(255,255,255,0.9)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)]"
                  >
                    -
                  </button>
                  <span className="text-5xl font-black text-slate-700 w-12 text-center">
                    {guestCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGuestCount(Math.min(10, guestCount + 1))}
                    className="w-14 h-14 rounded-full text-slate-600 font-black text-2xl flex items-center justify-center transition-all bg-[#e9e6dc] shadow-[5px_5px_12px_rgba(0,0,0,0.08),-5px_-5px_12px_rgba(255,255,255,0.9)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)]"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleCountNext}
                  className="w-full text-white font-bold py-4 rounded-full flex justify-center items-center gap-2 active:scale-[0.97] transition-all"
                  style={clayBtn(primaryColor)}
                >
                  המשך <ChevronLeft size={20} />
                </button>
              </div>
            )}

            {rsvpStep === 2 && (
              <form
                onSubmit={handleVerifyBeforeSubmit}
                className="step-anim pt-4"
              >
                <button
                  type="button"
                  onClick={() => setRsvpStep(1)}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-600 font-bold mb-6 text-sm transition-colors"
                >
                  <ChevronRight size={16} /> חזור
                </button>
                <h2 className="text-2xl font-black text-slate-700 mb-6">
                  פרטי המגיעים
                </h2>

                <div className="space-y-4 mb-8">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 pl-2">
                      טלפון נציג / שולח
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="050-0000000"
                      dir="ltr"
                      value={submitterPhone}
                      onChange={(e) => setSubmitterPhone(e.target.value)}
                      className={`${clayFieldCls} text-left`}
                    />
                  </div>

                  <div className="pt-2 border-t border-[#dcd7ca]">
                    <label className="text-xs font-bold text-slate-400 pl-2 block mb-3">
                      שמות האורחים (שם פרטי ומשפחה)
                    </label>
                    <div className="space-y-3">
                      {guestNames.map((name, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 font-bold text-sm shrink-0 bg-[#eeece5] shadow-[inset_3px_3px_7px_rgba(0,0,0,0.07),inset_-3px_-3px_7px_rgba(255,255,255,0.85)]">
                            {index + 1}
                          </div>
                          <input
                            type="text"
                            required
                            placeholder={
                              index === 0 ? "השם שלך" : `שם אורח ${index + 1}`
                            }
                            value={name}
                            onChange={(e) =>
                              handleNameChange(index, e.target.value)
                            }
                            className={clayFieldCls}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full text-white font-bold py-4 rounded-full flex justify-center items-center gap-2 active:scale-[0.97] transition-all disabled:opacity-50"
                  style={clayBtn(primaryColor)}
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

            {rsvpStep === 3 && (
              <div className="step-anim pt-4 text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-[#eeece5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.85)]">
                  <AlertTriangle size={40} className="text-amber-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-700 mb-2">
                  שימו לב!
                </h2>
                <p className="text-slate-600 text-sm font-medium mb-6 leading-snug">
                  המערכת זיהתה שחלק מהשמות שהזנתם כבר אישרו הגעה בעבר:
                </p>
                <div className="rounded-[1.4rem] p-4 mb-8 text-right space-y-2 bg-[#eeece5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.07),inset_-4px_-4px_9px_rgba(255,255,255,0.85)]">
                  {duplicateWarnings.map((dup, idx) => (
                    <p
                      key={idx}
                      className="text-sm font-bold text-amber-800 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0"></span>
                      השם "{dup.guest_name}" נוסף על ידי: {dup.submitter_name}
                    </p>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRsvpStep(2)}
                    className="flex-1 text-slate-600 font-bold py-4 rounded-full transition-all bg-[#e9e6dc] shadow-[5px_5px_12px_rgba(0,0,0,0.08),-5px_-5px_12px_rgba(255,255,255,0.9)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)]"
                  >
                    חזור לתיקון
                  </button>
                  <button
                    onClick={executeSubmit}
                    disabled={isSubmitting}
                    className="flex-1 text-white font-bold py-4 rounded-full transition-all active:scale-[0.97] flex justify-center items-center"
                    style={clayBtn(primaryColor)}
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

            {rsvpStep === 4 && (
              <div className="step-anim py-12 text-center">
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-[#eeece5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.85)]">
                  <CheckCircle2 size={48} className="text-[#7d9a86]" />
                </div>
                <h2 className="text-3xl font-black text-slate-700 mb-2">
                  איזה כיף!
                </h2>
                <p className="text-slate-500 font-medium text-lg">
                  אישור ההגעה נקלט בהצלחה.
                  <br />
                  נתראה באירוע!
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
