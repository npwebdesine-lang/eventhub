import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getLuminance } from "../lib/colors";
import { compressImage, isAllowedImageType } from "../lib/imageUtils";
import { useToast } from "../components/Toast";
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

const Icebreaker = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const guestName = localStorage.getItem("guest_name");
  const guestId = localStorage.getItem("guest_id");

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

  useEffect(() => {
    if (!eventId || !guestId) return navigate("/");
    let isMounted = true;
    checkStatus(isMounted);
    return () => {
      isMounted = false;
    };
  }, [eventId, guestId]);

  const checkStatus = async (isMounted = true) => {
    try {
      const { data: event } = await supabase
        .from("events")
        .select("id, name, design_config")
        .eq("id", eventId)
        .single();
      if (!isMounted) return;
      setEventData(event);

      const { data: profile } = await supabase
        .from("icebreaker_profiles")
        .select("id, guest_id, name, photo_url")
        .eq("event_id", eventId)
        .eq("guest_id", guestId)
        .single();

      if (!isMounted) return;

      if (!profile) {
        setView("register");
        return;
      }
      setMyProfile(profile);

      const { data: activeMatch } = await supabase
        .from("icebreaker_matches")
        .select(
          "id, guest1_id, guest2_id, mission_text, status, photo_url, completed_at, created_at",
        )
        .eq("event_id", eventId)
        .eq("status", "pending")
        .or(`guest1_id.eq.${guestId},guest2_id.eq.${guestId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

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
          .single();
        if (isMounted) {
          setCurrentMatch({ ...activeMatch, partner });
          setView("active_mission");
        }
      } else {
        await fetchFeed(isMounted);
        if (isMounted) setView("hub");
      }
    } catch (err) {
      console.error(err);
      if (isMounted) setView("register");
    }
  };

  const fetchFeed = async (isMounted = true) => {
    const { data } = await supabase
      .from("icebreaker_matches")
      .select("id, mission_text, photo_url, completed_at, guest1_id, guest2_id")
      .eq("event_id", eventId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(20);
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
      const { error } = await supabase.from("icebreaker_profiles").upsert({
        event_id: eventId,
        guest_id: guestId,
        name: guestName,
        photo_url: photoUrl,
      });
      if (error) throw error;
      await checkStatus();
    } catch {
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
        .neq("guest_id", guestId);

      const { data: missions } = await supabase
        .from("icebreaker_missions")
        .select("id, content")
        .eq("event_id", eventId);

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

      setTimeout(async () => {
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
          .single();

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
        .eq("id", currentMatch.id);

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
      <div className="min-h-screen bg-slate-900 flex justify-center items-center">
        <Loader2 className="animate-spin text-white" size={48} />
      </div>
    );
  }

  const primaryColor = eventData.design_config?.colors?.primary || "#3b82f6";
  const bgColor = eventData.design_config?.colors?.background || "#f8fafc";
  const primaryTextColor =
    getLuminance(primaryColor) > 150 ? "#1e293b" : "#ffffff";

  // ---- Register ----
  if (view === "register") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-1000"
        style={{ backgroundColor: bgColor }}
        dir="rtl"
      >
        <button
          onClick={() => navigate(-1)}
          className="absolute right-6 top-8 p-2 bg-slate-200/50 hover:bg-slate-200 rounded-full z-10 transition-colors"
        >
          <ChevronLeft size={24} className="text-slate-700" />
        </button>

        <div className="w-full max-w-sm text-center relative z-10 animate-in zoom-in-95 duration-500">
          <div
            className="inline-flex p-5 rounded-[1.5rem] mb-6 shadow-sm bg-white border"
            style={{ borderColor: `${primaryColor}30` }}
          >
            <Zap size={48} style={{ color: primaryColor }} />
          </div>
          <h1 className="text-4xl font-black mb-2 text-slate-800">
            IceBreaker
          </h1>
          <p className="text-slate-500 font-medium mb-8 text-sm leading-relaxed">
            מצאו אנשים, בצעו משימות מצחיקות, ותעדו הכל.
          </p>

          <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.07)]">
            <h2 className="text-lg font-bold mb-2 text-slate-800">
              תמונת זיהוי
            </h2>
            <p className="text-slate-400 text-sm mb-5">כדי שימצאו אתכם בקלות</p>
            <label className="relative cursor-pointer inline-block group mb-6">
              <div
                className="w-36 h-36 mx-auto rounded-full bg-slate-50 border-4 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all shadow-inner"
                style={{ borderColor: uploading ? primaryColor : undefined }}
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    className="w-full h-full object-cover"
                    alt="profile"
                  />
                ) : (
                  <Camera size={36} className="text-slate-300" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
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
              className="w-full font-black py-4 rounded-[1.2rem] text-xl shadow-lg transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: primaryColor, color: primaryTextColor }}
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
        style={{ backgroundColor: primaryColor, color: primaryTextColor }}
        dir="rtl"
      >
        <div
          ref={rouletteRef}
          className="bg-white/20 p-12 rounded-[3rem] backdrop-blur-md shadow-2xl border border-white/20"
        >
          <Loader2
            className="animate-spin mx-auto mb-8"
            size={72}
            style={{ color: primaryTextColor }}
          />
          <h2 className="text-3xl font-black mb-2 drop-shadow-md">
            מאתר קורבן...
          </h2>
          <p className="text-lg font-medium mt-3 animate-pulse opacity-70">
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
        className="min-h-screen flex flex-col transition-colors duration-1000"
        style={{ backgroundColor: bgColor }}
        dir="rtl"
      >
        <header
          className="p-6 flex justify-between items-center rounded-b-[3rem] shadow-md z-10"
          style={{ backgroundColor: primaryColor }}
        >
          <button
            onClick={() => setView("hub")}
            className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
          >
            <ChevronLeft size={24} style={{ color: primaryTextColor }} />
          </button>
          <span className="bg-white text-slate-900 px-5 py-2 rounded-full text-sm font-bold shadow-sm flex items-center gap-2">
            <Sparkles size={15} className="text-amber-500" /> משימה פעילה!
          </span>
          <div className="w-10" />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mission-reveal">
          <p className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-widest">
            המטרה שלך:
          </p>

          <div
            className="w-32 h-32 rounded-full overflow-hidden bg-slate-100 border-[5px] shadow-2xl mb-4 mx-auto"
            style={{ borderColor: primaryColor }}
          >
            {currentMatch.partner?.photo_url ? (
              <img
                src={currentMatch.partner.photo_url}
                className="w-full h-full object-cover"
                alt={currentMatch.partner.name}
              />
            ) : (
              <User size={44} className="m-auto mt-10 text-slate-300" />
            )}
          </div>
          <h1 className="text-4xl font-black text-slate-800 mb-8">
            {currentMatch.partner?.name}
          </h1>

          {/* Mission card */}
          <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.07)] w-full max-w-md relative">
            <div
              className="absolute -top-5 right-6 w-11 h-11 rounded-full flex items-center justify-center shadow-lg border-4 border-white"
              style={{ backgroundColor: primaryColor }}
            >
              <Target style={{ color: primaryTextColor }} size={18} />
            </div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-50"
              style={{ color: primaryColor }}
            >
              פקודת מבצע
            </p>
            <p className="text-2xl font-black text-slate-800 leading-snug">
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
              className="w-full font-black py-5 rounded-[1.5rem] text-lg shadow-xl flex justify-center items-center gap-3 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              style={{ backgroundColor: primaryColor, color: primaryTextColor }}
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
      className="min-h-screen font-sans transition-colors duration-1000 pb-12"
      style={{ backgroundColor: bgColor }}
      dir="rtl"
    >
      <div
        className="rounded-b-[3rem] pt-12 pb-24 px-6 relative z-10 shadow-lg flex justify-between items-center"
        style={{ backgroundColor: primaryColor }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
          style={{ color: primaryTextColor }}
        >
          <ChevronLeft size={22} />
        </button>
        <h1
          className="text-2xl font-black flex items-center gap-2"
          style={{ color: primaryTextColor }}
        >
          IceBreaker{" "}
          <Zap size={18} style={{ fill: primaryTextColor, opacity: 0.7 }} />
        </h1>
        <div className="w-10 h-10 rounded-[1rem] overflow-hidden bg-black/10 shadow-inner border border-white/10">
          {myProfile?.photo_url ? (
            <img
              src={myProfile.photo_url}
              className="w-full h-full object-cover"
              alt="avatar"
            />
          ) : (
            <User
              size={20}
              className="m-auto mt-2 opacity-50"
              style={{ color: primaryTextColor }}
            />
          )}
        </div>
      </div>

      <div className="px-5 -mt-14 relative z-20 max-w-md mx-auto">
        {/* Start Button — styled as challenge card */}
        <button
          onClick={startRoulette}
          className="fade-up-item w-full bg-white p-7 rounded-[2.5rem] text-center shadow-[0_12px_40px_rgb(0,0,0,0.10)] mb-7 hover:scale-[1.02] active:scale-[0.98] transition-transform group border border-slate-50 relative overflow-hidden"
        >
          {/* accent top bar */}
          <div
            className="absolute top-0 left-0 w-full h-1.5 rounded-t-[2.5rem]"
            style={{ backgroundColor: primaryColor }}
          />
          <div
            className="w-16 h-16 rounded-[1.2rem] flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: `${primaryColor}15` }}
          >
            <Zap
              className="group-hover:animate-bounce"
              size={30}
              style={{ color: primaryColor }}
            />
          </div>
          <h2 className="text-2xl font-black text-slate-800">
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
            <div className="fade-up-item text-center py-14 bg-white rounded-[2rem] shadow-sm border border-slate-100">
              <ImagePlus size={40} className="mx-auto mb-4 text-slate-200" />
              <p className="text-slate-600 font-bold">הקיר ריק.</p>
              <p className="text-slate-400 text-sm mt-1">
                היו הראשונים לבצע משימה!
              </p>
            </div>
          ) : (
            feed.map((match) => (
              <div
                key={match.id}
                className="fade-up-item bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.06)]"
              >
                {/* Mission text */}
                <div className="p-5 bg-slate-50/60 border-b border-slate-100">
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60"
                    style={{ color: primaryColor }}
                  >
                    משימה שבוצעה:
                  </p>
                  <p className="text-base font-black text-slate-800 leading-snug">
                    "{match.mission_text}"
                  </p>
                </div>

                {/* Proof photo */}
                {match.photo_url && (
                  <div className="aspect-square bg-slate-100 w-full">
                    <img
                      src={match.photo_url}
                      className="w-full h-full object-cover"
                      alt="Mission Proof"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Footer */}
                <div className="p-4 flex items-center justify-between text-xs text-slate-400 font-bold">
                  <div className="flex items-center gap-2">
                    <span>בוצע בשטח 🎯</span>
                    <button
                      onClick={() => handleReport(match.id)}
                      className="text-slate-200 hover:text-rose-400 transition-colors"
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
