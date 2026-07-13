import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getOrCreateDeviceId, isValidUUIDv4 } from "../utils/deviceId";
import { getTextColor } from "../lib/colors";
import { useToast } from "../components/Toast";
import {
  Loader2,
  ChevronLeft,
  Car,
  MapPin,
  MessageCircle,
  ArrowRight,
  Sparkles,
  AlertCircle,
  X,
  Phone,
} from "lucide-react";
import gsap from "gsap";

const formatDialer = (phone) => `tel:${phone.replace(/\D/g, "")}`;

/* ============================================================
   SOFT-CLAY / NEUMORPHISM DESIGN TOKENS  (shared across modules)
   ------------------------------------------------------------ */
const CLAY_BG = "#eceadf";
const CLAY_PAGE_BG =
  "linear-gradient(160deg, #eceadf 0%, #e2ddd0 100%)";
const CLAY =
  "rounded-[2rem] bg-[#f0eee7] shadow-[8px_8px_20px_rgba(0,0,0,0.09),-8px_-8px_20px_rgba(255,255,255,0.9)]";
const CLAY_INSET =
  "bg-[#eeece5] shadow-[inset_5px_5px_10px_rgba(0,0,0,0.07),inset_-5px_-5px_10px_rgba(255,255,255,0.85)]";
const clayBtn = (color) => ({
  backgroundColor: color,
  boxShadow: `5px 5px 14px rgba(0,0,0,0.14), -4px -4px 12px rgba(255,255,255,0.7), inset 2px 2px 4px rgba(255,255,255,0.35), inset -2px -2px 4px rgba(0,0,0,0.12)`,
});
// A neutral field styled as a debossed well (replaces flat inputs)
const clayFieldCls =
  "w-full p-4 rounded-[1.4rem] outline-none font-bold text-slate-700 placeholder:text-slate-400 bg-[#eeece5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.07),inset_-4px_-4px_9px_rgba(255,255,255,0.85)] focus:shadow-[inset_5px_5px_11px_rgba(0,0,0,0.09),inset_-5px_-5px_11px_rgba(255,255,255,0.9)] transition-all";

