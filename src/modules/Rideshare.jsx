import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, ChevronLeft, Car, MapPin, Phone, MessageCircle, ArrowRight, Sparkles, AlertCircle, X } from 'lucide-react';
import gsap from 'gsap';

// חישוב בהירות הצבע לעיצוב דינמי
const getLuminance = (hex) => {
  if (!hex) return 0;
  let color = hex.replace('#', '');
  if (color.length === 3) color = color.split('').map(c => c + c).join('');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
};

const Rideshare = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const navigate = useNavigate();

  const localGuestName = localStorage.getItem('guest_name') || '';
  const localGuestId = localStorage.getItem('guest_id') || '';

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(null);
  const [rides, setRides] = useState([]);
  
  const [step, setStep] = useState('welcome');
  
  const [formData, setFormData] = useState({
    role: '', 
    direction: '', 
    from_location: '',
    to_location: '',
    guest_name: localGuestName,
    phone: ''
  });

  const [matches, setMatches] = useState([]);
  const [boardTab, setBoardTab] = useState('driver');

  useEffect(() => {
    if (!eventId) return navigate('/');
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    try {
      const { data: event, error: eventErr } = await supabase.from('events').select('*').eq('id', eventId).single();
      if (eventErr) throw eventErr;
      setEventData(event);

      const { data: ridesData } = await supabase.from('rideshares').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
      setRides(ridesData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && eventData) {
      gsap.fromTo(".fade-up-item", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 });
    }
  }, [loading, step, eventData]);

  const handleRoleSelect = (selectedRole) => {
    setFormData({ ...formData, role: selectedRole });
    setStep('form');
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!localGuestId) return alert("אנא היכנסו לאירוע עם שם כדי להשתמש בלוח");
    
    setLoading(true);
    try {
      const { data: savedRide, error } = await supabase.from('rideshares').insert([{
        event_id: eventId,
        guest_id: localGuestId,
        ...formData
      }]).select().single();

      if (error) throw error;
      
      const updatedRides = [savedRide, ...rides];
      setRides(updatedRides);

      const oppositeRole = formData.role === 'driver' ? 'seeker' : 'driver';
      const potentialMatches = updatedRides.filter(r => {
        if (r.guest_id === localGuestId || r.role !== oppositeRole) return false;
        let isMatch = false;

        if (['there', 'both'].includes(formData.direction) && ['there', 'both'].includes(r.direction)) {
          if (r.from_location && formData.from_location && (r.from_location.includes(formData.from_location) || formData.from_location.includes(r.from_location))) isMatch = true;
        }
        if (['back', 'both'].includes(formData.direction) && ['back', 'both'].includes(r.direction)) {
          if (r.to_location && formData.to_location && (r.to_location.includes(formData.to_location) || formData.to_location.includes(r.to_location))) isMatch = true;
        }
        return isMatch;
      });

      if (potentialMatches.length > 0) {
        setMatches(potentialMatches);
        setStep('match'); 
      } else {
        setBoardTab(oppositeRole); 
        setStep('board');
      }

    } catch (err) {
      alert("שגיאה בפרסום. נסו שוב.");
    } finally {
      setLoading(false);
    }
  };

  const formatWhatsApp = (phone) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '972')}`;
  const formatDialer = (phone) => `tel:${phone.replace(/\D/g, '')}`;

  if (loading || !eventData) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={48} /></div>;

  const primaryColor = eventData.design_config?.colors?.primary || '#3b82f6';
  const bgColor = eventData.design_config?.colors?.background || '#f8fafc';
  const isLightPrimary = getLuminance(primaryColor) > 150;
  const primaryTextColor = isLightPrimary ? '#1e293b' : '#ffffff';

  const RideCard = ({ ride }) => {
    const isDriver = ride.role === 'driver';
    const accentColor = isDriver ? '#f59e0b' : primaryColor; // Amber למציע, צבע מותג למחפש
    
    return (
      <div className="bg-white p-5 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col gap-4 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-center border-b border-slate-50 pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center`} style={{ backgroundColor: `${accentColor}15` }}>
              <Car size={20} style={{ color: accentColor }} />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-800 leading-tight">{ride.guest_name}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md`} style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                {isDriver ? 'מציע/ה טרמפ' : 'מחפש/ת טרמפ'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2 bg-slate-50 border border-slate-100 p-3 rounded-[1rem]">
          {['there', 'both'].includes(ride.direction) && ride.from_location && (
            <div className="flex items-start gap-2">
              <ArrowRight size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm font-bold text-slate-700"><span className="text-slate-400 font-medium">הלוך מ:</span> {ride.from_location}</p>
            </div>
          )}
          {['back', 'both'].includes(ride.direction) && ride.to_location && (
            <div className="flex items-start gap-2">
              <ChevronLeft size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm font-bold text-slate-700"><span className="text-slate-400 font-medium">חזור ל:</span> {ride.to_location}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <a href={formatWhatsApp(ride.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-colors py-3 rounded-xl font-bold text-sm">
            <MessageCircle size={16} /> WhatsApp
          </a>
          <a href={formatDialer(ride.phone)} className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors py-3 rounded-xl font-bold text-sm">
            <Phone size={16} /> חיוג
          </a>
        </div>
      </div>
    );
  };

  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex flex-col p-6 text-center font-sans transition-colors duration-1000" style={{ backgroundColor: bgColor }} dir="rtl">
        <button onClick={() => navigate(-1)} className="self-end p-2 bg-black/5 hover:bg-black/10 rounded-full shadow-sm text-slate-500 transition-colors backdrop-blur-md mb-8">
          <X size={20} />
        </button>
        
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mx-auto mb-6" style={{ border: `1px solid ${primaryColor}20` }}>
            <Car size={40} style={{ color: primaryColor }} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">לוח טרמפים</h1>
          <p className="text-slate-500 font-medium mb-10">איך נוכל לעזור לכם להגיע לאירוע?</p>

          <div className="space-y-4">
            <button onClick={() => handleRoleSelect('passenger')} className="w-full text-white p-6 rounded-[1.5rem] shadow-lg flex items-center justify-between text-right transition-transform hover:scale-[1.02]" style={{ backgroundColor: primaryColor, color: primaryTextColor }}>
              <div>
                <h3 className="text-xl font-black mb-1">אני מחפש טרמפ 🙋‍♂️</h3>
                <p className="text-sm font-medium opacity-80">צריך עזרה להגיע או לחזור</p>
              </div>
              <ChevronLeft className="opacity-60" />
            </button>

            <button onClick={() => handleRoleSelect('driver')} className="w-full bg-white border border-slate-100 p-6 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform hover:scale-[1.02] group flex items-center justify-between text-right">
              <div>
                <h3 className="text-xl font-black text-slate-800 mb-1">אני מציע טרמפ 🚗</h3>
                <p className="text-sm font-medium text-slate-400">יש לי מקום פנוי ברכב</p>
              </div>
              <ChevronLeft className="text-slate-300 group-hover:text-slate-500 transition-colors" />
            </button>
          </div>

          <button onClick={() => { setStep('board'); setBoardTab('driver'); }} className="mt-10 text-slate-400 hover:text-slate-600 font-bold underline underline-offset-4 text-sm transition-colors">
            רק להסתכל על לוח הטרמפים המלא
          </button>
        </div>
      </div>
    );
  }

  if (step === 'form') {
    const isSeeker = formData.role === 'passenger';
    return (
      <div className="min-h-screen flex flex-col font-sans transition-colors duration-1000 pb-10" style={{ backgroundColor: bgColor }} dir="rtl">
        <div className="rounded-b-[3rem] pt-10 pb-16 px-6 relative z-10 shadow-lg flex justify-between items-start transition-colors duration-1000" style={{ backgroundColor: primaryColor }}>
          <button onClick={() => setStep('welcome')} className="p-2 rounded-full bg-black/10 hover:bg-black/20 transition-colors backdrop-blur-md" style={{ color: primaryTextColor }}>
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-black flex items-center gap-2" style={{ color: primaryTextColor }}>
            {isSeeker ? 'חיפוש טרמפ' : 'הצעת טרמפ'}
          </h1>
          <div className="w-9"></div>
        </div>

        <form onSubmit={submitForm} className="px-6 -mt-8 relative z-20 max-w-md mx-auto w-full space-y-4 flex-1 flex flex-col">
          <div className="fade-up-item bg-white p-6 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-800 border-b border-slate-50 pb-2">פרטי התקשרות</h3>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 pl-2">שם מלא</label>
              <input type="text" required value={formData.guest_name} onChange={e => setFormData({...formData, guest_name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[1.2rem] outline-none font-bold focus:ring-2 transition-all" style={{ '--tw-ring-color': primaryColor }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 pl-2">טלפון לתיאום</label>
              <input type="tel" required placeholder="050-0000000" dir="ltr" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[1.2rem] outline-none font-bold text-left focus:ring-2 transition-all" style={{ '--tw-ring-color': primaryColor }} />
            </div>
          </div>

          <div className="fade-up-item bg-white p-6 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-800 border-b border-slate-50 pb-2">כיוון הנסיעה</h3>
            <div className="grid gap-2">
              <label className={`border-2 p-4 rounded-[1.2rem] cursor-pointer transition-colors flex items-center gap-3 ${formData.direction === 'there' ? 'shadow-md' : 'border-slate-100 text-slate-600 hover:bg-slate-50'}`} style={formData.direction === 'there' ? { borderColor: primaryColor, backgroundColor: primaryColor, color: primaryTextColor } : {}}>
                <input type="radio" name="dir" value="there" className="hidden" required onChange={() => setFormData({...formData, direction: 'there', to_location: ''})} />
                <ArrowRight size={20} style={{ color: formData.direction === 'there' ? primaryTextColor : primaryColor }} />
                <span className="font-bold text-sm">{isSeeker ? 'צריך טרמפ רק הלוך' : 'נוסע רק הלוך'}</span>
              </label>
              <label className={`border-2 p-4 rounded-[1.2rem] cursor-pointer transition-colors flex items-center gap-3 ${formData.direction === 'back' ? 'shadow-md' : 'border-slate-100 text-slate-600 hover:bg-slate-50'}`} style={formData.direction === 'back' ? { borderColor: primaryColor, backgroundColor: primaryColor, color: primaryTextColor } : {}}>
                <input type="radio" name="dir" value="back" className="hidden" required onChange={() => setFormData({...formData, direction: 'back', from_location: ''})} />
                <ChevronLeft size={20} style={{ color: formData.direction === 'back' ? primaryTextColor : primaryColor }} />
                <span className="font-bold text-sm">{isSeeker ? 'צריך טרמפ רק חזור' : 'נוסע רק חזור'}</span>
              </label>
              <label className={`border-2 p-4 rounded-[1.2rem] cursor-pointer transition-colors flex items-center gap-3 ${formData.direction === 'both' ? 'shadow-md' : 'border-slate-100 text-slate-600 hover:bg-slate-50'}`} style={formData.direction === 'both' ? { borderColor: primaryColor, backgroundColor: primaryColor, color: primaryTextColor } : {}}>
                <input type="radio" name="dir" value="both" className="hidden" required onChange={() => setFormData({...formData, direction: 'both'})} />
                <div className="flex"><ArrowRight size={16} className="-ml-1" style={{ color: formData.direction === 'both' ? primaryTextColor : primaryColor }} /><ChevronLeft size={16} style={{ color: formData.direction === 'both' ? primaryTextColor : primaryColor }} /></div>
                <span className="font-bold text-sm">{isSeeker ? 'צריך להלוך וגם לחזור' : 'נוסע לשני הכיוונים'}</span>
              </label>
            </div>
          </div>

          {formData.direction && (
            <div className="fade-up-item bg-white p-6 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 space-y-4 animate-in slide-in-from-top-4">
              <h3 className="font-bold text-slate-800 border-b border-slate-50 pb-2">מאיפה / לאיפה?</h3>
              {['there', 'both'].includes(formData.direction) && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 pl-2">מאיפה בהלוך?</label>
                  <div className="relative">
                    <MapPin className="absolute right-4 top-4 text-slate-400" size={20} />
                    <input type="text" required value={formData.from_location} onChange={e => setFormData({...formData, from_location: e.target.value})} placeholder="עיר, שכונה או צומת" className="w-full p-4 pr-12 bg-slate-50 border border-slate-100 rounded-[1.2rem] outline-none font-bold focus:ring-2 transition-all" style={{ '--tw-ring-color': primaryColor }} />
                  </div>
                </div>
              )}
              {['back', 'both'].includes(formData.direction) && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 pl-2">לאן בחזור?</label>
                  <div className="relative">
                    <MapPin className="absolute right-4 top-4 text-slate-400" size={20} />
                    <input type="text" required value={formData.to_location} onChange={e => setFormData({...formData, to_location: e.target.value})} placeholder="עיר, שכונה או צומת" className="w-full p-4 pr-12 bg-slate-50 border border-slate-100 rounded-[1.2rem] outline-none font-bold focus:ring-2 transition-all" style={{ '--tw-ring-color': primaryColor }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-auto pt-6 pb-4">
            <button type="submit" disabled={loading} className="w-full font-black py-5 rounded-[1.5rem] shadow-xl flex justify-center items-center gap-2 hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50" style={{ backgroundColor: primaryColor, color: primaryTextColor }}>
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'שגר מודעה ובדוק התאמות'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 'match') {
    return (
      <div className="min-h-screen p-6 flex flex-col text-center font-sans transition-colors duration-1000" style={{ backgroundColor: primaryColor, color: primaryTextColor }} dir="rtl">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <div className="inline-flex items-center justify-center p-6 rounded-full mx-auto mb-6 bg-white/20 border border-white/30 shadow-inner animate-pulse">
            <Sparkles size={48} />
          </div>
          <h2 className="text-4xl font-black mb-2 drop-shadow-md">יש לנו התאמה!</h2>
          <p className="font-medium mb-10 text-lg opacity-90">
            מצאנו אנשים שכבר העלו מודעה לאותו אזור. דברו איתם עכשיו:
          </p>

          <div className="space-y-4 mb-8 text-right">
            {matches.map(match => (
              <div key={match.id} className="animate-in slide-in-from-bottom-8 text-slate-800">
                <RideCard ride={match} />
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => { setBoardTab(formData.role === 'driver' ? 'seeker' : 'driver'); setStep('board'); }} className="w-full bg-black/20 hover:bg-black/30 font-bold py-5 rounded-[1.5rem] transition-colors backdrop-blur-md">
          המשך ללוח הטרמפים המלא
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans transition-colors duration-1000 pb-10" style={{ backgroundColor: bgColor }} dir="rtl">
      <div className="rounded-b-[3rem] pt-10 pb-16 px-6 relative z-10 shadow-lg flex justify-between items-start transition-colors duration-1000" style={{ backgroundColor: primaryColor }}>
        <button onClick={() => navigate(-1)} className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors backdrop-blur-md" style={{ color: primaryTextColor }}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-black" style={{ color: primaryTextColor }}>הלוח המרכזי</h1>
        <button onClick={() => setStep('welcome')} className="text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm" style={{ backgroundColor: primaryTextColor, color: primaryColor }}>
          מודעה חדשה
        </button>
      </div>

      <div className="px-6 -mt-8 relative z-20 max-w-md mx-auto">
        <div className="flex bg-white p-1.5 rounded-[1.2rem] mb-6 shadow-sm border border-slate-100">
          <button onClick={() => setBoardTab('driver')} className={`flex-1 py-3 font-bold text-sm rounded-[1rem] transition-all flex items-center justify-center gap-2 ${boardTab === 'driver' ? 'shadow-md' : 'text-slate-500 hover:bg-slate-50'}`} style={boardTab === 'driver' ? { backgroundColor: primaryColor, color: primaryTextColor } : {}}>
            מציעים טרמפ 🚗
          </button>
          <button onClick={() => setBoardTab('seeker')} className={`flex-1 py-3 font-bold text-sm rounded-[1rem] transition-all flex items-center justify-center gap-2 ${boardTab === 'seeker' ? 'shadow-md' : 'text-slate-500 hover:bg-slate-50'}`} style={boardTab === 'seeker' ? { backgroundColor: primaryColor, color: primaryTextColor } : {}}>
            מחפשים טרמפ 🙋‍♂️
          </button>
        </div>

        <div className="space-y-4">
          {rides.filter(r => r.role === boardTab).length === 0 ? (
            <div className="fade-up-item text-center py-16 px-6 bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={28} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">הלוח עדיין ריק</h3>
              <p className="text-slate-500 text-sm">היו הראשונים לפרסם מודעה בקטגוריה זו.</p>
            </div>
          ) : (
            rides.filter(r => r.role === boardTab).map(ride => (
              <div key={ride.id} className="fade-up-item">
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