import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Camera,
  Heart,
  Loader2,
  PartyPopper,
  MapPin,
  X,
  RefreshCw,
  Zap,
  Users,
  Car,
  Info,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  UserX,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import gsap from "gsap";

const MODULES_INFO = {
  photo: {
    title: "כל אחד צלם",
    description: "העלו תמונות לאלבום המשותף של האירוע",
    icon: Camera,
    color: "text-orange-500",
    bg: "bg-orange-50",
  },
  dating: {
    title: "דייט-ליין",
    description: "הרשת החברתית של האירוע לרווקים ורווקות",
    icon: Heart,
    color: "text-rose-500",
    bg: "bg-rose-50",
  },
  icebreaker: {
    title: "שובר קרח",
    description: "משחק משימות חברתי עם אורחים אחרים",
    icon: Zap,
    color: "text-cyan-500",
    bg: "bg-cyan-50",
  },
  rideshare: {
    title: "לוח טרמפים",
    description: "שתפו נסיעות לאחר האירוע",
    icon: Car,
    color: "text-amber-500",
    bg: "bg-amber-50",
  },
  seating: {
    title: "סידור הושבה",
    description: "מצאו את השולחן שלכם ואת בני השולחן",
    icon: MapPin,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  blessings: {
    title: "ספר ברכות",
    description: "כתבו ברכה וצרפו תמונה לבעלי השמחה",
    icon: MessageCircle,
    color: "text-purple-500",
    bg: "bg-purple-50",
  },
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 17) return "צהריים טובים";
  if (h >= 17 && h < 21) return "ערב טוב";
  return "לילה טוב";
};

// Shared glassmorphism card style
const GLASS =
  "module-card-anim relative rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.09)] bg-white/80 backdrop-blur-md border border-white/60";

