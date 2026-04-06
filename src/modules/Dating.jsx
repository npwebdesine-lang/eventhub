import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Heart, Camera, Loader2, User, MessageCircle, Sparkles, Send, ChevronLeft, MessageSquare, ShieldAlert } from 'lucide-react';
import gsap from 'gsap';

const getLuminance = (hex) => {
  if (!hex) return 0;
  let color = hex.replace('#', '');
  if (color.length === 3) color = color.split('').map(c => c + c).join('');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
};

const Dating = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const navigate = useNavigate();

  const [eventData, setEventData] = useState(null);
  const [view, setView] = useState('loading'); 
  const [regStep, setRegStep] = useState(1);
  
  const [profiles, setProfiles] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [chatHistory, setChatHistory] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  
  // מנגנון שמירת חסומים מקומי כדי להעלים אותם מיד מהפיד
  const [blockedUsers, setBlockedUsers] = useState(() => JSON.parse(localStorage.getItem('blocked_users') || '[]'));

  const guestName = localStorage.getItem('guest_name');
  const guestId = localStorage.getItem('guest_id');

  const formRef = useRef(null);
  const galleryRef = useRef(null);

  const [formData, setFormData] = useState({ age: '', gender: 'זכר', seeking: 'נקבה', connection: '', location: '', bio: '', photo_url: '' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!eventId || !guestId) return navigate('/');
    checkProfile();
  }, [eventId, guestId]);

  useEffect(() => {
    if (view === 'register' && formRef.current) gsap.fromTo(formRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
    if (view === 'gallery' && galleryRef.current) gsap.fromTo('.profile-card', { opacity: 0, y: 40, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.1, ease: 'back.out(1.2)' });
    if (view === 'chatList') gsap.fromTo(".chat-item", { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.05 });
  }, [view, regStep, profiles]);

  const checkProfile = async () => {
    try {
      const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
      setEventData(event);

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
    let query = supabase.from('dating_profiles').select('*').eq('event_id', eventId).neq('guest_id', guestId);
    if (me.seeking !== 'הכל') query = query.eq('gender', me.seeking);
    const { data: others } = await query.order('created_at', { ascending: false });
    
    // סינון משתמשים חסומים מהפיד
    const matchedProfiles = (others || []).filter(p => (p.seeking === me.gender || p.seeking === 'הכל') && !blockedUsers.includes(p.guest_id));
    setProfiles(matchedProfiles);

    const { data: msgs } = await supabase.from('dating_messages').select('*').eq('event_id', eventId).or(`sender_id.eq.${guestId},receiver_id.eq.${guestId}`);
    
    if (msgs) {
      const historyIds = new Set();
      const unreads = {};
      msgs.forEach(m => {
        const otherId = m.sender_id === guestId ? m.receiver_id : m.sender_id;
        historyIds.add(otherId);
        if (m.receiver_id === guestId && !m.is_read) unreads[m.sender_id] = (unreads[m.sender_id] || 0) + 1;
      });
      setUnreadCounts(unreads);
      // סינון משתמשים חסומים מרשימת השיחות
      const historyProfiles = (others || []).filter(p => historyIds.has(p.guest_id) && !blockedUsers.includes(p.guest_id));
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
    } catch (err) { alert("תקלה בהעלאת התמונה"); } finally { setUploading(false); }
  };

  const handleSaveProfile = async () => {
    try {
      const { error } = await supabase.from('dating_profiles').upsert({ event_id: eventId, guest_id: guestId, name: guestName, ...formData });
      if (error) throw error;
      checkProfile();
    } catch (err) { alert("שגיאה בשמירת הנתונים"); }
  };

  // פעולת החסימה והדיווח המשולבת
  const handleReportAndBlock = async (partnerId, partnerName) => {
    if (!window.confirm(`האם לחסום את ${partnerName} ולדווח עליו/עליה למנהל האירוע? לא תוכלו לראות או לשלוח להם הודעות יותר.`)) return;

    // 1. שמירת החסימה מקומית
    const newBlocked = [...blockedUsers, partnerId];
    setBlockedUsers(newBlocked);
    localStorage.setItem('blocked_users', JSON.stringify(newBlocked));

    // 2. שליחת דיווח אמיתי לטבלת ה-Reports באדמין
    try {
      await supabase.from('reports').insert([{
        event_id: eventId,
        reported_item_id: partnerId,
        item_type: 'dating_profile',
        reporter_id: guestId
      }]);
    } catch(e) { console.error(e); }

    alert("המשתמש נחסם והועבר לבדיקת מנהלי האירוע.");
    setView('chatList');
    checkProfile(); // מרענן את הרשימות כדי להעלים את החסום
  };

  const openChat = async (partner) => {
    setActiveChat(partner);
    setView('chat');
    
    if (unreadCounts[partner.guest_id]) {
      await supabase.from('dating_messages').update({ is_read: true }).eq('sender_id', partner.guest_id).eq('receiver_id', guestId).eq('event_id', eventId);
      setUnreadCounts(prev => ({ ...prev, [partner.guest_id]: 0 }));
    }

    const { data } = await supabase.from('dating_messages').select('*').eq('event_id', eventId).or(`and(sender_id.eq.${guestId},receiver_id.eq.${partner.guest_id}),and(sender_id.eq.${partner.guest_id},receiver_id.eq.${guestId})`).order('created_at', { ascending: true });
    setMessages(data || []);
    setTimeout(() => { const chatBox = document.getElementById('chat-box'); if (chatBox) chatBox.scrollTop = chatBox.scrollHeight; }, 100);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msg = { event_id: eventId, sender_id: guestId, receiver_id: activeChat.guest_id, message: newMessage, is_read: false };
    const { error } = await supabase.from('dating_messages').insert([msg]);
    if (!error) {
      setMessages([...messages, { ...msg, created_at: new Date().toISOString() }]);
      setNewMessage('');
      setTimeout(() => { const chatBox = document.getElementById('chat-box'); if (chatBox) chatBox.scrollTop = chatBox.scrollHeight; }, 50);
    }
  };

  if (view === 'loading' || !eventData) return <div className="min-h-screen bg-slate-900 flex justify-center items-center"><Loader2 className="animate-spin text-rose-500" size={48} /></div>;

  const primaryColor = eventData.design_config?.colors?.primary || '#f43f5e';
  const bgColor = eventData.design_config?.colors?.background || '#f8fafc';
  const isLightPrimary = getLuminance(primaryColor) > 150;
  const primaryTextColor = isLightPrimary ? '#1e293b' : '#ffffff';

  if (view === 'register') {
    return (
      <div className="min-h-screen flex flex-col font-sans transition-colors duration-1000 pb-10" style={{ backgroundColor: bgColor }} dir="rtl">
        <div className="rounded-b-[3rem] pt-12 pb-24 px-6 relative z-10 shadow-lg text-center" style={{ backgroundColor: primaryColor }}>
          <button onClick={() => navigate(-1)} className="absolute right-6 top-10 p-2 bg-black/10 hover:bg-black/20 rounded-full backdrop-blur-md transition-colors" style={{ color: primaryTextColor }}><ChevronLeft size={24} /></button>
          <div className="inline-flex items-center justify-center p-4 bg-white/20 rounded-[1.2rem] mb-4 shadow-inner border border-white/20"><Heart style={{ fill: primaryTextColor, color: primaryTextColor }} size={32} /></div>
          <h1 className="text-3xl font-black mb-1" style={{ color: primaryTextColor }}>היי {guestName}!</h1>
          <p className="font-medium opacity-80" style={{ color: primaryTextColor }}>רגע לפני שמתחילים להכיר...</p>
        </div>
        <div ref={formRef} className="px-6 -mt-12 relative z-20 w-full max-w-md mx-auto flex-1">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100">
            {regStep === 1 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold mb-4 text-slate-800">פרטים בסיסיים</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold mb-1 block opacity-70" style={{ color: primaryColor }}>גיל</label>
                    <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': primaryColor }} placeholder="24" />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block opacity-70" style={{ color: primaryColor }}>אני</label>
                    <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': primaryColor }}><option>זכר</option><option>נקבה</option></select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block opacity-70" style={{ color: primaryColor }}>ומחפש/ת פה...</label>
                  <select value={formData.seeking} onChange={e => setFormData({...formData, seeking: e.target.value})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': primaryColor }}><option>נקבה</option><option>זכר</option><option>הכל</option></select>
                </div>
                <button onClick={() => setRegStep(2)} className="w-full py-4 rounded-[1.2rem] font-black mt-4 hover:scale-[1.02] transition-transform shadow-lg" style={{ backgroundColor: primaryColor, color: primaryTextColor }}>המשך</button>
              </div>
            )}
            {regStep === 2 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold mb-4 text-slate-800">איפה מוצאים אותך?</h2>
                <div>
                  <label className="text-xs font-bold mb-1 block opacity-70" style={{ color: primaryColor }}>הקשר לבעלי השמחה</label>
                  <input type="text" value={formData.connection} onChange={e => setFormData({...formData, connection: e.target.value})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': primaryColor }} placeholder="חבר מהצבא..." />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block opacity-70" style={{ color: primaryColor }}>מיקום באירוע</label>
                  <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': primaryColor }} placeholder="על הבר / שולחן 10" />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block opacity-70" style={{ color: primaryColor }}>משפט מחץ (Bio)</label>
                  <textarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all h-20 resize-none" style={{ '--tw-ring-color': primaryColor }} placeholder="משהו מעניין עליכם..." />
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setRegStep(1)} className="bg-slate-100 text-slate-600 px-6 rounded-[1.2rem] font-bold hover:bg-slate-200 transition-colors">חזור</button>
                  <button onClick={() => setRegStep(3)} className="flex-1 py-4 rounded-[1.2rem] font-black shadow-lg hover:scale-[1.02] transition-transform" style={{ backgroundColor: primaryColor, color: primaryTextColor }}>המשך</button>
                </div>
              </div>
            )}
            {regStep === 3 && (
              <div className="space-y-6 text-center">
                <h2 className="text-xl font-bold mb-2 text-slate-800">תמונה מנצחת</h2>
                <label className="relative cursor-pointer inline-block group">
                  <div className="w-40 h-40 rounded-[2rem] bg-slate-50 border-4 border-dashed flex items-center justify-center overflow-hidden transition-all shadow-inner" style={{ borderColor: `${primaryColor}50` }}>
                    {formData.photo_url ? <img src={formData.photo_url} className="w-full h-full object-cover" /> : <Camera size={40} className="text-slate-300" />}
                    {uploading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin" style={{ color: primaryColor }} /></div>}
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
                <button onClick={handleSaveProfile} className="w-full py-5 rounded-[1.5rem] font-black text-xl shadow-xl hover:scale-[1.02] transition-transform" style={{ backgroundColor: primaryColor, color: primaryTextColor }}>סיימתי, בואו נתחיל!</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'gallery' || view === 'chatList') {
    return (
      <div className="min-h-screen flex flex-col font-sans transition-colors duration-1000 pb-10" style={{ backgroundColor: bgColor }} dir="rtl">
        <div className="rounded-b-[3rem] pt-10 pb-20 px-6 relative z-10 shadow-lg transition-colors duration-1000" style={{ backgroundColor: primaryColor }}>
          <div className="flex justify-between items-center mb-6">
            <button onClick={() => navigate(-1)} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors backdrop-blur-md" style={{ color: primaryTextColor }}><ChevronLeft size={20} /></button>
            <h1 className="text-xl font-black flex items-center gap-2" style={{ color: primaryTextColor }}>Daitline <Heart size={20} style={{ fill: primaryTextColor, color: primaryTextColor }} /></h1>
            <button onClick={() => setView('register')} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors backdrop-blur-md" style={{ color: primaryTextColor }}><User size={20} /></button>
          </div>
          <div className="flex bg-white/20 p-1.5 rounded-2xl shadow-inner backdrop-blur-md border border-white/20 max-w-sm mx-auto">
            <button onClick={() => setView('gallery')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${view === 'gallery' ? 'bg-white shadow-md text-slate-900' : 'text-white hover:bg-white/10'}`}>התאמות</button>
            <button onClick={() => setView('chatList')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all relative ${view === 'chatList' ? 'bg-white shadow-md text-slate-900' : 'text-white hover:bg-white/10'}`}>הודעות {Object.values(unreadCounts).some(c => c > 0) && <span className="absolute top-2 left-4 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}</button>
          </div>
        </div>

        {view === 'gallery' && (
          <div ref={galleryRef} className="flex-1 overflow-x-auto flex gap-4 px-6 -mt-8 relative z-20 pb-12 snap-x snap-mandatory hide-scrollbar pt-2">
            {profiles.length === 0 ? (
              <div className="w-full flex flex-col items-center justify-center opacity-60 mt-10">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm"><Sparkles size={40} className="text-slate-300" /></div>
                <p className="font-bold text-slate-500">אין כרגע התאמות באזור...</p>
              </div>
            ) : (
              profiles.map(p => (
                <div key={p.id} className="profile-card snap-center shrink-0 w-[85vw] max-w-sm bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden relative flex flex-col h-[65vh] max-h-[600px] shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                  <div className="flex-1 bg-slate-100 relative">
                    {p.photo_url ? <img src={p.photo_url} className="w-full h-full object-cover" /> : <User size={80} className="absolute inset-0 m-auto text-slate-300" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent"></div>
                    {/* כפתור דיווח ישירות על הפרופיל */}
                    <button onClick={() => handleReportAndBlock(p.guest_id, p.name)} className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white/70 hover:text-white p-2 rounded-full backdrop-blur-sm transition-colors" title="חסום ודווח">
                      <ShieldAlert size={18} />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-2">
                    <div className="flex justify-between items-end mb-1">
                      <div><h3 className="font-black text-3xl text-white drop-shadow-md">{p.name}, {p.age}</h3><p className="font-bold drop-shadow-md" style={{ color: primaryColor }}>{p.connection}</p></div>
                      <button onClick={() => openChat(p)} className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform" style={{ backgroundColor: primaryColor, color: primaryTextColor }}><MessageCircle size={24} fill="currentColor" /></button>
                    </div>
                    <p className="text-white/90 line-clamp-2 font-medium mb-3 text-sm">"{p.bio}"</p>
                    <span className="text-xs text-slate-800 bg-white/90 w-fit px-3 py-1.5 rounded-full font-bold shadow-sm">📍 {p.location}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'chatList' && (
          <div className="flex-1 px-6 -mt-8 relative z-20 space-y-3 max-w-md mx-auto w-full">
            {chatHistory.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <MessageSquare size={48} className="mx-auto mb-4 text-slate-200" /><p className="font-bold text-slate-500">אין עדיין שיחות פעילות.</p>
              </div>
            ) : (
              chatHistory.map(p => (
                <div key={p.id} onClick={() => openChat(p)} className="chat-item bg-white border border-slate-100 shadow-sm rounded-[1.5rem] p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 relative shrink-0">
                    {p.photo_url ? <img src={p.photo_url} className="w-full h-full object-cover" /> : <User size={24} className="absolute inset-0 m-auto text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-lg text-slate-800 truncate flex items-center gap-2">{p.name}{unreadCounts[p.guest_id] > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{unreadCounts[p.guest_id]} חדשות</span>}</h3>
                    <p className="text-sm text-slate-400 font-medium truncate">לחץ להמשך השיחה...</p>
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
      <div className="min-h-screen flex flex-col h-[100dvh] font-sans" style={{ backgroundColor: bgColor }} dir="rtl">
        <header className="p-4 rounded-b-[2rem] shadow-sm flex items-center gap-4 shrink-0 z-10 transition-colors" style={{ backgroundColor: primaryColor, color: primaryTextColor }}>
          <button onClick={() => { setView('chatList'); fetchProfilesAndMessages(myProfile); }} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors"><ChevronLeft size={24} /></button>
          <div className="w-12 h-12 rounded-full overflow-hidden bg-black/10 border border-white/20">
            {activeChat.photo_url ? <img src={activeChat.photo_url} className="w-full h-full object-cover" /> : <User size={24} className="m-auto mt-3 opacity-50" />}
          </div>
          <div>
            <h2 className="font-black text-lg leading-tight">{activeChat.name}</h2>
            <span className="text-[11px] font-bold opacity-80">📍 {activeChat.location}</span>
          </div>
          
          {/* כפתור חסימה משולב */}
          <div className="mr-auto">
            <button 
              onClick={() => handleReportAndBlock(activeChat.guest_id, activeChat.name)}
              className="text-xs font-bold bg-black/10 hover:bg-black/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1" style={{ color: primaryTextColor }}>
              <ShieldAlert size={14} /> חסום
            </button>
          </div>
        </header>

        <div id="chat-box" className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender_id === guestId ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2`}>
              <div className={`max-w-[75%] p-4 rounded-[1.5rem] shadow-sm ${m.sender_id === guestId ? 'rounded-tr-sm' : 'bg-white border border-slate-100 rounded-tl-sm text-slate-800'}`} style={m.sender_id === guestId ? { backgroundColor: primaryColor, color: primaryTextColor } : {}}>
                <p className="text-[15px] font-medium leading-snug">{m.message}</p>
                <span className="text-[10px] opacity-60 mt-2 block text-left" dir="ltr">{new Date(m.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-3 shrink-0 shadow-[0_-10px_40px_rgb(0,0,0,0.03)] pb-6">
          <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="כתבו הודעה..." className="flex-1 bg-slate-50 border border-slate-200 p-4 rounded-full outline-none focus:ring-2 focus:ring-slate-300 text-slate-800 font-medium" />
          <button type="submit" disabled={!newMessage.trim()} className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center disabled:opacity-50 hover:scale-105 transition-transform" style={{ backgroundColor: primaryColor, color: primaryTextColor }}>
            <Send size={20} className="rtl:rotate-180 -ml-1" />
          </button>
        </form>
      </div>
    );
  }

  return null;
};

export default Dating;