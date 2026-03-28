import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, ChevronLeft, Car, MapPin, Phone, MessageCircle, ArrowRight, UserPlus, Sparkles, AlertCircle, X } from 'lucide-react';
import gsap from 'gsap';

const Rideshare = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const navigate = useNavigate();

  // נתוני משתמש מקומיים
  const localGuestName = localStorage.getItem('guest_name') || '';
  const localGuestId = localStorage.getItem('guest_id') || '';

  const [loading, setLoading] = useState(false);
  const [rides, setRides] = useState([]);
  
  // שלבי האפליקציה: 'welcome' -> 'form' -> 'match' -> 'board'
  const [step, setStep] = useState('welcome');
  
  // טופס רישום
  const [formData, setFormData] = useState({
    role: '', // 'driver', 'seeker'
    direction: '', // 'there', 'back', 'both'
    from_location: '',
    to_location: '',
    guest_name: localGuestName,
    phone: ''
  });

  const [matches, setMatches] = useState([]);
  const [boardTab, setBoardTab] = useState('driver'); // איזה טאב פתוח בלוח המרכזי

  useEffect(() => {
    if (!eventId) return navigate('/');
    // משיכת כל הנתונים ברקע למקרה שנלך ישר ללוח
    fetchAllRides();
  }, [eventId]);

  const fetchAllRides = async () => {
    try {
      const { data } = await supabase.from('rideshares').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
      setRides(data || []);
    } catch (err) { console.error(err); }
  };

  // מעבר משלב בחירת התפקיד לטופס
  const handleRoleSelect = (selectedRole) => {
    setFormData({ ...formData, role: selectedRole });
    setStep('form');
  };

  // שליחת הטופס ובדיקת התאמות (Match)
  const submitForm = async (e) => {
    e.preventDefault();
    if (!localGuestId) return alert("אנא היכנסו לאירוע עם שם כדי להשתמש בלוח");
    
    setLoading(true);
    try {
      // 1. שמירה במסד הנתונים
      const { data: savedRide, error } = await supabase.from('rideshares').insert([{
        event_id: eventId,
        guest_id: localGuestId,
        ...formData
      }]).select().single();

      if (error) throw error;
      
      // עדכון הסטייט המקומי
      const updatedRides = [savedRide, ...rides];
      setRides(updatedRides);

      // 2. חיפוש התאמות חכם (Matching)
      const oppositeRole = formData.role === 'driver' ? 'seeker' : 'driver';
      
      const potentialMatches = updatedRides.filter(r => {
        // סינון ראשוני: לא אני, תפקיד הפוך
        if (r.guest_id === localGuestId || r.role !== oppositeRole) return false;

        let isMatch = false;

        // התאמת "הלוך" (There)
        if (['there', 'both'].includes(formData.direction) && ['there', 'both'].includes(r.direction)) {
          if (r.from_location && formData.from_location) {
            if (r.from_location.includes(formData.from_location) || formData.from_location.includes(r.from_location)) {
              isMatch = true;
            }
          }
        }

        // התאמת "חזור" (Back)
        if (['back', 'both'].includes(formData.direction) && ['back', 'both'].includes(r.direction)) {
          if (r.to_location && formData.to_location) {
            if (r.to_location.includes(formData.to_location) || formData.to_location.includes(r.to_location)) {
              isMatch = true;
            }
          }
        }

        return isMatch;
      });

      if (potentialMatches.length > 0) {
        setMatches(potentialMatches);
        setStep('match'); // יש התאמה! הולכים למסך המצ'ים
      } else {
        setBoardTab(oppositeRole); // אין התאמה מדויקת, הולכים ללוח
        setStep('board');
      }

    } catch (err) {
      alert("שגיאה בפרסום. נסו שוב.");
    } finally {
      setLoading(false);
    }
  };

  // עיצוב קישורי תקשורת
  const formatWhatsApp = (phone) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '972')}`;
  const formatDialer = (phone) => `tel:${phone.replace(/\D/g, '')}`;

  // רכיב כרטיסיה של נסיעה (לשימוש גם במסך מצ'ים וגם בלוח)
  const RideCard = ({ ride }) => {
    const isDriver = ride.role === 'driver';
    const colorClass = isDriver ? 'text-amber-500' : 'text-indigo-500';
    const bgClass = isDriver ? 'bg-amber-50' : 'bg-indigo-50';

    return (
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-slate-50 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bgClass}`}>
              <Car size={20} className={colorClass} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800 leading-tight">{ride.guest_name}</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${bgClass} ${colorClass}`}>
                {isDriver ? 'מציע/ה טרמפ' : 'מחפש/ת טרמפ'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {['there', 'both'].includes(ride.direction) && ride.from_location && (
            <div className="flex items-start gap-2">
              <ArrowRight size={16} className="text-emerald-500 mt-1 shrink-0" />
              <p className="text-sm font-bold text-slate-700"><span className="text-slate-400">הלוך מ:</span> {ride.from_location}</p>
            </div>
          )}
          {['back', 'both'].includes(ride.direction) && ride.to_location && (
            <div className="flex items-start gap-2">
              <ChevronLeft size={16} className="text-rose-500 mt-1 shrink-0" />
              <p className="text-sm font-bold text-slate-700"><span className="text-slate-400">חזור ל:</span> {ride.to_location}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <a href={formatWhatsApp(ride.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-colors py-2.5 rounded-xl font-bold text-sm">
            <MessageCircle size={16} /> WhatsApp
          </a>
          <a href={formatDialer(ride.phone)} className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors py-2.5 rounded-xl font-bold text-sm">
            <Phone size={16} /> חיוג טלפוני
          </a>
        </div>
      </div>
    );
  };


  // ==========================================
  // רינדור המסכים
  // ==========================================

  // --- מסך 1: בחירת תפקיד (ברוכים הבאים) ---
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-6 text-center" dir="rtl">
        <button onClick={() => navigate(-1)} className="self-end p-2 bg-white rounded-full shadow-sm text-slate-600 mb-8"><X size={20} /></button>
        
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6">
            <Car size={48} className="text-indigo-500" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">לוח הטרמפים</h1>
          <p className="text-slate-500 font-medium mb-10">איך נוכל לעזור לכם להגיע לאירוע?</p>

          <div className="space-y-4">
            <button onClick={() => handleRoleSelect('passenger')} className="w-full bg-white border-2 border-indigo-100 hover:border-indigo-500 text-indigo-600 p-6 rounded-3xl shadow-sm transition-all group flex items-center justify-between text-right">
              <div>
                <h3 className="text-xl font-black mb-1">אני מחפש טרמפ 🙋‍♂️</h3>
                <p className="text-sm font-medium text-slate-400">צריך עזרה להגיע או לחזור</p>
              </div>
              <ChevronLeft className="text-indigo-300 group-hover:text-indigo-500 transition-colors" />
            </button>

            <button onClick={() => handleRoleSelect('driver')} className="w-full bg-white border-2 border-amber-100 hover:border-amber-500 text-amber-600 p-6 rounded-3xl shadow-sm transition-all group flex items-center justify-between text-right">
              <div>
                <h3 className="text-xl font-black mb-1">אני מציע טרמפ 🚗</h3>
                <p className="text-sm font-medium text-slate-400">יש לי מקום פנוי ברכב</p>
              </div>
              <ChevronLeft className="text-amber-300 group-hover:text-amber-500 transition-colors" />
            </button>
          </div>

          <button onClick={() => { setStep('board'); setBoardTab('driver'); }} className="mt-10 text-slate-400 hover:text-slate-600 font-bold underline underline-offset-4 text-sm">
            רק להסתכל על לוח הטרמפים המלא
          </button>
        </div>
      </div>
    );
  }

  // --- מסך 2: טופס פרטים חכם ---
  if (step === 'form') {
    const isSeeker = formData.role === 'passenger';
    const mainColor = isSeeker ? 'indigo' : 'amber';
    const bgColor = `bg-${mainColor}-500`;
    const ringColor = `focus:ring-${mainColor}-500`;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-6" dir="rtl">
        <header className="flex items-center gap-4 mb-8 relative z-10 animate-in fade-in">
          <button onClick={() => setStep('welcome')} className="p-2 bg-white rounded-full shadow-sm text-slate-600"><ChevronLeft size={20} /></button>
          <h2 className="text-xl font-black text-slate-800">{isSeeker ? 'חיפוש טרמפ' : 'הצעת טרמפ'}</h2>
        </header>

        <form onSubmit={submitForm} className="max-w-md mx-auto w-full space-y-6 flex-1 flex flex-col animate-in slide-in-from-right-8">
          
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-800 border-b border-slate-50 pb-2">פרטי התקשרות</h3>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 pl-2">שם מלא</label>
              <input type="text" required value={formData.guest_name} onChange={e => setFormData({...formData, guest_name: e.target.value})} className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl ${ringColor} outline-none font-bold`} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 pl-2">טלפון לתיאום</label>
              <input type="tel" required placeholder="050-0000000" dir="ltr" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl ${ringColor} outline-none font-bold text-left`} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-800 border-b border-slate-50 pb-2">כיוון הנסיעה</h3>
            <div className="grid gap-2">
              <label className={`border-2 p-4 rounded-2xl cursor-pointer transition-colors flex items-center gap-3 ${formData.direction === 'there' ? `border-${mainColor}-500 bg-${mainColor}-50` : 'border-slate-100 hover:bg-slate-50'}`}>
                <input type="radio" name="dir" value="there" className="hidden" required onChange={() => setFormData({...formData, direction: 'there', to_location: ''})} />
                <ArrowRight size={20} className={`text-${mainColor}-500`} />
                <span className="font-bold text-slate-700">{isSeeker ? 'צריך טרמפ רק הלוך' : 'נוסע רק הלוך'}</span>
              </label>
              <label className={`border-2 p-4 rounded-2xl cursor-pointer transition-colors flex items-center gap-3 ${formData.direction === 'back' ? `border-${mainColor}-500 bg-${mainColor}-50` : 'border-slate-100 hover:bg-slate-50'}`}>
                <input type="radio" name="dir" value="back" className="hidden" required onChange={() => setFormData({...formData, direction: 'back', from_location: ''})} />
                <ChevronLeft size={20} className={`text-${mainColor}-500`} />
                <span className="font-bold text-slate-700">{isSeeker ? 'צריך טרמפ רק חזור' : 'נוסע רק חזור'}</span>
              </label>
              <label className={`border-2 p-4 rounded-2xl cursor-pointer transition-colors flex items-center gap-3 ${formData.direction === 'both' ? `border-${mainColor}-500 bg-${mainColor}-50` : 'border-slate-100 hover:bg-slate-50'}`}>
                <input type="radio" name="dir" value="both" className="hidden" required onChange={() => setFormData({...formData, direction: 'both'})} />
                <div className="flex"><ArrowRight size={16} className={`text-${mainColor}-500 -ml-1`}/><ChevronLeft size={16} className={`text-${mainColor}-500`} /></div>
                <span className="font-bold text-slate-700">{isSeeker ? 'צריך להלוך וגם לחזור' : 'נוסע לשני הכיוונים'}</span>
              </label>
            </div>
          </div>

          {formData.direction && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 animate-in slide-in-from-top-4">
              <h3 className="font-bold text-slate-800 border-b border-slate-50 pb-2">מאיפה / לאיפה?</h3>
              
              {['there', 'both'].includes(formData.direction) && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 pl-2">מאיפה בהלוך?</label>
                  <div className="relative">
                    <MapPin className="absolute right-4 top-4 text-slate-400" size={20} />
                    <input type="text" required value={formData.from_location} onChange={e => setFormData({...formData, from_location: e.target.value})} placeholder="עיר, שכונה או צומת" className={`w-full p-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl ${ringColor} outline-none font-bold`} />
                  </div>
                </div>
              )}

              {['back', 'both'].includes(formData.direction) && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 pl-2">לאן בחזור?</label>
                  <div className="relative">
                    <MapPin className="absolute right-4 top-4 text-slate-400" size={20} />
                    <input type="text" required value={formData.to_location} onChange={e => setFormData({...formData, to_location: e.target.value})} placeholder="עיר, שכונה או צומת" className={`w-full p-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl ${ringColor} outline-none font-bold`} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-auto pt-6">
            <button type="submit" disabled={loading} className={`w-full ${bgColor} text-white font-black py-5 rounded-2xl shadow-xl flex justify-center items-center gap-2 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50`}>
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'שגר מודעה ובדוק התאמות'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- מסך 3: התאמות (Match) ---
  if (step === 'match') {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex flex-col text-center text-white" dir="rtl">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <div className="inline-flex items-center justify-center p-6 bg-emerald-500/20 rounded-full mx-auto mb-6 border border-emerald-500/30 animate-pulse">
            <Sparkles size={48} className="text-emerald-400" />
          </div>
          <h2 className="text-4xl font-black mb-2">יש לנו התאמה!</h2>
          <p className="text-slate-300 font-medium mb-10 text-lg">
            מצאנו אנשים שכבר העלו מודעה לאותו אזור. דברו איתם עכשיו:
          </p>

          <div className="space-y-4 mb-8 text-right">
            {matches.map(match => (
              <div key={match.id} className="animate-in slide-in-from-bottom-8">
                <RideCard ride={match} />
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => { setBoardTab(formData.role === 'driver' ? 'seeker' : 'driver'); setStep('board'); }} className="w-full bg-slate-800 text-white font-bold py-5 rounded-2xl hover:bg-slate-700 transition-colors">
          המשך ללוח הטרמפים המלא
        </button>
      </div>
    );
  }

  // --- מסך 4: הלוח המרכזי (Board) ---
  return (
    <div className="min-h-screen bg-slate-50 pb-24" dir="rtl">
      <header className="bg-white px-6 py-5 sticky top-0 z-40 shadow-sm rounded-b-[2rem] border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200"><ChevronLeft size={20} /></button>
          <h1 className="text-xl font-black text-slate-800">הלוח המרכזי</h1>
        </div>
        <button onClick={() => setStep('welcome')} className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">פרסם מודעה</button>
      </header>

      <div className="px-6 pt-6 max-w-md mx-auto">
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl mb-6 shadow-inner">
          <button onClick={() => setBoardTab('driver')} className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${boardTab === 'driver' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            מציעים טרמפ 🚗
          </button>
          <button onClick={() => setBoardTab('seeker')} className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 ${boardTab === 'seeker' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            מחפשים טרמפ 🙋‍♂️
          </button>
        </div>

        <div className="space-y-4">
          {rides.filter(r => r.role === boardTab).length === 0 ? (
            <div className="text-center py-16 px-6 bg-white rounded-[2rem] border border-slate-100">
              <AlertCircle size={48} className="text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-800 mb-1">הלוח עדיין ריק</h3>
              <p className="text-slate-500 text-sm">היו הראשונים לפרסם מודעה בקטגוריה זו.</p>
            </div>
          ) : (
            rides.filter(r => r.role === boardTab).map(ride => (
              <div key={ride.id} className="animate-in fade-in slide-in-from-bottom-4">
                <RideCard ride={ride} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Rideshare;