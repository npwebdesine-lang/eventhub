import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, ChevronLeft, Camera, Image as ImageIcon, UploadCloud, CheckCircle2, AlertCircle, Heart, Sparkles } from 'lucide-react';
import gsap from 'gsap';

const MAX_PHOTOS_PER_GUEST = 3;

// פונקציה לחישוב בהירות הצבע
const getLuminance = (hex) => {
  if (!hex) return 0;
  let color = hex.replace('#', '');
  if (color.length === 3) color = color.split('').map(c => c + c).join('');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
};

const Photos = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const navigate = useNavigate();

  const guestName = localStorage.getItem('guest_name') || '';
  
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(null); // נוסף סטייט לאירוע
  const [photos, setPhotos] = useState([]);
  
  const [uploading, setUploading] = useState(false);
  const [myUploadCount, setMyUploadCount] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    if (!eventId) return navigate('/');
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    try {
      // 1. משיכת נתוני האירוע (בשביל הצבעים)
      const { data: event, error: eventError } = await supabase.from('events').select('*').eq('id', eventId).single();
      if (eventError) throw eventError;
      setEventData(event);

      // 2. משיכת התמונות לגלריה
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (photosError) throw photosError;
      setPhotos(photosData || []);

      // 3. משיכת כמות התמונות של האורח לאבטחה
      const { count, error: countError } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('guest_name', guestName);
      if (countError) throw countError;
      setMyUploadCount(count || 0);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && eventData) {
      gsap.fromTo(".fade-up-item", 
        { y: 30, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "power2.out" }
      );
    }
  }, [loading, eventData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (myUploadCount >= MAX_PHOTOS_PER_GUEST) {
      return alert("הגעת למגבלת ההעלאות המותרת (3 תמונות).");
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('event-assets').upload(`photos/${fileName}`, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('event-assets').getPublicUrl(`photos/${fileName}`);

      const { error: dbError } = await supabase.from('photos').insert([{ event_id: eventId, guest_name: guestName, image_url: publicUrl }]);
      if (dbError) throw dbError;

      setPhotos([{ id: Date.now(), guest_name: guestName, image_url: publicUrl }, ...photos]);
      setMyUploadCount(prev => prev + 1);
      
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);

    } catch (err) {
      alert("שגיאה בהעלאת התמונה. נסו שוב.");
    } finally {
      setUploading(false);
    }
  };

  if (loading || !eventData) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={48} /></div>;

  const canUploadMore = myUploadCount < MAX_PHOTOS_PER_GUEST;
  
  // --- שאיבת צבעים דינמיים וחישוב בהירות ---
  const primaryColor = eventData.design_config?.colors?.primary || '#3b82f6';
  const bgColor = eventData.design_config?.colors?.background || '#f8fafc';
  const isLightPrimary = getLuminance(primaryColor) > 150;
  const primaryTextColor = isLightPrimary ? '#1e293b' : '#ffffff'; // טקסט שחור אם הרקע בהיר, לבן אם כהה

  return (
    <div className="min-h-screen font-sans pb-20 transition-colors duration-1000" style={{ backgroundColor: bgColor }} dir="rtl">
      
      {/* Header - משתמש בצבע ה-Primary הדינמי */}
      <div className="rounded-b-[3rem] pt-10 pb-16 px-6 relative z-10 shadow-lg flex justify-between items-start transition-colors duration-1000" style={{ backgroundColor: primaryColor }}>
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-black/10 hover:bg-black/20 transition-colors backdrop-blur-md" style={{ color: primaryTextColor }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-black flex items-center gap-2" style={{ color: primaryTextColor }}>
          כל אחד צלם <Camera size={20} style={{ color: primaryTextColor, opacity: 0.8 }} />
        </h1>
        <div className="w-9"></div>
      </div>

      <div className="px-6 -mt-8 relative z-20 max-w-md mx-auto">
        
        {/* כרטיסיית העלאת תמונה */}
        <div className="fade-up-item bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 mb-8 text-center">
          {uploadSuccess ? (
            <div className="py-6 animate-in zoom-in">
              <div className="w-16 h-16 bg-emerald-50 rounded-[1.2rem] flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <h3 className="font-black text-slate-800 text-lg">התמונה הועלתה!</h3>
              <p className="text-sm text-slate-500 font-medium">היא נוספה בהצלחה לאלבום המשותף.</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-[1.2rem] flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
                <UploadCloud size={28} style={{ color: primaryColor }} />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-2">צלמו או העלו תמונה</h2>
              <p className="text-slate-500 font-medium text-sm mb-6 leading-relaxed">
                שתפו את הרגעים היפים שלכם איתנו!<br/>
                <span className={`font-bold ${myUploadCount >= MAX_PHOTOS_PER_GUEST ? 'text-rose-500' : 'text-slate-700'}`}>
                  העליתם {myUploadCount} מתוך {MAX_PHOTOS_PER_GUEST} תמונות.
                </span>
              </p>
              
              {canUploadMore ? (
                <label className="w-full font-bold py-4 rounded-[1.2rem] flex justify-center items-center gap-2 cursor-pointer transition-all shadow-lg active:scale-95" style={{ backgroundColor: primaryColor, color: primaryTextColor }}>
                  {uploading ? <Loader2 className="animate-spin" size={20} /> : <><Camera size={20} /> פתח מצלמה / גלריה</>}
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    onChange={handleFileUpload} 
                    disabled={uploading} 
                    className="hidden" 
                  />
                </label>
              ) : (
                <div className="bg-rose-50 text-rose-600 font-bold py-3.5 rounded-[1.2rem] flex justify-center items-center gap-2 border border-rose-100">
                  <AlertCircle size={18} /> הגעתם למכסה המקסימלית
                </div>
              )}
            </>
          )}
        </div>

        {/* גלריה צפה */}
        <div className="fade-up-item">
          <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
            הפיד של האירוע <Sparkles size={16} style={{ color: primaryColor }} />
          </h3>
          
          {photos.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <ImageIcon size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-slate-500 font-medium text-sm">האלבום עדיין ריק.<br/>היו הראשונים להעלות תמונה!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group bg-white rounded-[1.5rem] overflow-hidden shadow-sm border border-slate-100 aspect-square">
                  <img 
                    src={photo.image_url} 
                    alt="Event" 
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/80 to-transparent p-3 pt-6">
                    <p className="text-white text-xs font-bold truncate flex items-center gap-1.5">
                      <Heart size={10} style={{ fill: primaryColor, color: primaryColor }} /> {photo.guest_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Photos;