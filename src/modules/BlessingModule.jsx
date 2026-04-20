import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import gsap from "gsap";
import {
  Send,
  Image as ImageIcon,
  X,
  Loader2,
  CheckCircle2,
  MessageCircle,
  User,
  ChevronRight,
  UploadCloud,
  AlertCircle,
} from "lucide-react";

const BlessingModule = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event");

  const [eventData, setEventData] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  const fileInputRef = useRef(null);
  const headerRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    const savedName = localStorage.getItem("guest_name");
    if (savedName) setGuestName(savedName);

    if (!eventId) return;
    const fetchEvent = async () => {
      try {
        const { data, error } = await supabase
          .from("events")
          .select("name, design_config")
          .eq("id", eventId)
          .single();
        if (error) throw error;
        setEventData(data);
      } catch (error) {
        console.error("Error fetching event:", error);
      } finally {
        setLoadingEvent(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!guestName.trim() || !message.trim() || !eventId) return;

    setIsSubmitting(true);
    setStatus(null);

    try {
      let imageUrl = null;

      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${eventId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("blessings-uploads")
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("blessings-uploads")
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      }

      const { error: dbError } = await supabase.from("blessings").insert([
        {
          event_id: eventId,
          guest_name: guestName.trim(),
          message: message.trim(),
          image_url: imageUrl,
        },
      ]);

      if (dbError) throw dbError;

      setStatus("success");
      setMessage("");
      removeImage();
    } catch (error) {
      console.error("Error submitting blessing:", error);
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // GSAP entry animations once event data loads
  useEffect(() => {
    if (loadingEvent || !eventData) return;
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current,
        { y: -30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
      );
    }
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, delay: 0.25, ease: "back.out(1.2)" },
      );
    }
  }, [loadingEvent, eventData]);

  if (loadingEvent) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center"
        dir="rtl"
      >
        <div className="relative">
          <Loader2 className="animate-spin text-slate-400 mb-6" size={56} />
          <div className="absolute inset-0 rounded-full animate-pulse opacity-20 bg-slate-400" style={{ width: '72px', height: '72px', left: '-8px', top: '-8px' }} />
        </div>
      </div>
    );
  }

  const primaryColor = eventData?.design_config?.colors?.primary || "#8b5cf6";
  const bgColor = eventData?.design_config?.colors?.background || "#f8fafc";

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-1000 font-sans pb-16"
      style={{ backgroundColor: bgColor }}
      dir="rtl"
    >
      {/* Header עם gradient ואנימציות */}
      <div
        ref={headerRef}
        className="rounded-b-[3.5rem] pt-16 pb-24 px-6 relative z-10 shadow-deep text-center transition-colors duration-1000 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
          boxShadow: `0 20px 50px ${primaryColor}30`
        }}
      >
        {/* Decorative floating elements */}
        <div className="absolute top-10 right-12 w-24 h-24 rounded-full opacity-10 bg-white float-effect" />
        <div className="absolute bottom-8 left-8 w-32 h-32 rounded-full opacity-10 bg-white float-delayed" />

        {/* כפתור חזרה */}
        <button
          onClick={() => navigate(`/event/${eventId}`)}
          className="absolute top-8 right-6 p-3 rounded-full bg-white/20 hover:bg-white/30 transition-all backdrop-blur-md button-pulse text-white"
          aria-label="חזרה לאירוע"
        >
          <ChevronRight size={24} className="mr-0.5" />
        </button>

        <div className="relative z-10 flex items-center justify-center gap-3">
          <MessageCircle size={28} className="text-white" />
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight drop-shadow-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              ספר ברכות
            </h1>
            <p className="text-white/70 font-bold text-xs uppercase tracking-widest mt-1">
              כתבו ברכה לבעלי השמחה
            </p>
          </div>
        </div>
      </div>

      {/* Blessing form card */}
      <div className="px-5 -mt-12 relative z-20 w-full max-w-md mx-auto flex-1 flex flex-col gap-6">
        <div
          ref={cardRef}
          className="glass-card rounded-[2.5rem] p-8 shadow-deep text-center"
          style={{ animation: 'bounce-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {status === "success" ? (
            <div className="py-8 animate-in zoom-in" style={{ animation: 'bounce-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-elevated"
                style={{
                  backgroundColor: `${primaryColor}18`,
                  boxShadow: `0 10px 30px ${primaryColor}25`
                }}
              >
                <CheckCircle2 size={48} style={{ color: primaryColor }} />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                הברכה נשלחה! ✨
              </h3>
              <p className="text-slate-600 font-medium text-sm mb-8 px-4 leading-relaxed">
                המילים המרגשות שלך צורפו לספר הברכות של {eventData?.name}.
              </p>

              <button
                onClick={() => setStatus(null)}
                className="w-full py-4 mb-3 glass-card hover:bg-slate-100 text-slate-700 font-bold rounded-[1.3rem] transition-all border-2 border-slate-200 shadow-elevated"
              >
                כתבו ברכה נוספת
              </button>
              <button
                onClick={() => navigate(`/event/${eventId}`)}
                className="w-full py-4 text-white font-black rounded-[1.3rem] shadow-elevated transition-all active:scale-95 button-pulse"
                style={{
                  backgroundColor: primaryColor,
                  boxShadow: `0 10px 30px ${primaryColor}40`
                }}
              >
                חזרה לאירוע
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                  כתבו משהו מהלב
                </h2>
                <p className="text-slate-600 text-sm font-medium mt-2">
                  הברכה והתמונה יצורפו לאלבום הדיגיטלי של האירוע
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 text-right">
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <User size={18} style={{ color: primaryColor, opacity: 0.7 }} />
                  </div>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full p-4 pr-12 bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-[1.3rem] outline-none font-bold text-slate-800 placeholder:text-slate-400 transition-smooth focus:bg-white"
                    style={{ "--tw-ring-color": primaryColor, borderColor: `${primaryColor}30` }}
                    placeholder="איך תרצו להופיע באלבום?"
                  />
                </div>

                <div className="relative">
                  <textarea
                    required
                    rows="5"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-4 bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-[1.3rem] outline-none font-medium text-slate-800 placeholder:text-slate-400 transition-smooth focus:bg-white resize-none"
                    style={{ "--tw-ring-color": primaryColor, borderColor: `${primaryColor}30` }}
                    placeholder="כתבו כאן את הברכה שלכם..."
                  />
                </div>

                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    ref={fileInputRef}
                    className="hidden"
                  />

                  {!imagePreview ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-8 border-2 border-dashed rounded-[1.5rem] flex flex-col items-center justify-center gap-3 transition-all group"
                      style={{
                        borderColor: `${primaryColor}40`,
                        backgroundColor: `${primaryColor}08`
                      }}
                    >
                      <div className="bg-white p-4 rounded-full shadow-elevated group-hover:scale-125 transition-transform" style={{ boxShadow: `0 8px 20px ${primaryColor}25` }}>
                        <UploadCloud
                          size={28}
                          style={{ color: primaryColor }}
                        />
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-bold block text-slate-800">
                          צרפו תמונת סלפי
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          (רשות, אבל מוסיף המון! 📸)
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="relative rounded-[1.5rem] overflow-hidden border-2 h-56 group shadow-elevated glass-card">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button
                          type="button"
                          onClick={removeImage}
                          className="bg-white text-rose-500 p-4 rounded-full shadow-elevated transform hover:scale-110 transition-all button-pulse"
                        >
                          <X size={24} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {status === "error" && (
                  <div className="text-rose-600 text-sm text-center font-bold bg-rose-50 py-4 rounded-[1.2rem] border-2 border-rose-200 shadow-elevated flex items-center justify-center gap-2">
                    <AlertCircle size={18} />
                    אופס, משהו השתבש בשליחה. אנא נסו שוב.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isSubmitting || !guestName.trim() || !message.trim()
                  }
                  className={`w-full flex items-center justify-center gap-2 py-4 mt-6 rounded-[1.3rem] font-black text-lg transition-all button-pulse ${
                    isSubmitting || !guestName.trim() || !message.trim()
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "text-white shadow-elevated active:scale-[0.97]"
                  }`}
                  style={{
                    backgroundColor:
                      isSubmitting || !guestName.trim() || !message.trim()
                        ? undefined
                        : primaryColor,
                    boxShadow: isSubmitting || !guestName.trim() || !message.trim()
                      ? undefined
                      : `0 10px 30px ${primaryColor}40`
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      שולח ברכה...
                    </>
                  ) : (
                    <>
                      <Send size={22} className="ml-1" />
                      שלח ברכה
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlessingModule;
