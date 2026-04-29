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

// Shared glassmorphism card style with celebration-forward design
const GLASS =
  "module-card-anim relative rounded-[2.5rem] overflow-hidden shadow-elevated card-hover glass-card transition-smooth";

const PhotoMarqueeCard = ({
  photos,
  primaryColor,
  eventId,
  navigate,
  openInfo,
}) => {
  const MIN_VISIBLE = 5;
  const repeatsPerCopy = Math.max(
    1,
    Math.ceil(MIN_VISIBLE / Math.max(1, photos.length)),
  );
  const singleCopy = Array.from(
    { length: repeatsPerCopy },
    () => photos,
  ).flat();

  const LOOP_COPIES = 4;
  const allPhotos = Array.from(
    { length: LOOP_COPIES },
    () => singleCopy,
  ).flat();

  const duration = Math.max(18, photos.length * 3);

  return (
    <div className={`${GLASS} flex flex-col overflow-hidden group`}>
      <button
        onClick={(e) => openInfo(e, "photo")}
        className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 z-20 p-2 bg-white/50 hover:bg-white/80 rounded-full transition-smooth"
        aria-label="מידע"
      >
        <Info size={18} />
      </button>

      {/* Marquee strip with enhanced visual */}
      <div
        className="relative h-40 md:h-48 overflow-hidden rounded-t-[2.2rem]"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}08 100%)`,
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
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

      {/* Bottom with enhanced styling */}
      <div className="p-6 text-center bg-gradient-to-br from-white to-slate-50/50">
        <h3
          className="font-black text-slate-900 text-lg mb-1"
          style={{ color: primaryColor }}
        >
          כל אחד צלם
        </h3>
        <p className="text-slate-500 text-sm mb-5 font-medium">
          העלו תמונות לאלבום המשותף
        </p>
        <button
          onClick={() => navigate(`/photos?event=${eventId}`)}
          className="w-full font-bold py-3 rounded-[1.2rem] text-sm flex items-center justify-center gap-2 hover:opacity-85 active:scale-[0.97] transition-all text-white shadow-elevated button-pulse"
          style={{
            backgroundColor: primaryColor,
            boxShadow: `0 10px 30px ${primaryColor}40`,
          }}
        >
          <Camera size={18} /> פתח מצלמה / גלריה
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
      className={`${GLASS} p-5 flex flex-col items-center text-center h-full group`}
    >
      <button
        onClick={(e) => openInfo(e, mKey)}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 z-10 p-2 bg-white/50 hover:bg-white/80 rounded-full transition-smooth"
        aria-label="מידע"
      >
        <Info size={16} />
      </button>

      {hasBadge && (
        <span className="absolute top-3 left-3 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-white shadow-lg" />
        </span>
      )}

      <div
        className={`w-14 h-14 ${info.bg} rounded-[1.2rem] flex items-center justify-center mb-3 mt-2 group-hover:scale-110 transition-smooth shadow-elevated`}
      >
        <info.icon size={24} className={info.color} />
      </div>

      <h3
        className="font-black text-slate-900 text-sm leading-tight mb-1.5"
        style={{ fontSize: "1.1rem" }}
      >
        {info.title}
      </h3>
      <p className="text-slate-500 text-xs leading-relaxed line-clamp-3 mb-4 flex-1 font-medium">
        {info.description}
      </p>

      <button
        onClick={onClick}
        className="w-full font-bold py-2.5 rounded-[1rem] text-xs flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-[0.97] transition-smooth mt-auto button-pulse"
        style={{
          backgroundColor: `${primaryColor}15`,
          color: primaryColor,
          border: `1.5px solid ${primaryColor}30`,
        }}
      >
        כניסה <ChevronLeft size={14} />
      </button>
    </div>
  );
};

// ---- Rideshare Card (2 role buttons) ----
const RideshareHomeCard = ({ primaryColor, eventId, navigate, openInfo }) => (
  <div
    className={`${GLASS} p-5 flex flex-col items-center text-center h-full group`}
  >
    <button
      onClick={(e) => openInfo(e, "rideshare")}
      className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 z-10 p-2 bg-white/50 hover:bg-white/80 rounded-full transition-smooth"
      aria-label="מידע"
    >
      <Info size={16} />
    </button>

    <div className="w-14 h-14 bg-amber-50 rounded-[1.2rem] flex items-center justify-center mb-3 mt-2 group-hover:scale-110 transition-smooth shadow-elevated">
      <Car size={24} className="text-amber-500" />
    </div>

    <h3
      className="font-black text-slate-900 text-sm mb-1.5"
      style={{ fontSize: "1.1rem" }}
    >
      לוח טרמפים
    </h3>
    <p className="text-slate-500 text-xs mb-4 leading-relaxed flex-1 line-clamp-3 font-medium">
      שתפו נסיעות לאחר האירוע
    </p>

    <div className="w-full space-y-2 mt-auto">
      <button
        onClick={() => navigate(`/rideshare?event=${eventId}&role=driver`)}
        className="w-full font-bold py-2.5 rounded-[1rem] text-xs hover:opacity-85 active:scale-[0.97] transition-smooth text-white flex items-center justify-center gap-1.5 button-pulse shadow-elevated"
        style={{
          backgroundColor: primaryColor,
          boxShadow: `0 8px 20px ${primaryColor}40`,
        }}
      >
        <Car size={14} /> אני מציע 🚗
      </button>
      <button
        onClick={() => navigate(`/rideshare?event=${eventId}&role=seeker`)}
        className="w-full font-bold py-2.5 rounded-[1rem] text-xs hover:opacity-90 active:scale-[0.97] transition-smooth flex items-center justify-center gap-1.5 border-2"
        style={{
          backgroundColor: `${primaryColor}10`,
          color: primaryColor,
          borderColor: `${primaryColor}30`,
        }}
      >
        <Users size={14} /> אני מחפש 🙋
      </button>
    </div>
  </div>
);

// ---- Blessings Card ----
const BlessingsHomeCard = ({ primaryColor, eventId, navigate, openInfo }) => (
  <div
    className={`${GLASS} p-5 flex flex-col items-center text-center h-full group`}
  >
    <button
      onClick={(e) => openInfo(e, "blessings")}
      className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 z-10 p-2 bg-white/50 hover:bg-white/80 rounded-full transition-smooth"
      aria-label="מידע"
    >
      <Info size={16} />
    </button>

    <div className="w-14 h-14 bg-purple-50 rounded-[1.2rem] flex items-center justify-center mb-3 mt-2 group-hover:scale-110 transition-smooth shadow-elevated">
      <MessageCircle size={26} className="text-purple-500" />
    </div>

    <h3
      className="font-black text-slate-900 text-sm mb-1.5"
      style={{ fontSize: "1.1rem" }}
    >
      ספר ברכות
    </h3>
    <p className="text-slate-500 text-xs mb-5 leading-relaxed font-medium flex-1">
      כתבו ברכה לבעלי השמחה
    </p>

    <button
      onClick={() => navigate(`/blessing?event=${eventId}`)}
      className="w-full font-bold py-2.5 rounded-[1rem] text-xs hover:opacity-85 active:scale-[0.97] transition-smooth text-white flex items-center justify-center gap-1.5 button-pulse shadow-elevated"
      style={{
        backgroundColor: primaryColor,
        boxShadow: `0 10px 25px ${primaryColor}40`,
      }}
    >
      <MessageCircle size={15} /> הוסף ברכה ✍️
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

    // Real-time listener for new approved blessings
    const channelId = `blessings_ticker_${eventId}_${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "blessings",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (!isMounted || !payload?.new) return;
          // Update if blessing is approved
          if (payload.new.is_approved === true) {
            if (isMounted) {
              setBlessing({
                guest_name: payload.new.guest_name,
                message: payload.new.message,
              });
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "blessings",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (!isMounted || !payload?.new) return;
          // If a blessing was approved or edited
          if (payload.new.is_approved === true) {
            if (isMounted) {
              setBlessing({
                guest_name: payload.new.guest_name,
                message: payload.new.message,
              });
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "blessings",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          if (!isMounted) return;
          // If a blessing is deleted, fetch the latest
          fetchLatest();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
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

  const text = `✨  "${blessing.message}"  —  ${blessing.guest_name}  `;

  return (
    <div
      ref={stripRef}
      className="overflow-hidden rounded-[1.5rem] py-3.5 mb-4 flex items-center shadow-elevated glass-card transition-smooth"
      style={{
        borderLeft: `4px solid ${primaryColor}`,
      }}
    >
      <div className="overflow-hidden flex-1">
        <div
          ref={trackRef}
          className="flex whitespace-nowrap will-change-transform"
        >
          <span
            className="text-sm font-bold px-4"
            style={{ color: primaryColor }}
          >
            {text}
          </span>
          <span
            className="text-sm font-bold px-4"
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
          if (!isMounted || !payload?.new?.image_url) return;
          setCarouselPhotos((prev) => [payload.new, ...prev].slice(0, 10));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "photos",
          filter: `event_id=eq.${id}`,
        },
        (payload) => {
          if (!isMounted || !payload?.old?.id) return;
          setCarouselPhotos((prev) =>
            prev.filter((p) => p.id !== payload.old.id),
          );
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

  // פונקציית ההרשמה הפשוטה והאמינה!
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!nameInput.trim() || !termsAccepted || isRegistering) return;

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      // שמירה מקומית בלבד, ללא קריאות מורכבות ל-DB שעשויות להיכשל
      localStorage.setItem("guest_name", nameInput.trim());

      let guestId = localStorage.getItem("guest_id");
      if (!guestId) {
        guestId = crypto.randomUUID();
        localStorage.setItem("guest_id", guestId);
      }

      setIsRegistered(true);
    } catch (err) {
      console.error(err);
      setRegistrationError("אירעה שגיאה. אנא נסו שוב.");
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
        <div
          className="glass-card shadow-deep p-8 rounded-[2.5rem] w-full max-w-sm text-center animate-in zoom-in duration-500"
          style={{
            animation: "bounce-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
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
              className="w-full p-4 bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-[1.2rem] focus:ring-2 outline-none text-center text-lg font-bold transition-smooth"
              style={{
                "--tw-ring-color": primary,
                borderColor: `${primary}40`,
              }}
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
              className="w-full text-white font-black py-4 rounded-[1.2rem] text-lg shadow-deep hover:opacity-85 active:scale-[0.97] transition-smooth mt-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:scale-100 button-pulse"
              style={{
                backgroundColor: primary,
                boxShadow: `0 12px 35px ${primary}50`,
              }}
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
      {/* Header with gradient background */}
      <div
        className="rounded-b-[3.5rem] pt-16 pb-28 px-6 relative z-10 shadow-deep text-center flex flex-col items-center transition-colors duration-1000 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 100%)`,
          boxShadow: `0 20px 50px ${primary}30`,
        }}
      >
        {/* Decorative floating elements */}
        <div className="absolute top-6 right-10 w-20 h-20 rounded-full opacity-10 bg-white float-effect" />
        <div className="absolute bottom-8 left-8 w-32 h-32 rounded-full opacity-10 bg-white float-delayed" />

        <div className="max-w-md w-full header-anim relative z-10">
          <p className="text-white/70 font-bold text-xs uppercase tracking-widest mb-2">
            {getGreeting()}
          </p>
          <h1
            className="text-4xl md:text-5xl font-black text-white mb-2 leading-tight drop-shadow-lg"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
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

          {/* User bar with enhanced styling */}
          <div className="bg-white/15 rounded-[1.5rem] p-4 flex items-center justify-between border border-white/30 backdrop-blur-md gap-3 shadow-elevated hover:bg-white/20 transition-smooth">
            <div className="flex flex-col text-right min-w-0">
              <span className="text-white/60 text-[11px] font-bold uppercase tracking-wider">
                מחובר כ:
              </span>
              <span className="text-white font-black text-sm truncate">
                {guestNameStr}
              </span>
            </div>
            <button
              onClick={handleChangeName}
              className="shrink-0 text-xs bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-[0.9rem] transition-smooth font-bold flex items-center gap-1.5 active:scale-95 border border-white/40 button-pulse"
            >
              <UserX size={15} /> החלף
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
            <div className={`${GLASS} p-6 relative overflow-hidden group`}>
              {/* Decorative background */}
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  background: `linear-gradient(135deg, ${primary} 0%, transparent 100%)`,
                }}
              />

              <button
                onClick={(e) => openInfo(e, "seating")}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10 p-2 bg-white/50 hover:bg-white/80 rounded-full transition-smooth"
                aria-label="מידע"
              >
                <Info size={18} />
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
                <div className="flex items-center justify-between gap-5 relative z-10">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-3 shadow-elevated group-hover:scale-110 transition-smooth"
                      style={{
                        backgroundColor: `${primary}18`,
                        boxShadow: `0 10px 30px ${primary}25`,
                      }}
                    >
                      <MapPin size={28} style={{ color: primary }} />
                    </div>
                    <p className="text-slate-500 font-bold text-xs mb-1 uppercase tracking-wider">
                      השולחן שלך
                    </p>
                    <div
                      className="text-7xl font-black leading-none"
                      style={{
                        color: primary,
                        fontFamily: "'Playfair Display', serif",
                        textShadow: `0 4px 12px ${primary}30`,
                      }}
                    >
                      {myTable.number}
                    </div>
                  </div>

                  <button
                    onClick={() => fetchTableMates(myTable.number)}
                    className="flex-1 flex flex-col items-center justify-center gap-2 py-6 rounded-[1.5rem] hover:opacity-85 active:scale-[0.97] transition-smooth border-2 shadow-elevated card-hover"
                    style={{
                      backgroundColor: `${primary}12`,
                      borderColor: `${primary}25`,
                      color: primary,
                    }}
                  >
                    <Users size={28} />
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
            className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
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
