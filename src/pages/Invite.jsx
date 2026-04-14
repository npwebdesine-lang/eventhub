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
      style={{ borderColor: isLight ? "#000000" : "#ffffff" }}
    >
      {active_modules?.rsvp !== false && (
        <button
          onClick={() => {
            setShowRsvp(true);
            setRsvpStep(1);
          }}
          className="w-full flex items-center justify-center gap-3 text-white font-black py-4 rounded-[1.5rem] text-lg shadow-xl hover:scale-[1.02] transition-transform"
          style={{ backgroundColor: primaryColor }}
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
            className={`flex-1 flex items-center justify-center gap-2 font-bold py-4 rounded-[1.5rem] text-sm transition-all active:scale-95 shadow-sm ${isLight ? "bg-[#e5f0ff] text-[#007ee5] hover:bg-[#d0e6ff]" : "bg-[#007ee5]/20 text-[#3399ff] border border-[#007ee5]/30 hover:bg-[#007ee5]/30"}`}
            title={`ניווט אל: ${location}`}
          >
            <Navigation size={18} /> נווט לאירוע
          </a>
        )}
        {active_modules?.rideshare && (
          <button
            onClick={() => navigate(`/rideshare?event=${id}`)}
            className={`flex-1 flex items-center justify-center gap-2 font-bold py-4 rounded-[1.5rem] text-sm transition-all active:scale-95 shadow-sm ${isLight ? "bg-slate-100 text-slate-800 hover:bg-slate-200" : "bg-white/10 text-white hover:bg-white/20 border border-white/10"}`}
          >
            <Car size={18} /> לוח טרמפים
          </button>
        )}
      </div>
    </div>
  );
};

