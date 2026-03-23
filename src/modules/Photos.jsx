import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ArrowRight, Loader2, ImagePlus, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Photos = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  // מצבי האפליקציה
  const [eventData, setEventData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // נתוני האורח מהזיכרון
  const guestName = localStorage.getItem('guest_name');
  const guestId = localStorage.getItem('guest_id');
  
  // כמה תמונות האורח הזה כבר העלה?
  const [userPhotoCount, setUserPhotoCount] = useState(0);
  const MAX_PHOTOS = 3;

  useEffect(() => {
    // אם מישהו הגיע לפה בלי שם, נזרוק אותו חזרה לשער הכניסה
    if (!guestName || !guestId) {
      navigate('/');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. מביאים את נתוני האירוע
      const { data: event, error: eventError } = await supabase.from('events').select('*').limit(1).single();
      if (eventError) throw eventError;
      setEventData(event);

      // 2. מביאים את כל התמונות שכבר צולמו באירוע הזה
      const { data: eventPhotos, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false }); // התמונות החדשות למעלה
      
      if (photosError) throw photosError;
      setPhotos(eventPhotos);

      // 3. סופרים כמה תמונות האורח הנוכחי העלה
      const myPhotos = eventPhotos.filter(p => p.guest_id === guestId);
      setUserPhotoCount(myPhotos.length);

    } catch (error) {
      console.error("Error loading gallery:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // הפונקציה שמופעלת כשהאורח בוחר תמונה מהמצלמה
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || userPhotoCount >= MAX_PHOTOS) return;

    setUploading(true);

    try {
      // 1. ממציאים שם ייחודי לקובץ (כדי שתמונות לא ידרסו אחת את השנייה)
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventData.id}/${Date.now()}-${guestId}.${fileExt}`;

      // 2. מעלים את הקובץ פיזית לכונן הענן של Supabase
      const { error: uploadError } = await supabase.storage
        .from('event-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 3. מבקשים מ-Supabase את הקישור הציבורי של התמונה שהרגע העלינו
      const { data: { publicUrl } } = supabase.storage
        .from('event-photos')
        .getPublicUrl(fileName);

      // 4. שומרים את הקישור והשם של האורח בטבלת הנתונים (כדי שיופיע בגלריה)
      const { error: dbError } = await supabase.from('photos').insert([
        {
          event_id: eventData.id,
          image_url: publicUrl,
          guest_id: guestId,
          guest_name: guestName
        }
      ]);

      if (dbError) throw dbError;

      // 5. מרעננים את המסך כדי להראות את התמונה החדשה!
      await fetchData();

    } catch (error) {
      alert("הייתה שגיאה בהעלאת התמונה. נסה שוב.");
      console.error(error);
    } finally {
      setUploading(false);
      // מאפס את הכפתור כדי שיוכל לצלם שוב
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-orange-500" size={48} /></div>;

  const { design_config } = eventData;
  const { background, primary } = design_config.colors;
  const isQuotaFull = userPhotoCount >= MAX_PHOTOS;

  return (
    <div className="min-h-screen pb-20 transition-colors duration-1000" style={{ backgroundColor: background }} dir="rtl">
      
      {/* --- תפריט עליון (Header) --- */}
      <div className="sticky top-0 z-50 bg-black/20 backdrop-blur-lg border-b border-white/10 p-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="text-white/80 hover:text-white bg-white/10 p-2 rounded-full transition-colors">
          <ArrowRight size={24} />
        </button>
        <h1 className="text-xl font-bold text-white tracking-tight">הגלריה המשותפת</h1>
        <div className="w-10"></div> {/* שומר על איזון (Spacer) */}
      </div>

      <div className="max-w-3xl mx-auto p-4">
        
        {/* --- אזור הצילום וההעלאה --- */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 text-center border border-white/20 mb-8 shadow-2xl">
          <h2 className="text-2xl font-black text-white mb-2">תפסו רגע מיוחד!</h2>
          <p className="text-white/80 mb-6 font-medium">העלו עד {MAX_PHOTOS} תמונות לגלריה של {eventData.name}</p>
          
          {/* כפתור נסתר שמפעיל את חלון בחירת הקבצים/מצלמה */}
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" /* אומר לטלפון לפתוח מצלמה אחורית אוטומטית אם אפשר */
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          {!isQuotaFull ? (
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full text-white font-bold py-5 rounded-2xl text-xl shadow-[0_0_40px_rgba(0,0,0,0.3)] hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-3 relative overflow-hidden"
              style={{ backgroundColor: primary }}
            >
              {uploading ? (
                <><Loader2 className="animate-spin" size={32} /> מעבד תמונה...</>
              ) : (
                <><Camera size={36} /> פתח מצלמה ({MAX_PHOTOS - userPhotoCount} נותרו)</>
              )}
            </button>
          ) : (
            <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 p-5 rounded-2xl flex flex-col items-center gap-2">
              <CheckCircle2 size={36} />
              <span className="font-bold text-lg">מושלם! העלית {MAX_PHOTOS} תמונות.</span>
              <span className="text-sm opacity-80">תודה שעזרת לתעד את האירוע!</span>
            </div>
          )}
        </div>

        {/* --- הגלריה (Grid) --- */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden group bg-white/5 border border-white/10">
              <img 
                src={photo.image_url} 
                alt="Event moment" 
                // כאן ה"פילטר" שלנו: מגביר קונטרסט וצבעים לתמונות שמחות יותר!
                className="w-full h-full object-cover contrast-110 saturate-150 transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 translate-y-2 group-hover:translate-y-0 transition-transform">
                <p className="text-white text-xs font-medium truncate flex items-center gap-1.5">
                  <Camera size={12} className="opacity-70" />
                  צולם ע"י {photo.guest_name}
                </p>
              </div>
            </div>
          ))}
          
          {photos.length === 0 && (
            <div className="col-span-full text-center py-12 text-white/50 bg-white/5 rounded-3xl border border-white/10 border-dashed">
              <ImagePlus size={48} className="mx-auto mb-3 opacity-50" />
              <p className="font-medium text-lg">עדיין אין תמונות בגלריה.</p>
              <p className="text-sm mt-1">תהיו הראשונים לצלם!</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Photos;