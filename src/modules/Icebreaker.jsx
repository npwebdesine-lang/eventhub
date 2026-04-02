import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Camera, ChevronLeft, Zap, Target, ImagePlus, User, CheckCircle2, LogOut, Sparkles } from 'lucide-react';
import gsap from 'gsap';

// חישוב בהירות הצבע
const getLuminance = (hex) => {
  if (!hex) return 0;
  let color = hex.replace('#', '');
  if (color.length === 3) color = color.split('').map(c => c + c).join('');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
};

const Icebreaker = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const navigate = useNavigate();

  const guestName = localStorage.getItem('guest_name');
  const guestId = localStorage.getItem('guest_id');

  const [eventData, setEventData] = useState(null);
  const [view, setView] = useState('loading');
  const [myProfile, setMyProfile] = useState(null);
  
  const [currentMatch, setCurrentMatch] = useState(null);
  const [feed, setFeed] = useState([]);
  
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const proofInputRef = useRef(null);
  const rouletteRef = useRef(null);

  useEffect(() => {
    if (!eventId || !guestId) return navigate('/');
    checkStatus();
  }, [eventId, guestId]);

  const checkStatus = async () => {
    try {
      const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
      setEventData(event);

      const { data: profile } = await supabase.from('icebreaker_profiles').select('*').eq('event_id', eventId).eq('guest_id', guestId).single();
      
      if (!profile) {
        setView('register');
        return;
      }
      setMyProfile(profile);

      const { data: activeMatch } = await supabase
        .from('icebreaker_matches')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'pending')
        .or(`guest1_id.eq.${guestId},guest2_id.eq.${guestId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (activeMatch) {
        const partnerId = activeMatch.guest1_id === guestId ? activeMatch.guest2_id : activeMatch.guest1_id;
        const { data: partner } = await supabase.from('icebreaker_profiles').select('*').eq('event_id', eventId).eq('guest_id', partnerId).single();
        setCurrentMatch({ ...activeMatch, partner });
        setView('active_mission');
      } else {
        fetchFeed();
        setView('hub');
      }
    } catch (err) { console.error(err); setView('register'); }
  };

  const fetchFeed = async () => {
    const { data } = await supabase.from('icebreaker_matches').select('*').eq('event_id', eventId).eq('status', 'completed').order('completed_at', { ascending: false });
    setFeed(data || []);
  };

  // אנימציות מעברים
  useEffect(() => {
    if (view === 'hub') {
      gsap.fromTo(".fade-up-item", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "back.out(1.2)" });
    }
  }, [view, feed]);

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileName = `profiles/${eventId}/${guestId}_${Date.now()}.jpg`;
      await supabase.storage.from('icebreaker-uploads').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('icebreaker-uploads').getPublicUrl(fileName);
      setPhotoUrl(publicUrl);
    } catch (err) { alert("שגיאה בהעלאה"); } finally { setUploading(false); }
  };

  const handleJoinGame = async () => {
    try {
      const { error } = await supabase.from('icebreaker_profiles').upsert({
        event_id: eventId, guest_id: guestId, name: guestName, photo_url: photoUrl
      });
      if (error) throw error;
      checkStatus();
    } catch (err) { alert("שגיאה בהצטרפות למשחק"); }
  };

  const handleLogout = async () => {
    if (!window.confirm("בטוח שרוצים להתנתק ולפרוש מהמשחק? (זה ימחק אתכם גם מהגרלות של אחרים)")) return;
    try {
      await supabase.from('icebreaker_profiles').delete().eq('event_id', eventId).eq('guest_id', guestId);
      setMyProfile(null); setPhotoUrl(''); setView('register');
    } catch (err) { alert("שגיאה בהתנתקות"); }
  };

  const startRoulette = async () => {
    setView('roulette');
    try {
      const { data: others } = await supabase.from('icebreaker_profiles').select('*').eq('event_id', eventId).neq('guest_id', guestId);
      const { data: missions } = await supabase.from('icebreaker_missions').select('*').eq('event_id', eventId);

      if (!others || others.length === 0) { alert("עדיין אין עוד אנשים במשחק! תגידו לחבר'ה להירשם."); setView('hub'); return; }
      if (!missions || missions.length === 0) { alert("מנהל האירוע עדיין לא הזין משימות לבנק!"); setView('hub'); return; }

      const randomPartner = others[Math.floor(Math.random() * others.length)];
      const randomMission = missions[Math.floor(Math.random() * missions.length)];

      gsap.to(rouletteRef.current, { scale: 1.1, duration: 0.2, yoyo: true, repeat: 10 });
      
      setTimeout(async () => {
        const { data: matchData, error } = await supabase.from('icebreaker_matches').insert([{
          event_id: eventId, guest1_id: guestId, guest2_id: randomPartner.guest_id, mission_text: randomMission.content, status: 'pending'
        }]).select().single();

        if (!error) {
          setCurrentMatch({ ...matchData, partner: randomPartner });
          setView('active_mission');
          gsap.fromTo(".mission-reveal", { scale: 0.8, opacity: 0, y: 50 }, { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.5)" });
        }
      }, 2000);

    } catch (err) { console.error(err); setView('hub'); }
  };

  const handleProofUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileName = `proofs/${eventId}/${currentMatch.id}_${Date.now()}.jpg`;
      await supabase.storage.from('icebreaker-uploads').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('icebreaker-uploads').getPublicUrl(fileName);
      
      await supabase.from('icebreaker_matches').update({
        photo_url: publicUrl, status: 'completed', completed_at: new Date().toISOString()
      }).eq('id', currentMatch.id);

      setCurrentMatch(null);
      fetchFeed();
      setView('hub');
    } catch (err) { alert("שגיאה בהעלאת ההוכחה"); } finally { setUploading(false); }
  };

  if (view === 'loading' || !eventData) return <div className="min-h-screen bg-slate-900 flex justify-center items-center"><Loader2 className="animate-spin text-white" size={48} /></div>;

  const primaryColor = eventData.design_config?.colors?.primary || '#3b82f6';
  const bgColor = eventData.design_config?.colors?.background || '#f8fafc';
  const isLightPrimary = getLuminance(primaryColor) > 150;
  const primaryTextColor = isLightPrimary ? '#1e293b' : '#ffffff';

  if (view === 'register') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-1000" style={{ backgroundColor: bgColor }} dir="rtl">
        <button onClick={() => navigate(-1)} className="absolute right-6 top-8 p-2 bg-slate-200/50 hover:bg-slate-200 rounded-full z-10 transition-colors"><ChevronLeft size={24} className="text-slate-700" /></button>
        
        <div className="w-full max-w-sm text-center relative z-10 animate-in zoom-in-95 duration-500">
          <div className="inline-flex p-5 rounded-[1.5rem] mb-6 shadow-sm border border-slate-100 bg-white" style={{ borderColor: `${primaryColor}30` }}>
            <Zap size={48} style={{ color: primaryColor }} />
          </div>
          <h1 className="text-4xl font-black mb-2 text-slate-800">IceBreaker</h1>
          <p className="text-slate-500 font-medium mb-8">המשימה שלכם: למצוא אנשים, לבצע משימות מצחיקות, ולתעד הכל.</p>

          <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <h2 className="text-xl font-bold mb-6 text-slate-800">תמונת זיהוי (כדי שימצאו אתכם)</h2>
            <label className="relative cursor-pointer inline-block group mb-6">
              <div className="w-40 h-40 mx-auto rounded-full bg-slate-50 border-4 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all shadow-inner" style={{ borderColor: uploading ? primaryColor : undefined }}>
                {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" /> : <Camera size={40} className="text-slate-300" />}
                {uploading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin" style={{ color: primaryColor }} /></div>}
              </div>
              <input type="file" accept="image/*" capture="user" onChange={handleProfilePhotoUpload} className="hidden" />
            </label>
            <button onClick={handleJoinGame} className="w-full font-black py-4 rounded-[1.2rem] text-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95" style={{ backgroundColor: primaryColor, color: primaryTextColor }}>
              אני בפנים!
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'roulette') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 transition-colors duration-1000" style={{ backgroundColor: primaryColor, color: primaryTextColor }} dir="rtl">
        <div ref={rouletteRef} className="bg-white/20 p-12 rounded-[3rem] backdrop-blur-md shadow-2xl border border-white/20">
          <Loader2 className="animate-spin mx-auto mb-8" size={80} style={{ color: primaryTextColor }} />
          <h2 className="text-3xl font-black mb-2 drop-shadow-md">מאתר קורבן...</h2>
          <p className="text-xl font-medium mt-4 animate-pulse opacity-80">מגריל משימה חשאית בשבילך</p>
        </div>
      </div>
    );
  }

  if (view === 'active_mission' && currentMatch) {
    return (
      <div className="min-h-screen flex flex-col transition-colors duration-1000" style={{ backgroundColor: bgColor }} dir="rtl">
        <header className="p-6 flex justify-between items-center rounded-b-[3rem] shadow-md z-10" style={{ backgroundColor: primaryColor }}>
          <button onClick={() => setView('hub')} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors"><ChevronLeft size={24} style={{ color: primaryTextColor }} /></button>
          <span className="bg-white text-slate-900 px-5 py-2 rounded-full text-sm font-bold shadow-sm animate-pulse flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500"/> משימה באוויר!
          </span>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mission-reveal -mt-6">
          <h2 className="text-xl font-bold text-slate-500 mb-4 uppercase tracking-widest">המטרה שלך:</h2>
          <div className="w-36 h-36 rounded-full overflow-hidden bg-slate-100 border-[6px] shadow-2xl mb-4 mx-auto relative z-10" style={{ borderColor: primaryColor }}>
            {currentMatch.partner?.photo_url ? <img src={currentMatch.partner.photo_url} className="w-full h-full object-cover" /> : <User size={48} className="m-auto mt-10 text-slate-300" />}
          </div>
          <h1 className="text-4xl font-black text-slate-800 mb-8">{currentMatch.partner?.name}</h1>
          
          <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] w-full max-w-md relative z-20">
            <div className="absolute -top-6 -right-2 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-4 border-white" style={{ backgroundColor: primaryColor }}>
              <Target style={{ color: primaryTextColor }} size={20} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3 opacity-60" style={{ color: primaryColor }}>פקודת מבצע</p>
            <p className="text-2xl font-black text-slate-800 leading-tight">{currentMatch.mission_text}</p>
          </div>

          <div className="mt-auto w-full max-w-md pt-12 pb-6">
            <input type="file" accept="image/*" capture="environment" ref={proofInputRef} onChange={handleProofUpload} className="hidden" />
            <button onClick={() => proofInputRef.current?.click()} disabled={uploading} className="w-full font-black py-5 rounded-[1.5rem] text-lg shadow-xl flex justify-center items-center gap-3 hover:scale-[1.02] transition-transform active:scale-95" style={{ backgroundColor: primaryColor, color: primaryTextColor }}>
              {uploading ? <Loader2 className="animate-spin" /> : <><Camera size={24} /> צילמנו! העלה הוכחה</>}
            </button>
            <p className="text-slate-400 font-medium text-xs mt-4">מצאו אחד את השנייה, בצעו את המשימה וצלמו תמונה.</p>
          </div>
        </div>
      </div>
    );
  }

  // --- תצוגת Hub (המסך הראשי של המודול) ---
  return (
    <div className="min-h-screen font-sans transition-colors duration-1000 pb-10" style={{ backgroundColor: bgColor }} dir="rtl">
      
      {/* Header כהה מעוגל */}
      <div className="rounded-b-[3rem] pt-12 pb-24 px-6 relative z-10 shadow-lg flex justify-between items-start transition-colors duration-1000" style={{ backgroundColor: primaryColor }}>
        <button onClick={() => navigate(`/event/${eventId}`)} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors backdrop-blur-md" style={{ color: primaryTextColor }}><ChevronLeft size={22} /></button>
        <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: primaryTextColor }}>
          IceBreaker <Zap size={20} style={{ fill: primaryTextColor, opacity: 0.8 }} />
        </h1>
        <div className="w-10 h-10 rounded-[1rem] overflow-hidden bg-black/10 shadow-inner">
          {myProfile?.photo_url ? <img src={myProfile.photo_url} className="w-full h-full object-cover" /> : <User size={20} className="m-auto mt-2 opacity-50" style={{ color: primaryTextColor }} />}
        </div>
      </div>

      <div className="px-6 -mt-14 relative z-20 max-w-md mx-auto flex-1 flex flex-col">
        
        {/* כפתור הגרלה ראשי צף */}
        <button onClick={startRoulette} className="fade-up-item w-full bg-white p-8 rounded-[2.5rem] text-center shadow-[0_15px_40px_rgb(0,0,0,0.08)] mb-8 transform-gpu hover:scale-[1.02] transition-transform active:scale-95 group border border-slate-50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: primaryColor }}></div>
          <div className="w-16 h-16 rounded-[1.2rem] flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
            <Zap className="group-hover:animate-bounce" size={32} style={{ color: primaryColor }} />
          </div>
          <h2 className="text-2xl font-black text-slate-800">הגרל משימה חדשה</h2>
          <p className="text-slate-500 font-medium mt-1 text-sm">בואו נשבור את הקרח</p>
        </button>

        <h3 className="fade-up-item text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
          <CheckCircle2 className="text-emerald-500" /> הקיר תהילה
        </h3>
        
        <div className="space-y-5 pb-8 flex-1">
          {feed.length === 0 ? (
            <div className="fade-up-item text-center py-12 bg-white rounded-[2rem] shadow-sm border border-slate-100">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <ImagePlus size={28} className="text-slate-300" />
              </div>
              <p className="text-slate-700 font-bold text-lg">הקיר ריק.</p>
              <p className="text-slate-400 font-medium text-sm mt-1">תהיו הראשונים לבצע משימה ולהופיע כאן!</p>
            </div>
          ) : (
            feed.map(match => (
              <div key={match.id} className="fade-up-item bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="p-5 bg-slate-50/50">
                  <p className="text-xs font-bold uppercase tracking-widest mb-1 opacity-70" style={{ color: primaryColor }}>המשימה שבוצעה:</p>
                  <p className="text-lg leading-snug font-black text-slate-800">"{match.mission_text}"</p>
                </div>
                {match.photo_url && (
                  <div className="aspect-square bg-slate-100 w-full relative">
                    <img src={match.photo_url} className="w-full h-full object-cover" alt="Mission Proof" loading="lazy" />
                  </div>
                )}
                <div className="p-4 flex items-center justify-between text-xs text-slate-400 font-bold bg-white">
                  <span>בוצע והוכח בשטח 🎯</span>
                  <span dir="ltr">{new Date(match.completed_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <button onClick={handleLogout} className="fade-up-item w-full mt-auto py-6 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 transition-colors font-bold text-sm">
          <LogOut size={16} /> אני רוצה לפרוש מהמשחק
        </button>
      </div>
    </div>
  );
};

export default Icebreaker;