import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Settings, Plus, Calendar, LogOut, Loader2, X, 
  Save, Image as ImageIcon, Trash2, DownloadCloud, Share2, Check, Users, QrCode 
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

  // מצבי טופס עריכה
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentEventId, setCurrentEventId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', event_date: '',
    active_modules: { photo: true, dating: false, seating: true },
    design_config: { template: 'glass', colors: { primary: '#3b82f6', background: '#020617' } }
  });

  // מצבי גלריה
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [activeGalleryEvent, setActiveGalleryEvent] = useState(null);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // מצבי הושבה
  const [isSeatingModalOpen, setIsSeatingModalOpen] = useState(false);
  const [activeSeatingEvent, setActiveSeatingEvent] = useState(null);
  const [seatingText, setSeatingText] = useState('');
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [savedGuestsCount, setSavedGuestsCount] = useState(0);

  // מצבי QR
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [activeQrEvent, setActiveQrEvent] = useState(null);

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

  const openModal = (event = null) => {
    if (event) {
      setCurrentEventId(event.id);
      setFormData({
        name: event.name, event_date: event.event_date || '',
        active_modules: event.active_modules || { photo: true, dating: false, seating: true },
        design_config: event.design_config || { template: 'glass', colors: { primary: '#3b82f6', background: '#020617' } }
      });
    } else {
      setCurrentEventId(null);
      setFormData({
        name: '', event_date: '', active_modules: { photo: true, dating: false, seating: true },
        design_config: { template: 'glass', colors: { primary: '#3b82f6', background: '#f8fafc' } }
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (currentEventId) await supabase.from('events').update(formData).eq('id', currentEventId);
      else await supabase.from('events').insert([formData]);
      setIsModalOpen(false);
      fetchEvents();
    } catch (error) { alert(error.message); }
    finally { setSaving(false); }
  };

  const openGallery = async (event) => {
    setActiveGalleryEvent(event);
    setIsGalleryOpen(true);
    setGalleryLoading(true);
    try {
      const { data } = await supabase.from('photos').select('*').eq('event_id', event.id).order('created_at', { ascending: false });
      setGalleryPhotos(data || []);
    } catch (error) { console.error(error); }
    finally { setGalleryLoading(false); }
  };

  const handleDeletePhoto = async (photo) => {
    if (!window.confirm(`למחוק את התמונה של ${photo.guest_name}?`)) return;
    try {
      await supabase.from('photos').delete().eq('id', photo.id);
      const filePath = photo.image_url.split('/event-photos/')[1];
      if (filePath) await supabase.storage.from('event-photos').remove([filePath]);
      setGalleryPhotos(prev => prev.filter(p => p.id !== photo.id));
    } catch (error) { alert(error.message); }
  };

  const downloadAlbum = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const imgFolder = zip.folder(`Album_${activeGalleryEvent.name}`);
      await Promise.all(galleryPhotos.map(async (p, i) => {
        const res = await fetch(p.image_url);
        const blob = await res.blob();
        imgFolder.file(`${p.guest_name}_${i+1}.jpg`, blob);
      }));
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${activeGalleryEvent.name}_Photos.zip`);
    } catch (error) { console.error(error); }
    finally { setDownloadingZip(false); }
  };

  const copyShareLink = async (eventId) => {
    const url = `${window.location.origin}/album/${eventId}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedId(eventId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      alert("לא הצלחנו להעתיק אוטומטית. הקישור הוא: " + url);
    }
  };

  const openSeatingModal = async (event) => {
    setActiveSeatingEvent(event);
    setSeatingText('');
    setIsSeatingModalOpen(true);
    setSeatingLoading(true);
    try {
      const { count } = await supabase.from('seating').select('*', { count: 'exact', head: true }).eq('event_id', event.id);
      setSavedGuestsCount(count || 0);
    } catch (error) { console.error(error); } 
    finally { setSeatingLoading(false); }
  };

  const handleSaveSeating = async () => {
    if (!seatingText.trim()) return alert("אנא הדבק רשימה קודם");
    setSeatingLoading(true);
    try {
      const lines = seatingText.split('\n');
      const parsedGuests = [];
      lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;
        const match = cleanLine.match(/^(.*?)[-,\s]*(\d+)\s*$/);
        if (match) {
          const name = match[1].trim();
          const table = match[2].trim();
          if (name && table) parsedGuests.push({ event_id: activeSeatingEvent.id, guest_name: name, table_number: table });
        }
      });
      if (parsedGuests.length === 0) {
        setSeatingLoading(false);
        return alert("לא הצלחנו לזהות שמות ומספרי שולחנות. וודא שהפורמט הוא 'שם - מספר'");
      }
      await supabase.from('seating').delete().eq('event_id', activeSeatingEvent.id);
      const { error } = await supabase.from('seating').insert(parsedGuests);
      if (error) throw error;
      setSavedGuestsCount(parsedGuests.length);
      setSeatingText('');
      alert(`מעולה! ${parsedGuests.length} מוזמנים נשמרו בהצלחה.`);
      setIsSeatingModalOpen(false);
    } catch (error) { alert(error.message); } 
    finally { setSeatingLoading(false); }
  };

  const openQrModal = (event) => {
    setActiveQrEvent(event);
    setIsQrModalOpen(true);
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
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-12" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900">לוח בקרה</h1>
            <p className="text-slate-500 font-medium text-lg mt-1">מערכת ה-SaaS שלך לניהול חוויות באירועים</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button onClick={() => openModal()} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-indigo-100">
              <Plus size={22} /> אירוע חדש
            </button>
            <button onClick={() => supabase.auth.signOut()} className="bg-slate-100 p-4 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors"><LogOut size={22} /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {dataLoading ? <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-indigo-600" size={48} /></div> :
            events.map(event => (
              <div key={event.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col xl:flex-row items-center justify-between group hover:border-indigo-200 transition-all gap-6">
                <div className="flex items-center gap-6 w-full xl:w-auto">
                  <div className="bg-indigo-50 p-5 rounded-3xl text-indigo-600 group-hover:scale-110 transition-transform duration-500"><Calendar size={32} /></div>
                  <div>
                    <h3 className="font-black text-2xl text-slate-800">{event.name}</h3>
                    <div className="flex gap-4 mt-2 text-slate-500 font-medium">
                      <span>{new Date(event.event_date).toLocaleDateString('he-IL')}</span>
                      <span>•</span>
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: event.design_config.colors.primary }}></div>
                        עיצוב {event.design_config.template}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center items-center gap-3 w-full xl:w-auto">
                  <button onClick={() => openGallery(event)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold shadow-md transition-all">
                    <ImageIcon size={18} /> אלבום
                  </button>
                  
                  {event.active_modules?.seating && (
                    <button onClick={() => openSeatingModal(event)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold shadow-md transition-all">
                      <Users size={18} /> הושבה
                    </button>
                  )}

                  <button onClick={() => openQrModal(event)} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold shadow-md transition-all">
                    <QrCode size={18} /> שילוט QR
                  </button>
                  
                  <button onClick={() => openModal(event)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-xl flex items-center gap-2 font-bold transition-all">
                    <Settings size={18} /> הגדרות
                  </button>
                  <button 
                    onClick={() => copyShareLink(event.id)}
                    className={`p-3 rounded-xl transition-all border ${copiedId === event.id ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600'}`}
                    title="העתק קישור לגלריה"
                  >
                    {copiedId === event.id ? <Check size={20} /> : <Share2 size={20} />}
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* --- מודל ה-QR המעוצב החדש --- */}
      {isQrModalOpen && activeQrEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 flex justify-between items-center bg-slate-50 border-b border-slate-100">
              <h2 className="text-2xl font-black text-slate-800">QR מעוצב: {activeQrEvent.name}</h2>
              <button onClick={() => setIsQrModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div className="p-6">
              {/* כאן הקישור עודכן לעמוד הבית של האירוע, לפי ההגדרה שהייתה לך קודם */}
              <AdminQRGenerator 
                defaultUrl={`${window.location.origin}`}
                defaultColor={activeQrEvent.design_config.colors.primary}
              />
            </div>
          </div>
        </div>
      )}

      {/* מודל הושבה */}
      {isSeatingModalOpen && activeSeatingEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
              <div>
                <h2 className="text-3xl font-black text-slate-800">ניהול הושבה - {activeSeatingEvent.name}</h2>
                <p className="text-emerald-600 font-bold mt-1">כרגע מוזנים במערכת {savedGuestsCount} אורחים</p>
              </div>
              <button onClick={() => setIsSeatingModalOpen(false)} className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-full transition-colors"><X size={28} /></button>
            </div>
            <div className="p-8">
              <label className="block text-sm font-bold text-slate-700 mb-2">הדבק רשימת מוזמנים</label>
              <textarea value={seatingText} onChange={e => setSeatingText(e.target.value)} placeholder="ישראל ישראלי 12&#10;שרה כהן - 5" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all h-64 resize-none" />
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button onClick={handleSaveSeating} disabled={seatingLoading || !seatingText} className="flex-1 bg-emerald-500 text-white font-black py-5 rounded-2xl flex justify-center items-center gap-2 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50">
                {seatingLoading ? <Loader2 className="animate-spin" /> : <><Users size={22} /> פענח ושמור רשימה</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* מודל עריכה */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-3xl font-black text-slate-800">{currentEventId ? 'עריכת אירוע' : 'אירוע חדש'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">שם האירוע</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">תאריך</label>
                  <input type="date" value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">צבע מיתוג ראשי</label>
                  <input type="color" value={formData.design_config.colors.primary} onChange={e => setFormData({...formData, design_config: {...formData.design_config, colors: {...formData.design_config.colors, primary: e.target.value}}})} className="w-full h-14 rounded-2xl cursor-pointer border-4 border-slate-50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">צבע רקע אפליקציה</label>
                  <input type="color" value={formData.design_config.colors.background} onChange={e => setFormData({...formData, design_config: {...formData.design_config, colors: {...formData.design_config.colors, background: e.target.value}}})} className="w-full h-14 rounded-2xl cursor-pointer border-4 border-slate-50" />
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <label className="text-sm font-bold text-slate-700 block">מודולים פעילים באירוע</label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"><input type="checkbox" checked={formData.active_modules.photo} onChange={(e) => setFormData({...formData, active_modules: {...formData.active_modules, photo: e.target.checked}})} className="w-5 h-5 text-indigo-600 rounded" /><span className="font-semibold text-slate-700">מצלמה</span></label>
                    <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"><input type="checkbox" checked={formData.active_modules.seating} onChange={(e) => setFormData({...formData, active_modules: {...formData.active_modules, seating: e.target.checked}})} className="w-5 h-5 text-indigo-600 rounded" /><span className="font-semibold text-slate-700">סידור הושבה</span></label>
                </div>
              </div>
            </form>
            <div className="p-8 bg-slate-50 flex gap-4">
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-600 text-white font-black py-5 rounded-2xl flex justify-center items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin" /> : <><Save size={22} /> שמור שינויים</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* מודל גלריה */}
      {isGalleryOpen && activeGalleryEvent && (
        <div className="fixed inset-0 z-[200] flex flex-col animate-in fade-in duration-300" style={{ backgroundColor: activeGalleryEvent.design_config.colors.background }}>
          <div className="p-6 md:p-10 shadow-xl flex justify-between items-center" style={{ backgroundColor: activeGalleryEvent.design_config.colors.primary }}>
            <div className="text-white">
              <h2 className="text-3xl md:text-5xl font-black drop-shadow-md">{activeGalleryEvent.name} - גלריית ניהול</h2>
              <p className="text-lg opacity-90 mt-2 font-medium">{galleryPhotos.length} תמונות נאספו עד כה</p>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={downloadAlbum} disabled={downloadingZip || galleryPhotos.length === 0} className="bg-white text-indigo-900 font-black px-8 py-4 rounded-2xl flex items-center gap-2 hover:scale-105 transition-all shadow-2xl disabled:opacity-50">
                {downloadingZip ? <Loader2 className="animate-spin" /> : <><DownloadCloud size={22} /> ייצוא ZIP ללקוח</>}
              </button>
              <button onClick={() => setIsGalleryOpen(false)} className="bg-black/20 text-white p-4 rounded-full hover:bg-black/40 transition-colors"><X size={32} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-8 md:p-16">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {galleryPhotos.map(photo => (
                <div key={photo.id} className="relative group rounded-3xl overflow-hidden aspect-square border border-white/10 shadow-2xl">
                  <img src={photo.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Moment" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-between p-6">
                    <button onClick={() => handleDeletePhoto(photo)} className="self-end bg-rose-500 text-white p-3 rounded-2xl hover:bg-rose-600 transition-colors shadow-lg"><Trash2 size={24} /></button>
                    <p className="text-white text-xl font-black truncate">{photo.guest_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Admin;