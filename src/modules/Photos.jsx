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

  // Realtime subscription — new photos appear instantly
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`photos_feed_${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photos",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          // Don't prepend own uploads (already optimistically added)
          if (payload.new.guest_id !== guestId) {
            setPhotos((prev) => [payload.new, ...prev]);
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={48} />
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
      {/* Header */}
      <div
        className="rounded-b-[3rem] pt-10 pb-16 px-6 relative z-10 shadow-lg flex justify-between items-start"
        style={{ backgroundColor: primaryColor }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-black/10 hover:bg-black/20 transition-colors"
          style={{ color: primaryTextColor }}
        >
          <ChevronLeft size={20} />
        </button>
        <h1
          className="text-xl font-black flex items-center gap-2"
          style={{ color: primaryTextColor }}
        >
          כל אחד צלם <Camera size={20} style={{ opacity: 0.8 }} />
        </h1>
        <div className="w-9" />
      </div>

      <div className="px-5 -mt-8 relative z-20 max-w-md mx-auto">
        {/* Upload Card */}
        <div className="fade-up-item bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.07)] border border-slate-100 mb-6 text-center">
          {uploadSuccess ? (
            <div className="py-6 animate-in zoom-in">
              <div className="w-16 h-16 bg-emerald-50 rounded-[1.2rem] flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <h3 className="font-black text-slate-800 text-lg">
                התמונה הועלתה!
              </h3>
              <p className="text-sm text-slate-500 font-medium">
                נוספה בהצלחה לאלבום המשותף
              </p>
            </div>
          ) : (
            <>
              <div
                className="w-16 h-16 rounded-[1.2rem] flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `${primaryColor}18` }}
              >
                <UploadCloud size={28} style={{ color: primaryColor }} />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-1">
                צלמו או העלו תמונה
              </h2>
              <p className="text-slate-400 font-medium text-sm mb-5">
                <span
                  className={`font-bold ${myUploadCount >= MAX_PHOTOS_PER_GUEST ? "text-rose-500" : "text-slate-600"}`}
                >
                  {myUploadCount}/{MAX_PHOTOS_PER_GUEST}
                </span>{" "}
                תמונות הועלו
              </p>

              {/* Progress bar */}
              {uploading && (
                <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${uploadProgress}%`,
                      backgroundColor: primaryColor,
                    }}
                  />
                </div>
              )}

              {canUploadMore ? (
                <label
                  className="w-full font-bold py-4 rounded-[1.2rem] flex justify-center items-center gap-2 cursor-pointer transition-all shadow-md active:scale-[0.98]"
                  style={{
                    backgroundColor: primaryColor,
                    color: primaryTextColor,
                  }}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> מעלה...
                    </>
                  ) : (
                    <>
                      <Camera size={20} /> פתח מצלמה / גלריה
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
                <div className="bg-rose-50 text-rose-600 font-bold py-3.5 rounded-[1.2rem] flex justify-center items-center gap-2 border border-rose-100">
                  <AlertCircle size={18} /> הגעתם למכסה המקסימלית
                </div>
              )}
            </>
          )}
        </div>

        {/* Gallery */}
        <div className="fade-up-item">
          <h3 className="font-black text-slate-700 mb-4 flex items-center gap-2">
            האלבום המשותף
            <Sparkles size={15} style={{ color: primaryColor }} />
            {photos.length > 0 && (
              <span className="text-slate-400 font-medium text-sm">
                ({photos.length})
              </span>
            )}
          </h3>

          {loading ? (
            <PhotoGridSkeleton count={6} />
          ) : photos.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
              <ImageIcon size={44} className="mx-auto mb-4 text-slate-200" />
              <p className="text-slate-500 font-medium text-sm leading-relaxed">
                האלבום עדיין ריק.
                <br />
                היו הראשונים להעלות תמונה!
              </p>
            </div>
          ) : (
            /* Masonry grid using CSS columns */
            <div style={{ columns: 2, columnGap: "12px" }}>
              {photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="relative group bg-white rounded-[1.2rem] overflow-hidden shadow-sm border border-slate-100 mb-3 break-inside-avoid cursor-pointer"
                  onClick={() => setLightbox(idx)}
                  style={{ breakInside: "avoid" }}
                >
                  <img
                    src={photo.image_url}
                    alt={`תמונה של ${photo.guest_name}`}
                    className="w-full object-cover"
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white text-xs font-bold truncate flex items-center gap-1">
                        <Heart
                          size={10}
                          style={{ fill: primaryColor, color: primaryColor }}
                        />
                        {photo.guest_name}
                      </p>
                      <div className="flex items-center gap-1">
                        <ZoomIn size={14} className="text-white/80" />
                      </div>
                    </div>
                    <p className="text-white/50 text-[10px] mt-0.5">
                      {timeAgo(photo.created_at)}
                    </p>
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
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white bg-white/10 rounded-full p-2 transition-colors z-10"
            onClick={() => setLightbox(null)}
          >
            <X size={22} />
          </button>

          {/* Download */}
          <button
            className="absolute top-4 left-4 text-white/60 hover:text-white bg-white/10 rounded-full p-2 transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(photos[lightbox].image_url);
            }}
            title="הורד תמונה"
          >
            <Download size={22} />
          </button>

          {/* Prev */}
          {lightbox > 0 && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white bg-white/10 rounded-full p-2 transition-colors z-10"
              onClick={(e) => {
                e.stopPropagation();
                lightboxGo(-1);
              }}
            >
              <ChevRight size={24} />
            </button>
          )}

          {/* Next */}
          {lightbox < photos.length - 1 && (
            <button
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white bg-white/10 rounded-full p-2 transition-colors z-10"
              onClick={(e) => {
                e.stopPropagation();
                lightboxGo(1);
              }}
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Image */}
          <img
            src={photos[lightbox].image_url}
            alt="תמונה מוגדלת"
            className="max-w-full max-h-full object-contain rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Caption */}
          <div className="absolute bottom-6 inset-x-0 text-center">
            <p className="text-white/70 text-sm font-bold">
              {photos[lightbox].guest_name}
            </p>
            <p className="text-white/40 text-xs">
              {lightbox + 1} / {photos.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Photos;
