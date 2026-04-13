import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getLuminance } from '../lib/colors';
import { compressImage, isAllowedImageType } from '../lib/imageUtils';
import { useToast } from '../components/Toast';
import { Heart, Camera, Loader2, User, MessageCircle, Sparkles, Send, ChevronLeft, MessageSquare, ShieldAlert, MapPin, Users } from 'lucide-react';
import gsap from 'gsap';

const PROFILES_PAGE = 20;
const MESSAGES_LIMIT = 50;

const Dating = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [eventData, setEventData] = useState(null);
  const [view, setView] = useState('loading');
  const [regStep, setRegStep] = useState(1);

  const [profiles, setProfiles] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [chatHistory, setChatHistory] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});

  const [blockedUsers] = useState(() => JSON.parse(localStorage.getItem('blocked_users') || '[]'));

  const guestName = localStorage.getItem('guest_name');
  const guestId = localStorage.getItem('guest_id');

  const formRef = useRef(null);
  const chatBoxRef = useRef(null);

  const [formData, setFormData] = useState({
    age: '', gender: 'זכר', seeking: 'נקבה', connection: '', location: '', bio: '', photo_url: ''
  });
  const [uploading, setUploading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Initial load
  useEffect(() => {
    if (!eventId || !guestId) return navigate('/');
    let isMounted = true;
    const init = async () => {
      try {
        const { data: event } = await supabase
          .from('events')
          .select('id, name, design_config')
          .eq('id', eventId)
          .single();
        if (!isMounted) return;
        setEventData(event);

        const { data: profile } = await supabase
          .from('dating_profiles')
          .select('id, guest_id, name, age, gender, seeking, connection, location, bio, photo_url')
          .eq('event_id', eventId)
          .eq('guest_id', guestId)
          .single();

        if (!isMounted) return;
        if (profile) {
          setMyProfile(profile);
          setFormData(profile);
          setView('gallery');
          await loadGalleryData(profile, isMounted);
        } else {
          setView('register');
        }
      } catch {
        if (isMounted) setView('register');
      }
    };
    init();
    return () => { isMounted = false; };
  }, [eventId, guestId]);

  const loadGalleryData = async (me, isMounted = true) => {
    let query = supabase
      .from('dating_profiles')
      .select('id, guest_id, name, age, gender, seeking, connection, location, bio, photo_url')
      .eq('event_id', eventId)
      .neq('guest_id', guestId)
      .order('created_at', { ascending: false })
      .limit(PROFILES_PAGE);
    if (me.seeking !== 'הכל') query = query.eq('gender', me.seeking);
    const { data: others } = await query;

    const matched = (others || []).filter(
      p => (p.seeking === me.gender || p.seeking === 'הכל') && !blockedUsers.includes(p.guest_id)
    );
    if (isMounted) setProfiles(matched);

    // Load messages — only last 50, newest first, then reverse for display
    const { data: msgs } = await supabase
      .from('dating_messages')
      .select('id, sender_id, receiver_id, message, is_read, created_at')
      .eq('event_id', eventId)
      .or(`sender_id.eq.${guestId},receiver_id.eq.${guestId}`)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_LIMIT);

    if (msgs && isMounted) {
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
      const historyProfiles = (others || []).filter(
        p => historyIds.has(p.guest_id) && !blockedUsers.includes(p.guest_id)
      );
      setChatHistory(historyProfiles);
    }
  };

  // Animations
  useEffect(() => {
    if (view === 'register' && formRef.current) {
      gsap.fromTo(formRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
    }
    if (view === 'gallery') {
      gsap.fromTo('.profile-card', { opacity: 0, y: 40, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.12, ease: 'back.out(1.2)' });
    }
    if (view === 'chatList') {
      gsap.fromTo('.chat-item', { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.05 });
    }
  }, [view, regStep, profiles]);

  // Realtime subscription for active chat
  useEffect(() => {
    if (view !== 'chat' || !activeChat) return;
    const channel = supabase
      .channel(`dating_chat_${eventId}_${guestId}_${activeChat.guest_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dating_messages',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        const m = payload.new;
        const isRelevant =
          (m.sender_id === guestId && m.receiver_id === activeChat.guest_id) ||
          (m.sender_id === activeChat.guest_id && m.receiver_id === guestId);
        if (isRelevant) {
          setMessages(prev => [...prev, m]);
          setTimeout(() => {
            if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
          }, 50);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [view, activeChat, guestId, eventId]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedImageType(file)) {
      showToast('יש להעלות קובץ תמונה בלבד', 'error');
      return;
    }
    if (uploading) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 800, quality: 0.78 });
      const fileName = `${eventId}/${guestId}_${Date.now()}.jpg`;
      await supabase.storage.from('dating-profiles').upload(fileName, compressed, {
        contentType: 'image/jpeg', upsert: true
      });
      const { data: { publicUrl } } = supabase.storage.from('dating-profiles').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, photo_url: publicUrl }));
    } catch {
      showToast('תקלה בהעלאת התמונה, נסה שוב', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (isSavingProfile) return;
    setIsSavingProfile(true);
    try {
      const { error } = await supabase.from('dating_profiles').upsert({
        event_id: eventId,
        guest_id: guestId,
        name: guestName,
        ...formData,
      });
      if (error) throw error;
      // Reload profile
      const { data: profile } = await supabase
        .from('dating_profiles')
        .select('id, guest_id, name, age, gender, seeking, connection, location, bio, photo_url')
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .single();
      setMyProfile(profile);
      setView('gallery');
      await loadGalleryData(profile);
    } catch {
      showToast('שגיאה בשמירת הנתונים, נסה שוב', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleReportAndBlock = async (partnerId, partnerName) => {
    const confirmed = window.confirm(
      `האם לחסום את ${partnerName} ולדווח עליו/עליה? לא תוכלו לראות אחד את השני יותר.`
    );
    if (!confirmed) return;

    const newBlocked = [...blockedUsers, partnerId];
    localStorage.setItem('blocked_users', JSON.stringify(newBlocked));

    try {
      await supabase.from('reports').insert([{
        event_id: eventId,
        reported_item_id: partnerId,
        item_type: 'dating_profile',
        reporter_id: guestId,
      }]);
    } catch (e) { console.error(e); }

    showToast('המשתמש נחסם והועבר לבדיקה', 'success');
    setView('chatList');
    if (myProfile) await loadGalleryData(myProfile);
  };

  const openChat = async (partner) => {
    setActiveChat(partner);
    setView('chat');
    setMessages([]);

    if (unreadCounts[partner.guest_id]) {
      await supabase
        .from('dating_messages')
        .update({ is_read: true })
        .eq('sender_id', partner.guest_id)
        .eq('receiver_id', guestId)
        .eq('event_id', eventId);
      setUnreadCounts(prev => ({ ...prev, [partner.guest_id]: 0 }));
    }

    // Load latest 50 messages, display oldest first
    const { data } = await supabase
      .from('dating_messages')
      .select('id, sender_id, receiver_id, message, is_read, created_at')
      .eq('event_id', eventId)
      .or(
        `and(sender_id.eq.${guestId},receiver_id.eq.${partner.guest_id}),and(sender_id.eq.${partner.guest_id},receiver_id.eq.${guestId})`
      )
      .order('created_at', { ascending: false })
      .limit(MESSAGES_LIMIT);

    const ordered = (data || []).reverse();
    setMessages(ordered);
    setTimeout(() => {
      if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }, 100);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;
    setIsSending(true);
    const text = newMessage.trim();
    setNewMessage('');
    try {
      const { error } = await supabase.from('dating_messages').insert([{
        event_id: eventId,
        sender_id: guestId,
        receiver_id: activeChat.guest_id,
        message: text,
        is_read: false,
      }]);
      if (error) {
        showToast('שגיאה בשליחה, נסה שוב', 'error');
        setNewMessage(text);
      }
    } finally {
      setIsSending(false);
    }
  };

  // ---- Render guards ----
  if (view === 'loading' || !eventData) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center">
        <Loader2 className="animate-spin text-rose-400" size={48} />
      </div>
    );
  }

  const primaryColor = eventData.design_config?.colors?.primary || '#f43f5e';
  const bgColor = eventData.design_config?.colors?.background || '#f8fafc';
  const primaryTextColor = getLuminance(primaryColor) > 150 ? '#1e293b' : '#ffffff';

  // ---- Registration ----
  if (view === 'register') {
    return (
      <div className="min-h-screen flex flex-col font-sans transition-colors duration-1000 pb-10" style={{ backgroundColor: bgColor }} dir="rtl">
        <div className="rounded-b-[3rem] pt-12 pb-24 px-6 relative z-10 shadow-lg text-center" style={{ backgroundColor: primaryColor }}>
          <button
            onClick={() => navigate(-1)}
            className="absolute right-6 top-10 p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
            style={{ color: primaryTextColor }}
          >
            <ChevronLeft size={24} />
          </button>
          <div className="inline-flex items-center justify-center p-4 bg-white/20 rounded-[1.2rem] mb-4 border border-white/20">
            <Heart style={{ fill: primaryTextColor, color: primaryTextColor }} size={32} />
          </div>
          <h1 className="text-3xl font-black mb-1" style={{ color: primaryTextColor }}>היי {guestName}!</h1>
          <p className="font-medium opacity-70 text-sm" style={{ color: primaryTextColor }}>ספר/י לנו קצת על עצמך</p>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: s === regStep ? 24 : 8, backgroundColor: s <= regStep ? 'white' : 'rgba(255,255,255,0.3)' }}
              />
            ))}
          </div>
        </div>

        <div ref={formRef} className="px-5 -mt-12 relative z-20 w-full max-w-md mx-auto">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100">
            {regStep === 1 && (
              <div className="space-y-5">
                <h2 className="text-xl font-black text-slate-800 mb-4">פרטים בסיסיים</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold mb-1.5 block" style={{ color: primaryColor }}>גיל</label>
                    <input
                      type="number" value={formData.age}
                      onChange={e => setFormData({ ...formData, age: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all"
                      placeholder="24"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1.5 block" style={{ color: primaryColor }}>אני</label>
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800"
                    >
                      <option>זכר</option><option>נקבה</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: primaryColor }}>ומחפש/ת...</label>
                  <select
                    value={formData.seeking}
                    onChange={e => setFormData({ ...formData, seeking: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800"
                  >
                    <option>נקבה</option><option>זכר</option><option>הכל</option>
                  </select>
                </div>
                <button
                  onClick={() => setRegStep(2)}
                  disabled={!formData.age}
                  className="w-full py-4 rounded-[1.2rem] font-black mt-4 hover:opacity-90 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: primaryColor, color: primaryTextColor }}
                >
                  המשך
                </button>
              </div>
            )}

            {regStep === 2 && (
              <div className="space-y-5">
                <h2 className="text-xl font-black text-slate-800 mb-4">ספר/י עוד קצת</h2>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: primaryColor }}>הקשר לבעלי השמחה</label>
                  <input
                    type="text" value={formData.connection}
                    onChange={e => setFormData({ ...formData, connection: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all"
                    placeholder="חבר מהצבא, בן דוד..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: primaryColor }}>מיקום באירוע</label>
                  <input
                    type="text" value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all"
                    placeholder="ליד הבר / שולחן 10"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: primaryColor }}>משפט מחץ (Bio)</label>
                  <textarea
                    value={formData.bio}
                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all h-20 resize-none"
                    placeholder="משהו מעניין עליכם..."
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setRegStep(1)}
                    className="bg-slate-100 text-slate-600 px-6 py-4 rounded-[1.2rem] font-bold hover:bg-slate-200 transition-colors"
                  >
                    חזור
                  </button>
                  <button
                    onClick={() => setRegStep(3)}
                    className="flex-1 py-4 rounded-[1.2rem] font-black shadow-lg hover:opacity-90 transition-all active:scale-[0.98]"
                    style={{ backgroundColor: primaryColor, color: primaryTextColor }}
                  >
                    המשך
                  </button>
                </div>
              </div>
            )}

            {regStep === 3 && (
              <div className="space-y-6 text-center">
                <h2 className="text-xl font-black text-slate-800 mb-2">תמונה מנצחת</h2>
                <p className="text-slate-400 text-sm">תמונה טובה מגדילה משמעותית את הסיכויים!</p>
                <label className="relative cursor-pointer inline-block">
                  <div
                    className="w-40 h-40 rounded-[2rem] bg-slate-50 border-4 border-dashed flex items-center justify-center overflow-hidden shadow-inner mx-auto"
                    style={{ borderColor: `${primaryColor}50` }}
                  >
                    {formData.photo_url
                      ? <img src={formData.photo_url} className="w-full h-full object-cover" alt="profile" />
                      : <Camera size={40} className="text-slate-300" />
                    }
                    {uploading && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="animate-spin" style={{ color: primaryColor }} />
                      </div>
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
                <div className="flex flex-col gap-3 mt-4">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="w-full py-5 rounded-[1.5rem] font-black text-xl shadow-xl hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-60"
                    style={{ backgroundColor: primaryColor, color: primaryTextColor }}
                  >
                    {isSavingProfile ? <Loader2 className="animate-spin mx-auto" size={24} /> : 'סיימתי, בואו נתחיל!'}
                  </button>
                  <button
                    onClick={() => setRegStep(2)}
                    className="text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
                  >
                    חזור
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Gallery / Chat List ----
  if (view === 'gallery' || view === 'chatList') {
    const hasUnread = Object.values(unreadCounts).some(c => c > 0);
    return (
      <div className="min-h-screen flex flex-col font-sans transition-colors duration-1000 pb-10" style={{ backgroundColor: bgColor }} dir="rtl">
        <div className="rounded-b-[3rem] pt-10 pb-20 px-6 relative z-10 shadow-lg" style={{ backgroundColor: primaryColor }}>
          <div className="flex justify-between items-center mb-5">
            <button
              onClick={() => navigate(-1)}
              className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
              style={{ color: primaryTextColor }}
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-xl font-black flex items-center gap-2" style={{ color: primaryTextColor }}>
              Daitline <Heart size={18} style={{ fill: primaryTextColor, color: primaryTextColor }} />
            </h1>
            <button
              onClick={() => { setRegStep(1); setView('register'); }}
              className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
              style={{ color: primaryTextColor }}
              title="ערוך פרופיל"
            >
              <User size={20} />
            </button>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-white/20 p-1.5 rounded-2xl border border-white/20 max-w-sm mx-auto">
            <button
              onClick={() => setView('gallery')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${view === 'gallery' ? 'bg-white shadow-md text-slate-900' : 'text-white hover:bg-white/10'}`}
            >
              התאמות
            </button>
            <button
              onClick={() => setView('chatList')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all relative ${view === 'chatList' ? 'bg-white shadow-md text-slate-900' : 'text-white hover:bg-white/10'}`}
            >
              הודעות
              {hasUnread && (
                <span className="absolute top-2 left-4 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Gallery tab — Tinder-style horizontal scroll cards */}
        {view === 'gallery' && (
          <div className="flex-1 overflow-x-auto flex gap-4 px-5 -mt-8 relative z-20 pb-12 snap-x snap-mandatory pt-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {profiles.length === 0 ? (
              <div className="w-full flex flex-col items-center justify-center mt-16 gap-4">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Users size={44} className="text-slate-200" />
                </div>
                <p className="font-bold text-slate-400 text-center text-sm px-8">
                  אין כרגע התאמות.<br />בדקו שוב מאוחר יותר!
                </p>
              </div>
            ) : (
              profiles.map(p => (
                <div
                  key={p.id}
                  className="profile-card snap-center shrink-0 w-[82vw] max-w-[340px] rounded-[2.5rem] overflow-hidden relative flex flex-col shadow-[0_10px_40px_rgb(0,0,0,0.15)]"
                  style={{ height: '65vh', maxHeight: 600 }}
                >
                  {/* Background photo */}
                  <div className="absolute inset-0 bg-slate-200">
                    {p.photo_url
                      ? <img src={p.photo_url} className="w-full h-full object-cover" alt={p.name} />
                      : <User size={80} className="absolute inset-0 m-auto text-slate-300" />
                    }
                  </div>

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                  {/* Report button */}
                  <button
                    onClick={() => handleReportAndBlock(p.guest_id, p.name)}
                    className="absolute top-4 left-4 bg-black/30 hover:bg-black/50 text-white/70 hover:text-white p-2 rounded-full backdrop-blur-sm transition-colors z-10"
                    title="חסום ודווח"
                  >
                    <ShieldAlert size={17} />
                  </button>

                  {/* Info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <h3 className="font-black text-3xl text-white leading-tight">{p.name}, {p.age}</h3>
                        <p className="text-sm font-bold mt-0.5" style={{ color: primaryColor }}>{p.connection}</p>
                      </div>
                      <button
                        onClick={() => openChat(p)}
                        className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-transform"
                        style={{ backgroundColor: primaryColor, color: primaryTextColor }}
                      >
                        <MessageCircle size={22} />
                      </button>
                    </div>

                    {p.bio && (
                      <p className="text-white/80 text-sm font-medium line-clamp-2 mb-3">"{p.bio}"</p>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      {p.location && (
                        <span className="bg-white/90 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                          <MapPin size={11} /> {p.location}
                        </span>
                      )}
                      <span className="bg-white/90 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full">
                        {p.seeking === 'הכל' ? 'פתוח/ה לכל' : `מחפש/ת ${p.seeking}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Chat List tab */}
        {view === 'chatList' && (
          <div className="flex-1 px-5 -mt-8 relative z-20 space-y-3 max-w-md mx-auto w-full pt-2">
            {chatHistory.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                <MessageSquare size={48} className="mx-auto mb-4 text-slate-200" />
                <p className="font-bold text-slate-400 text-sm">אין עדיין שיחות פעילות.</p>
                <p className="text-slate-300 text-xs mt-1">שלחו הודעה למישהו מהגלריה!</p>
              </div>
            ) : (
              chatHistory.map(p => (
                <div
                  key={p.id}
                  onClick={() => openChat(p)}
                  className="chat-item bg-white border border-slate-100 shadow-sm rounded-[1.5rem] p-4 flex items-center gap-4 cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 relative shrink-0 border-2 border-slate-100">
                    {p.photo_url
                      ? <img src={p.photo_url} className="w-full h-full object-cover" alt={p.name} />
                      : <User size={24} className="absolute inset-0 m-auto text-slate-300" />
                    }
                    {unreadCounts[p.guest_id] > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-800 truncate">{p.name}, {p.age}</h3>
                    <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                      {unreadCounts[p.guest_id] > 0
                        ? <span className="text-rose-500 font-bold">{unreadCounts[p.guest_id]} הודעות חדשות</span>
                        : 'לחץ להמשך השיחה'
                      }
                    </p>
                  </div>
                  <ChevronLeft size={16} className="text-slate-300 shrink-0" />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // ---- Chat View ----
  if (view === 'chat') {
    return (
      <div className="min-h-screen flex flex-col h-[100dvh] font-sans" style={{ backgroundColor: bgColor }} dir="rtl">
        <header
          className="p-4 rounded-b-[2rem] shadow-sm flex items-center gap-3 shrink-0 z-10"
          style={{ backgroundColor: primaryColor, color: primaryTextColor }}
        >
          <button
            onClick={() => { setView('chatList'); if (myProfile) loadGalleryData(myProfile); }}
            className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors shrink-0"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="w-11 h-11 rounded-full overflow-hidden bg-black/15 border border-white/20 shrink-0">
            {activeChat.photo_url
              ? <img src={activeChat.photo_url} className="w-full h-full object-cover" alt={activeChat.name} />
              : <User size={20} className="m-auto mt-2.5 opacity-50" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-base leading-tight truncate">{activeChat.name}</h2>
            {activeChat.location && (
              <span className="text-[11px] font-bold opacity-70">📍 {activeChat.location}</span>
            )}
          </div>
          <button
            onClick={() => handleReportAndBlock(activeChat.guest_id, activeChat.name)}
            className="text-xs font-bold bg-black/15 hover:bg-black/25 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 shrink-0"
            style={{ color: primaryTextColor }}
          >
            <ShieldAlert size={13} /> חסום
          </button>
        </header>

        {/* Messages */}
        <div
          ref={chatBoxRef}
          id="chat-box"
          className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
        >
          {messages.length === 0 && (
            <div className="text-center py-10">
              <Sparkles size={32} className="mx-auto mb-3 text-slate-200" />
              <p className="text-slate-400 text-sm font-medium">התחלה של שיחה חדשה!<br />שלחו הודעה ראשונה.</p>
            </div>
          )}
          {messages.map((m, i) => {
            const isMine = m.sender_id === guestId;
            return (
              <div key={m.id || i} className={`flex ${isMine ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-1`}>
                <div
                  className={`max-w-[78%] px-4 py-3 rounded-[1.5rem] shadow-sm ${
                    isMine
                      ? 'rounded-tr-md'
                      : 'bg-white border border-slate-100 rounded-tl-md text-slate-800'
                  }`}
                  style={isMine ? { backgroundColor: primaryColor, color: primaryTextColor } : {}}
                >
                  <p className="text-sm font-medium leading-relaxed">{m.message}</p>
                  <span className="text-[10px] opacity-50 mt-1 block" dir="ltr">
                    {new Date(m.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <form
          onSubmit={sendMessage}
          className="p-4 bg-white border-t border-slate-100 flex gap-3 shrink-0 pb-6"
        >
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="כתבו הודעה..."
            className="flex-1 bg-slate-50 border border-slate-200 p-4 rounded-full outline-none focus:ring-2 focus:ring-slate-300 text-slate-800 font-medium text-sm"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="w-13 h-13 min-w-[52px] min-h-[52px] rounded-full shadow-lg flex items-center justify-center disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
            style={{ backgroundColor: primaryColor, color: primaryTextColor }}
          >
            {isSending
              ? <Loader2 size={18} className="animate-spin" />
              : <Send size={18} className="rtl:rotate-180 -ml-0.5" />
            }
          </button>
        </form>
      </div>
    );
  }

  return null;
};

export default Dating;
