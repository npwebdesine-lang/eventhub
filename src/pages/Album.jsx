import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, X, ChevronRight, ChevronLeft, Heart } from 'lucide-react';
import gsap from 'gsap';

const Album = () => {
  const { id } = useParams();
  const [eventData, setEventData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(null);

  // References לאנימציות
  const headerRef = useRef(null);
  const gridRef = useRef(null);

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        // 1. מביא את פרטי האירוע
        const { data: event, error: eventError } = await supabase.from('events').select('*').eq('id', id).single();
        if (eventError) throw eventError;
        setEventData(event);

        // 2. התיקון כאן: אנחנו מחפשים לפי event_id ולא לפי id!
        const { data: eventPhotos, error: photosError } = await supabase
          .from('photos')
          .select('*')
          .eq('event_id', id) // <-- זה השינוי הקריטי
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

      // אנימציית כניסה לכותרת (Header)
      tl.fromTo(headerRef.current, 
        { y: -50, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 1.2, ease: "power4.out" }
      );

      // אנימציית "מפל" (Stagger) לתמונות בגלריה
      if (photos.length > 0) {
        gsap.fromTo(".photo-card", 
          { scale: 0.8, opacity: 0, y: 30 },
          { 
            scale: 1, 
            opacity: 1, 
            y: 0, 
            duration: 0.8, 
            stagger: 0.1, 
            ease: "back.out(1.7)",
            delay: 0.5 
          }
        );
      }
    }
  }, [loading, photos.length]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={48} /></div>;

  const { background, primary } = eventData.design_config.colors;

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: background }} dir="rtl">
      
      {/* Header עם Ref לאנימציה */}
      <header ref={headerRef} className="py-20 px-4 text-center relative">
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-block p-3 rounded-full bg-white/5 backdrop-blur-sm mb-6 border border-white/10">
            <Heart className="text-white fill-white/20" size={32} />
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-white drop-shadow-2xl mb-6 tracking-tighter">
            {eventData.name}
          </h1>
          <div className="h-1 w-24 mx-auto rounded-full mb-6" style={{ backgroundColor: primary }}></div>
          <p className="text-xl md:text-2xl text-white/70 font-light italic">רגעים שנשמרים לנצח</p>
        </div>
      </header>

      {/* Gallery Grid */}
      <main className="max-w-[1600px] mx-auto px-6 pb-32">
        <div ref={gridRef} className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
          {photos.map((photo, index) => (
            <div 
              key={photo.id} 
              onClick={() => setSelectedIndex(index)}
              className="photo-card relative break-inside-avoid rounded-3xl overflow-hidden cursor-pointer group border border-white/5 shadow-2xl transition-all"
            >
              <img 
                src={photo.image_url} 
                alt="Moment" 
                className="w-full h-auto object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              {/* Overlay יוקרתי ב-Hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-8">
                <p className="text-white/60 text-sm mb-1">צילום מהלב של</p>
                <p className="text-white text-2xl font-black tracking-tight">{photo.guest_name}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Lightbox - תצוגה מוגדלת */}
      {selectedIndex !== null && (
        <div 
          className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-2xl flex items-center justify-center p-4"
          onClick={() => setSelectedIndex(null)}
        >
          <button className="absolute top-8 right-8 text-white/30 hover:text-white transition-colors"><X size={40} /></button>
          
          <div className="relative w-full max-w-6xl flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(prev => prev === 0 ? photos.length - 1 : prev - 1); }} className="absolute right-0 md:-right-16 text-white/20 hover:text-white p-4 transition-all"><ChevronRight size={48} /></button>
            
            <div className="flex flex-col items-center">
              <img 
                src={photos[selectedIndex].image_url} 
                className="max-w-full max-h-[80vh] rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
                alt="Enlarged"
              />
              <div className="mt-8 text-center">
                <p className="text-white/40 text-sm uppercase tracking-widest mb-2">Captured by</p>
                <p className="text-white text-3xl font-black">{photos[selectedIndex].guest_name}</p>
              </div>
            </div>

            <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(prev => prev === photos.length - 1 ? 0 : prev + 1); }} className="absolute left-0 md:-left-16 text-white/20 hover:text-white p-4 transition-all"><ChevronLeft size={48} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Album;