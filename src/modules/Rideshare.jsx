import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getLuminance } from '../lib/colors';
import { useToast } from '../components/Toast';
import { Loader2, ChevronLeft, Car, MapPin, MessageCircle, ArrowRight, Sparkles, AlertCircle, X, Phone } from 'lucide-react';
import gsap from 'gsap';

const Rideshare = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event');
  const navigate = useNavigate();
  const { showToast } = useToast();

  const localGuestName = localStorage.getItem('guest_name') || '';
  const localGuestId = localStorage.getItem('guest_id') || '';

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventData, setEventData] = useState(null);
  const [rides, setRides] = useState([]);
  const [step, setStep] = useState('welcome');
  const [formData, setFormData] = useState({
    role: 'seeker',
    direction: '',
    from_location: '',
    to_location: '',
    guest_name: localGuestName,
    phone: '',
  });
  const [matches, setMatches] = useState([]);
  const [boardTab, setBoardTab] = useState('driver');

  useEffect(() => {
    if (!eventId) return navigate('/');
    let isMounted = true;
    const init = async () => {
      try {
        const { data: event, error } = await supabase
          .from('events')
          .select('id, name, design_config')
          .eq('id', eventId)
          .single();
        if (error) throw error;
        if (isMounted) setEventData(event);

        const { data: ridesData } = await supabase
          .from('rideshares')
          .select('id, guest_id, guest_name, role, direction, from_location, to_location, phone, created_at')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(100);
        if (isMounted) setRides(ridesData || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    init();
    return () => { isMounted = false; };
  }, [eventId, navigate]);

  useEffect(() => {
    if (!loading && eventData) {
      gsap.fromTo('.fade-up-item', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 });
    }
  }, [loading, step, eventData]);

  const handleRoleSelect = (role) => {
    setFormData(prev => ({ ...prev, role }));
    setStep('form');
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (!localGuestId) {
      showToast('אנא היכנסו לאירוע עם שם כדי להשתמש בלוח', 'warning');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data: savedRide, error } = await supabase
        .from('rideshares')
        .insert([{ event_id: eventId, guest_id: localGuestId, ...formData }])
        .select()
        .single();
      if (error) throw error;

      const updatedRides = [savedRide, ...rides];
      setRides(updatedRides);

      const oppositeRole = formData.role === 'driver' ? 'seeker' : 'driver';
      const potentialMatches = updatedRides.filter(r => {
        if (r.guest_id === localGuestId || r.role !== oppositeRole) return false;
        let isMatch = false;
        if (['there', 'both'].includes(formData.direction) && ['there', 'both'].includes(r.direction)) {
          if (r.from_location && formData.from_location &&
            (r.from_location.includes(formData.from_location) || formData.from_location.includes(r.from_location))) {
            isMatch = true;
          }
        }
        if (['back', 'both'].includes(formData.direction) && ['back', 'both'].includes(r.direction)) {
          if (r.to_location && formData.to_location &&
            (r.to_location.includes(formData.to_location) || formData.to_location.includes(r.to_location))) {
            isMatch = true;
          }
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
    } catch {
      showToast('שגיאה בפרסום המודעה. נסו שוב.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatWhatsApp = (phone) =>
    `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '972')}`;
  const formatDialer = (phone) => `tel:${phone.replace(/\D/g, '')}`;

  if (loading || !eventData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={48} />
      </div>
    );
  }

  const primaryColor = eventData.design_config?.colors?.primary || '#3b82f6';
  const bgColor = eventData.design_config?.colors?.background || '#f8fafc';
  const primaryTextColor = getLuminance(primaryColor) > 150 ? '#1e293b' : '#ffffff';

  // Improved Ride Card
  const RideCard = ({ ride }) => {
    const isDriver = ride.role === 'driver';
    const accentColor = isDriver ? '#f59e0b' : primaryColor;
    const cleanPhone = ride.phone?.replace(/\D/g, '').replace(/^0/, '972');

    return (
      <div className="bg-white p-5 rounded-[1.5rem] shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-slate-100 flex flex-col gap-3 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-[1rem] flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <Car size={20} style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-800 truncate">{ride.guest_name}</h3>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
            >
              {isDriver ? 'מציע/ה טרמפ' : 'מחפש/ת טרמפ'}
            </span>
          </div>
        </div>

        {/* Route */}
        <div className="bg-slate-50 border border-slate-100 rounded-[1rem] p-3 space-y-1.5">
          {['there', 'both'].includes(ride.direction) && ride.from_location && (
            <div className="flex items-center gap-2 text-sm">
              <ArrowRight size={13} className="text-slate-400 shrink-0" />
              <span className="text-slate-400 text-xs">הלוך מ:</span>
              <span className="font-bold text-slate-700 truncate">{ride.from_location}</span>
            </div>
          )}
          {['back', 'both'].includes(ride.direction) && ride.to_location && (
            <div className="flex items-center gap-2 text-sm">
              <ChevronLeft size={13} className="text-slate-400 shrink-0" />
              <span className="text-slate-400 text-xs">חזור ל:</span>
              <span className="font-bold text-slate-700 truncate">{ride.to_location}</span>
            </div>
          )}
        </div>

        {/* Contact buttons */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`https://wa.me/${cleanPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 bg-[#25D366] text-white hover:bg-[#20b859] active:scale-[0.97] transition-all py-3 rounded-xl font-bold text-sm shadow-sm"
          >
            <MessageCircle size={15} /> WhatsApp
          </a>
          <a
            href={formatDialer(ride.phone)}
            className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.97] transition-all py-3 rounded-xl font-bold text-sm"
          >
            <Phone size={15} /> חיוג
          </a>
        </div>
      </div>
    );
  };

  // ---- Welcome ----
  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex flex-col p-6 font-sans transition-colors duration-1000" style={{ backgroundColor: bgColor }} dir="rtl">
        <button
          onClick={() => navigate(-1)}
          className="self-end p-2 bg-black/5 hover:bg-black/10 rounded-full text-slate-500 transition-colors mb-8"
        >
          <X size={20} />
        </button>

        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full text-center animate-in zoom-in-95 duration-500">
          <div
            className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mx-auto mb-6"
            style={{ border: `2px solid ${primaryColor}20` }}
          >
            <Car size={40} style={{ color: primaryColor }} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">לוח טרמפים</h1>
          <p className="text-slate-400 font-medium mb-10 text-sm">שתפו נסיעות — יחד זה יותר כיף</p>

          <div className="space-y-3 text-right">
            <button
              onClick={() => handleRoleSelect('seeker')}
              className="w-full p-5 rounded-[1.5rem] shadow-lg flex items-center justify-between hover:scale-[1.02] active:scale-[0.98] transition-transform"
              style={{ backgroundColor: primaryColor, color: primaryTextColor }}
            >
              <div>
                <h3 className="text-lg font-black mb-0.5">אני מחפש/ת טרמפ 🙋</h3>
                <p className="text-xs font-medium opacity-75">צריך/ה עזרה להגיע או לחזור</p>
              </div>
              <ChevronLeft className="opacity-60 shrink-0" />
            </button>

            <button
              onClick={() => handleRoleSelect('driver')}
              className="w-full bg-white border border-slate-100 p-5 rounded-[1.5rem] shadow-sm flex items-center justify-between hover:scale-[1.02] active:scale-[0.98] transition-transform group text-right"
            >
              <div>
                <h3 className="text-lg font-black text-slate-800 mb-0.5">אני מציע/ת טרמפ 🚗</h3>
                <p className="text-xs font-medium text-slate-400">יש לי מקום פנוי ברכב</p>
              </div>
              <ChevronLeft className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
            </button>
          </div>

          <button
            onClick={() => { setStep('board'); setBoardTab('driver'); }}
            className="mt-10 text-slate-400 hover:text-slate-600 font-bold text-sm underline underline-offset-4 transition-colors"
          >
            רק להסתכל על הלוח המלא
          </button>
        </div>
      </div>
    );
  }

  // ---- Form ----
  if (step === 'form') {
    const isSeeker = formData.role === 'seeker';
    return (
      <div className="min-h-screen flex flex-col font-sans transition-colors duration-1000 pb-10" style={{ backgroundColor: bgColor }} dir="rtl">
        <div
          className="rounded-b-[3rem] pt-10 pb-16 px-6 relative z-10 shadow-lg flex justify-between items-center"
          style={{ backgroundColor: primaryColor }}
        >
          <button onClick={() => setStep('welcome')} className="p-2 rounded-full bg-black/10 hover:bg-black/20 transition-colors" style={{ color: primaryTextColor }}>
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-black" style={{ color: primaryTextColor }}>
            {isSeeker ? 'חיפוש טרמפ 🙋' : 'הצעת טרמפ 🚗'}
          </h1>
          <div className="w-9" />
        </div>

        <form onSubmit={submitForm} className="px-5 -mt-8 relative z-20 max-w-md mx-auto w-full space-y-4">
          {/* Contact info */}
          <div className="fade-up-item bg-white p-6 rounded-[1.5rem] shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-700 text-sm border-b border-slate-50 pb-2">פרטי התקשרות</h3>
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1 block">שם מלא</label>
              <input
                type="text" required value={formData.guest_name}
                onChange={e => setFormData({ ...formData, guest_name: e.target.value })}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[1.2rem] outline-none font-bold focus:ring-2 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1 block">טלפון לתיאום</label>
              <input
                type="tel" required placeholder="050-0000000" dir="ltr"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-[1.2rem] outline-none font-bold text-left focus:ring-2 transition-all"
              />
            </div>
          </div>

          {/* Direction */}
          <div className="fade-up-item bg-white p-6 rounded-[1.5rem] shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-slate-100 space-y-3">
            <h3 className="font-bold text-slate-700 text-sm border-b border-slate-50 pb-2">כיוון נסיעה</h3>
            {[
              { value: 'there', label: isSeeker ? 'צריך/ה טרמפ רק הלוך' : 'נוסע/ת רק הלוך', icon: '→' },
              { value: 'back', label: isSeeker ? 'צריך/ה טרמפ רק חזור' : 'נוסע/ת רק חזור', icon: '←' },
              { value: 'both', label: isSeeker ? 'הלוך וגם חזור' : 'שני הכיוונים', icon: '↔' },
            ].map(opt => (
              <label
                key={opt.value}
                className={`border-2 p-4 rounded-[1.2rem] cursor-pointer transition-all flex items-center gap-3 ${
                  formData.direction === opt.value ? 'shadow-md' : 'border-slate-100 hover:bg-slate-50'
                }`}
                style={formData.direction === opt.value
                  ? { borderColor: primaryColor, backgroundColor: primaryColor, color: primaryTextColor }
                  : { color: '#475569' }
                }
              >
                <input
                  type="radio" name="dir" value={opt.value} className="hidden" required
                  onChange={() => setFormData({ ...formData, direction: opt.value, from_location: opt.value === 'back' ? '' : formData.from_location, to_location: opt.value === 'there' ? '' : formData.to_location })}
                />
                <span className="text-base font-mono">{opt.icon}</span>
                <span className="font-bold text-sm">{opt.label}</span>
              </label>
            ))}
          </div>

          {/* Locations */}
          {formData.direction && (
            <div className="fade-up-item bg-white p-6 rounded-[1.5rem] shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-slate-100 space-y-4 animate-in slide-in-from-top-2">
              <h3 className="font-bold text-slate-700 text-sm border-b border-slate-50 pb-2">מאיפה / לאיפה?</h3>
              {['there', 'both'].includes(formData.direction) && (
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-1 block">מאיפה בהלוך?</label>
                  <div className="relative">
                    <MapPin className="absolute right-4 top-4 text-slate-300" size={18} />
                    <input
                      type="text" required value={formData.from_location}
                      onChange={e => setFormData({ ...formData, from_location: e.target.value })}
                      placeholder="עיר, שכונה או צומת"
                      className="w-full p-4 pr-11 bg-slate-50 border border-slate-100 rounded-[1.2rem] outline-none font-bold focus:ring-2 transition-all"
                    />
                  </div>
                </div>
              )}
              {['back', 'both'].includes(formData.direction) && (
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-1 block">לאן בחזור?</label>
                  <div className="relative">
                    <MapPin className="absolute right-4 top-4 text-slate-300" size={18} />
                    <input
                      type="text" required value={formData.to_location}
                      onChange={e => setFormData({ ...formData, to_location: e.target.value })}
                      placeholder="עיר, שכונה או צומת"
                      className="w-full p-4 pr-11 bg-slate-50 border border-slate-100 rounded-[1.2rem] outline-none font-bold focus:ring-2 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full font-black py-5 rounded-[1.5rem] shadow-xl flex justify-center items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 mt-4 mb-8"
            style={{ backgroundColor: primaryColor, color: primaryTextColor }}
          >
            {isSubmitting
              ? <><Loader2 className="animate-spin" size={20} /> מפרסם...</>
              : 'שגר מודעה ובדוק התאמות'
            }
          </button>
        </form>
      </div>
    );
  }

  // ---- Match ----
  if (step === 'match') {
    return (
      <div
        className="min-h-screen p-6 flex flex-col font-sans"
        style={{ backgroundColor: primaryColor, color: primaryTextColor }}
        dir="rtl"
      >
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full text-center">
          <div className="inline-flex items-center justify-center p-5 rounded-full mx-auto mb-5 bg-white/20 border border-white/30 animate-pulse">
            <Sparkles size={44} />
          </div>
          <h2 className="text-4xl font-black mb-2">יש התאמה!</h2>
          <p className="font-medium mb-8 opacity-80">מצאנו אנשים שכבר פרסמו מודעה לאותו אזור:</p>

          <div className="space-y-4 text-right mb-8">
            {matches.map(match => <RideCard key={match.id} ride={match} />)}
          </div>
        </div>

        <button
          onClick={() => { setBoardTab(formData.role === 'driver' ? 'seeker' : 'driver'); setStep('board'); }}
          className="w-full bg-black/20 hover:bg-black/30 font-bold py-5 rounded-[1.5rem] transition-colors"
        >
          המשך ללוח הטרמפים המלא
        </button>
      </div>
    );
  }

  // ---- Board ----
  return (
    <div className="min-h-screen font-sans transition-colors duration-1000 pb-12" style={{ backgroundColor: bgColor }} dir="rtl">
      <div
        className="rounded-b-[3rem] pt-10 pb-16 px-6 relative z-10 shadow-lg flex justify-between items-center"
        style={{ backgroundColor: primaryColor }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
          style={{ color: primaryTextColor }}
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-black" style={{ color: primaryTextColor }}>הלוח המרכזי</h1>
        <button
          onClick={() => setStep('welcome')}
          className="text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
          style={{ backgroundColor: primaryTextColor, color: primaryColor }}
        >
          + מודעה
        </button>
      </div>

      <div className="px-5 -mt-8 relative z-20 max-w-md mx-auto">
        {/* Tabs */}
        <div className="flex bg-white p-1.5 rounded-[1.2rem] mb-5 shadow-sm border border-slate-100">
          {[
            { key: 'driver', label: 'מציעים טרמפ 🚗' },
            { key: 'seeker', label: 'מחפשים טרמפ 🙋' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setBoardTab(tab.key)}
              className={`flex-1 py-3 font-bold text-sm rounded-[1rem] transition-all ${
                boardTab === tab.key ? 'shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
              style={boardTab === tab.key ? { backgroundColor: primaryColor, color: primaryTextColor } : {}}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rides list */}
        <div className="space-y-4">
          {rides.filter(r => r.role === boardTab).length === 0 ? (
            <div className="fade-up-item text-center py-14 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
              <AlertCircle size={36} className="mx-auto mb-4 text-slate-200" />
              <h3 className="text-base font-bold text-slate-600 mb-1">הלוח עדיין ריק</h3>
              <p className="text-slate-400 text-sm">
                {boardTab === 'driver' ? 'היו הראשונים להציע טרמפ!' : 'היו הראשונים לחפש טרמפ!'}
              </p>
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
