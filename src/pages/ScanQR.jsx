import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import { QrCode, Sparkles, Keyboard, Loader2, PartyPopper } from "lucide-react";
import { supabase } from "../lib/supabase";
import gsap from "gsap";
import { buttonPalette } from "../lib/colors";
import { CLAY_INK_BUTTON, DEFAULT_PRIMARY } from "../lib/clay";
import { useToast } from "../components/Toast";

const ScanQR = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [successEvent, setSuccessEvent] = useState(null);

  useEffect(() => {
    if (successEvent) {
      const tl = gsap.timeline({
        onComplete: () => {
          navigate(`/${successEvent.route}/${successEvent.id}`);
        },
      });
      tl.fromTo(
        ".welcome-overlay",
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" },
      )
        .fromTo(
          ".welcome-text",
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.15,
            ease: "back.out(1.2)",
          },
        )
        .to({}, { duration: 1.5 });
    }
  }, [successEvent, navigate]);

  const handleScan = (result) => {
    if (result && !processing) {
      setProcessing(true);

      // תמיכה רחבה במבני נתונים שונים (מערך, אובייקט או מחרוזת)
      const scannedText = Array.isArray(result)
        ? result[0]?.rawValue
        : result?.rawValue || result?.text || result;

      if (typeof scannedText !== "string" || !scannedText.trim()) {
        setProcessing(false);
        return;
      }
      processEventLink(scannedText.trim());
    }
  };

  const processEventLink = async (text) => {
    try {
      let eventId = null;
      let targetRoute = "event";

      if (text.includes("/event/")) {
        eventId = text.split("/event/")[1].split(/[?/#]/)[0];
      } else if (text.includes("/invite/")) {
        eventId = text.split("/invite/")[1].split(/[?/#]/)[0];
        targetRoute = "invite";
      } else if (text.length > 20) {
        eventId = text;
      }

      let query = supabase.from("events").select("id, name, design_config");
      if (eventId) {
        query = query.eq("id", eventId);
      } else {
        query = query.eq("short_code", text.trim().toUpperCase());
      }

      const { data, error } = await query.single();

      if (data && !error) {
        setSuccessEvent({
          id: data.id,
          name: data.name,
          route: targetRoute,
          colors: data.design_config?.colors || { primary: DEFAULT_PRIMARY },
        });
      } else {
        showToast("הקוד שגוי או שהאירוע לא קיים. נסו שוב.", "error");
        setProcessing(false);
      }
    } catch (error) {
      showToast("שגיאה בפענוח הנתונים. נסו שוב.", "error");
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
    // רקע וטקסט שעוברים 4.5:1 — גם כשצבע האירוע בהיר או בגוון ביניים.
    const { background, text } = buttonPalette(primaryColor);

    return (
      <div
        className="welcome-overlay min-h-screen flex flex-col items-center justify-center p-6 text-center z-50 fixed inset-0 transition-colors duration-500"
        style={{ backgroundColor: background, color: text }}
        dir="rtl"
      >
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8 welcome-text bg-white/20 shadow-[inset_2px_2px_5px_rgba(255,255,255,0.35),inset_-2px_-2px_5px_rgba(0,0,0,0.12),6px_6px_16px_rgba(0,0,0,0.2)]">
          <PartyPopper size={48} />
        </div>
        <p
          className="welcome-text font-bold tracking-widest uppercase text-sm mb-3"
        >
          ברוכים הבאים לאירוע של
        </p>
        <h1
          className="welcome-text text-5xl md:text-6xl font-black mb-12 leading-tight drop-shadow-md"
        >
          {successEvent.name}
        </h1>
        <Loader2
          className="welcome-text animate-spin opacity-60"
          size={40}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans bg-clay-gradient"
      dir="rtl"
    >
      <div className="pt-[calc(4rem+env(safe-area-inset-top))] pb-12 px-6 relative z-10 text-center">
        <div className="inline-flex items-center justify-center p-5 rounded-full mb-6 bg-clay-well shadow-clay-inset-deep">
          <QrCode size={40} className="text-clay-primary" />
        </div>
        <h1 className="text-4xl font-black text-slate-700 mb-2 tracking-tight">
          Eventick
        </h1>
        <p className="text-clay-muted font-medium flex items-center justify-center gap-2 text-sm">
          היכנסו לאירוע שלכם <Sparkles size={16} className="text-amber-400" />
        </p>
      </div>

      <div className="px-6 relative z-20 w-full max-w-sm mx-auto flex-1 flex flex-col">
        <div className="bg-clay-surface p-2 rounded-clay-lg shadow-clay mb-8 flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
          {manualMode ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-clay-well shadow-clay-inset-deep">
                <Keyboard size={28} className="text-slate-600" />
              </div>
              <h2 className="text-xl font-black text-slate-700 mb-2">
                הזנת קוד אירוע
              </h2>
              <p className="text-clay-muted text-sm font-medium mb-6">
                הקלידו את הקוד המזהה שקיבלתם מבעלי השמחה.
              </p>
              <form onSubmit={handleManualSubmit}>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="לדוגמה: 123456"
                  className="w-full p-4 rounded-clay-field outline-none font-mono text-center text-xl font-black tracking-widest mb-4 text-slate-700 placeholder:text-clay-muted bg-clay-well shadow-clay-inset focus:shadow-clay-inset-deep transition-all"
                  dir="ltr"
                />
                <button
                  type="submit"
                  disabled={processing || !manualCode.trim()}
                  className={`w-full font-black py-4 rounded-full active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50 ${CLAY_INK_BUTTON}`}
                >
                  {processing ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    "היכנס לאירוע"
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="relative rounded-[2rem] overflow-hidden aspect-[4/5] bg-slate-900 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.4)]">
              {processing ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-50">
                  <Loader2
                    className="animate-spin text-clay-primary mb-4"
                    size={48}
                  />
                  <p className="text-white font-bold">מעבד נתונים...</p>
                </div>
              ) : (
                <Scanner
                  onScan={handleScan}
                  onError={(error) => console.log(error?.message)}
                  options={{ delayBetweenScanAttempts: 1000 }}
                  styles={{
                    container: { width: "100%", height: "100%" },
                    video: { objectFit: "cover" },
                  }}
                />
              )}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="w-full h-full border-2 border-white/20 rounded-[2rem] relative shadow-[inset_0_0_50px_rgba(0,0,0,0.3)]">
                  <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-[#b6c6ae] rounded-tl-[2rem]"></div>
                  <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-[#b6c6ae] rounded-tr-[2rem]"></div>
                  <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-[#b6c6ae] rounded-bl-[2rem]"></div>
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-[#b6c6ae] rounded-br-[2rem]"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setManualMode(!manualMode)}
          className="mt-auto mb-[calc(2.5rem+env(safe-area-inset-bottom))] w-full py-4 text-clay-muted hover:text-slate-600 font-bold flex justify-center items-center gap-2 transition-colors"
        >
          {manualMode ? (
            <>
              <QrCode size={18} /> חזרה לסורק המצלמה
            </>
          ) : (
            <>
              <Keyboard size={18} /> לא מצליחים לסרוק? הזינו קוד ידנית
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ScanQR;
