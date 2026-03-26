import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, ArrowRight, Loader2, ImagePlus, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import gsap from 'gsap';

const Photos = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event'); // שולף את ה-ID מהכתובת
  
  const fileInputRef = useRef(null);
  const headerRef = useRef(null);
  const uploadBoxRef = useRef(null);
  
  // מצבי האפליקציה
  const [eventData, setEventData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // נתוני האורח מהזיכרון
  const guestName = localStorage.getItem('guest_name');
  const guestId = localStorage.getItem('guest_id');
  
  const [userPhotoCount, setUserPhotoCount] = useState(0);
  const MAX_PHOTOS = 3;

  useEffect(() => {
    // זריקה החוצה אם חסר משהו קריטי
    if (!guestName || !guestId || !eventId) {
      navigate('/');
      return;
    }
    fetchData();
  }, [eventId, guestId]);

  // אנימציות GSAP נכנסות לפעולה רק אחרי שהטעינה מסתיימת
  useEffect(() => {
    if (!loading && eventData) {
      gsap.fromTo(headerRef.current, 
        { y: -50, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }
      );
      gsap.fromTo(uploadBoxRef.current, 
        { scale: 0.9, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 0.5, delay: 0.2, ease: "back.out(1.5)" }
      );
      gsap.fromTo(".photo-item", 
        { y: 30, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, delay: 0.4, ease: "power2.out" }
      );
    }
  }, [loading, eventData]);

  const fetchData = async () => {
    try {
      // 1. תיקון הבאג: מביאים את האירוע הספציפי לפי ה-ID
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (eventError) throw eventError;
      setEventData(event);

      // 2. מביאים תמונות
      const { data: eventPhotos, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });
      
      if (photosError) throw photosError;
      setPhotos(eventPhotos);

      const myPhotos = eventPhotos.filter(p => p.guest_id === guestId);
      setUserPhotoCount(myPhotos.length);

    } catch (error) {
      console.error("Error loading gallery:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || userPhotoCount >= MAX_PHOTOS) return;

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventData.id}/${Date.now()}-${guestId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('event-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('event-photos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('photos').insert([
        { event_id: eventData.id, image_url: publicUrl, guest_id: guestId, guest_name: guestName }
      ]);

      if (dbError) throw dbError;

      await fetchData();

    } catch (error) {
      alert("הייתה שגיאה בהעלאת התמונה. נסה שוב.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;

  const { design_config } = eventData;
  const { background, primary } = design_config.colors;
  const isQuotaFull = userPhotoCount >= MAX_PHOTOS;

  return (
    <div className="min-h-screen pb-20 transition-colors duration-1000 overflow-x-hidden" style={{ backgroundColor: background }} dir="rtl">
      
      {/* --- תפריט עליון עם התיקון הקריטי --- */}
      <div ref={headerRef} className="sticky top-0 z-50 bg-black/30 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between shadow-lg">
        {/* הניווט תוקן ל- /event/eventId במקום / */}
        <button onClick={() => navigate(`/event/${eventId}`)} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all active:scale-95">
          <ArrowRight size={22} />
        </button>
        <h1 className="text-xl font-black text-white tracking-tight drop-shadow-md">גלריית האירוע</h1>
        <div className="w-10"></div>
      </div>

      <div className="max-w-3xl mx-auto p-5">
        
        {/* --- אזור הצילום --- */}
        <div ref={uploadBoxRef} className="bg-white/10 backdrop-blur-md rounded-[2rem] p-8 text-center border border-white/20 mb-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: primary }}></div>
          <h2 className="text-2xl font-black text-white mb-2">תפסו רגע מיוחד!</h2>
          <p className="text-white/80 mb-6 font-medium">העלו עד {MAX_PHOTOS} תמונות לגלריה של {eventData.name}</p>
          
          <input 
            type="file" 
            accept="image/*" 
            capture="environment"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          {!isQuotaFull ? (
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full text-white font-black py-5 rounded-2xl text-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden group"
              style={{ backgroundColor: primary }}
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              {uploading ? (
                <><Loader2 className="animate-spin" size={32} /> מעבד תמונה...</>
              ) : (
                <><Camera size={36} className="group-hover:scale-110 transition-transform" /> צלם והעלה ({MAX_PHOTOS - userPhotoCount} נותרו)</>
              )}
            </button>
          ) : (
            <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 p-6 rounded-2xl flex flex-col items-center gap-3 animate-in fade-in zoom-in">
              <CheckCircle2 size={42} />
              <span className="font-black text-xl">מושלם! מכסת התמונות מלאה.</span>
              <span className="text-sm opacity-80 font-medium">תודה שעזרת לתעד את הרגעים היפים.</span>
            </div>
          )}
        </div>

        {/* --- הגלריה --- */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="photo-item relative aspect-[4/5] rounded-[1.5rem] overflow-hidden group bg-slate-900 border border-white/10 shadow-xl">
              <img 
                src={photo.image_url} 
                alt="Event moment" 
                className="w-full h-full object-cover contrast-110 saturate-150 transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 group-hover:translate-y-0 transition-transform">
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">צולם ע"י</p>
                <p className="text-white text-sm font-black truncate flex items-center gap-2">
                  {photo.guest_name}
                </p>
              </div>
            </div>
          ))}
          
          {photos.length === 0 && (
            <div className="col-span-full text-center py-16 text-white/40 bg-white/5 rounded-[2rem] border-2 border-white/10 border-dashed">
              <ImagePlus size={56} className="mx-auto mb-4 opacity-30" />
              <p className="font-black text-xl mb-1">הגלריה ריקה</p>
              <p className="text-sm font-medium">תהיו הראשונים לפתוח את החגיגה!</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Photos;