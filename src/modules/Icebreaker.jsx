import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getTextColor } from "../lib/colors";
import { compressImage, isAllowedImageType } from "../lib/imageUtils";
import { useToast } from "../components/Toast";
import { sanitize } from "../utils/sanitize";
import { isValidUUIDv4, getOrCreateDeviceId } from "../utils/deviceId";
import {
  Loader2,
  Camera,
  ChevronLeft,
  Zap,
  Target,
  ImagePlus,
  User,
  CheckCircle2,
  LogOut,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import gsap from "gsap";

/* ============================================================
   SOFT-CLAY / NEUMORPHISM DESIGN TOKENS  (shared across modules)
   ------------------------------------------------------------ */
const CLAY_BG = "#eceadf";
const CLAY_PAGE_BG = "linear-gradient(160deg, #eceadf 0%, #e2ddd0 100%)";
const clayBtn = (color) => ({
  backgroundColor: color,
  boxShadow: `5px 5px 14px rgba(0,0,0,0.14), -4px -4px 12px rgba(255,255,255,0.7), inset 2px 2px 4px rgba(255,255,255,0.35), inset -2px -2px 4px rgba(0,0,0,0.12)`,
});
const clayRaised =
  "bg-[#f0eee7] shadow-[8px_8px_20px_rgba(0,0,0,0.09),-8px_-8px_20px_rgba(255,255,255,0.9)]";
const clayInsetShadow =
  "inset 5px 5px 10px rgba(0,0,0,0.07), inset -5px -5px 10px rgba(255,255,255,0.85)";

const Icebreaker = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const guestName = localStorage.getItem("guest_name");
  const guestId = getOrCreateDeviceId();

  const [eventData, setEventData] = useState(null);
  const [view, setView] = useState("loading");
  const [myProfile, setMyProfile] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [feed, setFeed] = useState([]);

  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const proofInputRef = useRef(null);
  const rouletteRef = useRef(null);
  const rouletteTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (rouletteTimeoutRef.current) clearTimeout(rouletteTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!eventId || !guestName || !guestId || !isValidUUIDv4(guestId))
      return navigate("/");
    let isMounted = true;
    checkStatus(isMounted);
    return () => {
      isMounted = false;
    };
  }, [eventId, guestId]);

  const checkStatus = async (isMounted = true) => {
    try {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id, name, design_config")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;
      if (!isMounted) return;
      setEventData(event);

      const { data: profile, error: profileError } = await supabase
        .from("icebreaker_profiles")
        .select("id, guest_id, name, photo_url")
        .eq("event_id", eventId)
        .eq("guest_id", guestId)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching icebreaker profile:", profileError);
      }

      if (!isMounted) return;

      if (!profile) {
        setView("register");
        return;
      }

      setMyProfile(profile);

      const { data: activeMatch, error: matchError } = await supabase
        .from("icebreaker_matches")
        .select(
          "id, guest1_id, guest2_id, mission_text, status, photo_url, completed_at, created_at",
        )
        .eq("event_id", eventId)
        .eq("status", "pending")
        .or(`guest1_id.eq.${guestId},guest2_id.eq.${guestId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (matchError) {
        console.error("Error fetching active match:", matchError);
      }

      if (activeMatch) {
        const partnerId =
          activeMatch.guest1_id === guestId
            ? activeMatch.guest2_id
            : activeMatch.guest1_id;

        const { data: partner } = await supabase
          .from("icebreaker_profiles")
          .select("id, guest_id, name, photo_url")
          .eq("event_id", eventId)
          .eq("guest_id", partnerId)
          .maybeSingle();

        if (isMounted) {
          setCurrentMatch({ ...activeMatch, partner });
          setView("active_mission");
        }
      } else {
        await fetchFeed(isMounted);
        if (isMounted) setView("hub");
      }
    } catch (err) {
      console.error("Icebreaker Init failed:", err);
      if (isMounted) setView("register");
    }
  };

  const fetchFeed = async (isMounted = true) => {
    const { data, error } = await supabase
      .from("icebreaker_matches")
      .select("id, mission_text, photo_url, completed_at, guest1_id, guest2_id")
      .eq("event_id", eventId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(20);

    if (error) console.error("Error fetching feed:", error);
    if (isMounted) setFeed(data || []);
  };

  useEffect(() => {
    if (view === "hub") {
      gsap.fromTo(
        ".fade-up-item",
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          ease: "back.out(1.2)",
        },
      );
    }
  }, [view, feed]);

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedImageType(file)) {
      showToast("יש להעלות קובץ תמונה בלבד", "error");
      return;
    }
    if (uploading) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, {
        maxWidth: 800,
        quality: 0.78,
      });
      const fileName = `profiles/${eventId}/${guestId}_${Date.now()}.jpg`;
      await supabase.storage
        .from("icebreaker-uploads")
        .upload(fileName, compressed, {
          contentType: "image/jpeg",
          upsert: true,
        });
      const {
        data: { publicUrl },
      } = supabase.storage.from("icebreaker-uploads").getPublicUrl(fileName);
      setPhotoUrl(publicUrl);
    } catch {
      showToast("שגיאה בהעלאת התמונה, נסה שוב", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleJoinGame = async () => {
    if (isJoining) return;
    setIsJoining(true);
    try {
      const payload = {
        event_id: eventId,
        guest_id: guestId,
        name: guestName,
        photo_url: photoUrl,
      };

      const { data: existingProfile } = await supabase
        .from("icebreaker_profiles")
        .select("id")
        .eq("event_id", eventId)
        .eq("guest_id", guestId)
        .maybeSingle();

      let saveError;

      if (existingProfile) {
        const { error } = await supabase
          .from("icebreaker_profiles")
          .update(payload)
          .eq("id", existingProfile.id)
          .eq("guest_id", guestId);
        saveError = error;
      } else {
        const { error } = await supabase
          .from("icebreaker_profiles")
          .insert([payload]);
        saveError = error;
      }

      if (saveError) throw saveError;

      await checkStatus();
    } catch (err) {
      console.error("Join game error:", err);
      showToast("שגיאה בהצטרפות למשחק, נסה שוב", "error");
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm("בטוח שרוצים לפרוש מהמשחק?")) return;
    try {
      await supabase
        .from("icebreaker_profiles")
        .delete()
        .eq("event_id", eventId)
        .eq("guest_id", guestId);
      setMyProfile(null);
      setPhotoUrl("");
      setView("register");
    } catch {
      showToast("שגיאה בהתנתקות", "error");
    }
  };

  const startRoulette = async () => {
    setView("roulette");
    try {
      const { data: others } = await supabase
        .from("icebreaker_profiles")
        .select("id, guest_id, name, photo_url")
        .eq("event_id", eventId)
        .neq("guest_id", guestId)
        .limit(200);

      const { data: missions } = await supabase
        .from("icebreaker_missions")
        .select("id, content")
        .eq("event_id", eventId)
        .limit(100);

      if (!others?.length) {
        showToast("עדיין אין עוד אנשים במשחק! תגידו לחבר'ה להירשם.", "warning");
        setView("hub");
        return;
      }
      if (!missions?.length) {
        showToast("מנהל האירוע עדיין לא הזין משימות", "warning");
        setView("hub");
        return;
      }

      const randomPartner = others[Math.floor(Math.random() * others.length)];
      const randomMission =
        missions[Math.floor(Math.random() * missions.length)];

      if (rouletteRef.current) {
        gsap.to(rouletteRef.current, {
          scale: 1.1,
          duration: 0.2,
          yoyo: true,
          repeat: 10,
        });
      }

      rouletteTimeoutRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;
        const { data: matchData, error } = await supabase
          .from("icebreaker_matches")
          .insert([
            {
              event_id: eventId,
              guest1_id: guestId,
              guest2_id: randomPartner.guest_id,
              mission_text: randomMission.content,
              status: "pending",
            },
          ])
          .select()
          .maybeSingle();

        if (!isMountedRef.current) return;
        if (!error && matchData) {
          setCurrentMatch({ ...matchData, partner: randomPartner });
          setView("active_mission");
          gsap.fromTo(
            ".mission-reveal",
            { scale: 0.8, opacity: 0, y: 50 },
            {
              scale: 1,
              opacity: 1,
              y: 0,
              duration: 0.6,
              ease: "back.out(1.5)",
            },
          );
        }
      }, 2000);
    } catch (err) {
      console.error(err);
      setView("hub");
    }
  };

  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedImageType(file)) {
      showToast("יש להעלות קובץ תמונה בלבד", "error");
      return;
    }
    if (uploading) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, {
        maxWidth: 1200,
        quality: 0.82,
      });
      const fileName = `proofs/${eventId}/${currentMatch.id}_${Date.now()}.jpg`;
      await supabase.storage
        .from("icebreaker-uploads")
        .upload(fileName, compressed, { contentType: "image/jpeg" });
      const {
        data: { publicUrl },
      } = supabase.storage.from("icebreaker-uploads").getPublicUrl(fileName);

      await supabase
        .from("icebreaker_matches")
        .update({
          photo_url: publicUrl,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", currentMatch.id)
        .or(`guest1_id.eq.${guestId},guest2_id.eq.${guestId}`);

      setCurrentMatch(null);
      await fetchFeed();
      setView("hub");
      showToast("המשימה הושלמה! כל הכבוד! 🎯", "success");
    } catch {
      showToast("שגיאה בהעלאת ההוכחה, נסה שוב", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleReport = async (matchId) => {
    if (!window.confirm("האם לדווח על תוכן זה כפוגעני?")) return;
    try {
      await supabase.from("reports").insert([
        {
          event_id: eventId,
          reported_item_id: matchId,
          item_type: "icebreaker",
          reporter_id: guestId,
        },
      ]);
      showToast("הדיווח התקבל ויטופל על ידי מנהלי האירוע", "success");
    } catch (e) {
      console.error(e);
    }
  };

  if (view === "loading" || !eventData) {
    return (
      <div
        className="min-h-screen flex justify-center items-center"
        style={{ background: CLAY_PAGE_BG }}
      >
        <Loader2 className="animate-spin text-slate-400" size={48} />
      </div>
    );
  }

  const primaryColor = eventData.design_config?.colors?.primary || "#8fa7b8";

  // ---- Register ----
  if (view === "register") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: CLAY_PAGE_BG }}
        dir="rtl"
      >
        <button
          onClick={() => navigate(-1)}
          className="absolute right-6 top-8 p-3 rounded-full z-10 text-slate-500 bg-[#f0eee7] shadow-[5px_5px_12px_rgba(0,0,0,0.09),-5px_-5px_12px_rgba(255,255,255,0.9)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)] transition-all"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="w-full max-w-sm text-center relative z-10">
          <div
            className="inline-flex p-5 rounded-[1.5rem] mb-6 text-white"
            style={clayBtn(primaryColor)}
          >
            <Zap size={48} />
          </div>
          <h1 className="text-4xl font-black mb-2 text-slate-700">
            IceBreaker
          </h1>
          <p className="text-slate-500 font-medium mb-8 text-sm leading-relaxed">
            מצאו אנשים, בצעו משימות מצחיקות, ותעדו הכל.
          </p>

          <div className={`p-8 rounded-[2.5rem] ${clayRaised}`}>
            <h2 className="text-lg font-bold mb-2 text-slate-700">
              תמונת זיהוי
            </h2>
            <p className="text-slate-400 text-sm mb-5">כדי שימצאו אתכם בקלות</p>
            <label className="relative cursor-pointer inline-block group mb-6">
              <div
                className="w-36 h-36 mx-auto rounded-full flex items-center justify-center overflow-hidden p-2 bg-[#eeece5]"
                style={{ boxShadow: clayInsetShadow }}
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    className="w-full h-full object-cover rounded-full"
                    alt="profile"
                  />
                ) : (
                  <Camera size={36} className="text-slate-300" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-full">
                    <Loader2
                      className="animate-spin"
                      style={{ color: primaryColor }}
                    />
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleProfilePhotoUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleJoinGame}
              disabled={isJoining}
              className="w-full font-black py-4 rounded-full text-xl transition-all active:scale-[0.98] disabled:opacity-50 text-white"
              style={clayBtn(primaryColor)}
            >
              {isJoining ? (
                <Loader2 className="animate-spin mx-auto" size={24} />
              ) : (
                "אני בפנים!"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Roulette ----
  if (view === "roulette") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-center p-6"
        style={{ background: CLAY_PAGE_BG }}
        dir="rtl"
      >
        <div ref={rouletteRef} className={`p-12 rounded-[3rem] ${clayRaised}`}>
          <Loader2
            className="animate-spin mx-auto mb-8"
            size={72}
            style={{ color: primaryColor }}
          />
          <h2 className="text-3xl font-black mb-2 text-slate-700">
            מאתר קורבן...
          </h2>
          <p className="text-lg font-medium mt-3 animate-pulse text-slate-400">
            מגריל משימה חשאית
          </p>
        </div>
      </div>
    );
  }

  // ---- Active Mission ----
  if (view === "active_mission" && currentMatch) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: CLAY_PAGE_BG }}
        dir="rtl"
      >
        <header className="p-5 flex justify-between items-center z-10 mx-3 mt-3 rounded-[1.8rem] bg-[#f0eee7] shadow-[7px_7px_18px_rgba(0,0,0,0.09),-6px_-6px_16px_rgba(255,255,255,0.9)]">
          <button
            onClick={() => setView("hub")}
            className="p-2.5 rounded-full text-slate-500 bg-[#f0eee7] shadow-[4px_4px_9px_rgba(0,0,0,0.09),-4px_-4px_9px_rgba(255,255,255,0.9)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.1),inset_-2px_-2px_5px_rgba(255,255,255,0.8)] transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          <span className="px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 text-slate-700 bg-[#f0eee7] shadow-[4px_4px_9px_rgba(0,0,0,0.09),-4px_-4px_9px_rgba(255,255,255,0.9)]">
            <Sparkles size={15} className="text-amber-500" /> משימה פעילה!
          </span>
          <div className="w-10" />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mission-reveal">
          <p className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-widest">
            המטרה שלך:
          </p>

          <div
            className="w-32 h-32 rounded-full overflow-hidden mb-4 mx-auto p-2 bg-[#eeece5]"
            style={{ boxShadow: clayInsetShadow }}
          >
            {currentMatch.partner?.photo_url ? (
              <img
                src={currentMatch.partner.photo_url}
                className="w-full h-full object-cover rounded-full"
                alt={currentMatch.partner.name}
              />
            ) : (
              <User size={44} className="m-auto mt-8 text-slate-300" />
            )}
          </div>
          <h1 className="text-4xl font-black text-slate-700 mb-8">
            {sanitize(currentMatch.partner?.name || "")}
          </h1>

          {/* Mission card */}
          <div
            className={`p-8 rounded-[2.5rem] w-full max-w-md relative ${clayRaised}`}
          >
            <div
              className="absolute -top-5 right-6 w-12 h-12 rounded-full flex items-center justify-center text-white"
              style={clayBtn(primaryColor)}
            >
              <Target size={18} />
            </div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60"
              style={{ color: primaryColor }}
            >
              פקודת מבצע
            </p>
            <p className="text-2xl font-black text-slate-700 leading-snug">
              {currentMatch.mission_text}
            </p>
          </div>

          <div className="w-full max-w-md pt-10 pb-6">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={proofInputRef}
              onChange={handleProofUpload}
              className="hidden"
            />
            <button
              onClick={() => proofInputRef.current?.click()}
              disabled={uploading}
              className="w-full font-black py-5 rounded-full text-lg flex justify-center items-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 text-white"
              style={clayBtn(primaryColor)}
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={22} /> מעלה...
                </>
              ) : (
                <>
                  <Camera size={22} /> צילמנו! העלה הוכחה
                </>
              )}
            </button>
            <p className="text-slate-400 font-medium text-xs mt-3">
              מצאו אחד את השנייה, בצעו את המשימה וצלמו הוכחה.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Hub / Wall of Fame ----
  return (
    <div
      className="min-h-screen font-sans pb-12"
      style={{ background: CLAY_PAGE_BG }}
      dir="rtl"
    >
      <div className="pt-12 pb-6 px-6 relative z-10 flex justify-between items-center max-w-md mx-auto w-full">
        <button
          onClick={() => navigate(-1)}
          className="p-3 rounded-full text-slate-500 bg-[#f0eee7] shadow-[5px_5px_12px_rgba(0,0,0,0.09),-5px_-5px_12px_rgba(255,255,255,0.9)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.1),inset_-3px_-3px_7px_rgba(255,255,255,0.8)] transition-all"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-2xl font-black flex items-center gap-2 text-slate-700">
          IceBreaker{" "}
          <Zap size={18} style={{ fill: primaryColor, color: primaryColor }} />
        </h1>
        <div className="w-11 h-11 rounded-[1rem] overflow-hidden bg-[#eeece5] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.7)]">
          {myProfile?.photo_url ? (
            <img
              src={myProfile.photo_url}
              className="w-full h-full object-cover"
              alt="avatar"
            />
          ) : (
            <User size={20} className="m-auto mt-2.5 text-slate-300" />
          )}
        </div>
      </div>

      <div className="px-5 relative z-20 max-w-md mx-auto">
        {/* Start Button — challenge card with accent bar */}
        <button
          onClick={startRoulette}
          className={`fade-up-item w-full p-7 rounded-[2.5rem] text-center mb-7 hover:scale-[1.02] active:scale-[0.98] transition-transform group relative overflow-hidden ${clayRaised}`}
        >
          <div
            className="absolute top-0 left-0 w-full h-2 rounded-t-[2.5rem]"
            style={{ backgroundColor: primaryColor }}
          />
          <div
            className="w-16 h-16 rounded-[1.4rem] flex items-center justify-center mx-auto mb-3 text-white"
            style={clayBtn(primaryColor)}
          >
            <Zap className="group-hover:animate-bounce" size={30} />
          </div>
          <h2 className="text-2xl font-black text-slate-700">
            הגרל משימה חדשה
          </h2>
          <p className="text-slate-400 font-medium mt-1 text-sm">
            לחצו כדי לקבל אתגר
          </p>
        </button>

        {/* Wall of Fame */}
        <h3 className="fade-up-item text-lg font-black text-slate-700 mb-4 flex items-center gap-2">
          <CheckCircle2 size={20} className="text-emerald-500" /> קיר תהילה
          {feed.length > 0 && (
            <span className="text-slate-400 font-medium text-sm">
              ({feed.length} משימות)
            </span>
          )}
        </h3>

        <div className="space-y-5 pb-8">
          {feed.length === 0 ? (
            <div
              className={`fade-up-item text-center py-14 rounded-[2rem] ${clayRaised}`}
            >
              <ImagePlus size={40} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600 font-bold">הקיר ריק.</p>
              <p className="text-slate-400 text-sm mt-1">
                היו הראשונים לבצע משימה!
              </p>
            </div>
          ) : (
            feed.map((match) => (
              <div
                key={match.id}
                className={`fade-up-item rounded-[2rem] overflow-hidden ${clayRaised}`}
              >
                {/* Mission text — debossed banner */}
                <div
                  className="p-5 m-2 mb-0 rounded-[1.5rem]"
                  style={{
                    backgroundColor: "#eeece5",
                    boxShadow: clayInsetShadow,
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60"
                    style={{ color: primaryColor }}
                  >
                    משימה שבוצעה:
                  </p>
                  <p className="text-base font-black text-slate-700 leading-snug">
                    "{match.mission_text}"
                  </p>
                </div>

                {/* Proof photo */}
                {match.photo_url && (
                  <div className="aspect-square w-full p-2">
                    <img
                      src={match.photo_url}
                      className="w-full h-full object-cover rounded-[1.4rem]"
                      alt="Mission Proof"
                      loading="lazy"
                      style={{
                        boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.15)",
                      }}
                    />
                  </div>
                )}

                {/* Footer */}
                <div className="p-4 flex items-center justify-between text-xs text-slate-400 font-bold">
                  <div className="flex items-center gap-2">
                    <span>בוצע בשטח 🎯</span>
                    <button
                      onClick={() => handleReport(match.id)}
                      className="text-slate-300 hover:text-rose-400 transition-colors"
                      title="דווח"
                    >
                      <AlertCircle size={13} />
                    </button>
                  </div>
                  <span dir="ltr">
                    {new Date(match.completed_at).toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          onClick={handleLogout}
          className="fade-up-item w-full py-5 flex items-center justify-center gap-2 text-slate-300 hover:text-slate-500 transition-colors font-bold text-sm"
        >
          <LogOut size={15} /> פרוש מהמשחק
        </button>
      </div>
    </div>
  );
};

export default Icebreaker;
