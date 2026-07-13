import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Loader2,
  ChevronLeft,
  Camera,
  Image as ImageIcon,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Heart,
  Sparkles,
  X,
  Download,
  ChevronRight as ChevRight,
  ZoomIn,
} from "lucide-react";
import { getTextColor } from "../lib/colors";
import { compressImage, isAllowedImageType } from "../lib/imageUtils";
import { useToast } from "../components/Toast";
import { useModalBehavior } from "../components/Modal";
import { PhotoGridSkeleton } from "../components/SkeletonCard";
import gsap from "gsap";
import { isValidUUIDv4, getOrCreateDeviceId } from "../utils/deviceId";

const MAX_PHOTOS_PER_GUEST = 3;
const PAGE_SIZE = 12;

/* ============================================================
   SOFT-CLAY / NEUMORPHISM DESIGN TOKENS  (shared with Home.jsx)
   ------------------------------------------------------------ */
const CLAY_BG = "#eceadf";
const CLAY_PAGE_BG =
  "linear-gradient(160deg, #eceadf 0%, #e2ddd0 100%)";
const CLAY =
  "rounded-[2.5rem] bg-[#f0eee7] shadow-[8px_8px_20px_rgba(0,0,0,0.09),-8px_-8px_20px_rgba(255,255,255,0.9)]";
const CLAY_INSET =
  "bg-[#eeece5] shadow-[inset_5px_5px_10px_rgba(0,0,0,0.07),inset_-5px_-5px_10px_rgba(255,255,255,0.85)]";
const clayPrimaryBtn = (primary) => ({
  backgroundColor: primary,
  boxShadow: `5px 5px 14px rgba(0,0,0,0.14), -4px -4px 12px rgba(255,255,255,0.7), inset 2px 2px 4px rgba(255,255,255,0.35), inset -2px -2px 4px rgba(0,0,0,0.12)`,
});

