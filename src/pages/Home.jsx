import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Heart, Loader2, PartyPopper, MapPin, X, RefreshCw } from 'lucide-react';
import ModuleCard from '../components/ModuleCard';
import { supabase } from '../lib/supabase';
import gsap from 'gsap';

const Home = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);

  // מערכת ההרשמה
  const [isRegistered, setIsRegistered] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // מצבי מודול ההושבה
  const [showTableModal, setShowTableModal] = useState(false);
  const [isSearchingTable, setIsSearchingTable] = useState(false);
  const [tableResult, setTableResult] = useState(null);

  // התראות דייטליין
  const [hasUnreadDating, setHasUnreadDating] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('guest_name');
    const savedId = localStorage.getItem('guest_id');
    
    if (savedName && savedId) {
      setIsRegistered(true);
    }

    const fetchEvent = async () => {
      try {
        const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
        if (error) throw error;
        setEventData(data);
      } catch (error) {
        console.error("Error fetching event:", error.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchEvent();
  }, [id]);

  // בדיקת הודעות שלא נקראו בדייטליין
  useEffect(() => {
    const checkUnreadMessages = async () => {
      const guestId = localStorage.getItem('guest_id');
      if (!guestId || !id || !eventData?.active_modules?.dating) return;
      
      try {
        const { count, error } = await supabase
          .from('dating_messages')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', id)
          .eq('receiver_id', guestId)
          .eq('is_read', false); // רק הודעות שלא נקראו
          
        if (!error && count > 0) {
          setHasUnreadDating(true);
        }
      } catch (e) { console.error(e); }
    };

    if (isRegistered && eventData) {
      checkUnreadMessages();
    }
  }, [isRegistered, eventData, id]);

  // אנימציות GSAP בכניסה למסך הראשי
  useEffect(() => {
    if (isRegistered && eventData && !loading) {
      gsap.fromTo(".header-anim", 
        { y: -30, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
      );
      gsap.fromTo(".module-card-anim", 
        { y: 50, opacity: 0, scale: 0.9 }, 
        { y: 0, opacity: 1, scale: 1, duration: 0.6, stagger: 0.15, ease: "back.out(1.5)" }
      );
    }
  }, [isRegistered, eventData, loading]);

  const handleRegister = (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const newGuestId = 'guest_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('guest_name', nameInput.trim());
    localStorage.setItem('guest_id', newGuestId);
    setIsRegistered(true);
  };

  const handleChangeName = () => {
    localStorage.removeItem('guest_name');
    localStorage.removeItem('guest_id');
    setNameInput('');
    setIsRegistered(false);
    setShowTableModal(false);
  };

  const findMyTable = async () => {
    setIsSearchingTable(true);
    setShowTableModal(true);
    setTableResult(null);
    try {
      const guestName = localStorage.getItem('guest_name');
      const { data, error } = await supabase.from('seating').select('table_number').eq('event_id', eventData.id).ilike('guest_name', `%${guestName.trim()}%`).limit(1);
      if (error) throw error;
      setTableResult(data && data.length > 0 ? { found: true, number: data[0].table_number } : { found: false });
    } catch (error) {
      setTableResult({ found: false });
    } finally {
      setIsSearchingTable(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
  if (!eventData) return <div className="min-h-screen flex items-center justify-center text-white">לא נמצא אירוע.</div>;

  const { name, active_modules, design_config } = eventData;
  const { background, primary } = design_config.colors;

  if (!isRegistered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-1000" style={{ backgroundColor: background }} dir="rtl">
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-[2rem] shadow-2xl w-full max-w-sm text-center border border-white/20 animate-in zoom-in duration-500">
          <PartyPopper className="text-white mx-auto mb-4" size={48} />
          <h1 className="text-3xl font-black text-white mb-2">ברוכים הבאים!</h1>
          <p className="text-white/80 mb-8 font-medium">ל-{name}.<br/>כדי להתחיל בחגיגה, איך קוראים לכם?</p>
          <form onSubmit={handleRegister} className="space-y-4">
            <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="לדוגמה: דודה תקווה" className="w-full p-4 bg-white/20 border border-white/30 text-white placeholder-white/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/50 text-center text-lg font-bold" required />
            <button type="submit" className="w-full text-white font-black py-4 rounded-2xl text-lg shadow-lg hover:scale-105 transition-all" style={{ backgroundColor: primary }}>היכנסו לאירוע</button>
          </form>
        </div>
      </div>
    );
  }

  const guestName = localStorage.getItem('guest_name');

  return (
    <div className="p-6 min-h-screen flex flex-col justify-center text-center transition-colors duration-1000 overflow-hidden" style={{ backgroundColor: background }} dir="rtl">
      <div className="max-w-md mx-auto w-full relative z-10">
        
        <header className="mb-12 header-anim opacity-0">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white drop-shadow-lg mb-4">{name}</h1>
          <p className="text-white font-bold text-lg bg-black/20 backdrop-blur-md inline-block px-6 py-2 rounded-full border border-white/10 shadow-lg cursor-pointer hover:bg-black/30 transition-colors" title="לחץ לשינוי שם" onClick={handleChangeName}>
            היי {guestName}! מה תרצו לעשות?
          </p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          {active_modules.photo && (
            <div className="module-card-anim opacity-0">
              <ModuleCard title="כל אחד צלם" icon={Camera} color="bg-orange-500" onClick={() => navigate(`/photos?event=${id}`)} />
            </div>
          )}
          
          {active_modules.seating && (
            <div className="module-card-anim opacity-0">
              <ModuleCard title="איפה אני יושב?" icon={MapPin} color="bg-emerald-500" onClick={findMyTable} />
            </div>
          )}

          {active_modules.dating && (
            <div className="module-card-anim opacity-0 relative">
              {/* נקודת התראה (Badge) שמהבהבת כשיש הודעה שלא נקראה */}
              {hasUnreadDating && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 z-20">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-500 border-2 border-slate-900 shadow-lg"></span>
                </span>
              )}
              <ModuleCard title="דייט-ליין" icon={Heart} color="bg-rose-500" onClick={() => navigate(`/dating?event=${id}`)} />
            </div>
          )}
        </div>
      </div>

      {/* פופ-אפ התוצאה: איפה אני יושב? */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setShowTableModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 bg-slate-100 p-2 rounded-full transition-colors"><X size={24} /></button>
            {isSearchingTable ? (
              <div className="py-8"><Loader2 className="animate-spin text-emerald-500 mx-auto mb-4" size={48} /><p className="text-slate-600 font-bold text-lg">מחפש את השולחן שלך...</p></div>
            ) : tableResult?.found ? (
              <div className="py-4">
                <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><span className="text-5xl font-black text-emerald-600">{tableResult.number}</span></div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">מצאנו אותך!</h3>
                <p className="text-slate-600 text-lg font-medium">את/ה יושב/ת בשולחן מספר <strong className="text-emerald-600">{tableResult.number}</strong>.<br/> שיהיה בתאבון!</p>
              </div>
            ) : (
              <div className="py-4">
                <div className="bg-rose-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><MapPin size={40} className="text-rose-500" /></div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">אופס...</h3>
                <p className="text-slate-600 font-medium mb-6">לא מצאנו את השם בדיוק כפי שהקלדת אותו.</p>
                <button onClick={handleChangeName} className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3.5 rounded-2xl transition-colors flex justify-center items-center gap-2 border border-indigo-100"><RefreshCw size={20} /> נסה/י שם אחר</button>
              </div>
            )}
            {!isSearchingTable && (<button onClick={() => setShowTableModal(false)} className="w-full mt-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-2xl transition-colors">סגור</button>)}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;