// Improved Ride Card — sculpted in clay
const RideCard = ({ ride, primaryColor }) => {
  const isDriver = ride.role === "driver";
  const accentColor = isDriver ? "#f59e0b" : primaryColor;
  const cleanPhone = ride.phone?.replace(/\D/g, "").replace(/^0/, "972");

  return (
    <div className={`${CLAY} p-5 flex flex-col gap-3`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-[1rem] flex items-center justify-center shrink-0 text-white"
          style={clayBtn(accentColor)}
        >
          <Car size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-slate-700 truncate">
            {ride.guest_name}
          </h3>
          <span
            className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-full mt-1"
            style={{
              color: accentColor,
              backgroundColor: "#eeece5",
              boxShadow:
                "inset 2px 2px 4px rgba(0,0,0,0.06), inset -2px -2px 4px rgba(255,255,255,0.8)",
            }}
          >
            {isDriver ? "מציע/ה טרמפ" : "מחפש/ת טרמפ"}
          </span>
        </div>
      </div>

      {/* Route — debossed well */}
      <div className={`rounded-[1.2rem] p-3.5 space-y-1.5 ${CLAY_INSET}`}>
        {["there", "both"].includes(ride.direction) && ride.from_location && (
          <div className="flex items-center gap-2 text-sm">
            <ArrowRight size={13} className="text-slate-400 shrink-0" />
            <span className="text-slate-400 text-xs">הלוך מ:</span>
            <span className="font-bold text-slate-600 truncate">
              {ride.from_location}
            </span>
          </div>
        )}
        {["back", "both"].includes(ride.direction) && ride.to_location && (
          <div className="flex items-center gap-2 text-sm">
            <ChevronLeft size={13} className="text-slate-400 shrink-0" />
            <span className="text-slate-400 text-xs">חזור ל:</span>
            <span className="font-bold text-slate-600 truncate">
              {ride.to_location}
            </span>
          </div>
        )}
      </div>

      {/* Contact buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href={`https://wa.me/${cleanPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-white active:scale-[0.97] transition-all py-3 rounded-full font-bold text-sm"
          style={clayBtn("#25D366")}
        >
          <MessageCircle size={15} /> WhatsApp
        </a>
        <a
          href={formatDialer(ride.phone)}
          className="flex items-center justify-center gap-1.5 text-slate-600 active:scale-[0.97] transition-all py-3 rounded-full font-bold text-sm bg-[#f0eee7] shadow-[4px_4px_10px_rgba(0,0,0,0.08),-4px_-4px_10px_rgba(255,255,255,0.9)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)]"
        >
          <Phone size={15} /> חיוג
        </a>
      </div>
    </div>
  );
};

const Rideshare = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const localGuestName = localStorage.getItem("guest_name") || "";
  const localGuestId = (() => {
    const id = getOrCreateDeviceId();
    return isValidUUIDv4(id) ? id : "";
  })();

  const roleParam = searchParams.get("role"); // "driver" | "seeker" from home page

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventData, setEventData] = useState(null);
  const [rides, setRides] = useState([]);
  const [step, setStep] = useState("welcome");
  const [tempName, setTempName] = useState("");
  const [formData, setFormData] = useState({
    role: roleParam === "driver" ? "driver" : "seeker",
    direction: "",
    from_location: "",
    to_location: "",
    guest_name: localGuestName,
    phone: "",
  });
  const [matches, setMatches] = useState([]);
  const [boardTab, setBoardTab] = useState("driver");

  useEffect(() => {
    if (!eventId) return navigate("/");
    let isMounted = true;
    const init = async () => {
      try {
        const { data: event, error } = await supabase
          .from("events")
          .select("id, name, design_config")
          .eq("id", eventId)
          .single();
        if (error) throw error;
        if (isMounted) setEventData(event);

        const { data: ridesData } = await supabase
          .from("rideshares")
          .select(
            "id, guest_id, guest_name, role, direction, from_location, to_location, phone, created_at",
          )
          .eq("event_id", eventId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (isMounted) setRides(ridesData || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [eventId, navigate]);

  // Skip welcome screen if role was passed via URL param
  useEffect(() => {
    if (
      !loading &&
      eventData &&
      (roleParam === "driver" || roleParam === "seeker")
    ) {
      setStep("form");
    }
  }, [loading, eventData, roleParam]);

  useEffect(() => {
    if (!loading && eventData) {
      gsap.fromTo(
        ".fade-up-item",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 },
      );
    }
  }, [loading, step, eventData]);

  const handleRoleSelect = (role) => {
    setFormData((prev) => ({ ...prev, role }));
    setStep("form");
  };

  const handleInlineNameSubmit = (e) => {
    e.preventDefault();
    if (!tempName.trim()) return;

    const trimmedName = tempName.trim();
    localStorage.setItem("guest_name", trimmedName);

    const guestId = getOrCreateDeviceId();
    if (!isValidUUIDv4(guestId)) {
      throw new Error("Failed to create valid device ID");
    }

    setFormData((prev) => ({ ...prev, guest_name: trimmedName }));
    setTempName("");
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data: savedRide, error } = await supabase
        .from("rideshares")
        .insert([{ event_id: eventId, guest_id: localGuestId, ...formData }])
        .select()
        .single();
      if (error) throw error;

      const updatedRides = [savedRide, ...rides];
      setRides(updatedRides);

      const oppositeRole = formData.role === "driver" ? "seeker" : "driver";
      const potentialMatches = updatedRides.filter((r) => {
        if (r.guest_id === localGuestId || r.role !== oppositeRole)
          return false;
        let isMatch = false;
        if (
          ["there", "both"].includes(formData.direction) &&
          ["there", "both"].includes(r.direction)
        ) {
          if (
            r.from_location &&
            formData.from_location &&
            (r.from_location.includes(formData.from_location) ||
              formData.from_location.includes(r.from_location))
          ) {
            isMatch = true;
          }
        }
        if (
          ["back", "both"].includes(formData.direction) &&
          ["back", "both"].includes(r.direction)
        ) {
          if (
            r.to_location &&
            formData.to_location &&
            (r.to_location.includes(formData.to_location) ||
              formData.to_location.includes(r.to_location))
          ) {
            isMatch = true;
          }
        }
        return isMatch;
      });

      if (potentialMatches.length > 0) {
        setMatches(potentialMatches);
        setStep("match");
      } else {
        setBoardTab(oppositeRole);
        setStep("board");
      }
    } catch {
      showToast("שגיאה בפרסום המודעה. נסו שוב.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !eventData) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: CLAY_PAGE_BG }}
      >
        <Loader2 className="animate-spin text-slate-400" size={48} />
      </div>
    );
  }

  const primaryColor = eventData.design_config?.colors?.primary || "#8fa7b8";

  // ---- Welcome ----
  if (step === "welcome") {
    return (
      <div
        className="min-h-screen flex flex-col p-6 font-sans"
        style={{ background: CLAY_PAGE_BG }}
        dir="rtl"
      >
        <button
          onClick={() => navigate(-1)}
          className="self-end p-3 rounded-full text-slate-500 mb-8 bg-[#f0eee7] shadow-[5px_5px_12px_rgba(0,0,0,0.09),-5px_-5px_12px_rgba(255,255,255,0.9)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)] transition-all"
        >
          <X size={20} />
        </button>

        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full text-center">
          <div
            className="w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 bg-[#f0eee7] shadow-[10px_10px_24px_rgba(0,0,0,0.1),-9px_-9px_22px_rgba(255,255,255,0.9)]"
          >
            <Car size={40} style={{ color: primaryColor }} />
          </div>
          <h1 className="text-3xl font-black text-slate-700 mb-2">לוח טרמפים</h1>
          <p className="text-slate-400 font-medium mb-10 text-sm">
            שתפו נסיעות — יחד זה יותר כיף
          </p>

          <div className="space-y-4 text-right">
            <button
              onClick={() => handleRoleSelect("seeker")}
              className="w-full p-5 rounded-[1.8rem] flex items-center justify-between active:scale-[0.98] transition-transform text-white"
              style={clayBtn(primaryColor)}
            >
              <div>
                <h3 className="text-lg font-black mb-0.5">
                  אני מחפש/ת טרמפ 🙋
                </h3>
                <p className="text-xs font-medium opacity-80">
                  צריך/ה עזרה להגיע או לחזור
                </p>
              </div>
              <ChevronLeft className="opacity-70 shrink-0" />
            </button>

            <button
              onClick={() => handleRoleSelect("driver")}
              className="w-full p-5 rounded-[1.8rem] flex items-center justify-between active:scale-[0.98] transition-transform group text-right bg-[#f0eee7] shadow-[7px_7px_18px_rgba(0,0,0,0.09),-6px_-6px_16px_rgba(255,255,255,0.9)]"
            >
              <div>
                <h3 className="text-lg font-black text-slate-700 mb-0.5">
                  אני מציע/ת טרמפ 🚗
                </h3>
                <p className="text-xs font-medium text-slate-400">
                  יש לי מקום פנוי ברכב
                </p>
              </div>
              <ChevronLeft className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
            </button>
          </div>

          <button
            onClick={() => {
              setStep("board");
              setBoardTab("driver");
            }}
            className="mt-10 text-slate-400 hover:text-slate-600 font-bold text-sm underline underline-offset-4 transition-colors"
          >
            רק להסתכל על הלוח המלא
          </button>
        </div>
      </div>
    );
  }

  // ---- Form ----
  if (step === "form") {
    const isSeeker = formData.role === "seeker";
    return (
      <div
        className="min-h-screen flex flex-col font-sans pb-10"
        style={{ background: CLAY_PAGE_BG }}
        dir="rtl"
      >
        <div className="pt-10 pb-4 px-6 relative z-10 flex justify-between items-center max-w-md mx-auto w-full">
          <button
            onClick={() => setStep("welcome")}
            className="p-3 rounded-full text-slate-500 bg-[#f0eee7] shadow-[5px_5px_12px_rgba(0,0,0,0.09),-5px_-5px_12px_rgba(255,255,255,0.9)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)] transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-2xl font-black text-slate-700">
            {isSeeker ? "חיפוש טרמפ 🙋" : "הצעת טרמפ 🚗"}
          </h1>
          <div className="w-11" />
        </div>

        {!formData.guest_name && (
          <form
            onSubmit={handleInlineNameSubmit}
            className="px-5 relative z-20 max-w-md mx-auto w-full space-y-4"
          >
            <div className={`fade-up-item ${CLAY} p-6 space-y-4`}>
              <h3 className="font-bold text-slate-600 text-sm">
                בואו נתחיל עם שמך
              </h3>
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                  הכנס שם כדי להשתמש בלוח הטרמפים
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="איך קוראים לך?"
                  className={clayFieldCls}
                />
              </div>
              <button
                type="submit"
                className="w-full font-black py-4 rounded-full active:scale-[0.98] transition-all mt-4 text-white"
                style={clayBtn(primaryColor)}
              >
                המשך
              </button>
            </div>
          </form>
        )}

        <form
          onSubmit={submitForm}
          className="px-5 relative z-20 max-w-md mx-auto w-full space-y-4 mt-2"
        >
          {/* Contact info */}
          <div className={`fade-up-item ${CLAY} p-6 space-y-4`}>
            <h3 className="font-bold text-slate-600 text-sm">פרטי התקשרות</h3>
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                שם מלא
              </label>
              <input
                type="text"
                required
                value={formData.guest_name}
                onChange={(e) =>
                  setFormData({ ...formData, guest_name: e.target.value })
                }
                className={clayFieldCls}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                טלפון לתיאום
              </label>
              <input
                type="tel"
                required
                placeholder="050-0000000"
                dir="ltr"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className={`${clayFieldCls} text-left`}
              />
            </div>
          </div>

          {/* Direction */}
          <div className={`fade-up-item ${CLAY} p-6 space-y-3`}>
            <h3 className="font-bold text-slate-600 text-sm">כיוון נסיעה</h3>
            {[
              {
                value: "there",
                label: isSeeker ? "צריך/ה טרמפ רק הלוך" : "נוסע/ת רק הלוך",
                icon: "→",
              },
              {
                value: "back",
                label: isSeeker ? "צריך/ה טרמפ רק חזור" : "נוסע/ת רק חזור",
                icon: "←",
              },
              {
                value: "both",
                label: isSeeker ? "הלוך וגם חזור" : "שני הכיוונים",
                icon: "↔",
              },
            ].map((opt) => {
              const active = formData.direction === opt.value;
              return (
                <label
                  key={opt.value}
                  className="p-4 rounded-[1.4rem] cursor-pointer transition-all flex items-center gap-3"
                  style={
                    active
                      ? { ...clayBtn(primaryColor), color: "#fff" }
                      : {
                          color: "#475569",
                          backgroundColor: "#eeece5",
                          boxShadow:
                            "inset 4px 4px 9px rgba(0,0,0,0.07), inset -4px -4px 9px rgba(255,255,255,0.85)",
                        }
                  }
                >
                  <input
                    type="radio"
                    name="dir"
                    value={opt.value}
                    className="hidden"
                    required
                    onChange={() =>
                      setFormData({
                        ...formData,
                        direction: opt.value,
                        from_location:
                          opt.value === "back" ? "" : formData.from_location,
                        to_location:
                          opt.value === "there" ? "" : formData.to_location,
                      })
                    }
                  />
                  <span className="text-base font-mono">{opt.icon}</span>
                  <span className="font-bold text-sm">{opt.label}</span>
                </label>
              );
            })}
          </div>

          {/* Locations */}
          {formData.direction && (
            <div className={`fade-up-item ${CLAY} p-6 space-y-4 animate-in slide-in-from-top-2`}>
              <h3 className="font-bold text-slate-600 text-sm">
                מאיפה / לאיפה?
              </h3>
              {["there", "both"].includes(formData.direction) && (
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                    מאיפה בהלוך?
                  </label>
                  <div className="relative">
                    <MapPin
                      className="absolute right-4 top-4 text-slate-300 z-10"
                      size={18}
                    />
                    <input
                      type="text"
                      required
                      value={formData.from_location}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          from_location: e.target.value,
                        })
                      }
                      placeholder="עיר, שכונה או צומת"
                      className={`${clayFieldCls} pr-11`}
                    />
                  </div>
                </div>
              )}
              {["back", "both"].includes(formData.direction) && (
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                    לאן בחזור?
                  </label>
                  <div className="relative">
                    <MapPin
                      className="absolute right-4 top-4 text-slate-300 z-10"
                      size={18}
                    />
                    <input
                      type="text"
                      required
                      value={formData.to_location}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          to_location: e.target.value,
                        })
                      }
                      placeholder="עיר, שכונה או צומת"
                      className={`${clayFieldCls} pr-11`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full font-black py-5 rounded-full flex justify-center items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 mt-4 mb-8 text-white"
            style={clayBtn(primaryColor)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={20} /> מפרסם...
              </>
            ) : (
              "שגר מודעה ובדוק התאמות"
            )}
          </button>
        </form>
      </div>
    );
  }

  // ---- Match ----
  if (step === "match") {
    return (
      <div
        className="min-h-screen p-6 flex flex-col font-sans"
        style={{ background: CLAY_PAGE_BG }}
        dir="rtl"
      >
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full text-center">
          <div
            className="inline-flex items-center justify-center w-24 h-24 rounded-full mx-auto mb-5 text-white"
            style={clayBtn(primaryColor)}
          >
            <Sparkles size={44} className="animate-pulse" />
          </div>
          <h2 className="text-4xl font-black text-slate-700 mb-2">יש התאמה!</h2>
          <p className="font-medium mb-8 text-slate-500">
            מצאנו אנשים שכבר פרסמו מודעה לאותו אזור:
          </p>

          <div className="space-y-4 text-right mb-8">
            {matches.map((match) => (
              <RideCard key={match.id} ride={match} primaryColor={primaryColor} />
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            setBoardTab(formData.role === "driver" ? "seeker" : "driver");
            setStep("board");
          }}
          className="w-full font-bold py-5 rounded-full transition-all active:scale-[0.98] text-slate-600 bg-[#f0eee7] shadow-[6px_6px_16px_rgba(0,0,0,0.09),-6px_-6px_16px_rgba(255,255,255,0.9)] active:shadow-[inset_4px_4px_9px_rgba(0,0,0,0.1),inset_-4px_-4px_9px_rgba(255,255,255,0.8)]"
        >
          המשך ללוח הטרמפים המלא
        </button>
      </div>
    );
  }

  // ---- Board ----
  return (
    <div
      className="min-h-screen font-sans pb-12"
      style={{ background: CLAY_PAGE_BG }}
      dir="rtl"
    >
      <div className="pt-10 pb-4 px-6 relative z-10 flex justify-between items-center max-w-md mx-auto w-full">
        <button
          onClick={() => navigate(-1)}
          className="p-3 rounded-full text-slate-500 bg-[#f0eee7] shadow-[5px_5px_12px_rgba(0,0,0,0.09),-5px_-5px_12px_rgba(255,255,255,0.9)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)] transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-slate-700">הלוח המרכזי</h1>
        <button
          onClick={() => setStep("welcome")}
          className="text-xs font-bold px-4 py-2.5 rounded-full transition-all text-white"
          style={clayBtn(primaryColor)}
        >
          + מודעה
        </button>
      </div>

      <div className="px-5 relative z-20 max-w-md mx-auto">
        {/* Tabs — segmented control in a debossed track */}
        <div className={`flex p-1.5 rounded-full mb-5 ${CLAY_INSET}`}>
          {[
            { key: "driver", label: "מציעים טרמפ 🚗" },
            { key: "seeker", label: "מחפשים טרמפ 🙋" },
          ].map((tab) => {
            const active = boardTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setBoardTab(tab.key)}
                className="flex-1 py-3 font-bold text-sm rounded-full transition-all"
                style={
                  active
                    ? { ...clayBtn(primaryColor), color: "#fff" }
                    : { color: "#64748b" }
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Rides list */}
        <div className="space-y-4">
          {rides.filter((r) => r.role === boardTab).length === 0 ? (
            <div className={`fade-up-item text-center py-14 ${CLAY}`}>
              <AlertCircle size={36} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-base font-bold text-slate-600 mb-1">
                הלוח עדיין ריק
              </h3>
              <p className="text-slate-400 text-sm">
                {boardTab === "driver"
                  ? "היו הראשונים להציע טרמפ!"
                  : "היו הראשונים לחפש טרמפ!"}
              </p>
            </div>
          ) : (
            rides
              .filter((r) => r.role === boardTab)
              .map((ride) => (
                <div key={ride.id} className="fade-up-item">
                  <RideCard ride={ride} primaryColor={primaryColor} />
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Rideshare;
