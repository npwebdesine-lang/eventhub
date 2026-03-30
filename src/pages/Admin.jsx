import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Settings, Plus, Calendar, LogOut, Loader2, X, 
  Save, Image as ImageIcon, Trash2, DownloadCloud, Share2, Check, Users, QrCode, Heart, ChevronRight, Camera, User, Sparkles, Edit2, Zap, Target, ListPlus, Wine, Briefcase, Music, PartyPopper, Gem, Link, UploadCloud, Car, CheckCircle2, Download, Info
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import AdminQRGenerator from './AdminQRGenerator';

const MISSION_PRESETS = {
  wedding_young: ["שוט טקילה ביחד! תוכיחו בתמונה", "תצטלמו רוקדים על שולחן (או כיסא)", "סלפי עם החתן/כלה", "תעשו פרצוף הכי מכוער שלכם", "סלפי מצחיק בשירותים", "שוט כפול עם מישהו שרוקד כמו משוגע"],
  corporate: ["סלפי עם המנכ\"ל", "תמונה עם מישהו ממחלקת HR", "תעשו הרמת כוסית עם מישהו ממחלקה אחרת", "צלמו מישהו מדבר על עבודה", "סלפי עם מתכנת/ת", "תמונה של שניכם בפוזה של 'עובדי החודש'"],
  //... 
};

// טקסטים להסבר על המודולים
const MODULE_INFO = {
  rsvp: {
    title: 'אישורי הגעה (RSVP)',
    description: 'מערכת קצה-לקצה חכמה המחליפה את הצורך בחברת אישורי הגעה חיצונית. האורחים מקבלים טופס מעוצב שדרכו הם מזינים כמה יגיעו, את שמותיהם והערות למנות (צמחוני/טבעוני). המערכת מסדרת הכל בטבלה שניתן לייצא לאקסל בקליק.'
  },
  photo: {
    title: 'כל אחד צלם',
    description: 'גלריה שיתופית דיגיטלית! במקום שהאורחים יצלמו תמונות וישמרו אצלם בטלפון, הם יכולים להעלות את כל התמונות והסרטונים ישירות לאלבום המשותף של האירוע. בסוף האירוע תוכלו להוריד קובץ ZIP עם כל הזכרונות היפים.'
  },
  seating: {
    title: 'סידור הושבה',
    description: 'הסוף לפקקים בכניסה לאולם מול הדיילות. האורח מזין את שמו ומקבל מיד את מספר השולחן שלו. בנוסף, המערכת מציגה לו אילו אורחים נוספים יושבים איתו בשולחן, כדי להתחיל לשבור את הקרח עוד לפני שהתיישב.'
  },
  dating: {
    title: 'Daitline (דייטליין)',
    description: 'רשת חברתית פנימית ודיסקרטית לאירוע בלבד. מושלם לחתונות עם חבר\'ה צעירים! מאפשר לאורחים רווקים (ופנויים בלבד) לראות פרופילים של אורחים אחרים, לשלוח קריצות ולהתחיל שיחה בקלות.'
  },
  icebreaker: {
    title: 'שובר קרח (IceBreaker)',
    description: 'משחק משימות חברתי שמרים את האווירה! המערכת מגרילה לאורח משימה מצחיקה (למשל "תצטלם עושה שוט עם החתן") ומשדכת לו אורח אחר כדי לבצע אותה. האורחים מעלים הוכחות לקיר תהילה מרכזי.'
  },
  rideshare: {
    title: 'לוח טרמפים',
    description: 'פותרים את כאב הראש הלוגיסטי. לוח חכם שבו אורחים עם מקום פנוי ברכב מפרסמים טרמפ הלוך או חזור, ואורחים שצריכים הסעה יכולים למצוא אותם. המערכת עושה התאמות (Match) חכמות בין נהגים לנוסעים באותו כיוון ומחברת ביניהם ישירות בוואטסאפ.'
  }
};

