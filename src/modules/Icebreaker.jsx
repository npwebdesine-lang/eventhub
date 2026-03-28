import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Camera, ChevronLeft, Zap, Target, ImagePlus, User, CheckCircle2, LogOut } from 'lucide-react';
import gsap from 'gsap';

const Icebreaker = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const navigate = useNavigate();

  const guestName = localStorage.getItem('guest_name');
  const guestId = localStorage.getItem('guest_id');

  const [view, setView] = useState('loading');
  const [myProfile, setMyProfile] = useState(null);
  
  const [currentMatch, setCurrentMatch] = useState(null);
  const [feed, setFeed] = useState([]);
  
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const proofInputRef = useRef(null);
  const rouletteRef = useRef(null);

  useEffect(() => {
    if (!eventId || !guestId) return navigate('/');
    checkStatus();
  }, [eventId, guestId]);

  const checkStatus = async () => {
    try {
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
      setMyProfile(null);
      setPhotoUrl('');
      setView('register');
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
          gsap.fromTo(".mission-reveal", { scale: 0, rotation: -180 }, { scale: 1, rotation: 0, duration: 0.8, ease: "back.out(1.5)" });
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

  if (view === 'loading') return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-cyan-500" size={48} /></div>;

  if (view === 'register') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center relative overflow-hidden" dir="rtl">
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-cyan-500/20 blur-[100px] rounded-full pointer-events-none"></div>
        <button onClick={() => navigate(-1)} className="absolute right-6 top-8 p-2 bg-white/10 rounded-full z-10"><ChevronLeft size={24} /></button>
        
        <div className="w-full max-w-sm text-center relative z-10 animate-in slide-in-from-bottom-8">
          <div className="inline-flex p-5 bg-cyan-500/20 rounded-full mb-6 border border-cyan-500/30">
            <Zap className="text-cyan-400" size={48} />
          </div>
          <h1 className="text-4xl font-black mb-2">IceBreaker</h1>
          <p className="text-white/60 mb-8">המשימה שלכם: למצוא אנשים, לבצע משימות מצחיקות, ולתעד הכל.</p>

          <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-xl">
            <h2 className="text-xl font-bold mb-6">צילום זיהוי (כדי שימצאו אתכם)</h2>
            <label className="relative cursor-pointer inline-block group mb-6">
              <div className="w-40 h-40 mx-auto rounded-full bg-slate-800 border-4 border-dashed border-cyan-500/50 flex items-center justify-center overflow-hidden transition-all group-hover:border-cyan-400">
                {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" /> : <Camera size={40} className="text-white/30" />}
                {uploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400" /></div>}
              </div>
              <input type="file" accept="image/*" capture="user" onChange={handleProfilePhotoUpload} className="hidden" />
            </label>
            <button onClick={handleJoinGame} className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black py-4 rounded-2xl text-xl shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all active:scale-95">
              אני בפנים! לחצו כאן
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'roulette') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white text-center p-6" dir="rtl">
        <div ref={rouletteRef}>
          <Loader2 className="animate-spin text-cyan-500 mx-auto mb-8" size={80} />
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">מאתר קורבן מתאים...</h2>
          <p className="text-xl text-white/50 mt-4 animate-pulse">מגריל משימה חשאית בשבילך</p>
        </div>
      </div>
    );
  }

  if (view === 'active_mission' && currentMatch) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col" dir="rtl">
        <header className="flex justify-between items-center mb-8">
          <button onClick={() => setView('hub')} className="p-2 bg-white/10 rounded-full"><ChevronLeft size={24} /></button>
          <span className="bg-rose-500 text-white px-4 py-1.5 rounded-full text-sm font-bold animate-pulse">משימה באוויר!</span>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center mission-reveal">
          <h2 className="text-2xl font-black text-white/60 mb-2">המטרה שלך:</h2>
          <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-800 border-4 border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.3)] mb-4 mx-auto">
            {currentMatch.partner?.photo_url ? <img src={currentMatch.partner.photo_url} className="w-full h-full object-cover" /> : <User size={48} className="m-auto mt-10 text-white/20" />}
          </div>
          <h1 className="text-4xl font-black text-cyan-400 mb-8">{currentMatch.partner?.name}</h1>
          
          <div className="bg-white/10 border border-white/20 p-6 rounded-3xl backdrop-blur-md w-full max-w-md relative">
            <Target className="absolute -top-4 -right-4 text-cyan-500 bg-slate-950 rounded-full" size={32} />
            <p className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2">פקודת מבצע</p>
            <p className="text-2xl font-black leading-snug">{currentMatch.mission_text}</p>
          </div>

          <div className="mt-auto w-full max-w-md pt-12 pb-6">
            <input type="file" accept="image/*" capture="environment" ref={proofInputRef} onChange={handleProofUpload} className="hidden" />
            <button onClick={() => proofInputRef.current?.click()} disabled={uploading} className="w-full bg-cyan-500 text-slate-950 font-black py-5 rounded-2xl text-xl shadow-[0_0_30px_rgba(6,182,212,0.4)] flex justify-center items-center gap-3 hover:scale-105 transition-all">
              {uploading ? <Loader2 className="animate-spin" /> : <><Camera size={28} /> צילמנו! העלה הוכחה</>}
            </button>
            <p className="text-white/40 text-xs mt-4">מצאו אחד את השנייה, בצעו את המשימה וצלמו תמונה משותפת.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col overflow-x-hidden" dir="rtl">
      <header className="p-6 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5 flex justify-between items-center shadow-lg">
        <button onClick={() => navigate(`/event/${eventId}`)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><ChevronLeft size={22} /></button>
        <h1 className="text-2xl font-black flex items-center gap-2">IceBreaker <Zap size={20} className="text-cyan-400 fill-cyan-400" /></h1>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 border-2 border-cyan-500/50">
          {myProfile?.photo_url && <img src={myProfile.photo_url} className="w-full h-full object-cover" />}
        </div>
      </header>

      <div className="p-6 flex-1 flex flex-col">
        <button onClick={startRoulette} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 p-8 rounded-[2rem] text-center shadow-[0_10px_40px_rgba(6,182,212,0.3)] mb-8 transform-gpu hover:scale-[1.02] transition-all active:scale-95 group">
          <Zap className="mx-auto text-white mb-3 group-hover:animate-bounce" size={40} />
          <h2 className="text-2xl font-black">הגרל משימה חדשה</h2>
          <p className="text-cyan-100 font-medium mt-1">בואו נשבור את הקרח</p>
        </button>

        <h3 className="text-xl font-black mb-4 flex items-center gap-2">
          <CheckCircle2 className="text-emerald-500" /> הקיר תהילה
        </h3>
        
        <div className="space-y-6 pb-10 flex-1">
          {feed.length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-[2rem] border border-white/5 border-dashed">
              <ImagePlus size={48} className="mx-auto mb-3 text-white/20" />
              <p className="text-white/50 font-bold">הקיר ריק.</p>
              <p className="text-white/30 text-sm">תהיו הראשונים לבצע משימה ולהופיע כאן!</p>
            </div>
          ) : (
            feed.map(match => (
              <div key={match.id} className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4">
                <div className="p-5 bg-slate-900/50 backdrop-blur-md">
                  <p className="text-sm font-black text-cyan-400 mb-1">המשימה שבוצעה:</p>
                  <p className="text-lg leading-snug font-medium text-white/90">"{match.mission_text}"</p>
                </div>
                {match.photo_url && (
                  <div className="aspect-square bg-slate-900 w-full relative">
                    <img src={match.photo_url} className="w-full h-full object-cover" alt="Mission Proof" loading="lazy" />
                  </div>
                )}
                <div className="p-4 flex items-center justify-between text-xs text-white/40 font-bold">
                  <span>בוצע והוכח בשטח 🎯</span>
                  <span dir="ltr">{new Date(match.completed_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <button onClick={handleLogout} className="w-full mt-auto py-6 flex items-center justify-center gap-2 text-cyan-500/50 hover:text-cyan-400 transition-colors font-bold text-sm">
          <LogOut size={16} /> אני רוצה לפרוש מהמשחק
        </button>
      </div>
    </div>
  );
};

export default Icebreaker;