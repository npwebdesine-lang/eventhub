import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase"; // ודא שהנתיב תקין אצלך
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
  const navigate = useNavigate();

  const [eventData, setEventData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [blessings, setBlessings] = useState([]); // הסטייט החדש לברכות
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [activeTab, setActiveTab] = useState("photos"); // 'photos' | 'blessings'

  const headerRef = useRef(null);
  const gridRef = useRef(null);
  const decorationsRef = useRef([]);

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        // קודם כל מושכים את נתוני האירוע כדי לדעת אילו פיצ'רים דלוקים
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("id", id)
          .single();
        if (eventError) throw eventError;
        setEventData(event);

        // מכינים את השאילתות למשיכה מקבילית
        const queries = [
          supabase
            .from("photos")
            .select("*")
            .eq("event_id", id)
            .order("created_at", { ascending: false }),
        ];

        // מושכים ברכות *רק* אם הפיצ'ר דלוק באירוע הזה
        // שים לב: ודא שיש לך עמודה בשם enable_blessings בטבלת events
        if (event.enable_blessings) {
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

        if (event.enable_blessings && results[1]) {
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

  // אנימציות רקע והדר (רצות פעם אחת)
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
  }, [loading]); // הוסר התלוי של photos.length כדי שההדר לא יקפוץ במעבר טאבים

  // אנימציות של הכרטיסיות (רצות בכל פעם שמחליפים טאב או שהמידע נטען)
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-white mb-4" size={48} />
        <p className="text-white/50 font-bold animate-pulse">
          מכין את הרגעים שלכם...
        </p>
      </div>
    );
  if (!eventData)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-2xl font-black">
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

  return (
    <div
      className="min-h-screen bg-slate-950 overflow-x-hidden relative font-sans"
      dir="rtl"
    >
      {/* עיטורים מרחפים ברקע */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          ref={(el) => (decorationsRef.current[0] = el)}
          className="absolute -top-20 -right-20 w-96 h-96 rounded-full blur-[100px] opacity-10 bg-indigo-500"
        ></div>
        <div
          ref={(el) => (decorationsRef.current[1] = el)}
          className="absolute top-1/2 -left-32 w-[30rem] h-[30rem] rounded-full blur-[120px] opacity-10 bg-purple-500"
        ></div>
        <div
          ref={(el) => (decorationsRef.current[2] = el)}
          className="absolute -bottom-40 right-1/4 w-80 h-80 rounded-full blur-[90px] opacity-10 bg-blue-500"
        ></div>
        <Heart
          ref={(el) => (decorationsRef.current[3] = el)}
          className="absolute top-32 left-10 text-white/5"
          size={64}
        />
        <Sparkles
          ref={(el) => (decorationsRef.current[4] = el)}
          className="absolute bottom-1/3 right-10 text-white/5"
          size={48}
        />
      </div>

      {/* Header */}
      <div
        ref={headerRef}
        className="bg-slate-900 rounded-b-[3rem] pt-12 pb-16 px-6 relative z-10 shadow-[0_10px_40px_rgba(0,0,0,0.3)] flex flex-col items-center text-center border-b border-white/5"
      >
        <button
          onClick={() => navigate(`/event/${id}`)}
          className="absolute top-6 left-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition-colors backdrop-blur-md"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="w-16 h-16 rounded-[1.2rem] flex items-center justify-center mb-4 bg-white/10 border border-white/10 shadow-inner">
          <ImageIcon className="text-white opacity-80" size={28} />
        </div>
        <p className="text-white/40 font-bold text-xs uppercase tracking-widest mb-1">
          האלבום הדיגיטלי של
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-white leading-tight drop-shadow-lg">
          {eventData.name}
        </h1>

        {/* טאבים מופיעים רק אם הפיצ'ר מאופשר באירוע */}
        {eventData.enable_blessings && (
          <div className="flex bg-black/20 p-1.5 rounded-full mt-8 backdrop-blur-md border border-white/5">
            <button
              onClick={() => setActiveTab("photos")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-300 ${activeTab === "photos" ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/70"}`}
            >
              <ImageIcon size={16} /> תמונות
            </button>
            <button
              onClick={() => setActiveTab("blessings")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-300 ${activeTab === "blessings" ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/70"}`}
            >
              <MessageCircle size={16} /> ברכות
            </button>
          </div>
        )}
      </div>

      <div className="relative z-20 px-4 md:px-8 mt-8 pb-32 max-w-[1800px] mx-auto">
        {/* תצוגת תמונות */}
        {activeTab === "photos" &&
          (photos.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/50 rounded-[2rem] border border-white/5 backdrop-blur-sm max-w-lg mx-auto">
              <ImageIcon size={48} className="mx-auto mb-4 text-white/20" />
              <p className="text-2xl font-black text-white/50">
                האלבום עדיין ריק.
              </p>
              <p className="font-medium mt-2 text-white/30 text-sm">
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
                  className="media-card relative break-inside-avoid rounded-[1.5rem] overflow-hidden cursor-pointer group shadow-xl bg-white/5 border border-white/10 transform-gpu"
                >
                  <img
                    src={photo.image_url}
                    alt={`Photo by ${photo.guest_name}`}
                    className="w-full h-auto object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-5">
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <Heart size={10} className="fill-white/40" /> צולם ע"י
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
            <div className="text-center py-20 bg-slate-900/50 rounded-[2rem] border border-white/5 backdrop-blur-sm max-w-lg mx-auto">
              <MessageCircle size={48} className="mx-auto mb-4 text-white/20" />
              <p className="text-2xl font-black text-white/50">
                אין ברכות עדיין.
              </p>
              <p className="font-medium mt-2 text-white/30 text-sm">
                שתפו את הקישור כדי שהאורחים יתחילו לברך!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {blessings.map((blessing) => (
                <div
                  key={blessing.id}
                  className="media-card relative break-inside-avoid rounded-[1.5rem] overflow-hidden shadow-xl bg-slate-900/40 border border-white/10 backdrop-blur-md p-6 flex flex-col h-full transform-gpu"
                >
                  <Quote
                    size={24}
                    className="text-white/10 absolute top-6 left-6"
                  />

                  {blessing.image_url && (
                    <div className="w-full h-48 mb-6 rounded-xl overflow-hidden border border-white/5">
                      <img
                        src={blessing.image_url}
                        alt="Selfie"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-grow">
                    <p className="text-white/90 text-lg leading-relaxed whitespace-pre-wrap relative z-10">
                      {blessing.message}
                    </p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-white/5">
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">
                      באהבה מ:
                    </p>
                    <p className="text-white text-xl font-black">
                      {blessing.guest_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>

      {/* Lightbox - נשאר לתמונות בלבד כרגע */}
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