const Admin = () => {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(null);
  const [uploadingAsset, setUploadingAsset] = useState(false);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  
  const [copiedEventId, setCopiedEventId] = useState(null);
  const [copiedInviteId, setCopiedInviteId] = useState(null);
  
  // הושבה
  const [isSeatingModalOpen, setIsSeatingModalOpen] = useState(false);
  const [seatingText, setSeatingText] = useState('');
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [savedGuestsCount, setSavedGuestsCount] = useState(0);
  const [seatingGuests, setSeatingGuests] = useState([]);
  const [editingGuestId, setEditingGuestId] = useState(null);
  const [editGuestName, setEditGuestName] = useState('');
  const [editGuestTable, setEditGuestTable] = useState('');

  // מודולים אחרים
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isDatingManagerOpen, setIsDatingManagerOpen] = useState(false);
  const [datingProfiles, setDatingProfiles] = useState([]);
  const [datingLoading, setDatingLoading] = useState(false);

  const [isIcebreakerModalOpen, setIsIcebreakerModalOpen] = useState(false);
  const [icebreakerMissions, setIcebreakerMissions] = useState([]);
  const [icebreakerLoading, setIcebreakerLoading] = useState(false);
  const [newMissionText, setNewMissionText] = useState('');
  const [isIcebreakerUserManagerOpen, setIsIcebreakerUserManagerOpen] = useState(false);
  const [icebreakerProfiles, setIcebreakerProfiles] = useState([]);
  const [icebreakerUsersLoading, setIcebreakerUsersLoading] = useState(false);

  // === מודול RSVP (אישורי הגעה) ===
  const [isRsvpManagerOpen, setIsRsvpManagerOpen] = useState(false);
  const [rsvpList, setRsvpList] = useState([]);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [editingRsvpId, setEditingRsvpId] = useState(null);
  const [editRsvpName, setEditRsvpName] = useState('');

  // פופ-אפ הסבר על מודול
  const [infoModal, setInfoModal] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); if (session) fetchEvents(); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); if (session) fetchEvents(); });
    return () => subscription.unsubscribe();
  }, []);

  const fetchEvents = async () => { setDataLoading(true); try { const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false }); if (error) throw error; setEvents(data); } catch (error) { console.error(error); } finally { setDataLoading(false); } };

  const handleLogin = async (e) => { e.preventDefault(); setAuthLoading(true); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) alert("פרטים שגויים"); setAuthLoading(false); };

  const handleManageEvent = (event) => { 
    setSelectedEvent(event); 
    setFormData({ 
      name: event.name, 
      event_date: event.event_date || '', 
      active_modules: { photo: false, seating: false, dating: false, icebreaker: false, rideshare: false, rsvp: false, ...event.active_modules }, 
      design_config: {
        template: event.design_config?.template || 'glass',
        colors: event.design_config?.colors || { primary: '#3b82f6', background: '#020617' },
        invite_template: event.design_config?.invite_template || 'modern',
        invite_image: event.design_config?.invite_image || ''
      } 
    }); 
  };

  const handleCreateNew = () => { 
    setSelectedEvent({ id: null, isNew: true }); 
    setFormData({ 
      name: '', event_date: '', 
      active_modules: { photo: false, seating: false, dating: false, icebreaker: false, rideshare: false, rsvp: false }, 
      design_config: { 
        template: 'glass', 
        colors: { primary: '#3b82f6', background: '#020617' },
        invite_template: 'modern',
        invite_image: ''
      } 
    }); 
  };

  const handleSave = async () => { if (!formData.name) return alert("יש להזין שם אירוע"); setSaving(true); try { if (selectedEvent.id) { await supabase.from('events').update(formData).eq('id', selectedEvent.id); } else { await supabase.from('events').insert([formData]); } setSelectedEvent(null); fetchEvents(); } catch (error) { alert(error.message); } finally { setSaving(false); } };
  const handleDelete = async () => { if (!window.confirm(`האם אתה בטוח שברצונך למחוק את האירוע "${formData.name}"?`)) return; setSaving(true); try { await supabase.from('events').delete().eq('id', selectedEvent.id); setSelectedEvent(null); fetchEvents(); } catch (error) { alert("שגיאה במחיקה"); } finally { setSaving(false); } };

  const copyEventLink = async (eventId) => { const url = `${window.location.origin}/event/${eventId}`; try { await navigator.clipboard.writeText(url); setCopiedEventId(eventId); setTimeout(() => setCopiedEventId(null), 2000); } catch (err) { alert("הקישור הוא: " + url); } };
  const copyInviteLink = async (eventId) => { const url = `${window.location.origin}/invite/${eventId}`; try { await navigator.clipboard.writeText(url); setCopiedInviteId(eventId); setTimeout(() => setCopiedInviteId(null), 2000); } catch (err) { alert("הקישור הוא: " + url); } };

  const handleInviteImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAsset(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedEvent.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('event-assets').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('event-assets').getPublicUrl(fileName);
      setFormData({ ...formData, design_config: { ...formData.design_config, invite_image: publicUrl } });
    } catch (error) { alert("שגיאה בהעלאת התמונה"); console.error(error); } finally { setUploadingAsset(false); }
  };

  const openGallery = async () => { setIsGalleryOpen(true); const { data } = await supabase.from('photos').select('*').eq('event_id', selectedEvent.id).order('created_at', { ascending: false }); setGalleryPhotos(data || []); };
  const downloadAlbum = async () => { setDownloadingZip(true); try { const zip = new JSZip(); const imgFolder = zip.folder(`Album_${formData.name}`); await Promise.all(galleryPhotos.map(async (p, i) => { const res = await fetch(p.image_url); const blob = await res.blob(); imgFolder.file(`${p.guest_name}_${i+1}.jpg`, blob); })); const content = await zip.generateAsync({ type: 'blob' }); saveAs(content, `${formData.name}_Photos.zip`); } catch (error) { console.error(error); } finally { setDownloadingZip(false); } };
  const handleDeletePhoto = async (photo) => { if (!window.confirm(`למחוק את התמונה של ${photo.guest_name}?`)) return; try { await supabase.from('photos').delete().eq('id', photo.id); setGalleryPhotos(prev => prev.filter(p => p.id !== photo.id)); } catch (error) { alert(error.message); } };
  
  // הושבה
  const openSeatingManager = async () => { setSeatingText(''); setIsSeatingModalOpen(true); setSeatingLoading(true); try { const { data, count, error } = await supabase.from('seating').select('*', { count: 'exact' }).eq('event_id', selectedEvent.id).order('guest_name', { ascending: true }); if (error) throw error; setSeatingGuests(data || []); setSavedGuestsCount(count || 0); } catch (error) { console.error(error); } finally { setSeatingLoading(false); } };
  const handleSaveSeating = async () => { if (!seatingText.trim()) return alert("אנא הדבק רשימה"); setSeatingLoading(true); try { const parsedGuests = seatingText.split('\n').map(line => { const match = line.trim().match(/^(.*?)[-,\s]*(\d+)\s*$/); return match ? { event_id: selectedEvent.id, guest_name: match[1].trim(), table_number: match[2].trim() } : null; }).filter(Boolean); if (parsedGuests.length === 0) throw new Error("לא זיהינו שמות בפורמט תקין"); await supabase.from('seating').insert(parsedGuests); openSeatingManager(); alert(`נוספו בהצלחה ${parsedGuests.length} מוזמנים.`); } catch (error) { alert(error.message); } finally { setSeatingLoading(false); } };
  const handleDeleteGuest = async (guestId, name) => { if (!window.confirm(`למחוק את ${name}?`)) return; try { await supabase.from('seating').delete().eq('id', guestId); setSeatingGuests(prev => prev.filter(g => g.id !== guestId)); setSavedGuestsCount(prev => prev - 1); } catch (error) { alert("שגיאה במחיקת האורח"); } };
  const startEditingGuest = (guest) => { setEditingGuestId(guest.id); setEditGuestName(guest.guest_name); setEditGuestTable(guest.table_number); };
  const saveGuestEdit = async (guestId) => { if (!editGuestName.trim() || !editGuestTable.trim()) return alert("שדות חסרים"); try { const { error } = await supabase.from('seating').update({ guest_name: editGuestName, table_number: editGuestTable }).eq('id', guestId); if (error) throw error; setSeatingGuests(prev => prev.map(g => g.id === guestId ? { ...g, guest_name: editGuestName, table_number: editGuestTable } : g)); setEditingGuestId(null); } catch (error) { alert("שגיאה בעדכון"); } };
  
  const openDatingManager = async () => { setIsDatingManagerOpen(true); setDatingLoading(true); try { const { data } = await supabase.from('dating_profiles').select('*').eq('event_id', selectedEvent.id).order('created_at', { ascending: false }); setDatingProfiles(data || []); } catch (error) { console.error(error); } finally { setDatingLoading(false); } };
  const handleDeleteDatingProfile = async (profileId, name) => { if (!window.confirm(`למחוק את הפרופיל של ${name}?`)) return; try { await supabase.from('dating_profiles').delete().eq('id', profileId); setDatingProfiles(prev => prev.filter(p => p.id !== profileId)); } catch (error) { alert("תקלה במחיקה"); } };
  const openIcebreakerManager = async () => { setIsIcebreakerModalOpen(true); setIcebreakerLoading(true); try { const { data } = await supabase.from('icebreaker_missions').select('*').eq('event_id', selectedEvent.id).order('created_at', { ascending: false }); setIcebreakerMissions(data || []); } catch (error) { console.error(error); } finally { setIcebreakerLoading(false); } };
  const handleAddMission = async () => { if (!newMissionText.trim()) return; setIcebreakerLoading(true); try { const { data, error } = await supabase.from('icebreaker_missions').insert([{ event_id: selectedEvent.id, content: newMissionText.trim() }]).select(); if (error) throw error; setIcebreakerMissions([data[0], ...icebreakerMissions]); setNewMissionText(''); } catch (error) { alert("שגיאה בהוספת משימה"); } finally { setIcebreakerLoading(false); } };
  const handleDeleteMission = async (missionId) => { if (!window.confirm("בטוח שרוצים למחוק משימה זו?")) return; try { await supabase.from('icebreaker_missions').delete().eq('id', missionId); setIcebreakerMissions(prev => prev.filter(m => m.id !== missionId)); } catch (error) { alert("תקלה במחיקה"); } };
  const loadPreset = async (presetType) => { const missionsToAdd = MISSION_PRESETS[presetType]; if (!missionsToAdd) return; if (!window.confirm(`להוסיף משימות מוכנות לבנק?`)) return; setIcebreakerLoading(true); try { const inserts = missionsToAdd.map(content => ({ event_id: selectedEvent.id, content })); const { data, error } = await supabase.from('icebreaker_missions').insert(inserts).select(); if (error) throw error; setIcebreakerMissions([...data, ...icebreakerMissions]); alert("החבילה נטענה!"); } catch (error) { alert("שגיאה בטעינת החבילה"); } finally { setIcebreakerLoading(false); } };
  const openIcebreakerUserManager = async () => { setIsIcebreakerUserManagerOpen(true); setIcebreakerUsersLoading(true); try { const { data } = await supabase.from('icebreaker_profiles').select('*').eq('event_id', selectedEvent.id).order('created_at', { ascending: false }); setIcebreakerProfiles(data || []); } catch (error) { console.error(error); } finally { setIcebreakerUsersLoading(false); } };
  const handleDeleteIcebreakerProfile = async (profileId, name) => { if (!window.confirm(`למחוק את ${name} מהמשחק?`)) return; try { await supabase.from('icebreaker_profiles').delete().eq('id', profileId); setIcebreakerProfiles(prev => prev.filter(p => p.id !== profileId)); } catch (error) { alert("תקלה במחיקה"); } };

  // === פונקציות RSVP ===
  const openRsvpManager = async () => {
    setIsRsvpManagerOpen(true);
    setRsvpLoading(true);
    try {
      const { data, error } = await supabase.from('rsvps').select('*').eq('event_id', selectedEvent.id).order('created_at', { ascending: false });
      if (error) throw error;
      setRsvpList(data || []);
    } catch (error) { console.error(error); } finally { setRsvpLoading(false); }
  };

  const handleDeleteRsvp = async (rsvpId, name) => {
    if (!window.confirm(`למחוק את אישור ההגעה של ${name}?`)) return;
    try {
      await supabase.from('rsvps').delete().eq('id', rsvpId);
      setRsvpList(prev => prev.filter(r => r.id !== rsvpId));
    } catch (error) { alert("שגיאה במחיקה"); }
  };

  const startEditingRsvp = (rsvp) => {
    setEditingRsvpId(rsvp.id);
    setEditRsvpName(rsvp.guest_name);
  };

  const saveRsvpEdit = async (rsvpId) => {
    if (!editRsvpName.trim()) return alert("חובה להזין שם");
    try {
      const { error } = await supabase.from('rsvps').update({ guest_name: editRsvpName }).eq('id', rsvpId);
      if (error) throw error;
      setRsvpList(prev => prev.map(r => r.id === rsvpId ? { ...r, guest_name: editRsvpName } : r));
      setEditingRsvpId(null);
    } catch (error) { alert("שגיאה בעדכון"); }
  };

  const exportRsvpToCSV = () => {
    const sorted = [...rsvpList].sort((a, b) => a.group_id.localeCompare(b.group_id));
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "שם האורח,מי מילא את הטופס,טלפון,תאריך רישום\n";
    
    sorted.forEach(row => {
      const date = new Date(row.created_at).toLocaleDateString('he-IL');
      csvContent += `"${row.guest_name}","${row.submitter_name}","${row.submitter_phone}","${date}"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RSVP_${formData.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;
  if (!session) { return ( <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" dir="rtl"><form onSubmit={handleLogin} className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200"><div className="text-center mb-8"><h1 className="text-3xl font-black text-slate-800">EventHub Admin</h1><p className="text-slate-500 mt-2">ניהול מערכת האירועים שלך</p></div><div className="space-y-4"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="אימייל" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" dir="ltr" /><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="סיסמה" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" dir="ltr" /><button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all">התחבר למערכת</button></div></form></div> ); }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8" dir="rtl">
      {!selectedEvent && (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 gap-6">
            <div><h1 className="text-4xl font-black text-slate-900">לוח בקרה</h1><p className="text-slate-500 font-medium text-lg mt-1">מערכת ה-SaaS שלך לניהול חוויות</p></div>
            <div className="flex gap-4 w-full md:w-auto"><button onClick={handleCreateNew} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-indigo-100"><Plus size={22} /> אירוע חדש</button><button onClick={() => supabase.auth.signOut()} className="bg-slate-100 p-4 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors"><LogOut size={22} /></button></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dataLoading ? <Loader2 className="animate-spin text-indigo-600 mx-auto col-span-full" size={48} /> :
              events.map(event => (
                <div key={event.id} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col group hover:border-indigo-300 hover:shadow-xl transition-all relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-indigo-100 p-4 rounded-2xl text-indigo-600"><Calendar size={28} /></div>
                    <div><h3 className="font-black text-2xl text-slate-800 line-clamp-1">{event.name}</h3><p className="text-slate-500 font-medium">{new Date(event.event_date).toLocaleDateString('he-IL')}</p></div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <button onClick={() => handleManageEvent(event)} className="col-span-2 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2"><Settings size={18} /> ניהול אירוע</button>
                    <button onClick={() => copyEventLink(event.id)} className={`py-2 rounded-xl transition-all border flex justify-center items-center gap-2 text-sm font-bold ${copiedEventId === event.id ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600'}`} title="העתק קישור לאפליקציה">
                      {copiedEventId === event.id ? <Check size={16} /> : <Share2 size={16} />} אפליקציה
                    </button>
                    <button onClick={() => copyInviteLink(event.id)} className={`py-2 rounded-xl transition-all border flex justify-center items-center gap-2 text-sm font-bold ${copiedInviteId === event.id ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'}`} title="העתק קישור לדף ההזמנה">
                      {copiedInviteId === event.id ? <Check size={16} /> : <Link size={16} />} הזמנה
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
          <button onClick={() => setSelectedEvent(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold mb-6 transition-colors"><ChevronRight size={20} /> חזרה לכל האירועים</button>
          
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden mb-8">
            <div className="p-8 md:p-10 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div><h2 className="text-3xl font-black text-slate-900">{selectedEvent.isNew ? 'יצירת אירוע חדש' : `ניהול: ${formData.name}`}</h2><p className="text-slate-500 mt-2">הגדרות כלליות, עיצוב ומודולים</p></div>
              <div className="flex gap-3 w-full md:w-auto">
                {!selectedEvent.isNew && (<button onClick={handleDelete} disabled={saving} className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all border border-rose-100" title="מחק אירוע"><Trash2 size={22} /></button>)}
                <button onClick={handleSave} disabled={saving} className="flex-1 md:flex-none bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex justify-center items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">{saving ? <Loader2 className="animate-spin" /> : <><Save size={22} /> שמור שינויים</>}</button>
              </div>
            </div>

            <div className="p-8 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-1 space-y-6">
                <h3 className="text-xl font-black text-slate-800 border-b pb-4">הגדרות ועיצוב</h3>
                
                <div className="space-y-2"><label className="text-sm font-bold text-slate-700">שם האירוע</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                <div className="space-y-2"><label className="text-sm font-bold text-slate-700">תאריך</label><input type="date" value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                
                {/* --- אזור בחירת הצבעים החדש שמשלב תיבת טקסט יחד עם Color Picker --- */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">צבע מיתוג עיקרי (Primary)</label>
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-slate-200 shrink-0 shadow-sm transition-colors" style={{ backgroundColor: formData.design_config.colors.primary }}>
                        <input 
                          type="color" 
                          value={/^#[0-9A-F]{6}$/i.test(formData.design_config.colors.primary) ? formData.design_config.colors.primary : '#3b82f6'} 
                          onChange={e => setFormData({...formData, design_config: {...formData.design_config, colors: {...formData.design_config.colors, primary: e.target.value}}})} 
                          className="opacity-0 w-full h-full cursor-pointer absolute inset-0" 
                          title="בחר צבע" 
                        />
                      </div>
                      <input 
                        type="text" 
                        value={formData.design_config.colors.primary} 
                        onChange={e => setFormData({...formData, design_config: {...formData.design_config, colors: {...formData.design_config.colors, primary: e.target.value}}})} 
                        placeholder="למשל: #3b82f6 / rgb()" 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-left text-sm" 
                        dir="ltr" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">צבע רקע (Background)</label>
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-slate-200 shrink-0 shadow-sm transition-colors" style={{ backgroundColor: formData.design_config.colors.background }}>
                        <input 
                          type="color" 
                          value={/^#[0-9A-F]{6}$/i.test(formData.design_config.colors.background) ? formData.design_config.colors.background : '#020617'} 
                          onChange={e => setFormData({...formData, design_config: {...formData.design_config, colors: {...formData.design_config.colors, background: e.target.value}}})} 
                          className="opacity-0 w-full h-full cursor-pointer absolute inset-0" 
                          title="בחר צבע" 
                        />
                      </div>
                      <input 
                        type="text" 
                        value={formData.design_config.colors.background} 
                        onChange={e => setFormData({...formData, design_config: {...formData.design_config, colors: {...formData.design_config.colors, background: e.target.value}}})} 
                        placeholder="למשל: #020617 / rgb()" 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-left text-sm" 
                        dir="ltr" 
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">עיצוב ההזמנה הדיגיטלית</label>
                  <select value={formData.design_config.invite_template || 'modern'} onChange={e => setFormData({...formData, design_config: {...formData.design_config, invite_template: e.target.value}})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700">
                    <option value="modern">מודרני / מסיבה (טקסט מוגדל ורקע צבעוני)</option>
                    <option value="elegant">אלגנטי (מתאים לחתונות ובר/בת מצווה)</option>
                    <option value="corporate">משרדי / כנסים (קלאסי ונקי)</option>
                  </select>

                  {(formData.design_config.invite_template === 'elegant' || formData.design_config.invite_template === 'corporate') && (
                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                      <label className="text-sm font-bold text-indigo-800 block mb-2">תמונה / לוגו להזמנה</label>
                      <div className="flex items-center gap-3">
                        <label className="flex-1 cursor-pointer bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-600 font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2">
                          {uploadingAsset ? <Loader2 className="animate-spin" size={18} /> : <><UploadCloud size={18} /> בחר קובץ</>}
                          <input type="file" accept="image/*" onChange={handleInviteImageUpload} disabled={uploadingAsset} className="hidden" />
                        </label>
                      </div>
                      {formData.design_config.invite_image && (
                        <div className="mt-3 relative w-full h-32 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                          <img src={formData.design_config.invite_image} alt="Cover" className="w-full h-full object-contain" />
                          <button onClick={() => setFormData({...formData, design_config: {...formData.design_config, invite_image: ''}})} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md"><X size={16}/></button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {!selectedEvent.isNew && (<button onClick={() => setIsQrModalOpen(true)} className="w-full mt-4 bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"><QrCode size={20} /> הפק שילוט QR לאירוע</button>)}
              </div>

              {/* מודולים */}
              <div className="lg:col-span-2 space-y-8">
                <h3 className="text-xl font-black text-slate-800 border-b pb-4">מודולים ופיצ'רים</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* --- מודול RSVP --- */}
                  <div className={`border-2 rounded-3xl p-6 transition-all md:col-span-2 ${formData.active_modules.rsvp ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 opacity-60 grayscale'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${formData.active_modules.rsvp ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'}`}><CheckCircle2 size={24} /></div>
                        <div>
                          <h4 className="font-black text-lg text-slate-800">אישורי הגעה (RSVP)</h4>
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">מערכת קצה לקצה</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={formData.active_modules.rsvp || false} onChange={e => setFormData({...formData, active_modules: {...formData.active_modules, rsvp: e.target.checked}})} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                    </div>
                    {formData.active_modules.rsvp && !selectedEvent.isNew && (
                      <div className="p-4 bg-white rounded-xl border border-blue-100 text-center animate-in fade-in space-y-3">
                        <p className="text-sm text-slate-600 font-medium mb-3">כפתור לאישור הגעה יופיע כעת בדף ההזמנה הדיגיטלית.</p>
                        <button onClick={openRsvpManager} className="w-full py-3 bg-white border border-blue-200 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors flex justify-center items-center gap-2 shadow-sm">
                          <Users size={18} /> ניהול אישורי הגעה
                        </button>
                      </div>
                    )}
                  </div>

                  {/* צילום */}
                  <div className={`border-2 rounded-3xl p-6 transition-all ${formData.active_modules.photo ? 'border-orange-500 bg-orange-50/30' : 'border-slate-100 opacity-60 grayscale'}`}>
                    <div className="flex justify-between items-start mb-6"><div className="flex items-center gap-3"><div className={`p-3 rounded-xl ${formData.active_modules.photo ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Camera size={24} /></div><h4 className="font-black text-lg text-slate-800">כל אחד צלם</h4></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={formData.active_modules.photo} onChange={e => setFormData({...formData, active_modules: {...formData.active_modules, photo: e.target.checked}})} /><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div></label></div>
                    {formData.active_modules.photo && !selectedEvent.isNew && (<div className="space-y-3 animate-in fade-in"><button onClick={openGallery} className="w-full py-3 bg-white border border-orange-200 text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors flex justify-center items-center gap-2"><ImageIcon size={18} /> ניהול תמונות (הורדת ZIP)</button><button onClick={() => window.open(`/album/${selectedEvent.id}`, '_blank')} className="w-full py-3 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-black rounded-xl hover:from-orange-500 hover:to-orange-600 transition-all flex justify-center items-center gap-2 shadow-lg shadow-orange-500/30"><Sparkles size={18} /> צפייה באלבום הדיגיטלי</button></div>)}
                  </div>

                  {/* הושבה */}
                  <div className={`border-2 rounded-3xl p-6 transition-all ${formData.active_modules.seating ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 opacity-60 grayscale'}`}>
                    <div className="flex justify-between items-start mb-6"><div className="flex items-center gap-3"><div className={`p-3 rounded-xl ${formData.active_modules.seating ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Users size={24} /></div><h4 className="font-black text-lg text-slate-800">סידור הושבה</h4></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={formData.active_modules.seating} onChange={e => setFormData({...formData, active_modules: {...formData.active_modules, seating: e.target.checked}})} /><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div></label></div>
                    {formData.active_modules.seating && !selectedEvent.isNew && (<div className="space-y-3 animate-in fade-in"><button onClick={openSeatingManager} className="w-full py-3 bg-white border border-emerald-200 text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-colors flex justify-center items-center gap-2"><Settings size={18} /> ניהול רשימת הושבה</button></div>)}
                  </div>

                  {/* דייטליין */}
                  <div className={`border-2 rounded-3xl p-6 transition-all md:col-span-2 ${formData.active_modules.dating ? 'border-rose-500 bg-rose-50/30' : 'border-slate-100 opacity-60 grayscale'}`}>
                    <div className="flex justify-between items-start mb-6"><div className="flex items-center gap-3"><div className={`p-3 rounded-xl ${formData.active_modules.dating ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Heart size={24} /></div><div><h4 className="font-black text-lg text-slate-800">Daitline (דייטליין)</h4></div></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={formData.active_modules.dating} onChange={e => setFormData({...formData, active_modules: {...formData.active_modules, dating: e.target.checked}})} /><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div></label></div>
                    {formData.active_modules.dating && !selectedEvent.isNew && (<div className="animate-in fade-in"><button onClick={openDatingManager} className="w-full py-3 bg-white border border-rose-200 text-rose-600 font-bold rounded-xl hover:bg-rose-50 transition-colors flex justify-center items-center gap-2 shadow-sm"><Users size={18} /> ניהול משתמשי דייטליין</button></div>)}
                  </div>

                  {/* שובר קרח */}
                  <div className={`border-2 rounded-3xl p-6 transition-all md:col-span-2 ${formData.active_modules.icebreaker ? 'border-cyan-500 bg-cyan-50/30' : 'border-slate-100 opacity-60 grayscale'}`}>
                    <div className="flex justify-between items-start mb-6"><div className="flex items-center gap-3"><div className={`p-3 rounded-xl ${formData.active_modules.icebreaker ? 'bg-cyan-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Zap size={24} /></div><div><h4 className="font-black text-lg text-slate-800">שובר קרח (IceBreaker)</h4></div></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={formData.active_modules.icebreaker || false} onChange={e => setFormData({...formData, active_modules: {...formData.active_modules, icebreaker: e.target.checked}})} /><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div></label></div>
                    {formData.active_modules.icebreaker && !selectedEvent.isNew && (<div className="flex flex-col md:flex-row gap-3 animate-in fade-in"><button onClick={openIcebreakerManager} className="flex-1 py-3 bg-white border border-cyan-200 text-cyan-600 font-bold rounded-xl hover:bg-cyan-50 transition-colors flex justify-center items-center gap-2 shadow-sm"><Target size={18} /> בנק המשימות</button><button onClick={openIcebreakerUserManager} className="flex-1 py-3 bg-white border border-cyan-200 text-cyan-600 font-bold rounded-xl hover:bg-cyan-50 transition-colors flex justify-center items-center gap-2 shadow-sm"><Users size={18} /> משתמשים</button></div>)}
                  </div>

                  {/* טרמפים */}
                  <div className={`border-2 rounded-3xl p-6 transition-all ${formData.active_modules.rideshare ? 'border-amber-500 bg-amber-50/30' : 'border-slate-100 opacity-60 grayscale'}`}>
                    <div className="flex justify-between items-start mb-6"><div className="flex items-center gap-3"><div className={`p-3 rounded-xl ${formData.active_modules.rideshare ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Car size={24} /></div><div><h4 className="font-black text-lg text-slate-800">לוח טרמפים</h4></div></div><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={formData.active_modules.rideshare || false} onChange={e => setFormData({...formData, active_modules: {...formData.active_modules, rideshare: e.target.checked}})} /><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div></label></div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === פופ-אפ מנהל RSVP === */}
      {isRsvpManagerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]">
            
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-blue-50/50 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800">אישורי הגעה (RSVP)</h2>
                <p className="text-blue-600 font-bold mt-1">סה"כ אישרו הגעה: {rsvpList.length} אורחים</p>
              </div>
              <div className="flex gap-3">
                <button onClick={exportRsvpToCSV} disabled={rsvpList.length === 0} className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50">
                  <Download size={18} /> ייצוא לאקסל
                </button>
                <button onClick={() => setIsRsvpManagerOpen(false)} className="p-2 hover:bg-blue-100 text-blue-600 rounded-full transition-colors"><X size={24} /></button>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 p-6 md:p-8 overflow-y-auto">
              {rsvpLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={48} /></div>
              ) : rsvpList.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <CheckCircle2 size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-lg">עדיין לא התקבלו אישורי הגעה.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rsvpList.map(guest => (
                    <div key={guest.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm hover:border-blue-200 transition-colors gap-4">
                      
                      <div className="flex-1 w-full">
                        {editingRsvpId === guest.id ? (
                          <div className="flex items-center gap-2">
                            <input type="text" value={editRsvpName} onChange={(e) => setEditRsvpName(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        ) : (
                          <div>
                            <h4 className="font-bold text-slate-800 text-lg">{guest.guest_name}</h4>
                            <p className="text-xs text-slate-500 font-medium mt-1">נרשם ע"י: {guest.submitter_name} | {guest.submitter_phone}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 shrink-0 bg-slate-50 p-1.5 rounded-xl w-full md:w-auto">
                        {editingRsvpId === guest.id ? (
                          <>
                            <button onClick={() => saveRsvpEdit(guest.id)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="שמור"><Check size={18} /></button>
                            <button onClick={() => setEditingRsvpId(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors" title="ביטול"><X size={18} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEditingRsvp(guest)} className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 font-bold text-sm" title="ערוך"><Edit2 size={16} /> ערוך</button>
                            <div className="w-px h-6 bg-slate-200 mx-1"></div>
                            <button onClick={() => handleDeleteRsvp(guest.id, guest.guest_name)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1 font-bold text-sm" title="מחק"><Trash2 size={16} /> מחק</button>
                          </>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- שאר הפופאפים ... --- */}
      {isGalleryOpen && ( <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex flex-col animate-in fade-in duration-300"><div className="p-6 md:p-8 flex justify-between items-center bg-white"><div><h2 className="text-3xl font-black text-slate-800">גלריית האירוע</h2></div><button onClick={() => setIsGalleryOpen(false)} className="bg-slate-100 text-slate-600 p-3 rounded-xl"><X size={24} /></button></div><div className="flex-1 overflow-y-auto p-6 md:p-10"><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">{galleryPhotos.map(photo => (<div key={photo.id} className="relative group rounded-2xl overflow-hidden aspect-square"><img src={photo.image_url} className="w-full h-full object-cover" /><button onClick={() => handleDeletePhoto(photo)} className="absolute top-2 right-2 bg-rose-500 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button></div>))}</div></div></div> )}
      {isSeatingModalOpen && ( <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]"><div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]"><div className="p-8 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50 shrink-0"><div><h2 className="text-2xl font-black text-slate-800">ניהול הושבה</h2><p className="text-emerald-600 font-bold mt-1">סה"כ במערכת: {savedGuestsCount} אורחים</p></div><button onClick={() => setIsSeatingModalOpen(false)} className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-full transition-colors"><X size={28} /></button></div><div className="flex flex-col md:flex-row flex-1 overflow-hidden"><div className="w-full md:w-1/2 p-8 border-l border-slate-100 flex flex-col bg-white shrink-0"><textarea value={seatingText} onChange={e => setSeatingText(e.target.value)} placeholder="ישראל ישראלי 12&#10;שרה כהן - 5" className="w-full flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[200px]" /><button onClick={handleSaveSeating} className="w-full mt-4 bg-emerald-500 text-white font-black py-4 rounded-2xl hover:bg-emerald-600">פענח והוסף לרשימה</button></div><div className="w-full md:w-1/2 bg-slate-50 p-8 overflow-y-auto"><div className="space-y-3">{seatingGuests.map(guest => (<div key={guest.id} className="bg-white p-3 rounded-2xl flex justify-between"><div className="flex items-center gap-3"><div className="bg-emerald-100 text-emerald-700 w-10 h-10 flex items-center justify-center rounded-xl">{guest.table_number}</div><span className="font-bold text-slate-700">{guest.guest_name}</span></div><button onClick={() => handleDeleteGuest(guest.id, guest.guest_name)} className="text-rose-500"><Trash2 size={16} /></button></div>))}</div></div></div></div></div> )}
      {isQrModalOpen && selectedEvent && ( <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]"><div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"><div className="p-6 flex justify-between items-center bg-slate-50"><h2 className="text-2xl font-black text-slate-800">QR מעוצב</h2><button onClick={() => setIsQrModalOpen(false)}><X size={24}/></button></div><div className="p-6"><AdminQRGenerator key={selectedEvent.id} defaultUrl={`${window.location.origin}/event/${selectedEvent.id}`} defaultColor={formData.design_config?.colors?.primary || '#3b82f6'} /></div></div></div> )}
      {isDatingManagerOpen && ( <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex flex-col animate-in fade-in duration-300"><div className="p-6 md:p-8 flex justify-between items-center bg-white shadow-sm z-10"><div><h2 className="text-3xl font-black text-slate-800">משתמשי דייטליין</h2></div><button onClick={() => setIsDatingManagerOpen(false)} className="bg-slate-100 p-3 rounded-xl"><X size={24} /></button></div><div className="flex-1 overflow-y-auto p-6 md:p-10"><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{datingProfiles.map(profile => (<div key={profile.id} className="bg-white rounded-[2rem] p-5 shadow-xl flex items-center gap-4 border border-slate-100"><h3 className="font-black">{profile.name}</h3><button onClick={() => handleDeleteDatingProfile(profile.id, profile.name)} className="text-rose-500"><Trash2 size={14}/></button></div>))}</div></div></div> )}
      {isIcebreakerUserManagerOpen && ( <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex flex-col animate-in fade-in duration-300"><div className="p-6 md:p-8 flex justify-between items-center bg-white shadow-sm z-10"><div><h2 className="text-3xl font-black text-slate-800">משתמשי IceBreaker</h2></div><button onClick={() => setIsIcebreakerUserManagerOpen(false)} className="bg-slate-100 p-3 rounded-xl"><X size={24} /></button></div><div className="flex-1 overflow-y-auto p-6 md:p-10"><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{icebreakerProfiles.map(profile => (<div key={profile.id} className="bg-white rounded-[2rem] p-5 shadow-xl flex items-center gap-4"><h3 className="font-black">{profile.name}</h3><button onClick={() => handleDeleteIcebreakerProfile(profile.id, profile.name)} className="text-rose-500"><Trash2 size={14}/></button></div>))}</div></div></div> )}
      {isIcebreakerModalOpen && ( <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex flex-col animate-in fade-in duration-300"><div className="p-6 md:p-8 flex justify-between items-center bg-white shadow-sm z-10"><div><h2 className="text-3xl font-black text-slate-800">בנק המשימות</h2></div><button onClick={() => setIsIcebreakerModalOpen(false)} className="bg-slate-100 p-3 rounded-xl"><X size={24} /></button></div><div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-4xl mx-auto w-full"><div className="bg-white p-6 rounded-3xl mb-6 flex"><input type="text" value={newMissionText} onChange={(e) => setNewMissionText(e.target.value)} placeholder="הוסף משימה..." className="w-full flex-1 p-4 bg-slate-50 rounded-xl" /><button onClick={handleAddMission} className="bg-cyan-500 text-white font-black px-6 py-4 rounded-xl">הוסף</button></div><div className="space-y-3">{icebreakerMissions.map(mission => (<div key={mission.id} className="bg-white p-5 rounded-2xl flex justify-between"><p className="font-medium">{mission.content}</p><button onClick={() => handleDeleteMission(mission.id)} className="text-rose-500"><Trash2 size={20}/></button></div>))}</div></div></div> )}
    </div>
  );
};

export default Admin;