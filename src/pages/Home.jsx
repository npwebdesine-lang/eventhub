import { useEffect, useState } from "react";
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

// ---- Photo Carousel Card ----
const PhotoCarouselCard = ({
  photos,
  primaryColor,
  eventId,
  navigate,
  openInfo,
}) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (photos.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % photos.length), 2800);
    return () => clearInterval(t);
  }, [photos.length]);

  return (
    <div className="module-card-anim relative bg-white rounded-[2rem] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-slate-100">
      <button
        onClick={(e) => openInfo(e, "photo")}
        className="absolute top-3 left-3 text-slate-200 hover:text-slate-400 z-20 p-1 transition-colors"
        aria-label="מידע"
      >
        <Info size={16} />
      </button>

      {/* Carousel area */}
      <div className="relative h-44 bg-slate-50 overflow-hidden">
        {photos.length > 0 && photos[idx] ? (
          <>
            <img
              key={idx}
              src={photos[idx]?.image_url || ""}
              alt="תמונה מהאירוע"
              className="w-full h-full object-cover animate-in fade-in duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />
            {photos.length > 1 && (
              <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 z-10">
                {photos.slice(0, 8).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className={`h-1 rounded-full transition-all ${
                      i === idx ? "w-5 bg-white" : "w-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <Camera size={36} className="text-slate-200" />
            <p className="text-xs mt-2 font-bold text-slate-400">
              אין תמונות עדיין
            </p>
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="p-4 text-center">
        <h3 className="font-black text-slate-800 text-sm mb-0.5">כל אחד צלם</h3>
        <p className="text-slate-400 text-xs mb-3">
          העלו תמונות לאלבום המשותף של האירוע
        </p>
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
    <div className="module-card-anim relative bg-white rounded-[2rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-slate-100 flex flex-col items-center text-center">
      <button
        onClick={(e) => openInfo(e, mKey)}
        className="absolute top-3 left-3 text-slate-200 hover:text-slate-400 z-10 p-1 transition-colors"
        aria-label="מידע"
      >
        <Info size={16} />
      </button>

      {hasBadge && (
        <span className="absolute top-3 right-3 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-white" />
        </span>
      )}

      <div
        className={`w-12 h-12 ${info.bg} rounded-[1rem] flex items-center justify-center mb-3 mt-1`}
      >
        <info.icon size={24} className={info.color} />
      </div>

      <h3 className="font-black text-slate-800 text-sm leading-tight mb-1">
        {info.title}
      </h3>
      <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 mb-3 flex-1">
        {info.description}
      </p>

      <button
        onClick={onClick}
        className="w-full font-bold py-2.5 rounded-[0.8rem] text-xs flex items-center justify-center gap-1.5 hover:opacity-80 active:scale-[0.98] transition-all"
        style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
      >
        כניסה <ChevronLeft size={12} />
      </button>
    </div>
  );
};

// ---- Rideshare Card (2 role buttons) ----
const RideshareHomeCard = ({ primaryColor, eventId, navigate, openInfo }) => (
  <div className="module-card-anim relative bg-white rounded-[2rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-slate-100 flex flex-col items-center text-center">
    <button
      onClick={(e) => openInfo(e, "rideshare")}
      className="absolute top-3 left-3 text-slate-200 hover:text-slate-400 z-10 p-1 transition-colors"
      aria-label="מידע"
    >
      <Info size={16} />
    </button>

    <div className="w-12 h-12 bg-amber-50 rounded-[1rem] flex items-center justify-center mb-3 mt-1">
      <Car size={24} className="text-amber-500" />
    </div>

    <h3 className="font-black text-slate-800 text-sm mb-1">לוח טרמפים</h3>
    <p className="text-slate-400 text-xs mb-3 leading-relaxed">
      שתפו נסיעות לאחר האירוע
    </p>

    <div className="w-full space-y-2">
      <button
        onClick={() => navigate(`/rideshare?event=${eventId}&role=driver`)}
        className="w-full font-bold py-2.5 rounded-[0.8rem] text-xs hover:opacity-90 active:scale-[0.98] transition-all text-white flex items-center justify-center gap-1.5"
        style={{ backgroundColor: primaryColor }}
      >
        <Car size={13} /> אני מציע 🚗
      </button>
      <button
        onClick={() => navigate(`/rideshare?event=${eventId}&role=seeker`)}
        className="w-full font-bold py-2.5 rounded-[0.8rem] text-xs hover:opacity-80 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
        style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
      >
        <Users size={13} /> אני מחפש 🙋
      </button>
    </div>
  </div>
);

// ---- Blessings Card (add only) ----
const BlessingsHomeCard = ({ primaryColor, eventId, navigate, openInfo }) => (
  <div className="module-card-anim relative bg-white rounded-[2rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-slate-100 flex flex-col items-center text-center">
    <button
      onClick={(e) => openInfo(e, "blessings")}
      className="absolute top-3 left-3 text-slate-200 hover:text-slate-400 z-10 p-1 transition-colors"
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

// ---- Main Component ----
const Home = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isRegistered, setIsRegistered] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [myTable, setMyTable] = useState(null);
  const [showMatesModal, setShowMatesModal] = useState(false);
  const [tableMates, setTableMates] = useState([]);
  const [loadingMates, setLoadingMates] = useState(false);

  const [hasUnreadDating, setHasUnreadDating] = useState(false);
  const [infoModal, setInfoModal] = useState(null);

  // Photo carousel
  const [carouselPhotos, setCarouselPhotos] = useState([]);

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

  // Fetch carousel photos + realtime
  useEffect(() => {
    if (!isRegistered || !eventData?.active_modules?.photo || !id) return;
    let isMounted = true;
    // Unique channel name prevents React StrictMode double-invoke conflicts
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
        console.error("Error fetching carousel photos:", e);
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

  // Animations
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
          stagger: 0.1,
          ease: "back.out(1.2)",
        },
      );
    }
  }, [isRegistered, eventData, loading]);

  const handleRegister = (e) => {
    e.preventDefault();
    if (!nameInput.trim() || !termsAccepted) return;
    localStorage.setItem("guest_name", nameInput.trim());
    localStorage.setItem("guest_id", crypto.randomUUID());
    setIsRegistered(true);
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
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="שם מלא (לדוגמה: תקווה משולם)"
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[1.2rem] focus:ring-2 outline-none text-center text-lg font-bold transition-all"
              style={{ "--tw-ring-color": primary }}
              required
            />

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
              className="w-full text-white font-black py-4 rounded-[1.2rem] text-lg shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform mt-4"
              style={{ backgroundColor: primary }}
            >
              היכנסו לאירוע
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

      {/* Cards */}
      <div className="px-5 -mt-10 relative z-20 w-full max-w-md mx-auto flex-1 flex flex-col gap-4">
        {/* Seating Card */}
        {active_modules.seating && (
          <div className="module-card-anim relative bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.07)] border border-slate-100">
            <button
              onClick={(e) => openInfo(e, "seating")}
              className="absolute top-4 left-4 text-slate-200 hover:text-slate-400 z-10 p-1 transition-colors"
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
                {/* Table info */}
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

                {/* Who's with me button */}
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
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3.5 px-6 rounded-[1.2rem] transition-colors flex justify-center items-center gap-2"
                >
                  <RefreshCw size={16} /> נסו שם אחר
                </button>
              </div>
            )}
          </div>
        )}

        {/* Photo Carousel Card */}
        {active_modules.photo && (
          <PhotoCarouselCard
            photos={carouselPhotos}
            primaryColor={primary}
            eventId={id}
            navigate={navigate}
            openInfo={openInfo}
          />
        )}

        {/* Module Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          {active_modules.dating && (
            <ActionModuleCard
              mKey="dating"
              primaryColor={primary}
              onClick={() => navigate(`/dating?event=${id}`)}
              openInfo={openInfo}
              hasBadge={hasUnreadDating}
            />
          )}
          {active_modules.icebreaker && (
            <ActionModuleCard
              mKey="icebreaker"
              primaryColor={primary}
              onClick={() => navigate(`/icebreaker?event=${id}`)}
              openInfo={openInfo}
            />
          )}
          {active_modules.rideshare && (
            <RideshareHomeCard
              primaryColor={primary}
              eventId={id}
              navigate={navigate}
              openInfo={openInfo}
            />
          )}
          {active_modules.blessings && (
            <BlessingsHomeCard
              primaryColor={primary}
              eventId={id}
              navigate={navigate}
              openInfo={openInfo}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400/60 font-medium mt-2 pb-2">
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
