import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import gsap from "gsap";
import { sanitize } from "../utils/sanitize";
import { compressImage, isAllowedImageType } from "../lib/imageUtils";
import { useToast } from "../components/Toast";
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

/* ============================================================
   SOFT-CLAY / NEUMORPHISM DESIGN TOKENS  (shared across modules)
   ------------------------------------------------------------ */
const CLAY_BG = "#eceadf";
const CLAY_PAGE_BG =
  "linear-gradient(160deg, #eceadf 0%, #e2ddd0 100%)";
const clayBtn = (color) => ({
  backgroundColor: color,
  boxShadow: `5px 5px 14px rgba(0,0,0,0.14), -4px -4px 12px rgba(255,255,255,0.7), inset 2px 2px 4px rgba(255,255,255,0.35), inset -2px -2px 4px rgba(0,0,0,0.12)`,
});
// Debossed field (input / textarea) carved into the clay surface
const clayFieldCls =
  "w-full p-4 rounded-[1.4rem] outline-none font-bold text-slate-700 placeholder:text-slate-400 bg-[#eeece5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.07),inset_-4px_-4px_9px_rgba(255,255,255,0.85)] focus:shadow-[inset_5px_5px_11px_rgba(0,0,0,0.09),inset_-5px_-5px_11px_rgba(255,255,255,0.9)] transition-all";

