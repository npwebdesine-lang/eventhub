import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Heart, Camera, Loader2, User, MessageCircle, Sparkles, 
  Send, ChevronLeft, ChevronRight, MessageSquare
} from 'lucide-react';
import gsap from 'gsap';

const Dating = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const navigate = useNavigate();

  // מצבי תצוגה
  const [view, setView] = useState('loading'); // loading, register, gallery, chatList, chat
  const [regStep, setRegStep] = useState(1);
  
  const [profiles, setProfiles] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  // שיחות פעילות והתראות
  const [chatHistory, setChatHistory] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});

  const guestName = localStorage.getItem('guest_name');
  const guestId = localStorage.getItem('guest_id');

  // רפרנסים לאנימציות GSAP
  const formRef = useRef(null);
  const galleryRef = useRef(null);

  const [formData, setFormData] = useState({
    age: '',
    gender: 'זכר',
    seeking: 'נקבה',
    connection: '',
    location: '',
    bio: '',
    photo_url: ''
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!eventId || !guestId) return navigate('/');
    checkProfile();
  }, [eventId, guestId]);

  // אנימציות מעברים עם GSAP
  useEffect(() => {
    if (view === 'register' && formRef.current) {
      gsap.fromTo(formRef.current, { opacity: 0, x: 50 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' });
    }
    if (view === 'gallery' && galleryRef.current) {
      gsap.fromTo('.profile-card', 
        { opacity: 0, y: 50, scale: 0.9 }, 
        { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.1, ease: 'back.out(1.5)' }
      );
    }
  }, [view, regStep]);

  const checkProfile = async () => {
    try {
      const { data } = await supabase.from('dating_profiles').select('*').eq('event_id', eventId).eq('guest_id', guestId).single();
      if (data) {
        setMyProfile(data);
        setFormData(data);
        setView('gallery');
        fetchProfilesAndMessages(data);
      } else {
        setView('register');
      }
    } catch (err) { setView('register'); }
  };

  const fetchProfilesAndMessages = async (me) => {
    // 1. שליפת פרופילים עם סינון לפי מין והעדפות
    let query = supabase.from('dating_profiles').select('*').eq('event_id', eventId).neq('guest_id', guestId);
    
    // לוגיקת התאמה (Match)
    if (me.seeking !== 'הכל') query = query.eq('gender', me.seeking);
    
    const { data: others } = await query.order('created_at', { ascending: false });
    
    // סינון נוסף: נציג רק אנשים שמחפשים את המין שלי (או 'הכל')
    const matchedProfiles = (others || []).filter(p => p.seeking === me.gender || p.seeking === 'הכל');
    setProfiles(matchedProfiles);

    // 2. שליפת היסטוריית הודעות והתראות
    const { data: msgs } = await supabase.from('dating_messages').select('*').eq('event_id', eventId)
      .or(`sender_id.eq.${guestId},receiver_id.eq.${guestId}`);
    
    if (msgs) {
      const historyIds = new Set();
      const unreads = {};
      msgs.forEach(m => {
        const otherId = m.sender_id === guestId ? m.receiver_id : m.sender_id;
        historyIds.add(otherId);
        if (m.receiver_id === guestId && !m.is_read) {
          unreads[m.sender_id] = (unreads[m.sender_id] || 0) + 1;
        }
      });
      setUnreadCounts(unreads);
      
      // יצירת רשימת אנשי קשר לשיחות
      const historyProfiles = (others || []).filter(p => historyIds.has(p.guest_id));
      setChatHistory(historyProfiles);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileName = `${eventId}/${guestId}_${Date.now()}.jpg`;
      await supabase.storage.from('dating-profiles').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('dating-profiles').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, photo_url: publicUrl }));
    } catch (err) { alert("תקלה בהעלאת התמונה"); } 
    finally { setUploading(false); }
  };

  const handleSaveProfile = async () => {
    try {
      const { error } = await supabase.from('dating_profiles').upsert({
        event_id: eventId, guest_id: guestId, name: guestName, ...formData
      });
      if (error) throw error;
      checkProfile();
    } catch (err) { alert("שגיאה בשמירת הנתונים"); }
  };

  const openChat = async (partner) => {
    setActiveChat(partner);
    setView('chat');
    
    // סימון הודעות כנקראו
    if (unreadCounts[partner.guest_id]) {
      await supabase.from('dating_messages').update({ is_read: true })
        .eq('sender_id', partner.guest_id).eq('receiver_id', guestId).eq('event_id', eventId);
      setUnreadCounts(prev => ({ ...prev, [partner.guest_id]: 0 }));
    }

    // שליפת היסטוריה ספציפית
    const { data } = await supabase.from('dating_messages').select('*').eq('event_id', eventId)
      .or(`and(sender_id.eq.${guestId},receiver_id.eq.${partner.guest_id}),and(sender_id.eq.${partner.guest_id},receiver_id.eq.${guestId})`)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    
    // גלילה למטה
    setTimeout(() => {
      const chatBox = document.getElementById('chat-box');
      if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }, 100);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msg = { event_id: eventId, sender_id: guestId, receiver_id: activeChat.guest_id, message: newMessage, is_read: false };
    const { error } = await supabase.from('dating_messages').insert([msg]);
    if (!error) {
      setMessages([...messages, { ...msg, created_at: new Date().toISOString() }]);
      setNewMessage('');
      setTimeout(() => {
        const chatBox = document.getElementById('chat-box');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      }, 50);
    }
  };

  // --- תצוגות ---
  if (view === 'loading') return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-rose-500" size={48} /></div>;

  if (view === 'register') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center overflow-hidden" dir="rtl">
        <header className="mb-8 text-center w-full max-w-md relative">
          <button onClick={() => navigate(-1)} className="absolute right-0 top-0 p-2 bg-white/10 rounded-full"><ChevronLeft size={24} /></button>
          <div className="inline-block p-4 bg-rose-500/20 rounded-full mb-4"><Heart className="text-rose-500 fill-current" size={32} /></div>
          <h1 className="text-3xl font-black">היי {guestName}!</h1>
        </header>

        <div ref={formRef} className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-xl shadow-2xl">
          {regStep === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold mb-4">קצת פרטים יבשים...</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-rose-400 font-bold mb-1 block">גיל</label>
                  <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-rose-500" placeholder="24" />
                </div>
                <div>
                  <label className="text-xs text-rose-400 font-bold mb-1 block">אני</label>
                  <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-rose-500 text-white [&>option]:bg-slate-900">
                    <option>זכר</option><option>נקבה</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-rose-400 font-bold mb-1 block">ומחפש/ת פה...</label>
                <select value={formData.seeking} onChange={e => setFormData({...formData, seeking: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-rose-500 text-white [&>option]:bg-slate-900">
                  <option>נקבה</option><option>זכר</option><option>הכל</option>
                </select>
              </div>
              <button onClick={() => setRegStep(2)} className="w-full bg-rose-500 py-4 rounded-2xl font-black mt-4 hover:scale-105 transition-transform">הבא</button>
            </div>
          )}

          {regStep === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold mb-4">איפה מוצאים אותך?</h2>
              <div>
                <label className="text-xs text-rose-400 font-bold mb-1 block">הקשר לבעלי השמחה</label>
                <input type="text" value={formData.connection} onChange={e => setFormData({...formData, connection: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none" placeholder="חבר מהצבא..." />
              </div>
              <div>
                <label className="text-xs text-rose-400 font-bold mb-1 block">מיקום באירוע</label>
                <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none" placeholder="על הבר / רחבה" />
              </div>
              <div>
                <label className="text-xs text-rose-400 font-bold mb-1 block">משפט מחץ (Bio)</label>
                <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none h-20" placeholder="משהו מעניין עליכם..." />
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setRegStep(1)} className="bg-white/10 px-6 rounded-2xl font-bold">חזור</button>
                <button onClick={() => setRegStep(3)} className="flex-1 bg-rose-500 py-4 rounded-2xl font-black">הבא</button>
              </div>
            </div>
          )}

          {regStep === 3 && (
            <div className="space-y-6 text-center">
              <h2 className="text-xl font-bold mb-2">תמונה מנצחת</h2>
              <label className="relative cursor-pointer inline-block group">
                <div className="w-48 h-48 rounded-[2.5rem] bg-white/5 border-4 border-dashed border-rose-500/30 flex items-center justify-center overflow-hidden transition-all group-hover:border-rose-500">
                  {formData.photo_url ? <img src={formData.photo_url} className="w-full h-full object-cover" /> : <Camera size={48} className="text-white/20" />}
                  {uploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
                </div>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
              <button onClick={handleSaveProfile} className="w-full bg-rose-500 py-5 rounded-2xl font-black text-xl shadow-[0_0_30px_rgba(244,63,94,0.3)] hover:scale-105 transition-all">סיימתי, בואו נתחיל!</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'gallery' || view === 'chatList') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col" dir="rtl">
        <header className="p-6 flex justify-between items-center bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full"><ChevronLeft size={22} /></button>
          <h1 className="text-2xl font-black flex items-center gap-2">Daitline <Heart size={20} className="fill-rose-500 text-rose-500" /></h1>
          <button onClick={() => setView('register')} className="p-2 bg-white/10 rounded-full"><User size={22} /></button>
        </header>

        {/* Toggle Nav */}
        <div className="flex px-6 mb-6 gap-2">
          <button onClick={() => setView('gallery')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${view === 'gallery' ? 'bg-rose-500 text-white' : 'bg-white/5 text-white/50'}`}>התאמות</button>
          <button onClick={() => setView('chatList')} className={`flex-1 py-3 rounded-xl font-bold transition-all relative ${view === 'chatList' ? 'bg-rose-500 text-white' : 'bg-white/5 text-white/50'}`}>
            הודעות
            {Object.values(unreadCounts).some(c => c > 0) && <span className="absolute top-2 left-4 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse"></span>}
          </button>
        </div>

        {view === 'gallery' && (
          <div ref={galleryRef} className="flex-1 overflow-x-auto flex gap-6 px-6 pb-12 snap-x snap-mandatory hide-scrollbar">
            {profiles.length === 0 ? (
              <div className="w-full flex flex-col items-center justify-center opacity-40 mt-20">
                <Sparkles size={48} className="mb-4" />
                <p>אין כרגע התאמות שעונות להגדרות שלך...</p>
              </div>
            ) : (
              profiles.map(p => (
                <div key={p.id} className="profile-card snap-center shrink-0 w-[85vw] max-w-sm bg-white/5 rounded-[3rem] border border-white/10 overflow-hidden relative flex flex-col h-[60vh] max-h-[600px] shadow-2xl">
                  <div className="flex-1 bg-slate-800 relative">
                    {p.photo_url ? <img src={p.photo_url} className="w-full h-full object-cover" /> : <User size={80} className="absolute inset-0 m-auto text-white/10" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <div>
                        <h3 className="font-black text-3xl text-white">{p.name}, {p.age}</h3>
                        <p className="text-rose-400 font-bold">{p.connection}</p>
                      </div>
                      <button onClick={() => openChat(p)} className="bg-rose-500 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(244,63,94,0.5)] hover:scale-110 transition-transform">
                        <MessageCircle size={24} fill="currentColor" />
                      </button>
                    </div>
                    <p className="text-white/80 line-clamp-2 italic mb-2">"{p.bio}"</p>
                    <span className="text-xs text-white/50 bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-md">📍 {p.location}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'chatList' && (
          <div className="flex-1 px-6 space-y-3">
            {chatHistory.length === 0 ? (
              <div className="text-center py-20 opacity-40"><MessageSquare size={48} className="mx-auto mb-4" /><p>אין עדיין שיחות פעילות.</p></div>
            ) : (
              chatHistory.map(p => (
                <div key={p.id} onClick={() => openChat(p)} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-white/10 transition-colors">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-800 relative shrink-0">
                    {p.photo_url ? <img src={p.photo_url} className="w-full h-full object-cover" /> : <User size={24} className="absolute inset-0 m-auto text-white/20" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-lg truncate flex items-center gap-2">
                      {p.name}
                      {unreadCounts[p.guest_id] > 0 && <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{unreadCounts[p.guest_id]} חדשות</span>}
                    </h3>
                    <p className="text-sm text-white/50 truncate">לחץ להמשך השיחה...</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  if (view === 'chat') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col h-[100dvh]" dir="rtl">
        <header className="p-4 bg-slate-900 border-b border-white/10 flex items-center gap-4 shrink-0 shadow-md z-10">
          <button onClick={() => { setView('chatList'); fetchProfilesAndMessages(myProfile); }} className="p-2 hover:bg-white/10 rounded-full"><ChevronLeft size={24} /></button>
          <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-800">
            {activeChat.photo_url ? <img src={activeChat.photo_url} className="w-full h-full object-cover" /> : <User size={24} className="m-auto mt-3 text-white/20" />}
          </div>
          <div>
            <h2 className="font-black text-lg leading-tight">{activeChat.name}</h2>
            <span className="text-[11px] text-rose-400 font-bold">📍 {activeChat.location}</span>
          </div>
        </header>

        <div id="chat-box" className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender_id === guestId ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2`}>
              <div className={`max-w-[75%] p-4 rounded-3xl shadow-lg ${m.sender_id === guestId ? 'bg-rose-600 rounded-tr-sm text-white' : 'bg-slate-800 border border-white/10 rounded-tl-sm text-white'}`}>
                <p className="text-[15px] font-medium leading-snug">{m.message}</p>
                <span className="text-[10px] opacity-50 mt-2 block text-left" dir="ltr">{new Date(m.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="p-4 bg-slate-900 border-t border-white/10 flex gap-3 shrink-0">
          <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="כתבו הודעה..." className="flex-1 bg-slate-800 border border-white/10 p-4 rounded-full outline-none focus:ring-2 focus:ring-rose-500 text-white" />
          <button type="submit" disabled={!newMessage.trim()} className="bg-rose-500 p-4 rounded-full text-white shadow-lg disabled:opacity-50 hover:bg-rose-600 transition-colors"><Send size={24} className="rtl:rotate-180" /></button>
        </form>
      </div>
    );
  }

  return null;
};

export default Dating;