// ---- Photo Marquee Card ----
// Uses a pure-CSS @keyframes loop so the track never "jumps" on reset.
// The track contains two identical copies of the images; the animation
// moves exactly -50% (one full copy), then wraps back to 0 — invisible
// because both positions look identical.
const PhotoMarqueeCard = ({
  photos,
  primaryColor,
  eventId,
  navigate,
  openInfo,
}) => {
  // Ensure each logical "copy" has at least MIN_VISIBLE photos so the strip
  // always fills the visible area even when few photos exist.
  const MIN_VISIBLE = 5;
  const repeatsPerCopy = Math.max(
    1,
    Math.ceil(MIN_VISIBLE / Math.max(1, photos.length)),
  );
  const singleCopy = Array.from(
    { length: repeatsPerCopy },
    () => photos,
  ).flat();

  // Use 4 copies total; animate by exactly -25% (= 1 copy) so the loop is seamless.
  const LOOP_COPIES = 4;
  const allPhotos = Array.from(
    { length: LOOP_COPIES },
    () => singleCopy,
  ).flat();

  // Slower for few photos, faster for many — keeps visual rhythm pleasant.
  const duration = Math.max(18, photos.length * 3);

  return (
    <div className={`${GLASS} flex flex-col`}>
      <button
        onClick={(e) => openInfo(e, "photo")}
        className="absolute top-3 left-3 text-slate-300 hover:text-slate-500 z-20 p-1 transition-colors"
        aria-label="מידע"
      >
        <Info size={16} />
      </button>

      {/* Marquee strip */}
      <div
        className="relative h-36 md:h-44 overflow-hidden rounded-t-[1.8rem]"
        style={{
          background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
          // Fade the strip edges so the loop is completely invisible
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
        }}
      >
        {photos.length > 0 ? (
          <div
            className="marquee-track flex gap-3 h-full will-change-transform px-4 py-2.5"
            style={{
              animation: `photo-marquee ${duration}s linear infinite`,
              width: "max-content",
              "--marquee-offset": "-25%",
            }}
          >
            {allPhotos.map((photo, i) => (
              <img
                key={i}
                src={photo?.image_url || ""}
                alt=""
                className="h-full w-28 md:w-32 object-cover rounded-2xl shrink-0 shadow-md"
                loading="lazy"
                style={{ filter: "brightness(0.97) contrast(1.03)" }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <Camera size={36} className="text-slate-300" />
            <p className="text-xs mt-2 font-bold text-slate-400">
              אין תמונות עדיין
            </p>
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="p-4 text-center">
        <h3 className="font-black text-slate-800 text-sm mb-0.5">כל אחד צלם</h3>
        <p className="text-slate-400 text-xs mb-3">העלו תמונות לאלבום המשותף</p>
        <button
          onClick={() => navigate(`/photos?event=${eventId}`)}
          className="w-full font-bold py-3 rounded-[1rem] text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all text-white shadow-md"
          style={{ backgroundColor: primaryColor }}
        >
          <Camera size={16} /> פתח מצלמה / גלריה
        </button>
      </div>
    </div>
  );
};

// ---- Action Module Card (dating, icebreaker) ----
const ActionModuleCard = ({
  mKey,
  primaryColor,
  onClick,
  openInfo,
  hasBadge,
}) => {
  const info = MODULES_INFO[mKey];
  if (!info) return null;

  return (
    <div
      className={`${GLASS} p-4 flex flex-col items-center text-center h-full`}
    >
      <button
        onClick={(e) => openInfo(e, mKey)}
        className="absolute top-2.5 left-2.5 text-slate-300 hover:text-slate-500 z-10 p-1 transition-colors"
        aria-label="מידע"
      >
        <Info size={14} />
      </button>

      {hasBadge && (
        <span className="absolute top-2.5 right-2.5 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-white" />
        </span>
      )}

      <div
        className={`w-11 h-11 ${info.bg} rounded-[0.875rem] flex items-center justify-center mb-2.5 mt-1`}
      >
        <info.icon size={20} className={info.color} />
      </div>

      <h3 className="font-black text-slate-800 text-xs leading-tight mb-1">
        {info.title}
      </h3>
      <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3 mb-3 flex-1">
        {info.description}
      </p>

      <button
        onClick={onClick}
        className="w-full font-bold py-2 rounded-[0.8rem] text-xs flex items-center justify-center gap-1 hover:opacity-80 active:scale-[0.98] transition-all mt-auto"
        style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
      >
        כניסה <ChevronLeft size={12} />
      </button>
    </div>
  );
};

// ---- Rideshare Card (2 role buttons) ----
const RideshareHomeCard = ({ primaryColor, eventId, navigate, openInfo }) => (
  <div className={`${GLASS} p-4 flex flex-col items-center text-center h-full`}>
    <button
      onClick={(e) => openInfo(e, "rideshare")}
      className="absolute top-2.5 left-2.5 text-slate-300 hover:text-slate-500 z-10 p-1 transition-colors"
      aria-label="מידע"
    >
      <Info size={14} />
    </button>

    <div className="w-11 h-11 bg-amber-50 rounded-[0.875rem] flex items-center justify-center mb-2.5 mt-1">
      <Car size={20} className="text-amber-500" />
    </div>

    <h3 className="font-black text-slate-800 text-xs mb-1">לוח טרמפים</h3>
    <p className="text-slate-400 text-[11px] mb-3 leading-relaxed flex-1 line-clamp-3">
      שתפו נסיעות לאחר האירוע
    </p>

    <div className="w-full space-y-1.5 mt-auto">
      <button
        onClick={() => navigate(`/rideshare?event=${eventId}&role=driver`)}
        className="w-full font-bold py-2 rounded-[0.8rem] text-xs hover:opacity-90 active:scale-[0.98] transition-all text-white flex items-center justify-center gap-1"
        style={{ backgroundColor: primaryColor }}
      >
        <Car size={12} /> אני מציע 🚗
      </button>
      <button
        onClick={() => navigate(`/rideshare?event=${eventId}&role=seeker`)}
        className="w-full font-bold py-2 rounded-[0.8rem] text-xs hover:opacity-80 active:scale-[0.98] transition-all flex items-center justify-center gap-1"
        style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
      >
        <Users size={12} /> אני מחפש 🙋
      </button>
    </div>
  </div>
);

// ---- Blessings Card ----
const BlessingsHomeCard = ({ primaryColor, eventId, navigate, openInfo }) => (
  <div className={`${GLASS} p-5 flex flex-col items-center text-center`}>
    <button
      onClick={(e) => openInfo(e, "blessings")}
      className="absolute top-3 left-3 text-slate-300 hover:text-slate-500 z-10 p-1 transition-colors"
      aria-label="מידע"
    >
      <Info size={16} />
    </button>

    <div className="w-12 h-12 bg-purple-50 rounded-[1rem] flex items-center justify-center mb-3 mt-1">
      <MessageCircle size={24} className="text-purple-500" />
    </div>

    <h3 className="font-black text-slate-800 text-sm mb-1">ספר ברכות</h3>
    <p className="text-slate-400 text-xs mb-3 leading-relaxed">
      כתבו ברכה לבעלי השמחה
    </p>

    <button
      onClick={() => navigate(`/blessing?event=${eventId}`)}
      className="w-full font-bold py-2.5 rounded-[0.8rem] text-xs hover:opacity-90 active:scale-[0.98] transition-all text-white flex items-center justify-center gap-1.5"
      style={{ backgroundColor: primaryColor }}
    >
      <MessageCircle size={13} /> הוסף ברכה ✍️
    </button>
  </div>
);

// ---- Blessings Strip Ticker ----
const BlessingsStrip = ({ eventId, primaryColor }) => {
  const [blessing, setBlessing] = useState(null);
  const trackRef = useRef(null);
  const stripRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLatest = async () => {
      try {
        const { data } = await supabase
          .from("blessings")
          .select("guest_name, message")
          .eq("event_id", eventId)
          .eq("is_approved", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (isMounted) setBlessing(data || null);
      } catch (e) {
        console.error(e);
      }
    };
    fetchLatest();
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // Entry animation
  useEffect(() => {
    if (!blessing || !stripRef.current) return;
    gsap.fromTo(
      stripRef.current,
      { y: -12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: "power2.out" },
    );
  }, [blessing]);

  // Ticker scroll
  useEffect(() => {
    if (!trackRef.current || !blessing) return;
    const tween = gsap.to(trackRef.current, {
      x: "-50%",
      duration: 16,
      ease: "none",
      repeat: -1,
    });
    return () => tween.kill();
  }, [blessing]);

  if (!blessing) return null;

  const text = `✨  "${blessing.message}"  —  ${blessing.guest_name}  `;

  return (
    <div
      ref={stripRef}
      className="overflow-hidden rounded-2xl py-2.5 mb-3 flex items-center"
      style={{
        backgroundColor: `${primaryColor}12`,
        borderRight: `3px solid ${primaryColor}`,
      }}
    >
      <div className="overflow-hidden flex-1">
        <div
          ref={trackRef}
          className="flex whitespace-nowrap will-change-transform"
        >
          <span
            className="text-sm font-medium px-4"
            style={{ color: primaryColor }}
          >
            {text}
          </span>
          <span
            className="text-sm font-medium px-4"
            style={{ color: primaryColor }}
          >
            {text}
          </span>
        </div>
      </div>
    </div>
  );
};

// ---- Main Component ----
const Home = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isRegistered, setIsRegistered] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState(null);

  // Persistent device fingerprint — created once, never wiped on "change user"
  const [deviceId] = useState(() => {
    let did = localStorage.getItem("device_id");
    if (!did) {
      did = crypto.randomUUID();
      localStorage.setItem("device_id", did);
    }
    return did;
  });

  const [myTable, setMyTable] = useState(null);
  const [showMatesModal, setShowMatesModal] = useState(false);
  const [tableMates, setTableMates] = useState([]);
  const [loadingMates, setLoadingMates] = useState(false);

  const [hasUnreadDating, setHasUnreadDating] = useState(false);
  const [infoModal, setInfoModal] = useState(null);

  const [carouselPhotos, setCarouselPhotos] = useState([]);
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const modulesCarouselRef = useRef(null);

  // Fetch event data
  useEffect(() => {
    const savedName = localStorage.getItem("guest_name");
    const savedId = localStorage.getItem("guest_id");
    if (savedName && savedId) setIsRegistered(true);

    let isMounted = true;
    const fetchEvent = async () => {
      try {
        const { data, error } = await supabase
          .from("events")
          .select(
            "id, name, active_modules, design_config, event_date, location",
          )
          .eq("id", id)
          .single();
        if (error) throw error;
        if (isMounted) setEventData(data);
      } catch (error) {
        console.error("Error fetching event:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (id) fetchEvent();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Fetch seating
  useEffect(() => {
    if (!isRegistered || !eventData?.active_modules?.seating) return;
    let isMounted = true;
    const fetchMyTable = async () => {
      const guestName = localStorage.getItem("guest_name");
      try {
        const { data, error } = await supabase
          .from("seating")
          .select("table_number")
          .eq("event_id", id)
          .ilike("guest_name", `%${guestName.trim()}%`)
          .limit(1);
        if (error) throw error;
        if (isMounted) {
          setMyTable(
            data?.length > 0
              ? { found: true, number: data[0].table_number }
              : { found: false },
          );
        }
      } catch {
        if (isMounted) setMyTable({ found: false });
      }
    };
    fetchMyTable();
    return () => {
      isMounted = false;
    };
  }, [isRegistered, eventData, id]);

  // Check unread dating messages
  useEffect(() => {
    if (!isRegistered || !eventData?.active_modules?.dating) return;
    const guestId = localStorage.getItem("guest_id");
    if (!guestId) return;
    let isMounted = true;
    const checkUnread = async () => {
      try {
        const { count, error } = await supabase
          .from("dating_messages")
          .select("id", { count: "exact", head: true })
          .eq("event_id", id)
          .eq("receiver_id", guestId)
          .eq("is_read", false);
        if (!error && isMounted) setHasUnreadDating(count > 0);
      } catch (e) {
        console.error(e);
      }
    };
    checkUnread();
    return () => {
      isMounted = false;
    };
  }, [isRegistered, eventData, id]);

  // Fetch photos + realtime subscription
  useEffect(() => {
    if (!isRegistered || !eventData?.active_modules?.photo || !id) return;
    let isMounted = true;
    const channelId = `home_photos_${id}_${crypto.randomUUID()}`;

    const fetchPhotos = async () => {
      try {
        const { data } = await supabase
          .from("photos")
          .select("id, image_url")
          .eq("event_id", id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (isMounted) setCarouselPhotos(data || []);
      } catch (e) {
        console.error("Error fetching photos:", e);
      }
    };
    fetchPhotos();

    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photos",
          filter: `event_id=eq.${id}`,
        },
        (payload) => {
          if (isMounted && payload.new?.image_url)
            setCarouselPhotos((prev) => [payload.new, ...prev].slice(0, 10));
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [isRegistered, eventData, id]);

  // GSAP entry animations
  useEffect(() => {
    if (isRegistered && eventData && !loading) {
      gsap.fromTo(
        ".header-anim",
        { y: -30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
      );
      gsap.fromTo(
        ".module-card-anim",
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.08,
          ease: "back.out(1.2)",
        },
      );
    }
  }, [isRegistered, eventData, loading]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!nameInput.trim() || !termsAccepted || isRegistering) return;

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      const tentativeGuestId = crypto.randomUUID();

      const { data, error } = await supabase.rpc("register_guest", {
        p_event_id: id,
        p_guest_name: nameInput.trim(),
        p_device_id: deviceId,
        p_guest_id: tentativeGuestId,
      });

      if (error) throw error;

      if (!data.ok) {
        setRegistrationError(
          "השם הזה כבר רשום ממכשיר אחר. אנא השתמשו בשם אחר.",
        );
        return;
      }

      // Use the guest_id returned from DB (preserves identity for returning users)
      localStorage.setItem("guest_name", nameInput.trim());
      localStorage.setItem("guest_id", data.guest_id);
      setIsRegistered(true);
    } catch (err) {
      console.error("Registration error:", err);
      const errorMsg = err?.message || "Unknown error";
      const errorStatus = err?.status || err?.statusCode;
      console.error("Error details:", { errorMsg, errorStatus, fullError: err });

      if (errorStatus === 404 || errorMsg.includes("not found")) {
        setRegistrationError("אירוע זה לא נמצא. בדקו את קוד ה-QR.");
      } else if (errorStatus === 400 || errorMsg.includes("duplicate")) {
        setRegistrationError("השם הזה כבר רשום ממכשיר אחר. אנא השתמשו בשם אחר.");
      } else {
        setRegistrationError("שגיאה בהתחברות. בדקו את החיבור לאינטרנט.");
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleChangeName = () => {
    localStorage.removeItem("guest_name");
    localStorage.removeItem("guest_id");
    setNameInput("");
    setTermsAccepted(false);
    setMyTable(null);
    setCarouselPhotos([]);
    setIsRegistered(false);
  };

  const fetchTableMates = async (tableNum) => {
    setLoadingMates(true);
    setShowMatesModal(true);
    try {
      const guestName = localStorage.getItem("guest_name");
      const { data, error } = await supabase
        .from("seating")
        .select("guest_name")
        .eq("event_id", eventData.id)
        .eq("table_number", tableNum);
      if (error) throw error;
      setTableMates(
        data.filter(
          (g) => g.guest_name.toLowerCase() !== guestName.toLowerCase(),
        ),
      );
    } catch (error) {
      console.error("Error fetching mates:", error);
    } finally {
      setLoadingMates(false);
    }
  };

  const openInfo = (e, moduleKey) => {
    e.stopPropagation();
    setInfoModal(MODULES_INFO[moduleKey]);
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-slate-900 flex flex-col items-center justify-center"
        dir="rtl"
      >
        <Loader2 className="animate-spin text-white mb-4" size={48} />
        <p className="text-white/50 text-sm font-medium">טוען את האירוע...</p>
      </div>
    );
  }

  if (!eventData)
    return (
      <div
        className="min-h-screen flex items-center justify-center text-slate-500"
        dir="rtl"
      >
        לא נמצא אירוע.
      </div>
    );

  const { name, active_modules, design_config } = eventData;
  const { background = "#f8fafc", primary = "#3b82f6" } =
    design_config?.colors || {};
  const guestNameStr = localStorage.getItem("guest_name");

  const secondaryModules = [
    active_modules?.dating && "dating",
    active_modules?.icebreaker && "icebreaker",
    active_modules?.rideshare && "rideshare",
    active_modules?.blessings && "blessings",
  ].filter(Boolean);

  // --- Registration Screen ---
  if (!isRegistered) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-1000"
        style={{ backgroundColor: background }}
        dir="rtl"
      >
        <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.10)] w-full max-w-sm text-center animate-in zoom-in duration-500">
          <div
            className="w-16 h-16 rounded-[1.2rem] flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: `${primary}18` }}
          >
            <PartyPopper style={{ color: primary }} size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-1">
            ברוכים הבאים!
          </h1>
          <p className="text-slate-500 mb-8 font-medium text-sm">
            ל-<span className="font-bold text-slate-700">{name}</span>
            <br />
            מלאו את שמכם כדי להתחיל בחגיגה
          </p>
          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (registrationError) setRegistrationError(null);
              }}
              placeholder="שם מלא (לדוגמה: תקווה משולם)"
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[1.2rem] focus:ring-2 outline-none text-center text-lg font-bold transition-all"
              style={{ "--tw-ring-color": primary }}
              required
              disabled={isRegistering}
            />

            {/* Error banner */}
            {registrationError && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium px-4 py-3 rounded-[1rem]">
                <X size={15} className="shrink-0" />
                {registrationError}
              </div>
            )}

            <div className="flex items-start gap-2 text-right mt-2">
              <input
                type="checkbox"
                required
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 cursor-pointer shrink-0 accent-current"
                style={{ accentColor: primary }}
              />
              <label
                htmlFor="terms"
                className="text-xs font-medium text-slate-500 leading-tight"
              >
                אני מסכים/ה ל
                <a
                  href="/terms"
                  target="_blank"
                  className="underline font-bold"
                >
                  תנאי השימוש
                </a>{" "}
                ול
                <a
                  href="/privacy"
                  target="_blank"
                  className="underline font-bold"
                >
                  מדיניות הפרטיות
                </a>{" "}
                של Eventick, ומאשר/ת את הצגת שמי ותמונותיי לשאר אורחי האירוע.
              </label>
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full text-white font-black py-4 rounded-[1.2rem] text-lg shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform mt-4 flex items-center justify-center gap-2 disabled:opacity-70 disabled:scale-100"
              style={{ backgroundColor: primary }}
            >
              {isRegistering ? (
                <>
                  <Loader2 size={20} className="animate-spin" /> מתחבר...
                </>
              ) : (
                "היכנסו לאירוע"
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full text-slate-400 hover:text-slate-600 font-bold text-sm py-2 transition-colors flex items-center justify-center gap-1 mt-1"
            >
              <ChevronRight size={16} /> חזור לעמוד הסריקה
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Main Event Screen ---
  return (
    <div
      className="min-h-screen flex flex-col font-sans pb-12 transition-colors duration-1000"
      style={{ backgroundColor: background }}
      dir="rtl"
    >
      {/* Header */}
      <div
        className="rounded-b-[3rem] pt-12 pb-24 px-6 relative z-10 shadow-lg text-center flex flex-col items-center transition-colors duration-1000"
        style={{ backgroundColor: primary }}
      >
        <div className="max-w-md w-full header-anim">
          <p className="text-white/60 font-bold text-xs uppercase tracking-widest mb-1">
            {getGreeting()}
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-1 leading-tight drop-shadow-sm">
            {name}
          </h1>
          {eventData.event_date && (
            <p className="text-white/60 text-xs font-bold mb-5">
              {new Date(eventData.event_date).toLocaleDateString("he-IL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {eventData.location ? ` · ${eventData.location}` : ""}
            </p>
          )}

          {/* User bar */}
          <div className="bg-black/20 rounded-[1.5rem] p-3.5 flex items-center justify-between border border-white/10 backdrop-blur-sm gap-3">
            <div className="flex flex-col text-right min-w-0">
              <span className="text-white/50 text-[10px] font-bold">
                מחובר כ:
              </span>
              <span className="text-white font-bold text-sm truncate">
                {guestNameStr}
              </span>
            </div>
            <button
              onClick={handleChangeName}
              className="shrink-0 text-xs bg-white/15 hover:bg-white/25 text-white px-3.5 py-2 rounded-xl transition-colors font-bold flex items-center gap-1.5 active:scale-95 border border-white/20"
            >
              <UserX size={14} /> החלף משתמש
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="px-3 -mt-10 relative z-20 w-full max-w-lg mx-auto flex-1 flex flex-col">
        {/* Blessings Strip Ticker */}
        {active_modules.blessings && (
          <BlessingsStrip eventId={id} primaryColor={primary} />
        )}

        {/* Module Cards — stacked layout */}
        <div className="flex flex-col gap-3">
          {/* 1. Seating Card — first */}
          {active_modules.seating && (
            <div className={`${GLASS} p-6`}>
              <button
                onClick={(e) => openInfo(e, "seating")}
                className="absolute top-4 left-4 text-slate-300 hover:text-slate-500 z-10 p-1 transition-colors"
                aria-label="מידע"
              >
                <Info size={16} />
              </button>

              {myTable === null ? (
                <div className="flex justify-center py-6">
                  <Loader2
                    className="animate-spin"
                    size={32}
                    style={{ color: primary }}
                  />
                </div>
              ) : myTable.found ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                      style={{ backgroundColor: `${primary}18` }}
                    >
                      <MapPin size={22} style={{ color: primary }} />
                    </div>
                    <p className="text-slate-400 font-bold text-xs mb-0.5">
                      השולחן שלך
                    </p>
                    <div
                      className="text-7xl font-black leading-none"
                      style={{ color: primary }}
                    >
                      {myTable.number}
                    </div>
                  </div>

                  <button
                    onClick={() => fetchTableMates(myTable.number)}
                    className="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-[1.5rem] hover:opacity-80 active:scale-[0.97] transition-all border-2"
                    style={{
                      backgroundColor: `${primary}10`,
                      borderColor: `${primary}20`,
                      color: primary,
                    }}
                  >
                    <Users size={26} />
                    <span className="text-xs font-black text-center leading-snug">
                      מי איתי
                      <br />
                      בשולחן?
                    </span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <h3 className="text-xl font-black text-slate-800 mb-1">
                    לא נמצא שולחן
                  </h3>
                  <p className="text-slate-400 text-sm font-medium mb-5">
                    לא מצאנו את השם &quot;{guestNameStr}&quot;.
                  </p>
                  <button
                    onClick={handleChangeName}
                    className="w-full bg-slate-50/80 hover:bg-slate-100/80 text-slate-700 font-bold py-3.5 px-6 rounded-[1.2rem] transition-colors flex justify-center items-center gap-2"
                  >
                    <RefreshCw size={16} /> נסו שם אחר
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. Photo Marquee Card — second */}
          {active_modules.photo && (
            <PhotoMarqueeCard
              photos={carouselPhotos}
              primaryColor={primary}
              eventId={id}
              navigate={navigate}
              openInfo={openInfo}
            />
          )}

          {/* 3. Secondary modules — horizontal swipeable carousel */}
          {secondaryModules.length > 0 && (
            <div>
              <div
                ref={modulesCarouselRef}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                onScroll={() => {
                  const el = modulesCarouselRef.current;
                  if (!el) return;
                  const page = Math.round(el.scrollLeft / el.clientWidth);
                  setActiveModuleIdx(page);
                }}
              >
                {active_modules.dating && (
                  <div
                    className="snap-start shrink-0"
                    style={{ width: "calc(50% - 6px)" }}
                  >
                    <ActionModuleCard
                      mKey="dating"
                      primaryColor={primary}
                      onClick={() => navigate(`/dating?event=${id}`)}
                      openInfo={openInfo}
                      hasBadge={hasUnreadDating}
                    />
                  </div>
                )}
                {active_modules.icebreaker && (
                  <div
                    className="snap-start shrink-0"
                    style={{ width: "calc(50% - 6px)" }}
                  >
                    <ActionModuleCard
                      mKey="icebreaker"
                      primaryColor={primary}
                      onClick={() => navigate(`/icebreaker?event=${id}`)}
                      openInfo={openInfo}
                    />
                  </div>
                )}
                {active_modules.rideshare && (
                  <div
                    className="snap-start shrink-0"
                    style={{ width: "calc(50% - 6px)" }}
                  >
                    <RideshareHomeCard
                      primaryColor={primary}
                      eventId={id}
                      navigate={navigate}
                      openInfo={openInfo}
                    />
                  </div>
                )}
                {active_modules.blessings && (
                  <div
                    className="snap-start shrink-0"
                    style={{ width: "calc(50% - 6px)" }}
                  >
                    <BlessingsHomeCard
                      primaryColor={primary}
                      eventId={id}
                      navigate={navigate}
                      openInfo={openInfo}
                    />
                  </div>
                )}
              </div>

              {/* Pill pagination — shown only when scrolling is needed (>2 modules) */}
              {secondaryModules.length > 2 && (
                <div className="flex justify-center items-center gap-[5px] mt-3">
                  {Array.from({
                    length: Math.ceil(secondaryModules.length / 2),
                  }).map((_, i) => {
                    const active = activeModuleIdx === i;
                    return (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-300 ease-in-out"
                        style={{
                          width: active ? 22 : 7,
                          height: 7,
                          backgroundColor: active
                            ? primary
                            : "rgba(120,110,100,0.25)",
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400/60 font-medium mt-6 pb-2">
          מופעל ע&quot;י Eventick
        </p>
      </div>

      {/* Info Modal */}
      {infoModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in"
          onClick={() => setInfoModal(null)}
        >
          <div
            className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl relative animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setInfoModal(null)}
              className="absolute top-4 right-4 text-slate-400 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <div
              className={`w-20 h-20 mx-auto rounded-[1.5rem] flex items-center justify-center mb-6 ${infoModal.bg}`}
            >
              <infoModal.icon size={40} className={infoModal.color} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3">
              {infoModal.title}
            </h3>
            <p className="text-slate-500 font-medium leading-relaxed mb-8 text-sm">
              {infoModal.description}
            </p>
            <button
              onClick={() => setInfoModal(null)}
              className="w-full text-white font-bold py-4 rounded-[1.2rem] transition-colors hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              הבנתי, תודה!
            </button>
          </div>
        </div>
      )}

      {/* Table Mates Modal */}
      {showMatesModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowMatesModal(false)}
        >
          <div
            className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl relative animate-in zoom-in-95 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowMatesModal(false)}
              className="absolute top-4 right-4 text-slate-400 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors z-10"
            >
              <X size={20} />
            </button>
            <div
              className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${primary}18` }}
            >
              <Users size={36} style={{ color: primary }} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-1">
              השותפים לשולחן
            </h3>
            <p className="text-slate-400 font-bold mb-6 text-sm">
              שולחן מספר {myTable?.number}
            </p>
            <div className="overflow-y-auto bg-slate-50 rounded-[1.5rem] p-5 text-right border border-slate-100 flex-1">
              {loadingMates ? (
                <div className="flex justify-center py-6">
                  <Loader2
                    className="animate-spin"
                    size={28}
                    style={{ color: primary }}
                  />
                </div>
              ) : tableMates.length > 0 ? (
                <ul className="space-y-3">
                  {tableMates.map((mate, idx) => (
                    <li
                      key={idx}
                      className="text-slate-700 font-bold flex items-center gap-3"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: primary }}
                      />
                      <span>{mate.guest_name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 text-center py-4 font-medium leading-relaxed text-sm">
                  נראה שאת/ה לבד בשולחן הזה כרגע.
                  <br />
                  אולי זה זמן טוב להכיר אנשים חדשים 😉
                </p>
              )}
            </div>
            <button
              onClick={() => setShowMatesModal(false)}
              className="w-full mt-4 text-white font-bold py-4 rounded-[1.2rem] transition-colors hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
