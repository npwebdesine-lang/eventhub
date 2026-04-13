import React, { useState, useRef } from "react";
import { supabase } from "../lib/supabase"; // מוודא שהנתיב תואם לארכיטקטורה שלך
import {
  Send,
  Image as ImageIcon,
  X,
  Loader2,
  CheckCircle2,
  MessageSquare,
  User,
} from "lucide-react";

const Blessing = ({ eventId }) => {
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | null

  const fileInputRef = useRef(null);

  // טיפול בבחירת תמונה (כולל יצירת תצוגה מקדימה)
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  // ביטול בחירת התמונה
  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // פונקציית השליחה ל-Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!guestName.trim() || !message.trim()) return;

    setIsSubmitting(true);
    setStatus(null);

    try {
      let imageUrl = null;

      // 1. העלאת התמונה ל-Storage (אם יש)
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${eventId}/${fileName}`; // תיקייה לכל אירוע

        const { error: uploadError } = await supabase.storage
          .from("blessings-uploads")
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        // קבלת הכתובת הפומבית
        const { data: publicUrlData } = supabase.storage
          .from("blessings-uploads")
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      }

      // 2. שמירת הברכה ב-Database
      const { error: dbError } = await supabase.from("blessings").insert([
        {
          event_id: eventId,
          guest_name: guestName.trim(),
          message: message.trim(),
          image_url: imageUrl,
        },
      ]);

      if (dbError) throw dbError;

      // הצלחה!
      setStatus("success");
      setGuestName("");
      setMessage("");
      removeImage();
    } catch (error) {
      console.error("Error submitting blessing:", error);
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="w-full max-w-md mx-auto p-6 bg-slate-900/60 backdrop-blur-md rounded-[2rem] border border-white/10 shadow-2xl font-sans"
      dir="rtl"
    >
      {status === "success" ? (
        <div className="text-center py-10 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
            <CheckCircle2 size={40} className="text-green-400" />
          </div>
          <h3 className="text-2xl font-black text-white mb-2">
            איזו ברכה מרגשת!
          </h3>
          <p className="text-white/60">
            הברכה שלך נשלחה בהצלחה ותצורף לאלבום של בעלי השמחה.
          </p>
          <button
            onClick={() => setStatus(null)}
            className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full transition-colors"
          >
            שלח ברכה נוספת
          </button>
        </div>
      ) : (
        <>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-white flex items-center justify-center gap-2">
              <MessageSquare className="text-indigo-400" size={24} />
              השאירו ברכה
            </h2>
            <p className="text-white/50 text-sm mt-1">
              המילים שלכם הן המזכרת הכי יפה מהאירוע
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* שדה שם */}
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <User size={18} className="text-white/30" />
              </div>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 text-white rounded-2xl py-3.5 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-white/30"
                placeholder="השם שלכם"
              />
            </div>

            {/* שדה ברכה */}
            <div className="relative">
              <textarea
                required
                rows="4"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 text-white rounded-2xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-white/30 resize-none"
                placeholder="כתבו כאן את הברכה שלכם..."
              />
            </div>

            {/* אזור העלאת תמונה */}
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
                  className="w-full py-4 border-2 border-dashed border-white/10 hover:border-white/30 bg-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 text-white/50 hover:text-white/80 transition-all group"
                >
                  <ImageIcon
                    size={28}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <span className="text-sm font-medium">
                    צרפו תמונת סלפי (רשות)
                  </span>
                </button>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 h-48 group">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={removeImage}
                      className="bg-red-500/80 hover:bg-red-500 text-white p-3 rounded-full backdrop-blur-md transform hover:scale-105 transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* הודעת שגיאה */}
            {status === "error" && (
              <p className="text-red-400 text-sm text-center font-medium bg-red-400/10 py-2 rounded-lg">
                אופס, משהו השתבש. אנא נסו שוב.
              </p>
            )}

            {/* כפתור שליחה */}
            <button
              type="submit"
              disabled={isSubmitting || !guestName.trim() || !message.trim()}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-lg transition-all duration-300 ${
                isSubmitting || !guestName.trim() || !message.trim()
                  ? "bg-slate-800 text-white/30 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] transform hover:-translate-y-1"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  שולח ברכה...
                </>
              ) : (
                <>
                  <Send size={20} />
                  שלח ברכה
                </>
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default Blessing;
