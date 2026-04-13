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
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 17) return "צהריים טובים";
  if (h >= 17 && h < 21) return "ערב טוב";
  return "לילה טוב";
};

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

  // Fetch event data — only needed columns
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

  // Fetch seating assignment
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

  // Check for unread dating messages
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
  const { background, primary } = design_config.colors;
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

  // --- Improved Module Card ---
  const CustomModuleCard = ({ mKey, onClick, hasBadge }) => {
    const info = MODULES_INFO[mKey];
    if (!info) return null;
    return (
      <div
        className="module-card-anim relative group bg-white rounded-[2rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-slate-100/80 flex flex-col cursor-pointer hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-200"
        onClick={onClick}
      >
        {/* Info button */}
        <button
          onClick={(e) => openInfo(e, mKey)}
          className="absolute top-3 left-3 text-slate-200 hover:text-slate-400 z-10 p-1 transition-colors"
          aria-label="מידע"
        >
          <Info size={16} />
        </button>

        {/* Unread badge */}
        {hasBadge && (
          <span className="absolute top-3 right-3 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-white"></span>
          </span>
        )}

        {/* Icon */}
        <div
          className={`w-12 h-12 ${info.bg} rounded-[1rem] flex items-center justify-center mb-3 mt-1`}
        >
          <info.icon size={24} className={info.color} />
        </div>

        {/* Title + description */}
        <h3 className="font-bold text-slate-800 text-sm leading-tight">
          {info.title}
        </h3>
        <p className="text-slate-400 text-xs mt-1 leading-relaxed line-clamp-2">
          {info.description}
        </p>

        {/* Arrow hint */}
        <ChevronLeft
          size={13}
          className="absolute bottom-4 left-4 text-slate-200 group-hover:text-slate-400 transition-colors"
        />
      </div>
    );
  };

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
          <div className="bg-black/20 rounded-[1.5rem] p-4 flex items-center justify-between border border-white/10 backdrop-blur-sm">
            <div className="flex flex-col text-right">
              <span className="text-white/50 text-xs font-bold">מחובר כ:</span>
              <span className="text-white font-bold text-sm">
                {guestNameStr}
              </span>
            </div>
            <button
              onClick={handleChangeName}
              className="text-xs bg-black/30 hover:bg-black/50 text-white px-4 py-2 rounded-xl transition-colors font-bold flex items-center gap-1 active:scale-95"
            >
              <RefreshCw size={13} /> החלף
            </button>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="px-5 -mt-10 relative z-20 w-full max-w-md mx-auto flex-1 flex flex-col gap-4">
        {/* Seating Card */}
        {active_modules.seating && (
          <div className="module-card-anim relative bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.07)] border border-slate-100 flex flex-col items-center text-center">
            <button
              onClick={(e) => openInfo(e, "seating")}
              className="absolute top-5 left-5 text-slate-200 hover:text-slate-400 z-10 p-1 transition-colors"
            >
              <Info size={18} />
            </button>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3 mt-1"
              style={{ backgroundColor: `${primary}18` }}
            >
              <MapPin size={22} style={{ color: primary }} />
            </div>

            {myTable === null ? (
              <div className="py-6">
                <Loader2
                  className="animate-spin"
                  size={32}
                  style={{ color: primary }}
                />
              </div>
            ) : myTable.found ? (
              <>
                <p className="text-slate-400 font-bold mb-1 text-xs uppercase tracking-wide">
                  השולחן שלך
                </p>
                <div
                  className="text-7xl font-black mb-5 leading-none"
                  style={{ color: primary }}
                >
                  {myTable.number}
                </div>
                <button
                  onClick={() => fetchTableMates(myTable.number)}
                  className="w-full font-bold py-3.5 rounded-[1.2rem] transition-all flex justify-center items-center gap-2 hover:opacity-80 active:scale-[0.98]"
                  style={{ backgroundColor: `${primary}15`, color: primary }}
                >
                  <Users size={18} /> מי איתי בשולחן?
                </button>
              </>
            ) : (
              <div className="py-2">
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

        {/* Module Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          {active_modules.photo && (
            <CustomModuleCard
              mKey="photo"
              onClick={() => navigate(`/photos?event=${id}`)}
            />
          )}
          {active_modules.dating && (
            <CustomModuleCard
              mKey="dating"
              onClick={() => navigate(`/dating?event=${id}`)}
              hasBadge={hasUnreadDating}
            />
          )}
          {active_modules.icebreaker && (
            <CustomModuleCard
              mKey="icebreaker"
              onClick={() => navigate(`/icebreaker?event=${id}`)}
            />
          )}
          {active_modules.rideshare && (
            <CustomModuleCard
              mKey="rideshare"
              onClick={() => navigate(`/rideshare?event=${id}`)}
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
