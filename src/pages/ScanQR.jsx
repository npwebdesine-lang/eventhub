import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { QrCode, Sparkles, Keyboard, Loader2, PartyPopper } from 'lucide-react';
import { supabase } from '../lib/supabase';
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

const ScanQR = () => {
  const navigate = useNavigate();
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successEvent, setSuccessEvent] = useState(null);

  useEffect(() => {
    if (successEvent) {
      const tl = gsap.timeline({
        onComplete: () => {
          navigate(`/${successEvent.route}/${successEvent.id}`);
        }
      });
      tl.fromTo(".welcome-overlay", { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" })
        .fromTo(".welcome-text", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.15, ease: "back.out(1.2)" })
        .to({}, { duration: 1.5 }); 
    }
  }, [successEvent, navigate]);

  const handleScan = (result) => {
    if (result && !processing) {
      setProcessing(true);
      const scannedText = result[0].rawValue;
      processEventLink(scannedText);
    }
  };

  const processEventLink = async (text) => {
    try {
      let eventId = null;
      let targetRoute = 'event';

      if (text.includes('/event/')) {
        eventId = text.split('/event/')[1].split('?')[0];
      } else if (text.includes('/invite/')) {
        eventId = text.split('/invite/')[1].split('?')[0];
        targetRoute = 'invite';
      } else if (text.length > 20) {
        eventId = text;
      }

      let query = supabase.from('events').select('id, name, design_config');
      if (eventId) {
        query = query.eq('id', eventId);
      } else {
        query = query.eq('short_code', text.trim().toUpperCase());
      }

      const { data, error } = await query.single();

      if (data && !error) {
        setSuccessEvent({ id: data.id, name: data.name, route: targetRoute, colors: data.design_config?.colors || { primary: '#3b82f6' } });
      } else {
        alert('הקוד שגוי או שהאירוע לא קיים. נסו שוב.');
        setProcessing(false);
      }
    } catch (error) {
      alert('שגיאה בפענוח הברקוד.');
      setProcessing(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      setProcessing(true);
      processEventLink(manualCode.trim());
    }
  };

  if (successEvent) {
    const primaryColor = successEvent.colors.primary;
    const isLightPrimary = getLuminance(primaryColor) > 150;
    const textColor = isLightPrimary ? 'text-slate-900' : 'text-white';
    const subTextColor = isLightPrimary ? 'text-slate-700' : 'text-white/80';

    return (
      <div className="welcome-overlay min-h-screen flex flex-col items-center justify-center p-6 text-center z-50 fixed inset-0 transition-colors duration-500" style={{ backgroundColor: primaryColor }} dir="rtl">
        <div className="w-24 h-24 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl welcome-text bg-white/20 border border-white/30 backdrop-blur-md">
          <PartyPopper size={48} className={textColor} />
        </div>
        <p className={`welcome-text ${subTextColor} font-bold tracking-widest uppercase text-sm mb-3`}>ברוכים הבאים לאירוע של</p>
        <h1 className={`welcome-text text-5xl md:text-6xl font-black ${textColor} mb-12 leading-tight drop-shadow-md`}>{successEvent.name}</h1>
        <Loader2 className={`welcome-text animate-spin ${subTextColor} opacity-60`} size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans" dir="rtl">
      <div className="rounded-b-[3rem] pt-16 pb-12 px-6 relative z-10 shadow-2xl text-center bg-slate-900 border-b border-white/5">
        <div className="inline-flex items-center justify-center p-5 bg-blue-500/20 rounded-[1.5rem] mb-6 shadow-inner border border-blue-500/30">
          <QrCode size={40} className="text-blue-400" />
        </div>
        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Eventick</h1>
        <p className="text-slate-400 font-medium flex items-center justify-center gap-2 text-sm">
          היכנסו לאירוע שלכם <Sparkles size={16} className="text-yellow-400" />
        </p>
      </div>

      <div className="px-6 -mt-6 relative z-20 w-full max-w-sm mx-auto flex-1 flex flex-col">
        <div className="bg-white p-2 rounded-[2.5rem] shadow-[0_15px_40px_rgb(0,0,0,0.2)] mb-8 flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
          {manualMode ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-[1.2rem] flex items-center justify-center mx-auto mb-6">
                <Keyboard size={28} className="text-slate-600" />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-2">הזנת קוד אירוע</h2>
              <p className="text-slate-500 text-sm font-medium mb-6">הקלידו את הקוד המזהה שקיבלתם מבעלי השמחה.</p>
              <form onSubmit={handleManualSubmit}>
                <input type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} placeholder="לדוגמה: 123456" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[1.2rem] outline-none font-mono text-center text-xl font-black tracking-widest mb-4 focus:ring-2 focus:ring-blue-500 transition-all" dir="ltr" />
                <button type="submit" disabled={processing || !manualCode.trim()} className="w-full bg-blue-600 text-white font-black py-4 rounded-[1.2rem] shadow-lg hover:scale-[1.02] transition-transform active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50">
                  {processing ? <Loader2 className="animate-spin" size={20} /> : 'היכנס לאירוע'}
                </button>
              </form>
            </div>
          ) : (
            <div className="relative rounded-[2rem] overflow-hidden aspect-[4/5] bg-slate-900 border-4 border-slate-50">
              {processing ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm z-50">
                  <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                  <p className="text-white font-bold">מעבד נתונים...</p>
                </div>
              ) : (
                <Scanner onResult={handleScan} onError={(error) => console.log(error?.message)} options={{ delayBetweenScanAttempts: 1000 }} styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }} />
              )}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="w-full h-full border-2 border-white/40 rounded-3xl relative">
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-3xl"></div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-3xl"></div>
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-3xl"></div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-3xl"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button onClick={() => setManualMode(!manualMode)} className="mt-auto mb-10 w-full py-4 text-white/60 hover:text-white font-bold flex justify-center items-center gap-2 transition-colors">
          {manualMode ? <><QrCode size={18} /> חזרה לסורק המצלמה</> : <><Keyboard size={18} /> לא מצליחים לסרוק? הזינו קוד ידנית</>}
        </button>
      </div>
    </div>
  );
};

export default ScanQR;