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
import { getOrCreateDeviceId } from "../utils/deviceId";
import { safeGetItem, safeRemoveItem, safeSetItem } from "../lib/safeStorage";
import {
  CLAY_CARD,
  CLAY_INSET,
  DEFAULT_PRIMARY,
  clayButtonStyle,
  clayHeroStyle,
} from "../lib/clay";
import { accentOn } from "../lib/colors";
import { useModalBehavior } from "../components/Modal";
import gsap from "gsap";
import { useEventBackdrop } from "../lib/useEventBackdrop";

const MODULES_INFO = {
  photo: {
    title: "כל אחד צלם",
    description: "העלו תמונות לאלבום המשותף של האירוע",
    icon: Camera,
    color: "text-orange-800",
    bg: "bg-orange-50",
  },
  dating: {
    title: "דייט-ליין",
    description: "הרשת החברתית של האירוע לרווקים ורווקות",
    icon: Heart,
    color: "text-rose-700",
    bg: "bg-rose-50",
  },
  icebreaker: {
    title: "שובר קרח",
    description: "משחק משימות חברתי עם אורחים אחרים",
    icon: Zap,
    color: "text-cyan-800",
    bg: "bg-cyan-50",
  },
  rideshare: {
    title: "לוח טרמפים",
    description: "שתפו נסיעות לאחר האירוע",
    icon: Car,
    color: "text-amber-800",
    bg: "bg-amber-50",
  },
  seating: {
    title: "סידור הושבה",
    description: "מצאו את השולחן שלכם ואת בני השולחן",
    icon: MapPin,
    color: "text-emerald-800",
    bg: "bg-emerald-50",
  },
  blessings: {
    title: "ספר ברכות",
    description: "כתבו ברכה וצרפו תמונה לבעלי השמחה",
    icon: MessageCircle,
    color: "text-purple-700",
    bg: "bg-purple-50",
  },
};

// ב-ilike התווים % ו-_ הם תווים כלליים, ו-PostgREST מתרגם גם * ל-%. שם שמכיל
// אותם היה מתאים לשורות של אורחים אחרים.
const escapeLikePattern = (value) => value.replace(/[\\%_*]/g, "\\$&");

const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 17) return "צהריים טובים";
  if (h >= 17 && h < 21) return "ערב טוב";
  return "לילה טוב";
};