const Invite = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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

    // אנימציית כניסה משותפת לכל התבניות (Fade Up Stagger)
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
    );

    // אנימציות רקע ייחודיות לכל תבנית
    if (template === "modern") {
      gsap.to([bgDecor1.current, bgDecor2.current], {
        x: "random(-60, 60)",
        y: "random(-60, 60)",
        scale: "random(0.8, 1.2)",
        duration: "random(4, 8)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    } else if (template === "elegant") {
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
      });
      gsap.to(".pulse-ring", {
        scale: 1.05,
        opacity: 0.4,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    } else if (template === "corporate") {
      gsap.to(bgDecor1.current, {
        rotation: 360,
        duration: 60,
        repeat: -1,
        ease: "linear",
      });
    }
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
      return alert("אנא מלאו את כל השמות ואת מספר הטלפון");
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
      alert("תקלה בבדיקת הנתונים");
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
      // שימוש ב-upsert כדי למנוע כפילויות במקרה של שליחה כפולה. (מומלץ להוסיף Unique Constraint בבסיס הנתונים על event_id + guest_name)
      const { error } = await supabase.from("rsvps").upsert(inserts, {
        onConflict: "event_id, guest_name",
        ignoreDuplicates: true,
      });
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
      alert("שגיאה בשמירת אישור ההגעה.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={48} />
      </div>
    );
  if (!eventData)
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xl font-bold">
        ההזמנה לא נמצאה :(
      </div>
    );

  const { name, event_date, location, design_config, active_modules } =
    eventData;
  const primaryColor = design_config?.colors?.primary || "#1e293b";
  const bgColor = design_config?.colors?.background || "#020617";
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
          className="min-h-screen bg-[#ffffff] flex flex-col items-center p-6 text-center relative overflow-hidden"
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
                  className="w-full h-full object-cover rounded-full p-1 relative z-10 shadow-lg bg-white"
                  alt="Event Cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center p-1 relative z-10">
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
          className="min-h-screen bg-slate-50 flex flex-col items-center p-6 text-center relative overflow-hidden"
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
                <div className="w-16 h-16 bg-slate-200 rounded-xl flex items-center justify-center">
                  <Briefcase className="text-slate-400" size={32} />
                </div>
              )}
            </div>
            <div
              className="fade-up-item bg-white rounded-t-2xl shadow-sm pt-8 pb-16 px-6"
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
              className="fade-up-item bg-slate-800 rounded-2xl shadow-2xl -mt-8 mx-4 p-6 relative z-20 text-white"
              style={{ backgroundColor: primaryColor }}
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
            <div className="fade-up-item mt-8 bg-white p-6 rounded-2xl shadow-sm relative z-30">
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
    // לוגיקת בהירות צבע (מונעת מסך לבן/בלתי נראה על רקע בהיר)
    const isLightBg = getLuminance(bgColor) > 150;
    const headerTextColor = isLightBg ? "text-slate-800" : "text-white";
    const subTextColor = isLightBg ? "text-slate-600" : "text-white/80";
    const boxBgColor = isLightBg
      ? "bg-white/60 border-white/50 text-slate-800 shadow-xl"
      : "bg-white/10 border-white/10 text-white shadow-2xl hover:bg-white/20";

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden text-center transition-colors duration-1000"
        style={{ backgroundColor: bgColor }}
        dir="rtl"
      >
        {/* Blobs חיים וזזים - משתמשים בצבע ה-Primary */}
        <div
          ref={bgDecor1}
          className="absolute top-[-10%] left-[-10%] w-96 h-96 blur-[120px] rounded-full pointer-events-none opacity-60"
          style={{ backgroundColor: primaryColor }}
        ></div>
        <div
          ref={bgDecor2}
          className="absolute bottom-[-10%] right-[-10%] w-80 h-80 blur-[100px] rounded-full pointer-events-none opacity-40"
          style={{ backgroundColor: primaryColor }}
        ></div>

        <div className="relative z-10 w-full max-w-lg mx-auto pb-20">
          <div
            className="fade-up-item mx-auto w-24 h-24 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl backdrop-blur-md"
            style={{
              backgroundColor: `${primaryColor}20`,
              border: `1px solid ${primaryColor}40`,
            }}
          >
            {inviteImage ? (
              <img
                src={inviteImage}
                className="w-full h-full object-cover rounded-[2rem] p-1 shadow-inner bg-white/50"
                alt="Event Cover"
              />
            ) : (
              <PartyPopper size={40} style={{ color: primaryColor }} />
            )}
          </div>

          <div
            className={`fade-up-item mb-2 font-medium tracking-widest uppercase text-sm`}
            style={{
              color: isLightBg ? primaryColor : "rgba(255,255,255,0.7)",
            }}
          >
            Save The Date
          </div>
          <h1
            className={`fade-up-item text-5xl md:text-6xl font-black ${headerTextColor} mb-6 leading-tight drop-shadow-lg`}
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
                  className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-2xl md:text-3xl font-black backdrop-blur-lg border transition-colors ${boxBgColor}`}
                >
                  {timeLeft.seconds.toString().padStart(2, "0")}
                </div>
                <span
                  className="text-xs font-bold mt-3"
                  style={{ color: isLightBg ? primaryColor : "white" }}
                >
                  שניות
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-2xl md:text-3xl font-black backdrop-blur-lg border transition-colors ${boxBgColor}`}
                >
                  {timeLeft.minutes.toString().padStart(2, "0")}
                </div>
                <span
                  className="text-xs font-bold mt-3"
                  style={{ color: isLightBg ? primaryColor : "white" }}
                >
                  דקות
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-2xl md:text-3xl font-black backdrop-blur-lg border transition-colors ${boxBgColor}`}
                >
                  {timeLeft.hours.toString().padStart(2, "0")}
                </div>
                <span
                  className="text-xs font-bold mt-3"
                  style={{ color: isLightBg ? primaryColor : "white" }}
                >
                  שעות
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-2xl md:text-3xl font-black backdrop-blur-lg border transition-colors ${boxBgColor}`}
                >
                  {timeLeft.days.toString().padStart(2, "0")}
                </div>
                <span
                  className="text-xs font-bold mt-3"
                  style={{ color: isLightBg ? primaryColor : "white" }}
                >
                  ימים
                </span>
              </div>
            </div>
          ) : (
            <div
              className={`fade-up-item mb-12 p-6 rounded-3xl border backdrop-blur-xl shadow-2xl ${isLightBg ? "bg-white/60 border-white/50" : "bg-white/10 border-white/20"}`}
            >
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
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-end md:items-center justify-center animate-in fade-in"
          dir="rtl"
        >
          <div className="bg-white w-full max-w-lg md:rounded-[2.5rem] rounded-t-[2.5rem] p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto hide-scrollbar">
            {rsvpStep !== 4 && (
              <button
                onClick={() => setShowRsvp(false)}
                className="absolute top-6 right-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-600 z-10 transition-colors"
              >
                <X size={20} />
              </button>
            )}

            {rsvpStep === 1 && (
              <div className="step-anim pt-4">
                <div className="w-16 h-16 bg-blue-50 rounded-[1.2rem] flex items-center justify-center mx-auto mb-4 border border-blue-100">
                  <Users size={32} className="text-blue-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2 text-center">
                  אישור הגעה
                </h2>
                <p className="text-slate-500 font-medium text-center mb-8 text-sm">
                  כמה תגיעו סך הכל? (כולל אותך)
                </p>

                <div className="flex items-center justify-center gap-6 mb-10">
                  <button
                    type="button"
                    onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                    className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 text-slate-600 font-black text-2xl flex items-center justify-center transition-colors hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="text-5xl font-black text-slate-800 w-12 text-center">
                    {guestCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGuestCount(Math.min(10, guestCount + 1))}
                    className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 text-slate-600 font-black text-2xl flex items-center justify-center transition-colors hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleCountNext}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-[1.5rem] shadow-lg flex justify-center items-center gap-2 hover:scale-[1.02] transition-all"
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
                <h2 className="text-2xl font-black text-slate-800 mb-6">
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
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[1.2rem] focus:ring-2 focus:ring-slate-900 outline-none font-bold text-left transition-all"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-400 pl-2 block mb-3">
                      שמות האורחים (שם פרטי ומשפחה)
                    </label>
                    <div className="space-y-3">
                      {guestNames.map((name, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm shrink-0">
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
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-[1.2rem] focus:ring-2 focus:ring-slate-900 outline-none font-bold transition-all"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-[1.5rem] shadow-lg flex justify-center items-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50"
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
                <div className="w-20 h-20 bg-amber-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 border border-amber-100">
                  <AlertTriangle size={40} className="text-amber-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">
                  שימו לב!
                </h2>
                <p className="text-slate-600 text-sm font-medium mb-6 leading-snug">
                  המערכת זיהתה שחלק מהשמות שהזנתם כבר אישרו הגעה בעבר:
                </p>
                <div className="bg-amber-50/50 rounded-[1.2rem] p-4 mb-8 text-right space-y-2 border border-amber-100/50">
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
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-4 rounded-[1.2rem] transition-colors border border-slate-200"
                  >
                    חזור לתיקון
                  </button>
                  <button
                    onClick={executeSubmit}
                    disabled={isSubmitting}
                    className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-[1.2rem] shadow-lg hover:opacity-90 transition-colors flex justify-center items-center"
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
                <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner border border-emerald-100">
                  <CheckCircle2 size={48} className="text-emerald-500" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2">
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
