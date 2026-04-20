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
import { getLuminance } from "../lib/colors";
import { compressImage, isAllowedImageType } from "../lib/imageUtils";
import { useToast } from "../components/Toast";
import { PhotoGridSkeleton } from "../components/SkeletonCard";
import gsap from "gsap";

const MAX_PHOTOS_PER_GUEST = 3;
const PAGE_SIZE = 12;

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
  const guestId = localStorage.getItem("guest_id") || "";

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

        if (guestId) {
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
          // Don't prepend own uploads (already optimistically added)
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
    setTimeout(() => setUploadProgress(45), 300);
    setTimeout(() => setUploadProgress(78), 900);
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
      // Compress before upload
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
      setTimeout(() => {
        setUploadSuccess(false);
        setUploadProgress(0);
      }, 3000);
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

  if (loading || !eventData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="relative">
          <Loader2 className="animate-spin text-slate-400 mb-6" size={56} />
          <div
            className="absolute inset-0 rounded-full animate-pulse opacity-20 bg-slate-400"
            style={{ width: "72px", height: "72px", left: "-8px", top: "-8px" }}
          />
        </div>
      </div>
    );
  }

  const primaryColor = eventData.design_config?.colors?.primary || "#3b82f6";
  const bgColor = eventData.design_config?.colors?.background || "#f8fafc";
  const primaryTextColor =
    getLuminance(primaryColor) > 150 ? "#1e293b" : "#ffffff";
  const canUploadMore = myUploadCount < MAX_PHOTOS_PER_GUEST;

  return (
    <div
      className="min-h-screen font-sans pb-20 transition-colors duration-1000"
      style={{ backgroundColor: bgColor }}
      dir="rtl"
    >
      {/* Header עם gradient ואנימציות */}
      <div
        className="rounded-b-[3.5rem] pt-16 pb-24 px-6 relative z-10 shadow-deep flex flex-col items-center text-center transition-colors duration-1000 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
          boxShadow: `0 20px 50px ${primaryColor}30`,
        }}
      >
        {/* Decorative floating elements */}
        <div className="absolute top-10 right-12 w-24 h-24 rounded-full opacity-10 bg-white float-effect" />
        <div className="absolute bottom-8 left-8 w-32 h-32 rounded-full opacity-10 bg-white float-delayed" />

        <div className="relative z-10 flex items-center gap-3 mb-2">
          <Camera size={28} style={{ color: primaryTextColor, opacity: 0.9 }} />
          <h1
            className="text-3xl md:text-4xl font-black"
            style={{
              color: primaryTextColor,
              fontFamily: "'Playfair Display', serif",
            }}
          >
            כל אחד צלם
          </h1>
        </div>
        <p
          className="text-white/70 font-bold text-xs uppercase tracking-widest"
          style={{ color: `${primaryTextColor}aa` }}
        >
          שתפו את הרגעים המיוחדים
        </p>

        {/* Back button positioned absolutely */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-8 right-6 p-3 rounded-full bg-white/20 hover:bg-white/30 transition-all backdrop-blur-md button-pulse"
          style={{ color: primaryTextColor }}
        >
          <ChevronLeft size={24} />
        </button>
      </div>

      <div className="px-5 -mt-12 relative z-20 max-w-md mx-auto">
        {/* Upload Card עם glass morphism */}
        <div className="fade-up-item glass-card p-7 rounded-[2.5rem] shadow-deep mb-8 text-center">
          {uploadSuccess ? (
            <div
              className="py-8 animate-in zoom-in"
              style={{
                animation: "bounce-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <div className="w-20 h-20 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-elevated">
                <CheckCircle2 size={40} className="text-emerald-500" />
              </div>
              <h3
                className="font-black text-slate-900 text-xl"
                style={{ fontFamily: "'Playfair Display', serif" }}
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
                className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 shadow-elevated group-hover:scale-110 transition-transform"
                style={{
                  backgroundColor: `${primaryColor}18`,
                  boxShadow: `0 10px 30px ${primaryColor}25`,
                }}
              >
                <UploadCloud size={32} style={{ color: primaryColor }} />
              </div>
              <h2
                className="text-2xl font-black text-slate-900 mb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                צלמו או העלו תמונה
              </h2>
              <p className="text-slate-500 font-medium text-sm mb-6">
                <span
                  className={`font-black text-lg ${myUploadCount >= MAX_PHOTOS_PER_GUEST ? "text-rose-500" : ""}`}
                  style={{
                    color:
                      myUploadCount >= MAX_PHOTOS_PER_GUEST
                        ? undefined
                        : primaryColor,
                  }}
                >
                  {myUploadCount}/{MAX_PHOTOS_PER_GUEST}
                </span>{" "}
                תמונות הועלו
              </p>

              {/* Progress bar */}
              {uploading && (
                <div className="w-full bg-slate-200 rounded-full h-3 mb-5 overflow-hidden shadow-sm">
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${uploadProgress}%`,
                      backgroundColor: primaryColor,
                      boxShadow: `0 0 10px ${primaryColor}60`,
                    }}
                  />
                </div>
              )}

              {canUploadMore ? (
                <label
                  className="w-full font-black py-4 rounded-[1.3rem] flex justify-center items-center gap-2 cursor-pointer transition-all shadow-elevated active:scale-[0.97] button-pulse text-white"
                  style={{
                    backgroundColor: primaryColor,
                    boxShadow: `0 10px 30px ${primaryColor}40`,
                  }}
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
                <div className="bg-rose-50 text-rose-600 font-bold py-4 rounded-[1.3rem] flex justify-center items-center gap-2 border-2 border-rose-200 shadow-elevated">
                  <AlertCircle size={20} /> הגעתם למכסה המקסימלית
                </div>
              )}
            </>
          )}
        </div>

        {/* Gallery עם עיטורים */}
        <div className="fade-up-item">
          <div className="flex items-center gap-3 mb-6">
            <h3
              className="font-black text-slate-800 text-xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              האלבום המשותף
            </h3>
            <Sparkles
              size={18}
              style={{ color: primaryColor }}
              className="animate-pulse"
            />
            {photos.length > 0 && (
              <span
                className="text-white font-black text-sm px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: primaryColor,
                  boxShadow: `0 4px 12px ${primaryColor}40`,
                }}
              >
                {photos.length}
              </span>
            )}
          </div>

          {loading ? (
            <PhotoGridSkeleton count={6} />
          ) : photos.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-[2rem] shadow-elevated">
              <ImageIcon size={52} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600 font-black text-lg mb-2">
                האלבום עדיין ריק
              </p>
              <p className="text-slate-500 font-medium text-sm leading-relaxed px-4">
                היו הראשונים להעלות תמונה ולחלוק רגעים מיוחדים! 📸
              </p>
            </div>
          ) : (
            /* Masonry grid using CSS columns */
            <div style={{ columns: 2, columnGap: "14px" }}>
              {photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="relative group glass-card rounded-[1.8rem] overflow-hidden shadow-elevated mb-4 break-inside-avoid cursor-pointer card-hover"
                  onClick={() => setLightbox(idx)}
                  style={{ breakInside: "avoid" }}
                >
                  <img
                    src={photo.image_url}
                    alt={`תמונה של ${photo.guest_name}`}
                    className="w-full object-cover transition-all duration-700 group-hover:scale-110"
                    loading="lazy"
                    style={{
                      aspectRatio:
                        idx % 3 === 0 ? "4/5" : idx % 3 === 1 ? "1/1" : "4/3",
                    }}
                    onError={(e) => {
                      e.target.style.minHeight = "120px";
                    }}
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4">
                    <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-white text-sm font-black truncate flex items-center gap-1.5">
                          <Heart
                            size={12}
                            className="fill-rose-500"
                            style={{ color: primaryColor }}
                          />
                          {photo.guest_name}
                        </p>
                        <div className="flex items-center gap-1">
                          <ZoomIn size={14} className="text-white/80" />
                        </div>
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

      {/* Lightbox עם אנימציות וControls */}
      {lightbox !== null && photos[lightbox] && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/98 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setLightbox(null)}
        >
          {/* Header bar */}
          <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-50 bg-gradient-to-b from-black/70 via-black/40 to-transparent pointer-events-none">
            <div className="pointer-events-auto">
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">
                צולם ע"י
              </p>
              <p
                className="text-white text-xl font-black"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {photos[lightbox].guest_name}
              </p>
            </div>
            <button
              className="pointer-events-auto text-white/50 hover:text-white bg-white/15 hover:bg-white/25 p-3 rounded-full transition-all backdrop-blur-md button-pulse"
              onClick={() => setLightbox(null)}
            >
              <X size={26} />
            </button>
          </div>

          {/* Counter & Download */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-4 text-white/70 text-sm font-bold bg-black/40 backdrop-blur-md px-6 py-3 rounded-full">
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
            {/* Prev */}
            {lightbox > 0 && (
              <button
                className="absolute right-6 md:right-12 z-50 text-white/40 hover:text-white bg-white/10 hover:bg-white/20 p-5 rounded-full transition-all backdrop-blur-md group button-pulse"
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxGo(-1);
                }}
              >
                <ChevRight
                  size={32}
                  className="group-hover:scale-125 transition-transform"
                />
              </button>
            )}

            {/* Image */}
            <img
              src={photos[lightbox].image_url}
              alt="תמונה מוגדלת"
              className="max-w-full max-h-[85vh] object-contain rounded-[2rem] shadow-[0_0_80px_rgba(0,0,0,0.7)] animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Next */}
            {lightbox < photos.length - 1 && (
              <button
                className="absolute left-6 md:left-12 z-50 text-white/40 hover:text-white bg-white/10 hover:bg-white/20 p-5 rounded-full transition-all backdrop-blur-md group button-pulse"
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxGo(1);
                }}
              >
                <ChevronLeft
                  size={32}
                  className="group-hover:scale-125 transition-transform"
                />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Photos;