// כרטיס מודול בדף הבית: כרטיס Clay משותף + אנימציית הכניסה של הדף.
const CLAY = `module-card-anim relative ${CLAY_CARD} transition-all duration-300`;
const clayIconDiscShadow =
  "inset 2px 2px 5px rgba(255,255,255,0.4), inset -2px -2px 5px rgba(0,0,0,0.12)";

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
    <div className={`${CLAY} flex flex-col overflow-hidden group`}>
      <button
        onClick={(e) => openInfo(e, "photo")}
        className="absolute top-4 left-4 text-clay-muted hover:text-slate-600 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-clay-surface shadow-clay-sm active:shadow-clay-pressed transition-all"
        aria-label="מידע"
      >
        <Info size={18} />
      </button>

      {/* Marquee strip — DEBOSSED well carved into the clay */}
      <div
        className={`relative h-40 md:h-48 overflow-hidden rounded-t-[2.5rem] m-2 mb-0 rounded-[2rem] ${CLAY_INSET}`}
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      >
        {photos.length > 0 ? (
          <div
            className="marquee-track flex gap-3 h-full will-change-transform px-4 py-3"
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
                className="h-full w-28 md:w-32 object-cover rounded-clay-field shrink-0 shadow-[4px_4px_10px_rgba(0,0,0,0.15)]"
                loading="lazy"
                style={{ filter: "brightness(0.98) contrast(1.02)" }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <Camera size={36} className="text-slate-300" />
            <p className="text-xs mt-2 font-bold text-clay-muted">
              אין תמונות עדיין
            </p>
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="p-6 text-center">
        <h3 className="font-black text-lg mb-1" style={{ color: accentOn(primaryColor) }}>
          כל אחד צלם
        </h3>
        <p className="text-clay-muted text-sm mb-5 font-medium">
          העלו תמונות לאלבום המשותף
        </p>
        <button
          onClick={() => navigate(`/photos?event=${eventId}`)}
          className="w-full font-bold py-3.5 rounded-full text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all text-white"
          style={clayButtonStyle(primaryColor)}
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
      className={`${CLAY} p-5 flex flex-col items-center text-center h-full group`}
    >
      <button
        onClick={(e) => openInfo(e, mKey)}
        className="absolute top-2 right-2 text-clay-muted hover:text-slate-600 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-clay-surface shadow-clay-sm transition-all"
        aria-label="מידע"
      >
        <Info size={16} />
      </button>

      {hasBadge && (
        <span className="absolute top-3 left-3 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-clay-surface shadow-lg" />
        </span>
      )}

      <div
        className={`w-16 h-16 ${info.bg} rounded-clay-field flex items-center justify-center mb-3 mt-2 group-hover:scale-110 transition-transform`}
        style={{ boxShadow: clayIconDiscShadow }}
      >
        <info.icon size={26} className={info.color} />
      </div>

      <h3
        className="font-black text-slate-700 leading-tight mb-1.5"
        style={{ fontSize: "1.1rem" }}
      >
        {info.title}
      </h3>
      <p className="text-clay-muted text-xs leading-relaxed line-clamp-3 mb-4 flex-1 font-medium">
        {info.description}
      </p>

      <button
        onClick={onClick}
        className="w-full font-bold py-3 rounded-full text-xs flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all mt-auto text-slate-600 bg-clay-surface shadow-clay-sm active:shadow-clay-pressed"
        style={{ color: accentOn(primaryColor) }}
      >
        כניסה <ChevronLeft size={14} />
      </button>
    </div>
  );
};

// ---- Rideshare Card (2 role buttons) ----
const RideshareHomeCard = ({ primaryColor, eventId, navigate, openInfo }) => (
  <div
    className={`${CLAY} p-5 flex flex-col items-center text-center h-full group`}
  >
    <button
      onClick={(e) => openInfo(e, "rideshare")}
      className="absolute top-2 right-2 text-clay-muted hover:text-slate-600 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-clay-surface shadow-clay-sm transition-all"
      aria-label="מידע"
    >
      <Info size={16} />
    </button>

    <div
      className="w-16 h-16 bg-amber-50 rounded-clay-field flex items-center justify-center mb-3 mt-2 group-hover:scale-110 transition-transform"
      style={{ boxShadow: clayIconDiscShadow }}
    >
      <Car size={26} className="text-amber-800" />
    </div>

    <h3
      className="font-black text-slate-700 mb-1.5"
      style={{ fontSize: "1.1rem" }}
    >
      לוח טרמפים
    </h3>
    <p className="text-clay-muted text-xs mb-4 leading-relaxed flex-1 line-clamp-3 font-medium">
      שתפו נסיעות לאחר האירוע
    </p>

    <div className="w-full space-y-2.5 mt-auto">
      <button
        onClick={() => navigate(`/rideshare?event=${eventId}&role=driver`)}
        className="w-full font-bold py-3 rounded-full text-xs active:scale-[0.97] transition-all text-white flex items-center justify-center gap-1.5"
        style={clayButtonStyle(primaryColor)}
      >
        <Car size={14} /> אני מציע 🚗
      </button>
      <button
        onClick={() => navigate(`/rideshare?event=${eventId}&role=seeker`)}
        className="w-full font-bold py-3 rounded-full text-xs active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 bg-clay-surface shadow-clay-sm active:shadow-clay-pressed"
        style={{ color: accentOn(primaryColor) }}
      >
        <Users size={14} /> אני מחפש 🙋
      </button>
    </div>
  </div>
);

// ---- Blessings Card ----
const BlessingsHomeCard = ({ primaryColor, eventId, navigate, openInfo }) => (
  <div
    className={`${CLAY} p-5 flex flex-col items-center text-center h-full group`}
  >
    <button
      onClick={(e) => openInfo(e, "blessings")}
      className="absolute top-2 right-2 text-clay-muted hover:text-slate-600 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-clay-surface shadow-clay-sm transition-all"
      aria-label="מידע"
    >
      <Info size={16} />
    </button>

    <div
      className="w-16 h-16 bg-purple-50 rounded-clay-field flex items-center justify-center mb-3 mt-2 group-hover:scale-110 transition-transform"
      style={{ boxShadow: clayIconDiscShadow }}
    >
      <MessageCircle size={28} className="text-purple-700" />
    </div>

    <h3
      className="font-black text-slate-700 mb-1.5"
      style={{ fontSize: "1.1rem" }}
    >
      ספר ברכות
    </h3>
    <p className="text-clay-muted text-xs mb-5 leading-relaxed font-medium flex-1">
      כתבו ברכה לבעלי השמחה
    </p>

    <button
      onClick={() => navigate(`/blessing?event=${eventId}`)}
      className="w-full font-bold py-3 rounded-full text-xs active:scale-[0.97] transition-all text-white flex items-center justify-center gap-1.5"
      style={clayButtonStyle(primaryColor)}
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

  const text = `✨  "${blessing.message}"  —  ${blessing.guest_name}  `;

  return (
    <div
      ref={stripRef}
      className={`overflow-hidden rounded-full py-3.5 mb-4 flex items-center ${CLAY_INSET}`}
    >
      <div className="overflow-hidden flex-1">
        <div
          ref={trackRef}
          className="flex whitespace-nowrap will-change-transform"
        >
          <span
            className="text-sm font-bold px-4"
            style={{ color: accentOn(primaryColor) }}
          >
            {text}
          </span>
          <span
            className="text-sm font-bold px-4"
            style={{ color: accentOn(primaryColor) }}
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
  useEventBackdrop(eventData?.design_config?.colors?.background);
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
    const savedName = safeGetItem("guest_name");
    if (savedName) setIsRegistered(true);

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
      const pattern = escapeLikePattern(
        (safeGetItem("guest_name") || "").trim(),
      );
      if (!pattern) {
        setMyTable({ found: false });
        return;
      }
      try {
        // התאמה מדויקת (בלי רגישות לאותיות) קודם. חיפוש חלקי לבדו החזיר את
        // השורה הראשונה שמכילה את השם — "דן" קיבל את השולחן של "דניאל".
        const exact = await supabase
          .from("seating")
          .select("guest_name, table_number")
          .eq("event_id", id)
          .ilike("guest_name", pattern)
          .limit(1);
        if (exact.error) throw exact.error;

        let row = exact.data?.[0];
        if (!row) {
          // נפילה לחיפוש חלקי רק כשהוא חד-משמעי: שתי התאמות או יותר פירושן
          // שאין לנו דרך לדעת מי האורח, ועדיף "לא נמצא" משולחן של מישהו אחר.
          const partial = await supabase
            .from("seating")
            .select("guest_name, table_number")
            .eq("event_id", id)
            .ilike("guest_name", `%${pattern}%`)
            .limit(2);
          if (partial.error) throw partial.error;
          if (partial.data?.length === 1) row = partial.data[0];
        }

        if (isMounted) {
          setMyTable(
            row
              ? {
                  found: true,
                  number: row.table_number,
                  seatedName: row.guest_name,
                }
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
    const guestId = getOrCreateDeviceId();
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
      safeSetItem("guest_name", nameInput.trim());
      getOrCreateDeviceId();
      setIsRegistered(true);
    } catch (err) {
      console.error(err);
      setRegistrationError("אירעה שגיאה. אנא נסו שוב.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleChangeName = () => {
    safeRemoveItem("guest_name");
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
      // מסננים לפי השם כפי שהוא רשום בהושבה ולא לפי מה שהאורח הקליד — בהתאמה
      // חלקית השניים שונים, והאורח היה מופיע ברשימת השותפים של עצמו.
      const selfName = (
        myTable?.seatedName ||
        safeGetItem("guest_name") ||
        ""
      )
        .trim()
        .toLowerCase();
      const { data, error } = await supabase
        .from("seating")
        .select("guest_name")
        .eq("event_id", eventData.id)
        .eq("table_number", tableNum);
      if (error) throw error;
      setTableMates(
        (data || []).filter(
          (g) => (g.guest_name || "").trim().toLowerCase() !== selfName,
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

  useModalBehavior({ open: !!infoModal, onClose: () => setInfoModal(null) });
  useModalBehavior({
    open: showMatesModal,
    onClose: () => setShowMatesModal(false),
  });

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-clay-gradient"
        dir="rtl"
      >
        <Loader2 className="animate-spin text-clay-muted mb-4" size={48} />
        <p className="text-clay-muted text-sm font-medium">טוען את האירוע...</p>
      </div>
    );
  }

  if (!eventData)
    return (
      <div
        className="min-h-screen flex items-center justify-center text-clay-muted bg-clay-gradient"
        dir="rtl"
      >
        לא נמצא אירוע.
      </div>
    );

  const { name, active_modules, design_config } = eventData;
  const { primary = DEFAULT_PRIMARY } = design_config?.colors || {};
  const guestNameStr = safeGetItem("guest_name");
  const guestInitial = (guestNameStr || "").trim().charAt(0) || "?";

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
        className="min-h-screen flex flex-col items-center justify-center p-6 bg-clay-gradient"
        dir="rtl"
      >
        <div
          className="p-8 rounded-clay w-full max-w-sm text-center bg-clay-surface shadow-clay-lg"
          style={{
            animation: "bounce-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 bg-clay-surface shadow-clay-inset-deep">
            <PartyPopper style={{ color: accentOn(primary) }} size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-700 mb-1">
            ברוכים הבאים!
          </h1>
          <p className="text-clay-muted mb-8 font-medium text-sm">
            ל-<span className="font-bold text-slate-600">{name}</span>
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
              className={`w-full p-4 rounded-full outline-none text-center text-lg font-bold text-slate-700 placeholder:text-clay-muted ${CLAY_INSET}`}
              required
              disabled={isRegistering}
            />

            {registrationError && (
              <div className="flex items-center gap-2 text-rose-700 text-sm font-medium px-4 py-3 rounded-[1rem] bg-clay-surface shadow-clay-inset">
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
                className="mt-0.5 w-5 h-5 cursor-pointer shrink-0"
                style={{ accentColor: primary }}
              />
              <label
                htmlFor="terms"
                className="text-xs font-medium text-clay-muted leading-tight"
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
              className="w-full text-white font-black py-4 rounded-full text-lg active:scale-[0.97] transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:scale-100"
              style={clayButtonStyle(primary)}
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
              className="w-full text-clay-muted hover:text-slate-600 font-bold text-sm py-3 min-h-11 transition-colors flex items-center justify-center gap-1 mt-1"
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
      className="min-h-screen flex flex-col font-sans pb-12 bg-clay-gradient"
      dir="rtl"
    >
      {/* Header — clay surface, greeting + floating avatar + embossed event card */}
      <div className="pt-[calc(3.5rem+env(safe-area-inset-top))] pb-6 px-5 relative z-10 max-w-lg w-full mx-auto">
        <div className="header-anim">
          {/* Greeting row with floating avatar */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="text-right min-w-0">
              <p className="text-clay-muted font-bold text-xs uppercase tracking-widest mb-1">
                {getGreeting()}
              </p>
              <h2 className="text-2xl font-black text-slate-700 truncate">
                {guestNameStr} 👋
              </h2>
            </div>
            <button
              onClick={handleChangeName}
              className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center font-black text-xl bg-clay-surface shadow-[6px_6px_14px_rgba(0,0,0,0.1),-5px_-5px_12px_rgba(255,255,255,0.9)] active:scale-95 transition-transform"
              style={{
                ...clayButtonStyle(primary),
                boxShadow: `6px 6px 14px rgba(0,0,0,0.12), -5px -5px 12px rgba(255,255,255,0.85), ${clayIconDiscShadow}`,
              }}
              aria-label="החלף משתמש"
              title="החלף משתמש"
            >
              {guestInitial}
            </button>
          </div>

          {/* Embossed horizontal Event Card with pulsing Live dot */}
          <div
            className="rounded-clay-lg p-6 relative overflow-hidden"
            style={{
              ...clayHeroStyle(primary),
              boxShadow: `9px 9px 24px rgba(0,0,0,0.16), -7px -7px 18px rgba(255,255,255,0.55), inset 2px 2px 5px rgba(255,255,255,0.25), inset -2px -2px 5px rgba(0,0,0,0.12)`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 bg-[var(--hero-chip)] px-3 py-1.5 rounded-full text-[11px] font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
                </span>
                האירוע פעיל
              </div>
              <PartyPopper size={22} className="opacity-85" />
            </div>
            <h1
              className="text-3xl font-black mt-4 leading-tight drop-shadow-sm"
              style={{ fontFamily: "'Assistant', sans-serif" }}
            >
              {name}
            </h1>
            {eventData.event_date && (
              <p className="text-xs font-bold mt-2">
                {new Date(eventData.event_date).toLocaleDateString("he-IL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                {eventData.location ? ` · ${eventData.location}` : ""}
              </p>
            )}
            {/* Connected-as strip */}
            <div className="mt-4 flex items-center justify-between gap-3 bg-[var(--hero-chip)] rounded-full px-4 py-2.5 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.15)]">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                מחובר כ: <span className="font-black">{guestNameStr}</span>
              </span>
              <button
                onClick={handleChangeName}
                className="shrink-0 text-xs bg-[var(--hero-chip)] hover:bg-[var(--hero-chip-strong)] px-4 min-h-11 rounded-full transition-all font-bold flex items-center gap-1.5 active:scale-95"
              >
                <UserX size={14} /> החלף
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="px-4 relative z-20 w-full max-w-lg mx-auto flex-1 flex flex-col">
        {/* Blessings Strip Ticker */}
        {active_modules.blessings && (
          <BlessingsStrip eventId={id} primaryColor={primary} />
        )}

        {/* Module Cards — stacked layout */}
        <div className="flex flex-col gap-4">
          {/* 1. Seating Card — first */}
          {active_modules.seating && (
            <div className={`${CLAY} p-6 relative overflow-hidden group`}>
              <button
                onClick={(e) => openInfo(e, "seating")}
                className="absolute top-4 right-4 text-clay-muted hover:text-slate-600 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-clay-surface shadow-clay-sm transition-all"
                aria-label="מידע"
              >
                <Info size={18} />
              </button>

              {myTable === null ? (
                <div className="flex justify-center py-6">
                  <Loader2
                    className="animate-spin"
                    size={32}
                    style={{ color: accentOn(primary) }}
                  />
                </div>
              ) : myTable.found ? (
                <div className="flex items-center justify-between gap-5 relative z-10">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 bg-clay-surface shadow-clay-inset-deep group-hover:scale-110 transition-transform">
                      <MapPin size={28} style={{ color: accentOn(primary) }} />
                    </div>
                    <p className="text-clay-muted font-bold text-xs mb-1 uppercase tracking-wider">
                      השולחן שלך
                    </p>
                    <div
                      className="text-7xl font-black leading-none"
                      style={{
                        color: accentOn(primary),
                        fontFamily: "'Assistant', sans-serif",
                        textShadow: `0 3px 8px rgba(0,0,0,0.12)`,
                      }}
                    >
                      {myTable.number}
                    </div>
                  </div>

                  <button
                    onClick={() => fetchTableMates(myTable.number)}
                    className="flex-1 flex flex-col items-center justify-center gap-2 py-6 rounded-[1.8rem] active:scale-[0.97] transition-all bg-clay-surface shadow-clay-md active:shadow-clay-inset-deep"
                    style={{ color: accentOn(primary) }}
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
                  <h3 className="text-xl font-black text-slate-700 mb-1">
                    לא נמצא שולחן
                  </h3>
                  <p className="text-clay-muted text-sm font-medium mb-5">
                    לא מצאנו את השם &quot;{guestNameStr}&quot;.
                  </p>
                  <button
                    onClick={handleChangeName}
                    className="w-full text-slate-600 font-bold py-3.5 px-6 rounded-full transition-all flex justify-center items-center gap-2 bg-clay-surface shadow-clay-sm active:shadow-clay-pressed"
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
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2"
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
        <p className="text-center text-xs text-clay-muted font-medium mt-6 pb-2">
          מופעל ע&quot;י Eventick
        </p>
      </div>

      {/* Info Modal */}
      {infoModal && (
        <div
          className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in fade-in"
          onClick={() => setInfoModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label={infoModal.title}
        >
          <div
            className="rounded-clay-lg p-8 w-full max-w-sm text-center relative animate-in zoom-in-95 max-h-full overflow-y-auto bg-clay-surface shadow-clay-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setInfoModal(null)}
              className="absolute top-4 right-4 text-clay-muted w-11 h-11 flex items-center justify-center rounded-full bg-clay-surface shadow-clay-sm active:shadow-clay-pressed transition-all"
              aria-label="סגור"
            >
              <X size={20} />
            </button>
            <div
              className={`w-20 h-20 mx-auto rounded-[1.5rem] flex items-center justify-center mb-6 ${infoModal.bg}`}
              style={{ boxShadow: clayIconDiscShadow }}
            >
              <infoModal.icon size={40} className={infoModal.color} />
            </div>
            <h3 className="text-2xl font-black text-slate-700 mb-3">
              {infoModal.title}
            </h3>
            <p className="text-clay-muted font-medium leading-relaxed mb-8 text-sm">
              {infoModal.description}
            </p>
            <button
              onClick={() => setInfoModal(null)}
              className="w-full text-white font-bold py-4 rounded-full transition-all active:scale-[0.97]"
              style={clayButtonStyle(primary)}
            >
              הבנתי, תודה!
            </button>
          </div>
        </div>
      )}

      {/* Table Mates Modal */}
      {showMatesModal && (
        <div
          className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in"
          onClick={() => setShowMatesModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="השותפים לשולחן"
        >
          <div
            className="rounded-clay-lg p-8 w-full max-w-sm text-center relative animate-in zoom-in-95 max-h-full flex flex-col bg-clay-surface shadow-clay-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowMatesModal(false)}
              className="absolute top-4 right-4 text-clay-muted w-11 h-11 flex items-center justify-center rounded-full bg-clay-surface shadow-clay-sm active:shadow-clay-pressed transition-all z-10"
              aria-label="סגור"
            >
              <X size={20} />
            </button>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-clay-surface shadow-clay-inset-deep">
              <Users size={36} style={{ color: accentOn(primary) }} />
            </div>
            <h3 className="text-2xl font-black text-slate-700 mb-1">
              השותפים לשולחן
            </h3>
            <p className="text-clay-muted font-bold mb-6 text-sm">
              שולחן מספר {myTable?.number}
            </p>
            <div
              className={`overflow-y-auto rounded-[1.8rem] p-5 text-right flex-1 ${CLAY_INSET}`}
            >
              {loadingMates ? (
                <div className="flex justify-center py-6">
                  <Loader2
                    className="animate-spin"
                    size={28}
                    style={{ color: accentOn(primary) }}
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
                <p className="text-clay-muted text-center py-4 font-medium leading-relaxed text-sm">
                  נראה שאת/ה לבד בשולחן הזה כרגע.
                  <br />
                  אולי זה זמן טוב להכיר אנשים חדשים 😉
                </p>
              )}
            </div>
            <button
              onClick={() => setShowMatesModal(false)}
              className="w-full mt-4 text-white font-bold py-4 rounded-full transition-all active:scale-[0.97]"
              style={clayButtonStyle(primary)}
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