const BlessingModule = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
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

  // Revoke the object URL when the preview changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedImageType(file)) {
      showToast("יש להעלות קובץ תמונה בלבד (JPG, PNG, WEBP)", "error");
      e.target.value = "";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast("הקובץ גדול מדי (מקסימום 15MB)", "error");
      e.target.value = "";
      return;
    }
    setImageFile(file);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
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
        const compressed = await compressImage(imageFile, {
          maxWidth: 1600,
          quality: 0.82,
        });
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        const filePath = `${eventId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("blessings-uploads")
          .upload(filePath, compressed, { contentType: "image/jpeg" });

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
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: CLAY_PAGE_BG }}
        dir="rtl"
      >
        <Loader2 className="animate-spin text-slate-400" size={56} />
      </div>
    );
  }

  const primaryColor = eventData?.design_config?.colors?.primary || "#8b5cf6";

  return (
    <div
      className="min-h-screen flex flex-col font-sans pb-16"
      style={{ background: CLAY_PAGE_BG }}
      dir="rtl"
    >
      {/* Header — clay surface */}
      <div
        ref={headerRef}
        className="pt-14 pb-6 px-6 relative z-10 max-w-md mx-auto w-full"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
              style={clayBtn(primaryColor)}
            >
              <MessageCircle size={24} />
            </div>
            <div>
              <h1
                className="text-3xl font-black text-slate-700 leading-tight"
                style={{ fontFamily: "'Assistant', sans-serif" }}
              >
                ספר ברכות
              </h1>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-0.5">
                כתבו ברכה לבעלי השמחה
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/event/${eventId}`)}
            className="shrink-0 p-3 rounded-full text-slate-500 bg-[#f0eee7] shadow-[5px_5px_12px_rgba(0,0,0,0.09),-5px_-5px_12px_rgba(255,255,255,0.9)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)] transition-all"
            aria-label="חזרה לאירוע"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* Blessing form card */}
      <div className="px-5 relative z-20 w-full max-w-md mx-auto flex-1 flex flex-col gap-6">
        <div
          ref={cardRef}
          className="rounded-[2.5rem] p-8 text-center bg-[#f0eee7] shadow-[12px_12px_30px_rgba(0,0,0,0.1),-12px_-12px_30px_rgba(255,255,255,0.9)]"
          style={{
            animation: "bounce-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {status === "success" ? (
            <div
              className="py-8"
              style={{
                animation: "bounce-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-[#f0eee7] shadow-[inset_5px_5px_11px_rgba(0,0,0,0.1),inset_-5px_-5px_11px_rgba(255,255,255,0.85)]"
              >
                <CheckCircle2 size={48} style={{ color: primaryColor }} />
              </div>
              <h3
                className="text-3xl font-black text-slate-700 mb-3"
                style={{ fontFamily: "'Assistant', sans-serif" }}
              >
                הברכה נשלחה! ✨
              </h3>
              <p className="text-slate-600 font-medium text-sm mb-8 px-4 leading-relaxed">
                המילים המרגשות שלך צורפו לספר הברכות של{" "}
                {sanitize(eventData?.name || "")}.
              </p>

              <button
                onClick={() => setStatus(null)}
                className="w-full py-4 mb-3 text-slate-600 font-bold rounded-full transition-all active:scale-[0.98] bg-[#f0eee7] shadow-[6px_6px_14px_rgba(0,0,0,0.09),-6px_-6px_14px_rgba(255,255,255,0.9)] active:shadow-[inset_4px_4px_9px_rgba(0,0,0,0.1),inset_-4px_-4px_9px_rgba(255,255,255,0.8)]"
              >
                כתבו ברכה נוספת
              </button>
              <button
                onClick={() => navigate(`/event/${eventId}`)}
                className="w-full py-4 text-white font-black rounded-full transition-all active:scale-95"
                style={clayBtn(primaryColor)}
              >
                חזרה לאירוע
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2
                  className="text-2xl font-black text-slate-700"
                  style={{ fontFamily: "'Assistant', sans-serif" }}
                >
                  כתבו משהו מהלב
                </h2>
                <p className="text-slate-500 text-sm font-medium mt-2">
                  הברכה והתמונה יצורפו לאלבום הדיגיטלי של האירוע
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 text-right">
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none z-10">
                    <User size={18} style={{ color: primaryColor, opacity: 0.7 }} />
                  </div>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className={`${clayFieldCls} pr-12`}
                    placeholder="איך תרצו להופיע באלבום?"
                  />
                </div>

                <div className="relative">
                  <textarea
                    required
                    rows="5"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={`${clayFieldCls} resize-none font-medium`}
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
                      className="w-full py-8 rounded-[1.6rem] flex flex-col items-center justify-center gap-3 transition-all group bg-[#eeece5] shadow-[inset_5px_5px_10px_rgba(0,0,0,0.07),inset_-5px_-5px_10px_rgba(255,255,255,0.85)]"
                    >
                      <div
                        className="p-4 rounded-full group-hover:scale-110 transition-transform text-white"
                        style={clayBtn(primaryColor)}
                      >
                        <UploadCloud size={28} />
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-bold block text-slate-700">
                          צרפו תמונת סלפי
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          (רשות, אבל מוסיף המון! 📸)
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="relative rounded-[1.6rem] overflow-hidden h-56 group p-2 bg-[#f0eee7] shadow-[6px_6px_16px_rgba(0,0,0,0.1),-5px_-5px_14px_rgba(255,255,255,0.9)]">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-[1.2rem] hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-2 rounded-[1.2rem] bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={removeImage}
                          className="bg-[#f0eee7] text-rose-500 p-4 rounded-full transform hover:scale-110 transition-all shadow-[5px_5px_12px_rgba(0,0,0,0.2)]"
                        >
                          <X size={24} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {status === "error" && (
                  <div className="text-rose-600 text-sm text-center font-bold py-4 rounded-[1.2rem] flex items-center justify-center gap-2 bg-[#f0eee7] shadow-[inset_3px_3px_7px_rgba(0,0,0,0.07),inset_-3px_-3px_7px_rgba(255,255,255,0.8)]">
                    <AlertCircle size={18} />
                    אופס, משהו השתבש בשליחה. אנא נסו שוב.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !guestName.trim() || !message.trim()}
                  className="w-full flex items-center justify-center gap-2 py-4 mt-6 rounded-full font-black text-lg transition-all active:scale-[0.97] disabled:cursor-not-allowed"
                  style={
                    isSubmitting || !guestName.trim() || !message.trim()
                      ? {
                          color: "#a8a294",
                          backgroundColor: "#eeece5",
                          boxShadow:
                            "inset 4px 4px 9px rgba(0,0,0,0.07), inset -4px -4px 9px rgba(255,255,255,0.85)",
                        }
                      : { ...clayBtn(primaryColor), color: "#fff" }
                  }
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
