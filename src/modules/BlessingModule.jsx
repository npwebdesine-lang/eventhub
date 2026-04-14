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
        className="min-h-screen flex flex-col items-center justify-center bg-slate-50"
        dir="rtl"
      >
        <Loader2 className="animate-spin text-slate-400 mb-4" size={48} />
      </div>
    );
  }

  const primaryColor = eventData?.design_config?.colors?.primary || "#8b5cf6";
  const bgColor = eventData?.design_config?.colors?.background || "#f8fafc";

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-1000 font-sans pb-12"
      style={{ backgroundColor: bgColor }}
      dir="rtl"
    >
      {/* Header */}
      <div
        ref={headerRef}
        className="rounded-b-[2.5rem] pt-8 pb-20 px-6 relative z-10 shadow-md text-center transition-colors duration-1000"
        style={{ backgroundColor: primaryColor }}
      >
        {/* כפתור חזרה תואם */}
        <button
          onClick={() => navigate(`/event/${eventId}`)}
          className="absolute top-6 right-6 w-10 h-10 bg-black/20 hover:bg-black/30 rounded-full flex items-center justify-center text-white transition-colors"
          aria-label="חזרה לאירוע"
        >
          <ChevronRight size={22} className="mr-0.5" />
        </button>

        <div className="mt-2 flex items-center justify-center gap-2 text-white font-black text-xl drop-shadow-sm">
          <MessageCircle size={22} />
          ספר ברכות
        </div>
      </div>

      {/* אזור הכרטיסייה ה"רוכבת" על החיבור */}
      <div className="px-5 -mt-12 relative z-20 w-full max-w-md mx-auto flex-1 flex flex-col gap-6">
        <div ref={cardRef} className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-50 text-center">
          {status === "success" ? (
            <div className="py-6">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-4"
                style={{
                  backgroundColor: `${primaryColor}15`,
                  borderColor: `${primaryColor}30`,
                }}
              >
                <CheckCircle2 size={40} style={{ color: primaryColor }} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">
                הברכה נשלחה!
              </h3>
              <p className="text-slate-500 font-medium text-sm mb-8 px-4">
                המילים המרגשות שלך צורפו לספר הברכות של {eventData?.name}.
              </p>

              <button
                onClick={() => setStatus(null)}
                className="w-full py-3.5 mb-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl transition-colors border border-slate-200"
              >
                כתבו ברכה נוספת
              </button>
              <button
                onClick={() => navigate(`/event/${eventId}`)}
                className="w-full py-3.5 text-white font-black rounded-2xl shadow-md transition-transform active:scale-95"
                style={{ backgroundColor: primaryColor }}
              >
                חזרה לאירוע
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-black text-slate-800">
                  כתבו משהו מהלב
                </h2>
                <p className="text-slate-500 text-sm font-medium mt-1">
                  הברכה והתמונה יצורפו לאלבום הדיגיטלי
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-right">
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <User size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full p-3.5 pr-12 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 placeholder:text-slate-400 transition-all focus:ring-2 focus:bg-white"
                    style={{ "--tw-ring-color": primaryColor }}
                    placeholder="איך תרצו להופיע באלבום?"
                  />
                </div>

                <div className="relative">
                  <textarea
                    required
                    rows="4"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium text-slate-800 placeholder:text-slate-400 transition-all focus:ring-2 focus:bg-white resize-none"
                    style={{ "--tw-ring-color": primaryColor }}
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
                      className="w-full py-6 border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-600 transition-all group"
                    >
                      <div className="bg-white p-3 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                        <UploadCloud
                          size={24}
                          style={{ color: primaryColor }}
                        />
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-bold block">
                          צרפו תמונת סלפי
                        </span>
                        <span className="text-xs text-slate-400">
                          (רשות, אבל מוסיף המון!)
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-48 group shadow-sm">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button
                          type="button"
                          onClick={removeImage}
                          className="bg-white text-rose-500 p-3 rounded-full shadow-lg transform hover:scale-105 transition-all"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {status === "error" && (
                  <p className="text-rose-500 text-sm text-center font-bold bg-rose-50 py-3 rounded-xl border border-rose-100">
                    אופס, משהו השתבש בשליחה. אנא נסו שוב.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    isSubmitting || !guestName.trim() || !message.trim()
                  }
                  className={`w-full flex items-center justify-center gap-2 py-4 mt-2 rounded-2xl font-black text-lg transition-all ${
                    isSubmitting || !guestName.trim() || !message.trim()
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "text-white shadow-[0_4px_15px_rgb(0,0,0,0.1)] active:scale-[0.98]"
                  }`}
                  style={{
                    backgroundColor:
                      isSubmitting || !guestName.trim() || !message.trim()
                        ? undefined
                        : primaryColor,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      שולח ברכה...
                    </>
                  ) : (
                    <>
                      <Send size={20} className="ml-1" />
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