// Relative time helper
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק'`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שע'`;
  return `לפני ${Math.floor(h / 24)} ימים`;
};

const Photos = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const guestName = localStorage.getItem("guest_name") || "";
  const guestId = getOrCreateDeviceId();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [myUploadCount, setMyUploadCount] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Lightbox
  const [lightbox, setLightbox] = useState(null); // index into photos[]

  // Sentinel for infinite scroll
  const sentinelRef = useRef(null);
  // Track upload-progress timeouts so they can be cleared on unmount
  const timeoutsRef = useRef([]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => timeouts.forEach((t) => clearTimeout(t));
  }, []);

  const fetchPage = useCallback(
    async (pageOffset = 0) => {
      if (!eventId) return;
      const { data, error } = await supabase
        .from("photos")
        .select("id, image_url, guest_name, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .range(pageOffset, pageOffset + PAGE_SIZE - 1);

      if (error) {
        console.error(error);
        return;
      }
      const rows = data || [];
      if (rows.length < PAGE_SIZE) setHasMore(false);
      setPhotos((prev) => (pageOffset === 0 ? rows : [...prev, ...rows]));
      offsetRef.current = pageOffset + rows.length;
    },
    [eventId],
  );

  // Initial load
  useEffect(() => {
    if (!eventId) return navigate("/");
    let isMounted = true;
    const init = async () => {
      try {
        const { data: event, error } = await supabase
          .from("events")
          .select("id, name, design_config, active_modules")
          .eq("id", eventId)
          .single();
        if (error) throw error;
        if (isMounted) setEventData(event);

        await fetchPage(0);

        if (guestId && isValidUUIDv4(guestId)) {
          const { count } = await supabase
            .from("photos")
            .select("id", { count: "exact", head: true })
            .eq("event_id", eventId)
            .eq("guest_id", guestId);
          if (isMounted) setMyUploadCount(count || 0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [eventId, fetchPage, guestId, navigate]);

  // Realtime subscription — new photos appear instantly & deleted photos removed
  useEffect(() => {
    if (!eventId) return;
    let isMounted = true;
    const channelId = `photos_feed_${eventId}_${crypto.randomUUID()}`;

    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photos",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (!isMounted || !payload?.new) return;
          if (payload.new.guest_id !== guestId) {
            setPhotos((prev) => [payload.new, ...prev]);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "photos",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (!isMounted || !payload?.old?.id) return;
          setPhotos((prev) => prev.filter((p) => p.id !== payload.old.id));
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [eventId, guestId]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          setLoadingMore(true);
          fetchPage(offsetRef.current).finally(() => setLoadingMore(false));
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, loadingMore]);

  // Entry animations
  useEffect(() => {
    if (!loading && eventData) {
      gsap.fromTo(
        ".fade-up-item",
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "power2.out" },
      );
    }
  }, [loading, eventData]);

  // Simulated upload progress
  const simulateProgress = () => {
    setUploadProgress(15);
    timeoutsRef.current.push(
      setTimeout(() => setUploadProgress(45), 300),
      setTimeout(() => setUploadProgress(78), 900),
    );
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAllowedImageType(file)) {
      showToast("יש להעלות קובץ תמונה בלבד (JPG, PNG, WEBP)", "error");
      e.target.value = null;
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast("הקובץ גדול מדי (מקסימום 15MB)", "error");
      e.target.value = null;
      return;
    }
    if (myUploadCount >= MAX_PHOTOS_PER_GUEST) {
      showToast(`הגעתם למגבלת ${MAX_PHOTOS_PER_GUEST} תמונות`, "warning");
      e.target.value = null;
      return;
    }
    if (uploading) return;

    setUploading(true);
    setUploadProgress(0);
    simulateProgress();

    try {
      const compressed = await compressImage(file, {
        maxWidth: 1200,
        quality: 0.82,
      });
      const fileName = `photo_${eventId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("event-assets")
        .upload(`photos/${fileName}`, compressed, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/jpeg",
        });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("event-assets")
        .getPublicUrl(`photos/${fileName}`);

      const { error: dbError } = await supabase.from("photos").insert([
        {
          event_id: eventId,
          guest_id: guestId,
          guest_name: guestName || "אורח",
          image_url: publicUrl,
        },
      ]);
      if (dbError) throw dbError;

      setUploadProgress(100);
      const newPhoto = {
        id: Date.now(),
        guest_name: guestName || "אורח",
        image_url: publicUrl,
        created_at: new Date().toISOString(),
      };
      setPhotos((prev) => [newPhoto, ...prev]);
      setMyUploadCount((prev) => prev + 1);
      setUploadSuccess(true);
      timeoutsRef.current.push(
        setTimeout(() => {
          setUploadSuccess(false);
          setUploadProgress(0);
        }, 3000),
      );
    } catch (err) {
      showToast("שגיאה בהעלאה: " + (err.message || "נסו שוב"), "error");
      setUploadProgress(0);
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleReport = async (photoId, reportedName) => {
    try {
      await supabase.from("reports").insert([
        {
          event_id: eventId,
          reported_item_id: photoId,
          item_type: "photo",
          reporter_id: guestId,
        },
      ]);
      showToast("הדיווח התקבל ויטופל על ידי מנהלי האירוע", "success");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `eventick_photo_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      showToast("לא ניתן להוריד את התמונה", "error");
    }
  };

  // Lightbox navigation
  const lightboxGo = (dir) => {
    setLightbox((prev) => {
      const next = prev + dir;
      if (next < 0 || next >= photos.length) return prev;
      return next;
    });
  };

  useModalBehavior({
    open: lightbox !== null,
    onClose: () => setLightbox(null),
    onArrowRight: () => lightboxGo(-1),
    onArrowLeft: () => lightboxGo(1),
  });

  if (loading || !eventData) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: CLAY_PAGE_BG }}
      >
        <Loader2 className="animate-spin text-slate-400" size={56} />
      </div>
    );
  }

  const primaryColor = eventData.design_config?.colors?.primary || "#8fa7b8";
  const canUploadMore = myUploadCount < MAX_PHOTOS_PER_GUEST;

  return (
    <div
      className="min-h-screen font-sans pb-20"
      style={{ background: CLAY_PAGE_BG }}
      dir="rtl"
    >
      {/* Header — clay surface, title + back */}
      <div className="pt-14 pb-6 px-5 relative z-10 max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white"
                style={clayPrimaryBtn(primaryColor)}
              >
                <Camera size={22} />
              </div>
              <h1
                className="text-3xl font-black text-slate-700"
                style={{ fontFamily: "'Assistant', sans-serif" }}
              >
                כל אחד צלם
              </h1>
            </div>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest pr-1">
              שתפו את הרגעים המיוחדים
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="shrink-0 p-3 rounded-full text-slate-500 bg-[#f0eee7] shadow-[5px_5px_12px_rgba(0,0,0,0.09),-5px_-5px_12px_rgba(255,255,255,0.9)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)] transition-all"
            aria-label="חזרה"
          >
            <ChevronLeft size={24} />
          </button>
        </div>
      </div>

      <div className="px-5 relative z-20 max-w-md mx-auto">
        {/* Upload Card — extruded clay */}
        <div className={`fade-up-item ${CLAY} p-7 mb-8 text-center`}>
          {uploadSuccess ? (
            <div
              className="py-8"
              style={{
                animation: "bounce-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <div
                className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ boxShadow: "inset 2px 2px 5px rgba(255,255,255,0.5), inset -2px -2px 5px rgba(0,0,0,0.1)" }}
              >
                <CheckCircle2 size={40} className="text-emerald-500" />
              </div>
              <h3
                className="font-black text-slate-700 text-xl"
                style={{ fontFamily: "'Assistant', sans-serif" }}
              >
                התמונה הועלתה! ✨
              </h3>
              <p className="text-slate-500 font-medium text-sm mt-2">
                נוספה בהצלחה לאלבום המשותף
              </p>
            </div>
          ) : (
            <>
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 bg-[#f0eee7] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.85)]"
              >
                <UploadCloud size={32} style={{ color: primaryColor }} />
              </div>
              <h2
                className="text-2xl font-black text-slate-700 mb-2"
                style={{ fontFamily: "'Assistant', sans-serif" }}
              >
                צלמו או העלו תמונה
              </h2>
              <p className="text-slate-500 font-medium text-sm mb-6">
                <span
                  className="font-black text-lg"
                  style={{
                    color:
                      myUploadCount >= MAX_PHOTOS_PER_GUEST
                        ? "#f43f5e"
                        : primaryColor,
                  }}
                >
                  {myUploadCount}/{MAX_PHOTOS_PER_GUEST}
                </span>{" "}
                תמונות הועלו
              </p>

              {/* Progress bar — debossed track with filled pill */}
              {uploading && (
                <div className={`w-full rounded-full h-4 mb-5 overflow-hidden p-0.5 ${CLAY_INSET}`}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${uploadProgress}%`,
                      backgroundColor: primaryColor,
                      boxShadow: `inset 1px 1px 2px rgba(255,255,255,0.4), inset -1px -1px 2px rgba(0,0,0,0.15)`,
                    }}
                  />
                </div>
              )}

              {canUploadMore ? (
                <label
                  className="w-full font-black py-4 rounded-full flex justify-center items-center gap-2 cursor-pointer transition-all active:scale-[0.97] text-white"
                  style={clayPrimaryBtn(primaryColor)}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} /> מעלה...
                    </>
                  ) : (
                    <>
                      <Camera size={22} /> צלם / גלריה
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="text-rose-500 font-bold py-4 rounded-full flex justify-center items-center gap-2 bg-[#f0eee7] shadow-[inset_3px_3px_7px_rgba(0,0,0,0.07),inset_-3px_-3px_7px_rgba(255,255,255,0.8)]">
                  <AlertCircle size={20} /> הגעתם למכסה המקסימלית
                </div>
              )}
            </>
          )}
        </div>

        {/* Gallery */}
        <div className="fade-up-item">
          <div className="flex items-center gap-3 mb-6">
            <h3
              className="font-black text-slate-700 text-xl"
              style={{ fontFamily: "'Assistant', sans-serif" }}
            >
              האלבום המשותף
            </h3>
            <Sparkles size={18} style={{ color: primaryColor }} className="animate-pulse" />
            {photos.length > 0 && (
              <span
                className="text-white font-black text-sm px-3 py-1.5 rounded-full"
                style={clayPrimaryBtn(primaryColor)}
              >
                {photos.length}
              </span>
            )}
          </div>

          {loading ? (
            <PhotoGridSkeleton count={6} />
          ) : photos.length === 0 ? (
            <div className={`text-center py-16 ${CLAY}`}>
              <ImageIcon size={52} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600 font-black text-lg mb-2">
                האלבום עדיין ריק
              </p>
              <p className="text-slate-500 font-medium text-sm leading-relaxed px-4">
                היו הראשונים להעלות תמונה ולחלוק רגעים מיוחדים! 📸
              </p>
            </div>
          ) : (
            /* Masonry grid using CSS columns — each photo sculpted in clay */
            <div style={{ columns: 2, columnGap: "14px" }}>
              {photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="relative group rounded-[1.8rem] overflow-hidden mb-4 break-inside-avoid cursor-pointer bg-[#f0eee7] shadow-[6px_6px_16px_rgba(0,0,0,0.1),-5px_-5px_14px_rgba(255,255,255,0.9)] transition-transform hover:scale-[1.02]"
                  onClick={() => setLightbox(idx)}
                  style={{ breakInside: "avoid", padding: "8px" }}
                >
                  <img
                    src={photo.image_url}
                    alt={`תמונה של ${photo.guest_name}`}
                    className="w-full object-cover rounded-[1.4rem] transition-all duration-700 group-hover:scale-105"
                    loading="lazy"
                    style={{
                      aspectRatio:
                        idx % 3 === 0 ? "4/5" : idx % 3 === 1 ? "1/1" : "4/3",
                      boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.15)",
                    }}
                    onError={(e) => {
                      e.target.style.minHeight = "120px";
                    }}
                  />
                  {/* Overlay */}
                  <div className="absolute inset-2 rounded-[1.4rem] bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4">
                    <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-white text-sm font-black truncate flex items-center gap-1.5">
                          <Heart size={12} className="fill-current" style={{ color: primaryColor }} />
                          {photo.guest_name}
                        </p>
                        <ZoomIn size={14} className="text-white/80" />
                      </div>
                      <p className="text-white/60 text-[11px] font-medium">
                        {timeAgo(photo.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              {loadingMore && (
                <Loader2 className="animate-spin text-slate-300" size={24} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && photos[lightbox] && (
        <div
          className="fixed inset-0 z-[200] bg-slate-950/98 flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="תצוגת תמונה"
        >
          {/* Header bar */}
          <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-50 bg-gradient-to-b from-black/70 via-black/40 to-transparent pointer-events-none">
            <div className="pointer-events-auto">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">
                צולם ע"י
              </p>
              <p
                className="text-white text-xl font-black"
                style={{ fontFamily: "'Assistant', sans-serif" }}
              >
                {photos[lightbox].guest_name}
              </p>
            </div>
            <button
              className="pointer-events-auto text-white/50 hover:text-white bg-white/15 hover:bg-white/25 p-3 rounded-full transition-all"
              onClick={() => setLightbox(null)}
              aria-label="סגור תצוגה"
            >
              <X size={26} />
            </button>
          </div>

          {/* Counter & Download */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-4 text-white/70 text-sm font-bold bg-black/40 px-6 py-3 rounded-full">
            <span>
              {lightbox + 1} / {photos.length}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(photos[lightbox].image_url);
              }}
              className="text-white/60 hover:text-white transition-colors flex items-center gap-1.5"
              title="הורד תמונה"
            >
              <Download size={18} /> הורד
            </button>
          </div>

          {/* Navigation buttons */}
          <div
            className="relative w-full h-full flex items-center justify-center p-6 md:p-12"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox > 0 && (
              <button
                className="absolute right-6 md:right-12 z-50 text-white/40 hover:text-white bg-white/10 hover:bg-white/20 p-5 rounded-full transition-all group"
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxGo(-1);
                }}
                aria-label="התמונה הקודמת"
              >
                <ChevRight size={32} className="group-hover:scale-125 transition-transform" />
              </button>
            )}

            <img
              src={photos[lightbox].image_url}
              alt="תמונה מוגדלת"
              className="max-w-full max-h-[85vh] object-contain rounded-[2rem] shadow-[0_0_80px_rgba(0,0,0,0.7)] animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            />

            {lightbox < photos.length - 1 && (
              <button
                className="absolute left-6 md:left-12 z-50 text-white/40 hover:text-white bg-white/10 hover:bg-white/20 p-5 rounded-full transition-all group"
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxGo(1);
                }}
                aria-label="התמונה הבאה"
              >
                <ChevronLeft size={32} className="group-hover:scale-125 transition-transform" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Photos;
