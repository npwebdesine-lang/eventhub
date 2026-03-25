import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Settings, Plus, Calendar, LogOut, Loader2, X, 
  Save, Image as ImageIcon, Trash2, DownloadCloud, Share2, Check, Users, QrCode, Heart, ChevronRight
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import AdminQRGenerator from './AdminQRGenerator';

const Admin = () => {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // היררכיה חדשה: אירוע נבחר לניהול מלא
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(null);

  // מצבי מודולים ספציפיים
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  
  const [isSeatingModalOpen, setIsSeatingModalOpen] = useState(false);
  const [seatingText, setSeatingText] = useState('');
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [savedGuestsCount, setSavedGuestsCount] = useState(0);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session) fetchEvents();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchEvents();
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchEvents = async () => {
    setDataLoading(true);
    try {
      const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setEvents(data);
    } catch (error) { console.error(error); }
    finally { setDataLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("פרטים שגויים");
    setAuthLoading(false);
  };

  // פתיחת אירוע לניהול
  const handleManageEvent = (event) => {
    setSelectedEvent(event);
    setFormData({
      name: event.name,
      event_date: event.event_date || '',
      active_modules: { photo: true, seating: true, dating: false, ...event.active_modules },
      design_config: event.design_config || { template: 'glass', colors: { primary: '#3b82f6', background: '#020617' } }
    });
  };

  const handleCreateNew = () => {
    setSelectedEvent({ id: null, isNew: true });
    setFormData({
      name: '', event_date: '', 
      active_modules: { photo: true, seating: true, dating: false },
      design_config: { template: 'glass', colors: { primary: '#3b82f6', background: '#f8fafc' } }
    });
  };

  const handleSave = async () => {
    if (!formData.name) return alert("יש להזין שם אירוע");
    setSaving(true);
    try {
      if (selectedEvent.id) {
        await supabase.from('events').update(formData).eq('id', selectedEvent.id);
      } else {
        await supabase.from('events').insert([formData]);
      }
      setSelectedEvent(null);
      fetchEvents();
    } catch (error) { alert(error.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את האירוע "${formData.name}"? כל הנתונים יימחקו לצמיתות!`)) return;
    setSaving(true);
    try {
      await supabase.from('events').delete().eq('id', selectedEvent.id);
      setSelectedEvent(null);
      fetchEvents();
    } catch (error) { alert("שגיאה במחיקה"); }
    finally { setSaving(false); }
  };

  // --- פונקציות מודולים ---
  const copyShareLink = async (eventId) => {
    const url = `${window.location.origin}/event/${eventId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(eventId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { alert("הקישור הוא: " + url); }
  };

  const openGallery = async () => {
    setIsGalleryOpen(true);
    const { data } = await supabase.from('photos').select('*').eq('event_id', selectedEvent.id).order('created_at', { ascending: false });
    setGalleryPhotos(data || []);
  };

  const downloadAlbum = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const imgFolder = zip.folder(`Album_${formData.name}`);
      await Promise.all(galleryPhotos.map(async (p, i) => {
        const res = await fetch(p.image_url);
        const blob = await res.blob();
        imgFolder.file(`${p.guest_name}_${i+1}.jpg`, blob);
      }));
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${formData.name}_Photos.zip`);
    } catch (error) { console.error(error); }
    finally { setDownloadingZip(false); }
  };

  const handleDeletePhoto = async (photo) => {
    if (!window.confirm(`למחוק את התמונה של ${photo.guest_name}?`)) return;
    try {
      await supabase.from('photos').delete().eq('id', photo.id);
      setGalleryPhotos(prev => prev.filter(p => p.id !== photo.id));
    } catch (error) { alert(error.message); }
  };

  const openSeatingManager = async () => {
    setSeatingText('');
    setIsSeatingModalOpen(true);
    const { count } = await supabase.from('seating').select('*', { count: 'exact', head: true }).eq('event_id', selectedEvent.id);
    setSavedGuestsCount(count || 0);
  };

  const handleSaveSeating = async () => {
    if (!seatingText.trim()) return alert("אנא הדבק רשימה");
    setSeatingLoading(true);
    try {
      const parsedGuests = seatingText.split('\n').map(line => {
        const match = line.trim().match(/^(.*?)[-,\s]*(\d+)\s*$/);
        return match ? { event_id: selectedEvent.id, guest_name: match[1].trim(), table_number: match[2].trim() } : null;
      }).filter(Boolean);
      
      if (parsedGuests.length === 0) throw new Error("לא זיהינו שמות בפורמט התקין (שם - מספר)");
      await supabase.from('seating').delete().eq('event_id', selectedEvent.id);
      await supabase.from('seating').insert(parsedGuests);
      setSavedGuestsCount(parsedGuests.length);
      setSeatingText('');
      alert(`נשמרו ${parsedGuests.length} מוזמנים.`);
    } catch (error) { alert(error.message); } 
    finally { setSeatingLoading(false); }
  };


  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" dir="rtl">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-slate-800">EventHub Admin</h1>
            <p className="text-slate-500 mt-2">ניהול מערכת האירועים שלך</p>
          </div>
          <div className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="אימייל" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" dir="ltr" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="סיסמה" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" dir="ltr" />
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all">התחבר למערכת</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8" dir="rtl">
      
      {/* מסך ראשי - רשימת אירועים */}
      {!selectedEvent && (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 gap-6">
            <div>
              <h1 className="text-4xl font-black text-slate-900">לוח בקרה</h1>
              <p className="text-slate-500 font-medium text-lg mt-1">מערכת ה-SaaS שלך לניהול חוויות</p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button onClick={handleCreateNew} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-indigo-100">
                <Plus size={22} /> אירוע חדש
              </button>
              <button onClick={() => supabase.auth.signOut()} className="bg-slate-100 p-4 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors"><LogOut size={22} /></button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dataLoading ? <Loader2 className="animate-spin text-indigo-600 mx-auto col-span-full" size={48} /> :
              events.map(event => (
                <div key={event.id} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col group hover:border-indigo-300 hover:shadow-xl transition-all relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-indigo-100 p-4 rounded-2xl text-indigo-600"><Calendar size={28} /></div>
                    <div>
                      <h3 className="font-black text-2xl text-slate-800 line-clamp-1">{event.name}</h3>
                      <p className="text-slate-500 font-medium">{new Date(event.event_date).toLocaleDateString('he-IL')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => handleManageEvent(event)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2">
                      <Settings size={18} /> ניהול אירוע
                    </button>
                    <button onClick={() => copyShareLink(event.id)} className={`p-3 rounded-xl transition-all border ${copiedId === event.id ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600'}`} title="העתק קישור לאירוע">
                      {copiedId === event.id ? <Check size={20} /> : <Share2 size={20} />}
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* מסך ניהול אירוע נבחר */}
      {selectedEvent && (
        <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
          <button onClick={() => setSelectedEvent(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold mb-6 transition-colors">
            <ChevronRight size={20} /> חזרה לכל האירועים
          </button>

          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
            {/* Header של מסך הניהול */}
            <div className="p-8 md:p-10 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-3xl font-black text-slate-900">{selectedEvent.isNew ? 'יצירת אירוע חדש' : `ניהול: ${formData.name}`}</h2>
                <p className="text-slate-500 mt-2">הגדרות כלליות ומודולים</p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                {!selectedEvent.isNew && (
                  <button onClick={handleDelete} disabled={saving} className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all border border-rose-100" title="מחק אירוע">
                    <Trash2 size={22} />
                  </button>
                )}
                <button onClick={handleSave} disabled={saving} className="flex-1 md:flex-none bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex justify-center items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                  {saving ? <Loader2 className="animate-spin" /> : <><Save size={22} /> שמור שינויים</>}
                </button>
              </div>
            </div>

            <div className="p-8 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
              
              {/* טור ימני: הגדרות בסיסיות */}
              <div className="lg:col-span-1 space-y-6">
                <h3 className="text-xl font-black text-slate-800 border-b pb-4">הגדרות בסיס</h3>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">שם האירוע</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">תאריך</label>
                  <input type="date" value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 text-center block">צבע מיתוג</label>
                    <input type="color" value={formData.design_config.colors.primary} onChange={e => setFormData({...formData, design_config: {...formData.design_config, colors: {...formData.design_config.colors, primary: e.target.value}}})} className="w-full h-12 rounded-xl cursor-pointer border-2 border-slate-100" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 text-center block">צבע רקע</label>
                    <input type="color" value={formData.design_config.colors.background} onChange={e => setFormData({...formData, design_config: {...formData.design_config, colors: {...formData.design_config.colors, background: e.target.value}}})} className="w-full h-12 rounded-xl cursor-pointer border-2 border-slate-100" />
                  </div>
                </div>
                
                {!selectedEvent.isNew && (
                  <button onClick={() => setIsQrModalOpen(true)} className="w-full mt-4 bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                    <QrCode size={20} /> הפק שילוט QR לאירוע
                  </button>
                )}
              </div>

              {/* טור שמאלי: ניהול מודולים (הקסם החדש) */}
              <div className="lg:col-span-2 space-y-8">
                <h3 className="text-xl font-black text-slate-800 border-b pb-4">מודולים ופיצ'רים</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* מודול צילום */}
                  <div className={`border-2 rounded-3xl p-6 transition-all ${formData.active_modules.photo ? 'border-orange-500 bg-orange-50/30' : 'border-slate-100 opacity-60 grayscale'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${formData.active_modules.photo ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Camera size={24} /></div>
                        <h4 className="font-black text-lg text-slate-800">כל אחד צלם</h4>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={formData.active_modules.photo} onChange={e => setFormData({...formData, active_modules: {...formData.active_modules, photo: e.target.checked}})} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    </div>
                    {formData.active_modules.photo && !selectedEvent.isNew && (
                      <div className="space-y-3 animate-in fade-in">
                        <p className="text-sm text-slate-600 font-medium mb-4">ניהול הגלריה המשותפת של האורחים.</p>
                        <button onClick={openGallery} className="w-full py-3 bg-white border border-orange-200 text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors flex justify-center items-center gap-2">
                          <ImageIcon size={18} /> ניהול תמונות האלבום
                        </button>
                      </div>
                    )}
                  </div>

                  {/* מודול הושבה */}
                  <div className={`border-2 rounded-3xl p-6 transition-all ${formData.active_modules.seating ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 opacity-60 grayscale'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${formData.active_modules.seating ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Users size={24} /></div>
                        <h4 className="font-black text-lg text-slate-800">סידור הושבה</h4>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={formData.active_modules.seating} onChange={e => setFormData({...formData, active_modules: {...formData.active_modules, seating: e.target.checked}})} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                    {formData.active_modules.seating && !selectedEvent.isNew && (
                      <div className="space-y-3 animate-in fade-in">
                        <p className="text-sm text-slate-600 font-medium mb-4">ניהול רשימת המוזמנים ושולחנות.</p>
                        <button onClick={openSeatingManager} className="w-full py-3 bg-white border border-emerald-200 text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-colors flex justify-center items-center gap-2">
                          <Settings size={18} /> הזנת רשימת הושבה
                        </button>
                      </div>
                    )}
                  </div>

                  {/* מודול דייטליין */}
                  <div className={`border-2 rounded-3xl p-6 transition-all md:col-span-2 ${formData.active_modules.dating ? 'border-rose-500 bg-rose-50/30' : 'border-slate-100 opacity-60 grayscale'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${formData.active_modules.dating ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-500'}`}><Heart size={24} /></div>
                        <div>
                          <h4 className="font-black text-lg text-slate-800">Daitline (דייטליין)</h4>
                          <span className="text-xs font-bold text-rose-500 bg-rose-100 px-2 py-0.5 rounded-full">פרימיום</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={formData.active_modules.dating} onChange={e => setFormData({...formData, active_modules: {...formData.active_modules, dating: e.target.checked}})} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                      </label>
                    </div>
                    {formData.active_modules.dating && !selectedEvent.isNew && (
                      <div className="p-4 bg-white rounded-xl border border-rose-100 text-center animate-in fade-in">
                        <p className="text-sm text-slate-600 font-medium mb-3">צפייה ומחיקת משתמשים ממודול ההיכרויות (יפותח בשלב הבא).</p>
                        <button disabled className="w-full py-3 bg-rose-50 text-rose-400 font-bold rounded-xl flex justify-center items-center gap-2 cursor-not-allowed">
                           ניהול משתמשים (בקרוב)
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- מודלים פנימיים למודולים שונים --- */}
      
      {/* מודל גלריה למנהל (נפתח מה"כל אחד צלם") */}
      {isGalleryOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
          <div className="p-6 md:p-8 flex justify-between items-center bg-white">
            <div>
              <h2 className="text-3xl font-black text-slate-800">גלריית האירוע</h2>
              <p className="text-slate-500 font-medium">{galleryPhotos.length} תמונות נאספו</p>
            </div>
            <div className="flex gap-4">
              <button onClick={downloadAlbum} disabled={downloadingZip || galleryPhotos.length === 0} className="bg-orange-500 text-white font-black px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-orange-600 transition-all disabled:opacity-50">
                {downloadingZip ? <Loader2 className="animate-spin" /> : <><DownloadCloud size={20} /> ייצוא ZIP</>}
              </button>
              <button onClick={() => setIsGalleryOpen(false)} className="bg-slate-100 text-slate-600 p-3 rounded-xl hover:bg-slate-200 transition-colors"><X size={24} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {galleryPhotos.map(photo => (
                <div key={photo.id} className="relative group rounded-2xl overflow-hidden aspect-square border-4 border-white shadow-xl">
                  <img src={photo.image_url} className="w-full h-full object-cover" alt="Moment" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-between p-4">
                    <button onClick={() => handleDeletePhoto(photo)} className="self-end bg-rose-500 text-white p-2 rounded-lg hover:bg-rose-600 transition-colors shadow-lg"><Trash2 size={20} /></button>
                    <p className="text-white text-sm font-black truncate">{photo.guest_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* מודל הושבה */}
      {isSeatingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-800">ניהול הושבה</h2>
                <p className="text-emerald-600 font-bold mt-1">כרגע מוזנים במערכת {savedGuestsCount} אורחים</p>
              </div>
              <button onClick={() => setIsSeatingModalOpen(false)} className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-full transition-colors"><X size={28} /></button>
            </div>
            <div className="p-8">
              <label className="block text-sm font-bold text-slate-700 mb-2">הדבק רשימת מוזמנים (פורמט: שם - מספר שולחן)</label>
              <textarea value={seatingText} onChange={e => setSeatingText(e.target.value)} placeholder="ישראל ישראלי 12&#10;שרה כהן - 5" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all h-64 resize-none" />
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button onClick={handleSaveSeating} disabled={seatingLoading || !seatingText} className="w-full bg-emerald-500 text-white font-black py-5 rounded-2xl flex justify-center items-center gap-2 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50">
                {seatingLoading ? <Loader2 className="animate-spin" /> : <><Users size={22} /> פענח ושמור רשימה</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* מודל QR */}
      {isQrModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 flex justify-between items-center bg-slate-50 border-b border-slate-100">
              <h2 className="text-2xl font-black text-slate-800">QR מעוצב שולחני</h2>
              <button onClick={() => setIsQrModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6">
              <AdminQRGenerator key={selectedEvent.id} defaultUrl={`${window.location.origin}/event/${selectedEvent.id}`} defaultColor={formData.design_config?.colors?.primary || '#3b82f6'} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Admin;