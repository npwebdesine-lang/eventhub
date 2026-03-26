import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, X, ChevronRight, ChevronLeft, Heart, Sparkles, Image as ImageIcon } from 'lucide-react';
import gsap from 'gsap';

const Album = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [eventData, setEventData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(null);

  // References לאנימציות
  const headerRef = useRef(null);
  const gridRef = useRef(null);
  const decorationsRef = useRef([]);

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        const { data: event, error: eventError } = await supabase.from('events').select('*').eq('id', id).single();
        if (eventError) throw eventError;
        setEventData(event);

        const { data: eventPhotos, error: photosError } = await supabase
          .from('photos')
          .select('*')
          .eq('event_id', id)
          .order('created_at', { ascending: false });
        
        if (photosError) throw photosError;
        setPhotos(eventPhotos || []);
      } catch (error) {
        console.error("Error fetching album:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAlbumData();
  }, [id]);

  // --- הקסם של GSAP ---
  useEffect(() => {
    if (!loading && eventData) {
      const tl = gsap.timeline();

      // 1. אנימציית כניסה לכותרת (Header) - יורד מלמעלה בבאונס עדין
      tl.fromTo(headerRef.current, 
        { y: -80, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 1.2, ease: "bounce.out" }
      );

      // 2. אנימציית "מפל" (Stagger) לתמונות בגלריה - כניסה עם סיבוב קל (3D feel)
      if (photos.length > 0) {
        gsap.fromTo(".photo-card", 
          { scale: 0.8, opacity: 0, y: 100, rotation: gsap.utils.random(-10, 10, true) },
          { 
            scale: 1, opacity: 1, y: 0, rotation: 0, 
            duration: 0.8, stagger: 0.1, ease: "back.out(1.2)", delay: 0.3 
          }
        );
      }

      // 3. אנימציה לעיטורים הצפים ברקע (Floating Blobs)
      decorationsRef.current.forEach((el, index) => {
        gsap.to(el, {
          y: "random(-30, 30)",
          x: "random(-30, 30)",
          rotation: "random(-20, 20)",
          duration: "random(3, 6)",
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: index * 0.2
        });
      });
    }
  }, [loading, photos.length]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center"><Loader2 className="animate-spin text-white mb-4" size={48} /><p className="text-white/50 font-bold animate-pulse">מכין את הרגעים שלכם...</p></div>;
  if (!eventData) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-2xl font-black">האירוע לא נמצא 💔</div>;

  const { background, primary } = eventData.design_config.colors;

  const handleNext = (e) => { e.stopPropagation(); setSelectedIndex(prev => prev === photos.length - 1 ? 0 : prev + 1); };
  const handlePrev = (e) => { e.stopPropagation(); setSelectedIndex(prev => prev === 0 ? photos.length - 1 : prev - 1); };

  return (
    <div className="min-h-screen overflow-x-hidden relative" style={{ backgroundColor: background }} dir="rtl">
      
      {/* --- רקעים דקורטיביים ועיטורים צפים (GSAP Animations) --- */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div ref={el => decorationsRef.current[0] = el} className="absolute -top-20 -right-20 w-96 h-96 rounded-full blur-[100px] opacity-20 mix-blend-screen" style={{ backgroundColor: primary }}></div>
        <div ref={el => decorationsRef.current[1] = el} className="absolute top-1/2 -left-32 w-[30rem] h-[30rem] rounded-full blur-[120px] opacity-10 mix-blend-screen" style={{ backgroundColor: primary }}></div>
        <div ref={el => decorationsRef.current[2] = el} className="absolute -bottom-40 right-1/4 w-80 h-80 rounded-full blur-[90px] opacity-20 mix-blend-screen" style={{ backgroundColor: primary }}></div>
        
        {/* אייקונים מרחפים */}
        <Heart ref={el => decorationsRef.current[3] = el} className="absolute top-32 left-10 text-white/5" size={64} />
        <Sparkles ref={el => decorationsRef.current[4] = el} className="absolute bottom-1/3 right-10 text-white/5" size={48} />
      </div>

      <div className="relative z-10">
        {/* Header פרימיום */}
        <header ref={headerRef} className="pt-24 pb-16 px-4 text-center">
          <div className="max-w-4xl mx-auto flex flex-col items-center">
            <button onClick={() => navigate(`/event/${id}`)} className="mb-6 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all text-sm font-bold flex items-center gap-2 backdrop-blur-md">
              חזרה לאירוע <ChevronLeft size={16} />
            </button>
            <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-white/5 backdrop-blur-md mb-6 border border-white/10 shadow-2xl transform rotate-3">
              <ImageIcon className="text-white fill-white/20" size={40} />
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white drop-shadow-2xl mb-4 tracking-tight leading-tight">
              {eventData.name}
            </h1>
            <div className="flex items-center gap-4 mt-2 mb-6">
              <div className="h-[2px] w-12 bg-white/20 rounded-full"></div>
              <p className="text-xl md:text-2xl text-white/60 font-medium tracking-widest uppercase">האלבום הדיגיטלי</p>
              <div className="h-[2px] w-12 bg-white/20 rounded-full"></div>
            </div>
          </div>
        </header>

        {/* Gallery Grid (Masonry Style) */}
        <main className="max-w-[1800px] mx-auto px-4 md:px-8 pb-32">
          {photos.length === 0 ? (
            <div className="text-center py-20 text-white/40">
              <ImageIcon size={64} className="mx-auto mb-4 opacity-30" />
              <p className="text-2xl font-black">האלבום עדיין ריק.</p>
              <p className="font-medium mt-2">היו הראשונים להוסיף רגעים מיוחדים!</p>
            </div>
          ) : (
            <div ref={gridRef} className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 md:gap-6 space-y-4 md:space-y-6">
              {photos.map((photo, index) => (
                <div 
                  key={photo.id} 
                  onClick={() => setSelectedIndex(index)}
                  className="photo-card relative break-inside-avoid rounded-[2rem] overflow-hidden cursor-pointer group shadow-2xl bg-white/5 border border-white/10 transform-gpu"
                >
                  <img 
                    src={photo.image_url} 
                    alt={`Photo by ${photo.guest_name}`} 
                    className="w-full h-auto object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-110"
                    loading="lazy"
                  />
                  {/* Overlay מעוצב */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6">
                    <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <Heart size={12} className="fill-white/50" /> צולם ע"י
                    </p>
                    <p className="text-white text-xl md:text-2xl font-black tracking-tight translate-y-2 group-hover:translate-y-0 transition-transform duration-500">{photo.guest_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Lightbox - תצוגה מוגדלת חכמה */}
      {selectedIndex !== null && (
        <div 
          className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setSelectedIndex(null)}
        >
          {/* Header Lightbox */}
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <div className="pointer-events-auto">
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest">צלם/ת הרגע</p>
              <p className="text-white text-2xl font-black">{photos[selectedIndex].guest_name}</p>
            </div>
            <button className="pointer-events-auto text-white/50 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all backdrop-blur-md">
              <X size={28} />
            </button>
          </div>
          
          <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12" onClick={e => e.stopPropagation()}>
            {/* כפתורי ניווט */}
            <button onClick={handleNext} className="absolute right-4 md:right-10 z-50 text-white/30 hover:text-white bg-black/20 hover:bg-black/40 p-4 md:p-6 rounded-full transition-all backdrop-blur-md group">
              <ChevronRight size={32} className="group-hover:scale-110 transition-transform" />
            </button>
            
            <img 
              key={selectedIndex} /* מכריח את ריאקט לטעון מחדש את האנימציה בהחלפת תמונה */
              src={photos[selectedIndex].image_url} 
              className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.4)] animate-in zoom-in-95 duration-300"
              alt="Enlarged moment"
            />

            <button onClick={handlePrev} className="absolute left-4 md:left-10 z-50 text-white/30 hover:text-white bg-black/20 hover:bg-black/40 p-4 md:p-6 rounded-full transition-all backdrop-blur-md group">
              <ChevronLeft size={32} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Album;