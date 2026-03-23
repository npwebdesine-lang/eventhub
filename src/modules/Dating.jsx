import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Heart, Camera, Loader2, ArrowRight, User, 
  MessageCircle, Sparkles, Trash2, Edit3, Send, X, ChevronLeft 
} from 'lucide-react';

const Dating = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const navigate = useNavigate();

  // מצבי תצוגה: 'loading', 'register', 'gallery', 'chat'
  const [view, setView] = useState('loading');
  const [regStep, setRegStep] = useState(1);
  
  const [profiles, setProfiles] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [activeChat, setActiveChat] = useState(null); // המשתמש שאיתו מתכתבים
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // נתוני המשתמש מה-LocalStorage
  const guestName = localStorage.getItem('guest_name');
  const guestId = localStorage.getItem('guest_id');

  // נתוני הטופס
  const [formData, setFormData] = useState({
    age: '',
    connection: '',
    location: '',
    bio: '',
    photo_url: ''
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!eventId || !guestId) {
      navigate('/');
      return;
    }
    checkProfile();
  }, [eventId, guestId]);

  // בדיקה אם המשתמש כבר רשום
  const checkProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('dating_profiles')
        .select('*')
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .single();
      
      if (data) {
        setMyProfile(data);
        setFormData(data);
        setView('gallery');
        fetchProfiles();
      } else {
        setView('register');
      }
    } catch (err) {
      setView('register');
    }
  };

  // שליפת כל שאר המשתמשים
  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('dating_profiles')
      .select('*')
      .eq('event_id', eventId)
      .neq('guest_id', guestId)
      .order('created_at', { ascending: false });
    setProfiles(data || []);
  };

  // העלאת תמונה למודול הדייטליין
const handlePhotoUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setUploading(true);
  
  try {
    // יצירת שם קובץ ייחודי (הורדנו את התיקייה dating/ כי הדלי עצמו כבר ייעודי לדייטליין)
    const fileName = `${eventId}/${guestId}_${Date.now()}.jpg`;
    
    // שינוי שם הדלי ל-dating-profiles
    const { data, error } = await supabase.storage
      .from('dating-profiles') 
      .upload(fileName, file);

    if (error) throw error;

    // קבלת הכתובת הציבורית מהדלי החדש
    const { data: { publicUrl } } = supabase.storage
      .from('dating-profiles')
      .getPublicUrl(fileName);

    setFormData(prev => ({ ...prev, photo_url: publicUrl }));
  } catch (err) {
    console.error("Upload error:", err);
    alert("תקלה בהעלאת התמונה. וודאו שהרצתם את ה-SQL של ה-Policies");
  } finally {
    setUploading(false);
  }
};

  // שמירת/עדכון פרופיל
  const handleSaveProfile = async () => {
    try {
      const { error } = await supabase.from('dating_profiles').upsert({
        event_id: eventId,
        guest_id: guestId,
        name: guestName,
        ...formData
      });
      if (error) throw error;
      checkProfile();
    } catch (err) {
      alert("שגיאה בשמירת הנתונים");
    }
  };

  // מחיקת פרופיל (התנתקות)
  const handleLogoutDating = async () => {
    if (!window.confirm("בטוח שרוצים למחוק את הפרופיל ולהתנתק מהדייטליין?")) return;
    await supabase.from('dating_profiles').delete().eq('guest_id', guestId).eq('event_id', eventId);
    setMyProfile(null);
    setFormData({ age: '', connection: '', location: '', bio: '', photo_url: '' });
    setView('register');
    setRegStep(1);
  };

  // --- מערכת הצ'אט ---
  const openChat = async (partner) => {
    setActiveChat(partner);
    setView('chat');
    // שליפת הודעות קודמות
    const { data } = await supabase
      .from('dating_messages')
      .select('*')
      .eq('event_id', eventId)
      .or(`and(sender_id.eq.${guestId},receiver_id.eq.${partner.guest_id}),and(sender_id.eq.${partner.guest_id},receiver_id.eq.${guestId})`)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msg = {
      event_id: eventId,
      sender_id: guestId,
      receiver_id: activeChat.guest_id,
      message: newMessage
    };
    const { error } = await supabase.from('dating_messages').insert([msg]);
    if (!error) {
      setMessages([...messages, { ...msg, created_at: new Date().toISOString() }]);
      setNewMessage('');
    }
  };

  // --- Render Helpers ---

  if (view === 'loading') return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-rose-500" size={48} /></div>;

  // 1. טופס רב שלבי
  if (view === 'register') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6" dir="rtl">
        <header className="mb-10 text-center">
          <button onClick={() => navigate(-1)} className="absolute right-6 top-8 p-2 bg-white/10 rounded-full"><ChevronLeft size={24} /></button>
          <div className="inline-block p-4 bg-rose-500/20 rounded-full mb-4"><Heart className="text-rose-500 fill-current" size={32} /></div>
          <h1 className="text-3xl font-black">היי {guestName}!</h1>
          <p className="text-white/50">בואו נבנה לכם כרטיס ביקור לאירוע</p>
        </header>

        <div className="max-w-md mx-auto bg-white/5 border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-xl">
          {regStep === 1 && (
            <div className="space-y-6 animate-in slide-in-from-left">
              <div>
                <label className="text-xs font-bold text-rose-400 block mb-2 uppercase tracking-widest">גיל</label>
                <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 text-lg font-bold" placeholder="למשל: 24" />
              </div>
              <div>
                <label className="text-xs font-bold text-rose-400 block mb-2 uppercase tracking-widest">איך אני קשור לאירוע?</label>
                <input type="text" value={formData.connection} onChange={e => setFormData({...formData, connection: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500" placeholder="חבר מהצבא? בת דודה?" />
              </div>
              <button onClick={() => setRegStep(2)} className="w-full bg-rose-500 py-4 rounded-2xl font-black text-xl shadow-lg">הבא</button>
            </div>
          )}

          {regStep === 2 && (
            <div className="space-y-6 animate-in slide-in-from-left">
              <div>
                <label className="text-xs font-bold text-rose-400 block mb-2 uppercase tracking-widest">איפה אפשר למצוא אותי?</label>
                <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500" placeholder="בשולחן 12? ברחבה?" />
              </div>
              <div>
                <label className="text-xs font-bold text-rose-400 block mb-2 uppercase tracking-widest">קצת עלי (ביו)</label>
                <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 h-24" placeholder="משהו קצר שיעשה חשק להכיר..." />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setRegStep(1)} className="flex-1 bg-white/10 py-4 rounded-2xl font-bold">חזור</button>
                <button onClick={() => setRegStep(3)} className="flex-[2] bg-rose-500 py-4 rounded-2xl font-black">שלב אחרון</button>
              </div>
            </div>
          )}

          {regStep === 3 && (
            <div className="space-y-6 animate-in slide-in-from-left text-center">
              <label className="relative cursor-pointer group inline-block">
                <div className="w-44 h-44 rounded-full bg-white/5 border-4 border-dashed border-rose-500/30 flex items-center justify-center overflow-hidden">
                  {formData.photo_url ? <img src={formData.photo_url} className="w-full h-full object-cover" /> : <Camera size={48} className="text-white/20" />}
                  {uploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
                </div>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
              <p className="text-sm text-white/40 italic">תמונה עוזרת לאנשים למצוא אתכם (אופציונלי)</p>
              <button onClick={handleSaveProfile} className="w-full bg-rose-500 py-5 rounded-2xl font-black text-xl shadow-xl shadow-rose-500/20">סיימתי, בואו נחגוג!</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. גלריית משתמשים
  if (view === 'gallery') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 pb-24" dir="rtl">
        <header className="flex justify-between items-center mb-8 max-w-md mx-auto">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full"><ChevronLeft size={22} /></button>
          <div className="text-center">
            <h1 className="text-2xl font-black flex items-center gap-2">Daitline <Heart size={20} className="fill-rose-500 text-rose-500 animate-pulse" /></h1>
          </div>
          <button onClick={() => setView('register')} className="p-2 bg-white/10 rounded-full"><Edit3 size={22} /></button>
        </header>

        <div className="max-w-md mx-auto space-y-4">
          {profiles.length === 0 ? (
            <div className="text-center py-20 opacity-40">
              <Sparkles size={48} className="mx-auto mb-4" />
              <p>אתם הראשונים פה! חכו שכולם יירשמו...</p>
            </div>
          ) : (
            profiles.map(p => (
              <div key={p.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-5 flex gap-4 items-center group relative overflow-hidden">
                <div className="w-24 h-24 rounded-3xl bg-slate-800 overflow-hidden flex-shrink-0 shadow-xl border border-white/5">
                  {p.photo_url ? <img src={p.photo_url} className="w-full h-full object-cover" /> : <User size={40} className="m-auto mt-6 text-white/10" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-xl truncate">{p.name}, {p.age}</h3>
                  <p className="text-xs text-rose-400 font-bold mb-2">{p.connection}</p>
                  <p className="text-sm text-white/60 line-clamp-2 italic mb-3">"{p.bio}"</p>
                  <div className="flex items-center gap-1 text-[10px] text-white/40 font-bold bg-white/5 w-fit px-3 py-1 rounded-full">
                    <span>📍 {p.location}</span>
                  </div>
                </div>
                <button 
                  onClick={() => openChat(p)}
                  className="bg-rose-500 p-4 rounded-2xl text-white shadow-lg shadow-rose-500/30 hover:scale-110 active:scale-95 transition-all"
                >
                  <Heart size={24} fill="currentColor" />
                </button>
              </div>
            ))
          )}

          <button onClick={handleLogoutDating} className="w-full mt-10 text-rose-500/40 text-sm font-bold flex items-center justify-center gap-2 py-8 hover:text-rose-500 transition-colors">
            <Trash2 size={16} /> התנתקות ומחיקת פרופיל מהדייטליין
          </button>
        </div>
      </div>
    );
  }

  // 3. צ'אט דיסקרטי
  if (view === 'chat') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col" dir="rtl">
        <header className="p-6 bg-white/5 border-b border-white/10 flex items-center gap-4">
          <button onClick={() => setView('gallery')} className="p-2 bg-white/10 rounded-full"><ChevronLeft size={20} /></button>
          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800">
            {activeChat.photo_url ? <img src={activeChat.photo_url} className="w-full h-full object-cover" /> : <User size={24} className="m-auto mt-3 text-white/20" />}
          </div>
          <div>
            <h2 className="font-black">{activeChat.name}</h2>
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">{activeChat.status || 'דיבורים מהאירוע'}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender_id === guestId ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] p-4 rounded-[1.5rem] ${m.sender_id === guestId ? 'bg-rose-500 rounded-tr-none text-white' : 'bg-white/10 rounded-tl-none text-white'}`}>
                <p className="text-sm font-medium">{m.message}</p>
                <span className="text-[8px] opacity-40 mt-1 block">{new Date(m.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="p-6 bg-slate-900/50 backdrop-blur-md border-t border-white/10 flex gap-2">
          <input 
            type="text" 
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="כתבו משהו נחמד..."
            className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500"
          />
          <button type="submit" className="bg-rose-500 p-4 rounded-2xl text-white shadow-lg"><Send size={24} /></button>
        </form>
      </div>
    );
  }

  return null;
};

export default Dating;