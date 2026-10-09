import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom"; // הסרנו את useNavigate כי אין כפתור חזרה
import { supabase } from "../lib/supabase";
import {
  Loader2,
  X,
  ChevronRight,
  ChevronLeft,
  Heart,
  Sparkles,
  Image as ImageIcon,
  MessageCircle,
  Quote,
} from "lucide-react";
import gsap from "gsap";
import { useModalBehavior } from "../components/Modal";
import { appendUnique, olderThan, orderNewestFirst } from "../lib/pagination";

const PAGE_SIZE = 24;

const Album = () => {
  const { id } = useParams();

  const [eventData, setEventData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [blessings, setBlessings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [activeTab, setActiveTab] = useState("photos"); // 'photos' | 'blessings'

  const [photosHasMore, setPhotosHasMore] = useState(true);
  const [blessingsHasMore, setBlessingsHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // לכל לשונית דגל כישלון משלה: אחרי כישלון הטעינה האוטומטית נעצרת עד
  // "נסו שוב", אחרת ה-sentinel הגלוי מריץ אותה בלולאה.
  const [loadFailed, setLoadFailed] = useState({
    photos: false,
    blessings: false,
  });
  const photosCursor = useRef(null);
  const blessingsCursor = useRef(null);

  const headerRef = useRef(null);
  const gridRef = useRef(null);
  const decorationsRef = useRef([]);
  const sentinelRef = useRef(null);

  // שתי הפונקציות מחזירות true בהצלחה ו-false בכישלון.
  const fetchPhotos = useCallback(
    async ({ reset = false } = {}) => {
      const query = orderNewestFirst(
        supabase
          .from("photos")
          .select("id, image_url, guest_name, created_at")
          .eq("event_id", id),
      ).limit(PAGE_SIZE);
      const { data, error } = await (reset
        ? query
        : olderThan(query, photosCursor.current));
      if (error) {
        console.error(error);
        return false;
      }
      const rows = data || [];
      if (rows.length < PAGE_SIZE) setPhotosHasMore(false);
      if (rows.length > 0) photosCursor.current = rows[rows.length - 1];
      setPhotos((prev) => (reset ? rows : appendUnique(prev, rows)));
      return true;
    },
    [id],
  );

  const fetchBlessings = useCallback(
    async ({ reset = false } = {}) => {
      const query = orderNewestFirst(
        supabase
          .from("blessings")
          .select("id, guest_name, message, image_url, created_at")
          .eq("event_id", id)
          .eq("is_approved", true),
      ).limit(PAGE_SIZE);
      const { data, error } = await (reset
        ? query
        : olderThan(query, blessingsCursor.current));
      if (error) {
        console.error(error);
        return false;
      }
      const rows = data || [];
      if (rows.length < PAGE_SIZE) setBlessingsHasMore(false);
      if (rows.length > 0) blessingsCursor.current = rows[rows.length - 1];
      setBlessings((prev) => (reset ? rows : appendUnique(prev, rows)));
      return true;
    },
    [id],
  );

  // Initial load — first page only; the rest streams in on scroll
  useEffect(() => {
    let isMounted = true;
    const fetchAlbumData = async () => {
      try {
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("id", id)
          .single();
        if (eventError) throw eventError;
        if (!isMounted) return;
        setEventData(event);

        const photosLoaded = await fetchPhotos({ reset: true });
        const blessingsLoaded = event.active_modules?.blessings
          ? await fetchBlessings({ reset: true })
          : true;
        if (!event.active_modules?.blessings) setBlessingsHasMore(false);
        if (isMounted && (!photosLoaded || !blessingsLoaded)) {
          setLoadFailed({
            photos: !photosLoaded,
            blessings: !blessingsLoaded,
          });
        }
      } catch (error) {
        console.error("Error fetching album:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAlbumData();
    return () => {
      isMounted = false;
    };
  }, [id, fetchPhotos, fetchBlessings]);

  // Infinite scroll for whichever tab is active
  useEffect(() => {
    const hasMore = activeTab === "photos" ? photosHasMore : blessingsHasMore;
    if (!sentinelRef.current || !hasMore || loadFailed[activeTab]) return;
    const tab = activeTab;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          setLoadingMore(true);
          const loader = tab === "photos" ? fetchPhotos() : fetchBlessings();
          loader
            .then((loaded) => {
              if (!loaded) setLoadFailed((prev) => ({ ...prev, [tab]: true }));
            })
            .finally(() => setLoadingMore(false));
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [
    activeTab,
    photosHasMore,
    blessingsHasMore,
    loadingMore,
    loadFailed,
    fetchPhotos,
    fetchBlessings,
  ]);

  // Header entrance + floating decorations. The decoration tweens loop forever
  // (repeat: -1), so they are captured and killed on cleanup to avoid leaking
  // into GSAP's global ticker after unmount.
  useEffect(() => {
    if (loading || !eventData) return;
    const tweens = [
      gsap.fromTo(
        headerRef.current,
        { y: -80, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, ease: "power3.out" },
      ),
    ];
    decorationsRef.current.forEach((el, index) => {
      if (el) {
        tweens.push(
          gsap.to(el, {
            y: "random(-30, 30)",
            x: "random(-30, 30)",
            rotation: "random(-20, 20)",
            duration: "random(3, 6)",
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: index * 0.2,
          }),
        );
      }
    });
    return () => tweens.forEach((t) => t.kill());
  }, [loading, eventData]);

  useEffect(() => {
    if (!loading && (photos.length > 0 || blessings.length > 0)) {
      const tween = gsap.fromTo(
        ".media-card",
        { scale: 0.8, opacity: 0, y: 50 },
        {
          scale: 1,
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.05,
          ease: "back.out(1.2)",
          clearProps: "all",
        },
      );
      return () => tween.kill();
    }
  }, [loading, activeTab, photos.length, blessings.length]);

  // Lightbox keyboard: Escape closes; arrows step through photos (this screen
  // lays the "next" control on the right, so ArrowRight advances).
  useModalBehavior({
    open: selectedIndex !== null && activeTab === "photos",
    onClose: () => setSelectedIndex(null),
    onArrowRight: () =>
      setSelectedIndex((p) =>
        p === null ? p : p === photos.length - 1 ? 0 : p + 1,
      ),
    onArrowLeft: () =>
      setSelectedIndex((p) =>
        p === null ? p : p === 0 ? photos.length - 1 : p - 1,
      ),
  });

  if (loading)
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{
          background: "linear-gradient(160deg, #eceadf 0%, #e2ddd0 100%)",
        }}
      >
        <div className="relative">
          <Loader2 className="animate-spin text-slate-400 mb-6" size={56} />
          <div
            className="absolute inset-0 rounded-full animate-pulse opacity-20 bg-slate-400"
            style={{ width: "72px", height: "72px", left: "-8px", top: "-8px" }}
          />
        </div>
        <p className="text-slate-600 font-black text-lg animate-pulse">
          מכין את הרגעים שלכם...
        </p>
      </div>
    );
  if (!eventData)
    return (
      <div
        className="min-h-screen flex items-center justify-center text-slate-700 text-2xl font-black"
        style={{
          background: "linear-gradient(160deg, #eceadf 0%, #e2ddd0 100%)",
        }}
      >
        האירוע לא נמצא 💔
      </div>
    );

  const handleNext = (e) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };
  const handlePrev = (e) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  // משיכת צבע המיתוג מהאירוע (המשטח קבוע בסגנון חימר)
  const primaryColor = eventData.design_config?.colors?.primary || "#8fa7b8";

  return (
    <div
      className="min-h-screen overflow-x-hidden relative font-sans"
      style={{
        background: "linear-gradient(160deg, #eceadf 0%, #e2ddd0 100%)",
      }}
      dir="rtl"
    >
      {/* עיטורים מרחפים ברקע */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          ref={(el) => (decorationsRef.current[0] = el)}
          className="absolute -top-20 -right-20 w-96 h-96 rounded-full blur-[100px] opacity-10"
          style={{ backgroundColor: primaryColor }}
        ></div>
        <div
          ref={(el) => (decorationsRef.current[1] = el)}
          className="absolute top-1/2 -left-32 w-[30rem] h-[30rem] rounded-full blur-[120px] opacity-[0.05]"
          style={{ backgroundColor: primaryColor }}
        ></div>
        <div
          ref={(el) => (decorationsRef.current[2] = el)}
          className="absolute -bottom-40 right-1/4 w-80 h-80 rounded-full blur-[90px] opacity-10"
          style={{ backgroundColor: primaryColor }}
        ></div>
        <Heart
          ref={(el) => (decorationsRef.current[3] = el)}
          className="absolute top-32 left-10 opacity-20"
          style={{ color: primaryColor }}
          size={64}
        />
        <Sparkles
          ref={(el) => (decorationsRef.current[4] = el)}
          className="absolute bottom-1/3 right-10 opacity-20"
          style={{ color: primaryColor }}
          size={48}
        />
      </div>

      {/* Header עם gradient ואנימציות */}
      <div
        ref={headerRef}
        className="rounded-b-[2.5rem] pt-[calc(5rem+env(safe-area-inset-top))] pb-28 px-6 relative z-10 flex flex-col items-center text-center overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
          boxShadow:
            "9px 9px 24px rgba(0,0,0,0.16), inset 2px 2px 5px rgba(255,255,255,0.25), inset -2px -2px 5px rgba(0,0,0,0.12)",
        }}
      >
        {/* Decorative floating elements */}
        <div className="absolute top-10 right-12 w-24 h-24 rounded-full opacity-10 bg-white float-effect" />
        <div className="absolute bottom-8 left-8 w-32 h-32 rounded-full opacity-10 bg-white float-delayed" />

        <div className="relative z-10">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-white/20 shadow-[inset_2px_2px_5px_rgba(255,255,255,0.35),inset_-2px_-2px_5px_rgba(0,0,0,0.12)] hover:scale-110 transition-transform mx-auto">
            <ImageIcon className="text-white" size={32} />
          </div>
          <p className="text-white/70 font-bold text-xs uppercase tracking-widest mb-2">
            האלבום הדיגיטלי של
          </p>
          <h1
            className="text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-lg"
            style={{ fontFamily: "'Assistant', sans-serif" }}
          >
            {eventData.name}
          </h1>
        </div>

        {/* טאבים עם אנימציות חלקות */}
        {eventData.active_modules?.blessings && (
          <div className="flex bg-white/15 p-2 rounded-full mt-10 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.14),inset_-2px_-2px_5px_rgba(255,255,255,0.15)] gap-2">
            <button
              onClick={() => setActiveTab("photos")}
              className={`flex items-center gap-2 px-7 py-3 rounded-full font-bold text-sm transition-all duration-300 button-pulse ${
                activeTab === "photos"
                  ? "bg-white shadow-[4px_4px_10px_rgba(0,0,0,0.14)] scale-105"
                  : "text-white/70 hover:text-white"
              }`}
              style={activeTab === "photos" ? { color: primaryColor } : {}}
            >
              <ImageIcon size={18} /> תמונות
            </button>
            <button
              onClick={() => setActiveTab("blessings")}
              className={`flex items-center gap-2 px-7 py-3 rounded-full font-bold text-sm transition-all duration-300 button-pulse ${
                activeTab === "blessings"
                  ? "bg-white shadow-[4px_4px_10px_rgba(0,0,0,0.14)] scale-105"
                  : "text-white/70 hover:text-white"
              }`}
              style={activeTab === "blessings" ? { color: primaryColor } : {}}
            >
              <MessageCircle size={18} /> ברכות
            </button>
          </div>
        )}
      </div>

      <div className="relative z-20 px-4 md:px-8 -mt-10 pb-32 max-w-[1800px] mx-auto">
        {/* תצוגת תמונות */}
        {activeTab === "photos" &&
          (photos.length === 0 && !loadFailed.photos ? (
            <div className="text-center py-20 bg-[#f0eee7] rounded-[2.25rem] shadow-[8px_8px_20px_rgba(0,0,0,0.09),-8px_-8px_20px_rgba(255,255,255,0.9)] max-w-lg mx-auto">
              <ImageIcon
                size={48}
                className="mx-auto mb-4 opacity-20"
                style={{ color: primaryColor }}
              />
              <p className="text-2xl font-black text-slate-800">
                האלבום עדיין ריק.
              </p>
              <p className="font-medium mt-2 text-slate-500 text-sm">
                היו הראשונים להוסיף רגעים מיוחדים!
              </p>
            </div>
          ) : (
            <div
              ref={gridRef}
              className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 md:gap-6 space-y-4 md:gap-6"
            >
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedIndex(index)}
                  className="media-card relative break-inside-avoid rounded-[24px] overflow-hidden cursor-pointer group p-[7px] bg-[#f0eee7] shadow-[6px_6px_16px_rgba(0,0,0,0.1),-5px_-5px_14px_rgba(255,255,255,0.9)] transform-gpu card-hover"
                >
                  <img
                    src={photo.image_url}
                    alt={`Photo by ${photo.guest_name}`}
                    className="w-full h-auto object-cover transition-all duration-700 group-hover:scale-[1.03] bg-[#eeece5] rounded-[18px] shadow-[inset_2px_2px_6px_rgba(0,0,0,0.2)]"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-[7px] rounded-[18px] bg-gradient-to-t from-slate-950/95 via-slate-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6">
                    <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                      <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Heart
                          size={12}
                          className="fill-rose-500"
                          style={{ color: primaryColor }}
                        />{" "}
                        צולם ע"י
                      </p>
                      <p
                        className="text-white text-lg font-black tracking-tight"
                        style={{ fontFamily: "'Assistant', sans-serif" }}
                      >
                        {photo.guest_name}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* תצוגת ברכות */}
        {activeTab === "blessings" &&
          (blessings.length === 0 && !loadFailed.blessings ? (
            <div className="text-center py-20 bg-[#f0eee7] rounded-[2.25rem] shadow-[8px_8px_20px_rgba(0,0,0,0.09),-8px_-8px_20px_rgba(255,255,255,0.9)] max-w-lg mx-auto">
              <MessageCircle
                size={48}
                className="mx-auto mb-4 opacity-20"
                style={{ color: primaryColor }}
              />
              <p className="text-2xl font-black text-slate-800">
                אין ברכות עדיין.
              </p>
              <p className="font-medium mt-2 text-slate-500 text-sm">
                שתפו את הקישור כדי שהאורחים יתחילו לברך!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {blessings.map((blessing) => (
                <div
                  key={blessing.id}
                  className="media-card relative break-inside-avoid rounded-[2.25rem] overflow-hidden p-7 flex flex-col h-full transform-gpu card-hover bg-[#f0eee7] shadow-[8px_8px_20px_rgba(0,0,0,0.09),-8px_-8px_20px_rgba(255,255,255,0.9)]"
                >
                  {/* Background quote decoration */}
                  <Quote
                    size={42}
                    className="absolute top-4 right-4 opacity-10"
                    style={{ color: primaryColor }}
                  />

                  {blessing.image_url && (
                    <div className="w-full h-52 mb-6 rounded-[1.4rem] overflow-hidden bg-[#eeece5] shadow-[inset_3px_3px_8px_rgba(0,0,0,0.1),inset_-3px_-3px_8px_rgba(255,255,255,0.8)] p-[5px]">
                      <img
                        src={blessing.image_url}
                        alt="Selfie"
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-700 rounded-[1.1rem]"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  )}

                  <div className="flex-grow mt-3">
                    <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap relative z-10 font-medium italic">
                      "{blessing.message}"
                    </p>
                  </div>

                  <div className="mt-8 pt-6 border-t border-[#dcd7ca]">
                    <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest mb-2">
                      באהבה מ:
                    </p>
                    <p
                      className="text-lg font-black"
                      style={{
                        color: primaryColor,
                        fontFamily: "'Assistant', sans-serif",
                      }}
                    >
                      {blessing.guest_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* Infinite-scroll sentinel for the active tab */}
        {((activeTab === "photos" && photosHasMore) ||
          (activeTab === "blessings" && blessingsHasMore)) &&
          (loadFailed[activeTab] ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-slate-500 font-bold text-sm">
                לא הצלחנו לטעון את התוכן
              </p>
              <button
                type="button"
                onClick={() =>
                  setLoadFailed((prev) => ({ ...prev, [activeTab]: false }))
                }
                className="text-white font-bold py-3 px-6 rounded-full text-sm active:scale-[0.97] transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                נסו שוב
              </button>
            </div>
          ) : (
            <div ref={sentinelRef} className="flex justify-center py-10">
              {loadingMore && (
                <Loader2 className="animate-spin text-slate-400" size={28} />
              )}
            </div>
          ))}
      </div>

      {/* Lightbox - אלגנטי עם אנימציות חלקות */}
      {selectedIndex !== null && activeTab === "photos" && (
        <div
          className="fixed inset-0 z-[200] bg-slate-950/95 flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setSelectedIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="תצוגת תמונה"
        >
          {/* Info bar */}
          <div className="absolute top-0 left-0 right-0 p-8 pt-[calc(2rem+env(safe-area-inset-top))] flex justify-between items-center z-50 bg-gradient-to-b from-black/70 via-black/40 to-transparent pointer-events-none">
            <div className="pointer-events-auto">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">
                צלם/ת הרגע
              </p>
              <p
                className="text-white text-2xl font-black"
                style={{ fontFamily: "'Assistant', sans-serif" }}
              >
                {photos[selectedIndex].guest_name}
              </p>
            </div>
            <button
              onClick={() => setSelectedIndex(null)}
              className="pointer-events-auto text-white/50 hover:text-white bg-white/15 hover:bg-white/25 p-3 rounded-full transition-all button-pulse"
              aria-label="סגור תצוגה"
            >
              <X size={26} />
            </button>
          </div>

          {/* Counter */}
          <div className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 transform -translate-x-1/2 z-50 text-white/60 text-sm font-bold bg-black/40 px-5 py-2.5 rounded-full">
            {selectedIndex + 1} / {photos.length}
          </div>

          <div
            className="relative w-full h-full flex items-center justify-center p-6 md:p-16"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleNext}
              className="absolute right-[max(1.5rem,env(safe-area-inset-right))] md:right-12 z-50 text-white/40 hover:text-white bg-white/10 hover:bg-white/20 p-5 rounded-[1.5rem] transition-all group button-pulse"
              aria-label="התמונה הבאה"
            >
              <ChevronRight
                size={32}
                className="group-hover:scale-125 transition-transform"
              />
            </button>
            <img
              key={selectedIndex}
              src={photos[selectedIndex].image_url}
              className="max-w-full max-h-[85%] object-contain rounded-[2rem] shadow-[0_0_80px_rgba(0,0,0,0.7)] animate-in zoom-in-95 duration-300"
              alt="Enlarged moment"
            />
            <button
              onClick={handlePrev}
              className="absolute left-[max(1.5rem,env(safe-area-inset-left))] md:left-12 z-50 text-white/40 hover:text-white bg-white/10 hover:bg-white/20 p-5 rounded-[1.5rem] transition-all group button-pulse"
              aria-label="התמונה הקודמת"
            >
              <ChevronLeft
                size={32}
                className="group-hover:scale-125 transition-transform"
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Album;
