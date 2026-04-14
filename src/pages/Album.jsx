import { useEffect, useState, useRef } from "react";
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

const Album = () => {
  const { id } = useParams();

  const [eventData, setEventData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [blessings, setBlessings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [activeTab, setActiveTab] = useState("photos"); // 'photos' | 'blessings'

  const headerRef = useRef(null);
  const gridRef = useRef(null);
  const decorationsRef = useRef([]);

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("id", id)
          .single();
        if (eventError) throw eventError;
        setEventData(event);

        const queries = [
          supabase
            .from("photos")
            .select("*")
            .eq("event_id", id)
            .order("created_at", { ascending: false }),
        ];

        if (event.active_modules?.blessings) {
          queries.push(
            supabase
              .from("blessings")
              .select("*")
              .eq("event_id", id)
              .eq("is_approved", true)
              .order("created_at", { ascending: false }),
          );
        }

        const results = await Promise.all(queries);

        if (results[0].error) throw results[0].error;
        setPhotos(results[0].data || []);

        if (event.active_modules?.blessings && results[1]) {
          if (results[1].error) throw results[1].error;
          setBlessings(results[1].data || []);
        }
      } catch (error) {
        console.error("Error fetching album:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAlbumData();
  }, [id]);

  useEffect(() => {
    if (!loading && eventData) {
      const tl = gsap.timeline();
      tl.fromTo(
        headerRef.current,
        { y: -80, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, ease: "power3.out" },
      );

      decorationsRef.current.forEach((el, index) => {
        if (el) {
          gsap.to(el, {
            y: "random(-30, 30)",
            x: "random(-30, 30)",
            rotation: "random(-20, 20)",
            duration: "random(3, 6)",
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: index * 0.2,
          });
        }
      });
    }
  }, [loading, eventData]);

  useEffect(() => {
    if (!loading && (photos.length > 0 || blessings.length > 0)) {
      gsap.fromTo(
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
    }
  }, [loading, activeTab, photos.length, blessings.length]);

  if (loading)
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-slate-400 mb-4" size={48} />
        <p className="text-slate-500 font-bold animate-pulse">
          מכין את הרגעים שלכם...
        </p>
      </div>
    );
  if (!eventData)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-800 text-2xl font-black">
        האירוע לא נמצא 💔
      </div>
    );

  const handleNext = (e) => {
    e.stopPropagation();
    setSelectedIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };
  const handlePrev = (e) => {
    e.stopPropagation();
    setSelectedIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  // משיכת צבע המיתוג והרקע מהאירוע
  const primaryColor = eventData.design_config?.colors?.primary || "#6366f1";
  const bgColor = eventData.design_config?.colors?.background || "#f8fafc";

  return (
    <div
      className="min-h-screen overflow-x-hidden relative font-sans transition-colors duration-1000"
      style={{ backgroundColor: bgColor }}
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

      {/* Header צבוע בצבע הראשי */}
      <div
        ref={headerRef}
        className="rounded-b-[3rem] pt-16 pb-20 px-6 relative z-10 shadow-md flex flex-col items-center text-center transition-colors duration-1000"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="w-16 h-16 rounded-[1.2rem] flex items-center justify-center mb-4 bg-white/20 border border-white/20 shadow-inner">
          <ImageIcon className="text-white opacity-90" size={28} />
        </div>
        <p className="text-white/70 font-bold text-xs uppercase tracking-widest mb-1">
          האלבום הדיגיטלי של
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-white leading-tight drop-shadow-sm">
          {eventData.name}
        </h1>

        {/* טאבים מותאמים לרקע צבעוני */}
        {eventData.active_modules?.blessings && (
          <div className="flex bg-black/15 p-1.5 rounded-full mt-8 backdrop-blur-sm border border-white/10">
            <button
              onClick={() => setActiveTab("photos")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-300 ${
                activeTab === "photos"
                  ? "bg-white shadow-md"
                  : "text-white/70 hover:text-white"
              }`}
              style={activeTab === "photos" ? { color: primaryColor } : {}}
            >
              <ImageIcon size={16} /> תמונות
            </button>
            <button
              onClick={() => setActiveTab("blessings")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-300 ${
                activeTab === "blessings"
                  ? "bg-white shadow-md"
                  : "text-white/70 hover:text-white"
              }`}
              style={activeTab === "blessings" ? { color: primaryColor } : {}}
            >
              <MessageCircle size={16} /> ברכות
            </button>
          </div>
        )}
      </div>

      <div className="relative z-20 px-4 md:px-8 -mt-10 pb-32 max-w-[1800px] mx-auto">
        {/* תצוגת תמונות */}
        {activeTab === "photos" &&
          (photos.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-50 max-w-lg mx-auto">
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
                  className="media-card relative break-inside-avoid rounded-[1.5rem] overflow-hidden cursor-pointer group shadow-md bg-white border border-slate-100 transform-gpu hover:shadow-xl transition-all"
                >
                  <img
                    src={photo.image_url}
                    alt={`Photo by ${photo.guest_name}`}
                    className="w-full h-auto object-cover transition-all duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-5">
                    <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <Heart size={10} className="fill-rose-500" /> צולם ע"י
                    </p>
                    <p className="text-white text-lg font-black tracking-tight translate-y-2 group-hover:translate-y-0 transition-transform duration-500 truncate">
                      {photo.guest_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* תצוגת ברכות */}
        {activeTab === "blessings" &&
          (blessings.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-50 max-w-lg mx-auto">
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
                  className="media-card relative break-inside-avoid rounded-[1.5rem] overflow-hidden shadow-md bg-white border border-slate-100 p-6 flex flex-col h-full transform-gpu transition-all hover:shadow-xl"
                >
                  <Quote
                    size={36}
                    className="absolute top-4 left-4 opacity-[0.05]"
                    style={{ color: primaryColor }}
                  />

                  {blessing.image_url && (
                    <div className="w-full h-48 mb-6 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                      <img
                        src={blessing.image_url}
                        alt="Selfie"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-grow mt-2">
                    <p className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap relative z-10 font-medium">
                      {blessing.message}
                    </p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                      באהבה מ:
                    </p>
                    <p
                      className="text-xl font-black"
                      style={{ color: primaryColor }}
                    >
                      {blessing.guest_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>

      {/* Lightbox - תמיד כהה להבלטת התמונה */}
      {selectedIndex !== null && activeTab === "photos" && (
        <div
          className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setSelectedIndex(null)}
        >
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <div className="pointer-events-auto">
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest">
                צלם/ת הרגע
              </p>
              <p className="text-white text-xl font-black">
                {photos[selectedIndex].guest_name}
              </p>
            </div>
            <button className="pointer-events-auto text-white/50 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-[1rem] transition-all backdrop-blur-md">
              <X size={24} />
            </button>
          </div>

          <div
            className="relative w-full h-full flex items-center justify-center p-4 md:p-12"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleNext}
              className="absolute right-4 md:right-10 z-50 text-white/30 hover:text-white bg-black/20 hover:bg-black/40 p-4 rounded-[1.2rem] transition-all backdrop-blur-md group"
            >
              <ChevronRight
                size={28}
                className="group-hover:scale-110 transition-transform"
              />
            </button>
            <img
              key={selectedIndex}
              src={photos[selectedIndex].image_url}
              className="max-w-full max-h-full object-contain rounded-[1.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300"
              alt="Enlarged moment"
            />
            <button
              onClick={handlePrev}
              className="absolute left-4 md:left-10 z-50 text-white/30 hover:text-white bg-black/20 hover:bg-black/40 p-4 rounded-[1.2rem] transition-all backdrop-blur-md group"
            >
              <ChevronLeft
                size={28}
                className="group-hover:scale-110 transition-transform"
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Album;
