import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { compressImage, isAllowedImageType } from "../lib/imageUtils";
import { safeGetItem } from "../lib/safeStorage";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";
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
  Sparkles,
  AlertCircle,
  Lock,
  UserMinus,
} from "lucide-react";
import gsap from "gsap";
import { CLAY_RAISED, DEFAULT_PRIMARY, clayButtonStyle } from "../lib/clay";
import { accentOn } from "../lib/colors";
import { useEventBackdrop } from "../lib/useEventBackdrop";

// הזרימה חד-צדדית ופרטית:
//   1. אורח נכנס למאגר (icebreaker_profiles, is_active = true).
//   2. "הגרל משימה" בוחר אורח פעיל אחר + משימה. זו תצוגה מקדימה בלבד, על
//      המכשיר של המגריל — שום דבר לא נכתב ל-DB, ולכן גם אין מה שיגיע למטרה.
//   3. "קבלתי על עצמי" יוצר שורה ב-icebreaker_matches (guest1 = המגריל,
//      status = 'pending'). מדיניות ה-RLS מראה שורה ממתינה רק ל-guest1.
//   4. "סיימתי את המשימה" מסמן completed, ואז היא עולה לקיר התהילה.

// הגרלות חוזרות לכל משימה: המונה מתאפס כשמשימה מתקבלת.
const MAX_REROLLS = 3;
// אנימציית ההגרלה — מספיק כדי להרגיש כמו הגרלה, לא כדי לעכב.
const DRAW_ANIMATION_MS = 1200;

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ההגרלה הפתוחה ומונה ההגרלות החוזרות נשמרים ב-sessionStorage: יציאה
// וחזרה לא מגרילות מחדש בחינם, ורענון לא מאפס את המונה.
const sessionKey = (eventId, name) => `icebreaker_${name}_${eventId}`;
const readSession = (key, fallback) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const writeSession = (key, value) => {
  try {
    if (value === null || value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // אחסון חסום — ההגרלה פשוט לא שורדת רענון.
  }
};

const poolCountLabel = (count) =>
  count === 1 ? "אורח אחד במשחק עכשיו" : `${count} אורחים במשחק עכשיו`;

const Icebreaker = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const guestName = safeGetItem("guest_name");
  const guestId = getOrCreateDeviceId();

  const previewKey = sessionKey(eventId, "preview");
  const rerollsKey = sessionKey(eventId, "rerolls");

  const [eventData, setEventData] = useState(null);
  useEventBackdrop(eventData?.design_config?.colors?.background);
  const [view, setView] = useState("loading");
  const [myProfile, setMyProfile] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [feed, setFeed] = useState([]);
  const [poolCount, setPoolCount] = useState(null);

  const [preview, setPreview] = useState(() => readSession(previewKey, null));
  const [rerollsLeft, setRerollsLeft] = useState(() =>
    readSession(rerollsKey, MAX_REROLLS),
  );
  // "עוד אורחים מצטרפים..." — מוצג בכרטיס במסך הראשי, לא כהודעה חולפת.
  const [emptyPool, setEmptyPool] = useState(false);

  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const proofInputRef = useRef(null);
  const drawCardRef = useRef(null);
  const drawTweenRef = useRef(null);
  // מזהה הגרלה נוכחית: ביטול מקדם אותו, וכך הגרלה שהשאילתות שלה עוד רצות
  // לא ממשיכה אחרי שהאורח כבר יצא.
  const drawRunRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      drawTweenRef.current?.kill();
    };
  }, []);

  const savePreview = useCallback(
    (value) => {
      setPreview(value);
      writeSession(previewKey, value);
    },
    [previewKey],
  );

  const saveRerolls = useCallback(
    (value) => {
      setRerollsLeft(value);
      writeSession(rerollsKey, value);
    },
    [rerollsKey],
  );

  const fetchFeed = useCallback(
    async (isActive = () => isMountedRef.current) => {
      const { data, error } = await supabase
        .from("icebreaker_matches")
        .select("id, mission_text, photo_url, completed_at")
        .eq("event_id", eventId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(20);

      if (error) console.error("Error fetching feed:", error);
      if (isActive()) setFeed(data || []);
    },
    [eventId],
  );

  const fetchPoolCount = useCallback(async () => {
    const { count, error } = await supabase
      .from("icebreaker_profiles")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("is_active", true);
    if (error) {
      console.error("Error counting pool:", error);
      return;
    }
    if (isMountedRef.current) setPoolCount(count ?? 0);
  }, [eventId]);

  const checkStatus = useCallback(
    async (isActive = () => isMountedRef.current) => {
      try {
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("id, name, design_config")
          .eq("id", eventId)
          .single();

        if (eventError) throw eventError;
        if (!isActive()) return;
        setEventData(event);
        fetchPoolCount();

        const { data: profile, error: profileError } = await supabase
          .from("icebreaker_profiles")
          .select("id, guest_id, name, photo_url, is_active")
          .eq("event_id", eventId)
          .eq("guest_id", guestId)
          .maybeSingle();

        if (profileError) {
          console.error("Error fetching icebreaker profile:", profileError);
        }
        if (!isActive()) return;

        setMyProfile(profile || null);
        // מי שיצא מהמאגר חוזר למסך ההצטרפות, עם התמונה שכבר העלה.
        if (!profile || !profile.is_active) {
          setPhotoUrl(profile?.photo_url || "");
          setView("register");
          return;
        }

        // רק משימות שהאורח עצמו הגריל (guest1). משימה שבה הוא המטרה לא
        // מוצגת לו — וה-RLS ממילא לא מחזיר אותה.
        const { data: activeMatch, error: matchError } = await supabase
          .from("icebreaker_matches")
          .select("id, guest2_id, mission_text, status, created_at")
          .eq("event_id", eventId)
          .eq("status", "pending")
          .eq("guest1_id", guestId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (matchError) {
          console.error("Error fetching active match:", matchError);
        }

        if (activeMatch) {
          const { data: partner } = await supabase
            .from("icebreaker_profiles")
            .select("guest_id, name, photo_url")
            .eq("event_id", eventId)
            .eq("guest_id", activeMatch.guest2_id)
            .maybeSingle();

          if (isActive()) {
            setCurrentMatch({ ...activeMatch, partner });
            setView("active_mission");
          }
        } else {
          await fetchFeed(isActive);
          if (isActive()) setView("hub");
        }
      } catch (err) {
        console.error("Icebreaker Init failed:", err);
        if (isActive()) setView("register");
      }
    },
    [eventId, guestId, fetchFeed, fetchPoolCount],
  );

  useEffect(() => {
    if (!eventId || !guestName || !guestId || !isValidUUIDv4(guestId))
      return navigate("/");
    let isMounted = true;
    // פונקציה ולא ערך: בוליאני עובר by value, וה-cleanup שמאפס אותו לא היה
    // מגיע ל-checkStatus שכבר רצה — setState אחרי unmount / מעבר אירוע.
    checkStatus(() => isMounted);
    return () => {
      isMounted = false;
    };
  }, [eventId, guestId, guestName, navigate, checkStatus]);

  // מונה חי: כל הצטרפות / יציאה מהמאגר מרעננת את הספירה. DELETE לא עובר
  // דרך filter של realtime, ולכן גם חזרה ללשונית מרעננת.
  useEffect(() => {
    if (!eventId) return undefined;
    const channel = supabase
      .channel(`icebreaker_pool_${eventId}_${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "icebreaker_profiles",
          filter: `event_id=eq.${eventId}`,
        },
        () => fetchPoolCount(),
      )
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchPoolCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchPoolCount]);

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
    if (view === "preview" || view === "active_mission") {
      gsap.fromTo(
        ".mission-reveal",
        { scale: 0.85, opacity: 0, y: 40 },
        { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.5)" },
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
      // supabase-js לא זורק — בלי הבדיקה נשמר URL לקובץ שמעולם לא עלה.
      const { error: uploadError } = await supabase.storage
        .from("icebreaker-uploads")
        .upload(fileName, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (uploadError) throw uploadError;
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

  // הצטרפות ראשונה יוצרת פרופיל; חזרה אחרי "הסר אותי" מפעילה אותו מחדש.
  const handleJoinGame = async () => {
    if (isJoining) return;
    setIsJoining(true);
    try {
      const payload = {
        event_id: eventId,
        guest_id: guestId,
        name: guestName,
        photo_url: photoUrl,
        is_active: true,
      };

      const { error } = myProfile
        ? await supabase
            .from("icebreaker_profiles")
            .update(payload)
            .eq("id", myProfile.id)
            .eq("guest_id", guestId)
        : await supabase.from("icebreaker_profiles").insert([payload]);
      if (error) throw error;

      await checkStatus();
    } catch (err) {
      console.error("Join game error:", err);
      showToast("שגיאה בהצטרפות למשחק, נסה שוב", "error");
    } finally {
      setIsJoining(false);
    }
  };

  // "הסר אותי מהמאגר": is_active = false — מאותו רגע אי אפשר להגריל אותו.
  // הפרופיל (והתמונה) נשארים, כך שחזרה היא לחיצה אחת.
  const handleLeavePool = async () => {
    if (leaving || !myProfile) return;
    setLeaving(true);
    try {
      // עדכון שנחסם ב-RLS חוזר בלי שגיאה ועם 0 שורות.
      const { data, error } = await supabase
        .from("icebreaker_profiles")
        .update({ is_active: false })
        .eq("id", myProfile.id)
        .eq("guest_id", guestId)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("profile_not_updated");

      savePreview(null);
      setEmptyPool(false);
      setConfirmLeaveOpen(false);
      setMyProfile({ ...myProfile, is_active: false });
      setPhotoUrl(myProfile.photo_url || "");
      setView("register");
      fetchPoolCount();
      showToast("הוסרת מהמאגר. אפשר לחזור בכל רגע", "success");
    } catch (err) {
      console.error("Leave pool error:", err);
      showToast("לא הצלחנו להסיר אותך, נסו שוב", "error");
    } finally {
      setLeaving(false);
    }
  };

  // בוחר מטרה ומשימה. עדיפות לאורחים שעוד לא הוגרלו על ידך באירוע הזה;
  // כשכולם כבר הוגרלו — חוזרים לכל המאגר (בלי מי שבדיוק דילגת עליו).
  const drawCandidate = async (skip) => {
    const [othersRes, missionsRes, mineRes] = await Promise.all([
      supabase
        .from("icebreaker_profiles")
        .select("guest_id, name, photo_url")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .neq("guest_id", guestId)
        .limit(500),
      supabase
        .from("icebreaker_missions")
        .select("id, content")
        .eq("event_id", eventId)
        .limit(200),
      supabase
        .from("icebreaker_matches")
        .select("guest2_id")
        .eq("event_id", eventId)
        .eq("guest1_id", guestId)
        .limit(500),
    ]);
    if (othersRes.error) throw othersRes.error;
    if (missionsRes.error) throw missionsRes.error;
    if (mineRes.error) throw mineRes.error;

    const others = othersRes.data || [];
    const missions = missionsRes.data || [];
    if (!others.length) return { reason: "empty_pool" };
    if (!missions.length) return { reason: "no_missions" };

    const alreadyDrawn = new Set((mineRes.data || []).map((m) => m.guest2_id));
    const notSkipped = others.filter((p) => p.guest_id !== skip?.guestId);
    const fresh = notSkipped.filter((p) => !alreadyDrawn.has(p.guest_id));
    const target = pickRandom(
      fresh.length ? fresh : notSkipped.length ? notSkipped : others,
    );

    const otherMissions = missions.filter((m) => m.content !== skip?.mission);
    const mission = pickRandom(otherMissions.length ? otherMissions : missions);

    return { preview: { target, mission: mission.content } };
  };

  // isReroll: נספר מול MAX_REROLLS. skip: ההגרלה הקודמת, כדי לא להגריל
  // אותה שוב מיד.
  const startDraw = async ({ isReroll = false, skip = null } = {}) => {
    const runId = ++drawRunRef.current;
    const isCurrentRun = () =>
      isMountedRef.current && runId === drawRunRef.current;
    setEmptyPool(false);
    setView("drawing");

    requestAnimationFrame(() => {
      if (!drawCardRef.current) return;
      drawTweenRef.current?.kill();
      drawTweenRef.current = gsap.to(drawCardRef.current, {
        scale: 1.06,
        duration: 0.2,
        yoyo: true,
        repeat: -1,
      });
    });

    try {
      const [result] = await Promise.all([
        drawCandidate(skip),
        delay(DRAW_ANIMATION_MS),
      ]);
      if (!isCurrentRun()) return;
      drawTweenRef.current?.kill();

      if (result.reason === "empty_pool") {
        setEmptyPool(true);
        setView(preview ? "preview" : "hub");
        return;
      }
      if (result.reason === "no_missions") {
        showToast("מנהל האירוע עדיין לא הזין משימות", "warning");
        setView("hub");
        return;
      }

      savePreview(result.preview);
      if (isReroll) saveRerolls(Math.max(0, rerollsLeft - 1));
      setView("preview");
    } catch (err) {
      console.error("Draw failed:", err);
      if (!isCurrentRun()) return;
      drawTweenRef.current?.kill();
      showToast("לא הצלחנו להגריל משימה, נסו שוב", "error");
      setView(preview ? "preview" : "hub");
    }
  };

  const cancelDraw = () => {
    drawRunRef.current += 1;
    drawTweenRef.current?.kill();
    setView(preview ? "preview" : "hub");
  };

  const handleReroll = () => {
    if (rerollsLeft <= 0 || !preview) return;
    startDraw({
      isReroll: true,
      skip: { guestId: preview.target.guest_id, mission: preview.mission },
    });
  };

  // רק כאן נכתבת שורה ל-DB. לפני כן מוודאים שהמטרה עדיין במאגר — אם יצאה
  // בינתיים, מגרילים מישהו אחר בלי לחייב הגרלה חוזרת.
  const handleAccept = async () => {
    if (accepting || !preview) return;
    setAccepting(true);
    try {
      const { data: stillActive, error: checkError } = await supabase
        .from("icebreaker_profiles")
        .select("guest_id")
        .eq("event_id", eventId)
        .eq("guest_id", preview.target.guest_id)
        .eq("is_active", true)
        .maybeSingle();
      if (checkError) throw checkError;
      if (!stillActive) {
        showToast(
          `${preview.target.name} יצא/ה מהמשחק — מגרילים מחדש`,
          "warning",
        );
        const skip = {
          guestId: preview.target.guest_id,
          mission: preview.mission,
        };
        savePreview(null);
        setAccepting(false);
        startDraw({ skip });
        return;
      }

      const { data: match, error } = await supabase
        .from("icebreaker_matches")
        .insert([
          {
            event_id: eventId,
            guest1_id: guestId,
            guest2_id: preview.target.guest_id,
            mission_text: preview.mission,
            status: "pending",
          },
        ])
        .select("id, guest2_id, mission_text, status, created_at")
        .single();
      // 42501 = ה-RLS דחה את ההגרלה: המשימה נמחקה או נערכה בדשבורד, או
      // שהמטרה יצאה מהמאגר ממש עכשיו. ההגרלה כבר לא בתוקף — מגרילים
      // מחדש בלי לחייב הגרלה חוזרת, במקום שגיאה בלי מוצא.
      if (error?.code === "42501") {
        const skip = {
          guestId: preview.target.guest_id,
          mission: preview.mission,
        };
        showToast("ההגרלה כבר לא בתוקף — מגרילים מחדש", "warning");
        savePreview(null);
        setAccepting(false);
        startDraw({ skip });
        return;
      }
      if (error) throw error;
      if (!isMountedRef.current) return;

      setCurrentMatch({ ...match, partner: preview.target });
      savePreview(null);
      saveRerolls(MAX_REROLLS);
      setView("active_mission");
    } catch (err) {
      console.error("Accept mission failed:", err);
      showToast("לא הצלחנו לשמור את המשימה, נסו שוב", "error");
    } finally {
      if (isMountedRef.current) setAccepting(false);
    }
  };

  // סיום משימה; תמונה לקיר התהילה היא תוספת אופציונלית.
  const completeMission = async (proofFile) => {
    if (completing || !currentMatch) return;
    setCompleting(true);
    try {
      let proofUrl = null;
      if (proofFile) {
        const compressed = await compressImage(proofFile, {
          maxWidth: 1200,
          quality: 0.82,
        });
        const fileName = `proofs/${eventId}/${currentMatch.id}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("icebreaker-uploads")
          .upload(fileName, compressed, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        proofUrl = supabase.storage
          .from("icebreaker-uploads")
          .getPublicUrl(fileName).data.publicUrl;
      }

      // עדכון שנחסם ב-RLS חוזר בלי שגיאה ועם 0 שורות, ולכן בודקים גם את
      // מספר השורות — אחרת המשימה "הושלמה" רק על המסך.
      const { data: updated, error: updateError } = await supabase
        .from("icebreaker_matches")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          ...(proofUrl ? { photo_url: proofUrl } : {}),
        })
        .eq("id", currentMatch.id)
        .eq("guest1_id", guestId)
        .select("id");
      if (updateError) throw updateError;
      if (!updated?.length) throw new Error("mission_not_updated");

      setCurrentMatch(null);
      await fetchFeed();
      setView("hub");
      showToast("המשימה הושלמה! כל הכבוד! 🎯", "success");
    } catch (err) {
      console.error("Complete mission failed:", err);
      showToast("לא הצלחנו לסמן את המשימה, נסו שוב", "error");
    } finally {
      if (isMountedRef.current) setCompleting(false);
    }
  };

  const handleProofSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isAllowedImageType(file)) {
      showToast("יש להעלות קובץ תמונה בלבד", "error");
      return;
    }
    completeMission(file);
  };

  const handleReport = async (matchId) => {
    if (!window.confirm("האם לדווח על תוכן זה כפוגעני?")) return;
    try {
      // supabase-js לא זורק — בלי הבדיקה הוצג "הדיווח התקבל" גם בכישלון.
      const { error } = await supabase.from("reports").insert([
        {
          event_id: eventId,
          reported_item_id: matchId,
          item_type: "icebreaker",
          reporter_id: guestId,
        },
      ]);
      if (error) throw error;
      showToast("הדיווח התקבל ויטופל על ידי מנהלי האירוע", "success");
    } catch (e) {
      console.error(e);
      showToast("הדיווח לא נשלח, נסו שוב", "error");
    }
  };

  if (view === "loading" || !eventData) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-clay-gradient">
        <Loader2 className="animate-spin text-clay-muted" size={48} />
      </div>
    );
  }

  const primaryColor =
    eventData.design_config?.colors?.primary || DEFAULT_PRIMARY;
  const accent = accentOn(primaryColor);

  const poolPill =
    poolCount === null ? null : (
      <p
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-slate-600 bg-clay-surface shadow-clay-md"
        aria-live="polite"
      >
        <span className="relative flex w-2.5 h-2.5" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-60 animate-ping" />
          <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-600" />
        </span>
        {poolCountLabel(poolCount)}
      </p>
    );

  const targetAvatar = (person, size = "w-32 h-32") => (
    <div
      className={`${size} rounded-full overflow-hidden mx-auto p-2 bg-clay-well flex items-center justify-center`}
      style={{ boxShadow: "var(--shadow-clay-inset)" }}
    >
      {person?.photo_url ? (
        <img
          src={person.photo_url}
          className="w-full h-full object-cover rounded-full"
          alt={person.name}
        />
      ) : (
        <User size={44} className="text-slate-300" />
      )}
    </div>
  );

  const missionCard = (text) => (
    <div
      className={`p-8 rounded-clay-lg w-full max-w-md relative ${CLAY_RAISED}`}
    >
      <div
        className="absolute -top-5 right-6 w-12 h-12 rounded-full flex items-center justify-center text-white"
        style={clayButtonStyle(primaryColor)}
      >
        <Target size={18} />
      </div>
      <p
        className="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-60"
        style={{ color: accent }}
      >
        פקודת מבצע
      </p>
      <p className="text-2xl font-black text-slate-700 leading-snug">{text}</p>
    </div>
  );

  const backHeader = (badge) => (
    <header className="p-5 flex justify-between items-center z-10 mx-3 mt-[calc(0.75rem+env(safe-area-inset-top))] rounded-[1.8rem] bg-clay-surface shadow-clay-md">
      <button
        onClick={() => setView("hub")}
        aria-label="חזרה"
        className="p-2.5 rounded-full text-clay-muted bg-clay-surface shadow-clay-md active:shadow-clay-pressed transition-all"
      >
        <ChevronLeft size={24} />
      </button>
      <span className="px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 text-slate-700 bg-clay-surface shadow-clay-md">
        {badge}
      </span>
      <div className="w-10" />
    </header>
  );

  const privacyNote = (
    <p className="flex items-center justify-center gap-1.5 text-clay-muted font-medium text-xs mt-4">
      <Lock size={13} aria-hidden="true" /> המשימה חשאית — רק את/ה רואה אותה
    </p>
  );

  // ---- Register / Rejoin ----
  if (view === "register") {
    const rejoining = Boolean(myProfile);
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 bg-clay-gradient"
        dir="rtl"
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="חזרה"
          className="absolute right-6 top-[calc(2rem+env(safe-area-inset-top))] p-3 rounded-full z-10 text-clay-muted bg-clay-surface shadow-clay-md active:shadow-clay-pressed transition-all"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="w-full max-w-sm text-center relative z-10">
          <div
            className="inline-flex p-5 rounded-[1.5rem] mb-6 text-white"
            style={clayButtonStyle(primaryColor)}
          >
            <Zap size={48} />
          </div>
          <h1 className="text-4xl font-black mb-2 text-slate-700">
            IceBreaker
          </h1>
          <p className="text-clay-muted font-medium mb-4 text-sm leading-relaxed">
            {rejoining
              ? "יצאת מהמאגר, אז אף אחד לא יכול להגריל אותך. רוצה לחזור?"
              : "מגרילים אורח ומשימה חשאית, מבצעים, ומתעדים בקיר התהילה."}
          </p>
          {poolCount > 0 && <div className="mb-6">{poolPill}</div>}

          <div className={`p-8 rounded-clay-lg ${CLAY_RAISED}`}>
            <h2 className="text-lg font-bold mb-2 text-slate-700">
              תמונת זיהוי
            </h2>
            <p className="text-clay-muted text-sm mb-5">
              כדי שימצאו אתכם בקלות
            </p>
            <label className="relative cursor-pointer inline-block group mb-6">
              <div
                className="w-36 h-36 mx-auto rounded-full flex items-center justify-center overflow-hidden p-2 bg-clay-well"
                style={{ boxShadow: "var(--shadow-clay-inset)" }}
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
                      style={{ color: accent }}
                    />
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleProfilePhotoUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleJoinGame}
              disabled={isJoining}
              className="w-full font-black py-4 rounded-full text-xl transition-all active:scale-[0.98] disabled:opacity-50 text-white"
              style={clayButtonStyle(primaryColor)}
            >
              {isJoining ? (
                <Loader2 className="animate-spin mx-auto" size={24} />
              ) : rejoining ? (
                "חזרה למשחק!"
              ) : (
                "אני בפנים!"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Drawing ----
  if (view === "drawing") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-center p-6 bg-clay-gradient"
        dir="rtl"
      >
        <div
          ref={drawCardRef}
          className={`p-12 rounded-clay-lg ${CLAY_RAISED}`}
        >
          <Loader2
            className="animate-spin mx-auto mb-8"
            size={72}
            style={{ color: accent }}
          />
          <h2 className="text-3xl font-black mb-2 text-slate-700">
            מגריל מטרה...
          </h2>
          <p className="text-lg font-medium mt-3 animate-pulse text-clay-muted">
            ומשימה חשאית
          </p>
        </div>
        <button
          type="button"
          onClick={cancelDraw}
          className="mt-10 px-8 py-3.5 rounded-full font-bold text-slate-600 bg-clay-surface shadow-clay-md active:shadow-clay-pressed transition-all"
        >
          ביטול
        </button>
      </div>
    );
  }

  // ---- Preview: accept or reroll ----
  if (view === "preview" && preview) {
    return (
      <div className="min-h-screen flex flex-col bg-clay-gradient" dir="rtl">
        {backHeader(
          <>
            <Sparkles size={15} className="text-amber-800" /> ההגרלה שלך
          </>,
        )}

        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mission-reveal">
          {emptyPool && (
            <p className="w-full max-w-md mb-6 p-4 rounded-clay-field bg-clay-well shadow-clay-inset text-sm font-bold text-slate-600">
              עוד אורחים מצטרפים ממש עכשיו — נסו להגריל שוב בעוד כמה דקות! 🎉
            </p>
          )}
          <p className="text-sm font-bold text-clay-muted mb-4 uppercase tracking-widest">
            המטרה שלך:
          </p>
          <div className="mb-4">{targetAvatar(preview.target)}</div>
          <h1 className="text-4xl font-black text-slate-700 mb-8 break-words max-w-full">
            {preview.target.name}
          </h1>

          {missionCard(preview.mission)}

          <div className="w-full max-w-md pt-10 pb-6 space-y-3">
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full font-black py-5 rounded-full text-lg flex justify-center items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 text-white"
              style={clayButtonStyle(primaryColor)}
            >
              {accepting ? (
                <Loader2 className="animate-spin" size={22} />
              ) : (
                "קבלתי על עצמי! 🎯"
              )}
            </button>
            <button
              onClick={handleReroll}
              disabled={accepting || rerollsLeft <= 0}
              className="w-full font-bold py-4 rounded-full flex justify-center items-center gap-2 text-slate-600 bg-clay-surface shadow-clay-md active:shadow-clay-pressed transition-all disabled:opacity-50"
            >
              {rerollsLeft > 0 ? (
                <>
                  הגרל מחדש 🔄
                  <span className="text-xs font-bold text-clay-muted">
                    (נותרו {rerollsLeft})
                  </span>
                </>
              ) : (
                "נגמרו ההגרלות החוזרות"
              )}
            </button>
            {privacyNote}
          </div>
        </div>
      </div>
    );
  }

  // ---- Active Mission ----
  if (view === "active_mission" && currentMatch) {
    return (
      <div className="min-h-screen flex flex-col bg-clay-gradient" dir="rtl">
        {backHeader(
          <>
            <Sparkles size={15} className="text-amber-800" /> משימה פעילה!
          </>,
        )}

        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mission-reveal">
          <p className="text-sm font-bold text-clay-muted mb-4 uppercase tracking-widest">
            המטרה שלך:
          </p>
          <div className="mb-4">{targetAvatar(currentMatch.partner)}</div>
          <h1 className="text-4xl font-black text-slate-700 mb-8 break-words max-w-full">
            {currentMatch.partner?.name || "אורח/ת שיצא/ה מהמשחק"}
          </h1>

          {missionCard(currentMatch.mission_text)}

          <div className="w-full max-w-md pt-10 pb-6 space-y-3">
            <button
              onClick={() => completeMission(null)}
              disabled={completing}
              className="w-full font-black py-5 rounded-full text-lg flex justify-center items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 text-white"
              style={clayButtonStyle(primaryColor)}
            >
              {completing ? (
                <Loader2 className="animate-spin" size={22} />
              ) : (
                "סיימתי את המשימה ✅"
              )}
            </button>
            <input
              type="file"
              accept="image/*"
              ref={proofInputRef}
              onChange={handleProofSelected}
              className="hidden"
            />
            <button
              onClick={() => proofInputRef.current?.click()}
              disabled={completing}
              className="w-full font-bold py-4 rounded-full flex justify-center items-center gap-2 text-slate-600 bg-clay-surface shadow-clay-md active:shadow-clay-pressed transition-all disabled:opacity-50"
            >
              <Camera size={18} /> סיימתי + תמונה לקיר התהילה
            </button>
            {privacyNote}
          </div>
        </div>
      </div>
    );
  }

  // ---- Hub / Wall of Fame ----
  return (
    <div className="min-h-screen font-sans pb-12 bg-clay-gradient" dir="rtl">
      <div className="pt-[calc(3rem+env(safe-area-inset-top))] pb-4 px-6 relative z-10 flex justify-between items-center max-w-md mx-auto w-full">
        <button
          onClick={() => navigate(-1)}
          aria-label="חזרה"
          className="p-3 rounded-full text-clay-muted bg-clay-surface shadow-clay-md active:shadow-clay-pressed transition-all"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-2xl font-black flex items-center gap-2 text-slate-700">
          IceBreaker{" "}
          <Zap size={18} style={{ fill: primaryColor, color: accent }} />
        </h1>
        <div className="w-11 h-11 rounded-[1rem] overflow-hidden bg-clay-well flex items-center justify-center shadow-[inset_2px_2px_5px_rgba(0,0,0,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.7)]">
          {myProfile?.photo_url ? (
            <img
              src={myProfile.photo_url}
              className="w-full h-full object-cover"
              alt="avatar"
            />
          ) : (
            <User size={20} className="text-slate-300" />
          )}
        </div>
      </div>

      <div className="px-5 relative z-20 max-w-md mx-auto">
        {poolPill && (
          <div className="fade-up-item flex justify-center mb-6">
            {poolPill}
          </div>
        )}

        {/* משימה פעילה קודמת להגרלה חדשה: אחת בכל פעם */}
        {currentMatch ? (
          <button
            onClick={() => setView("active_mission")}
            className={`fade-up-item w-full p-7 rounded-clay-lg text-center mb-7 active:scale-[0.98] transition-transform relative overflow-hidden ${CLAY_RAISED}`}
          >
            <div
              className="absolute top-0 left-0 w-full h-2 rounded-t-[2.5rem]"
              style={{ backgroundColor: primaryColor }}
            />
            <p className="text-xs font-bold text-clay-muted mb-1">
              המשימה הפעילה שלך
            </p>
            <h2 className="text-xl font-black text-slate-700 leading-snug">
              {currentMatch.mission_text}
            </h2>
            <p className="text-sm font-bold mt-2" style={{ color: accent }}>
              המטרה: {currentMatch.partner?.name || "—"} · להמשך ←
            </p>
          </button>
        ) : (
          <button
            onClick={() => (preview ? setView("preview") : startDraw())}
            className={`fade-up-item w-full p-7 rounded-clay-lg text-center mb-4 hover:scale-[1.02] active:scale-[0.98] transition-transform group relative overflow-hidden ${CLAY_RAISED}`}
          >
            <div
              className="absolute top-0 left-0 w-full h-2 rounded-t-[2.5rem]"
              style={{ backgroundColor: primaryColor }}
            />
            <div
              className="w-16 h-16 rounded-clay-field flex items-center justify-center mx-auto mb-3 text-white"
              style={clayButtonStyle(primaryColor)}
            >
              <Zap className="group-hover:animate-bounce" size={30} />
            </div>
            <h2 className="text-2xl font-black text-slate-700">
              {preview ? "ההגרלה שלך מחכה" : "הגרל משימה"}
            </h2>
            <p className="text-clay-muted font-medium mt-1 text-sm">
              {preview
                ? "לחצו כדי לקבל או להגריל מחדש"
                : "אורח אקראי ומשימה חשאית — רק לעיניך"}
            </p>
          </button>
        )}

        {emptyPool && !currentMatch && (
          <p
            className="fade-up-item mb-7 p-4 rounded-clay-field bg-clay-well shadow-clay-inset text-center text-sm font-bold text-slate-600"
            role="status"
          >
            עוד אורחים מצטרפים ממש עכשיו — נסו להגריל שוב בעוד כמה דקות! 🎉
          </p>
        )}
        {!emptyPool && !currentMatch && <div className="mb-3" />}

        {/* Wall of Fame */}
        <h3 className="fade-up-item text-lg font-black text-slate-700 mb-4 flex items-center gap-2">
          <CheckCircle2 size={20} className="text-emerald-800" /> קיר תהילה
          {feed.length > 0 && (
            <span className="text-clay-muted font-medium text-sm">
              ({feed.length} משימות)
            </span>
          )}
        </h3>

        <div className="space-y-5 pb-8">
          {feed.length === 0 ? (
            <div
              className={`fade-up-item text-center py-14 rounded-[2rem] ${CLAY_RAISED}`}
            >
              <ImagePlus size={40} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600 font-bold">הקיר ריק.</p>
              <p className="text-clay-muted text-sm mt-1">
                היו הראשונים לבצע משימה!
              </p>
            </div>
          ) : (
            feed.map((match) => (
              <div
                key={match.id}
                className={`fade-up-item rounded-[2rem] overflow-hidden ${CLAY_RAISED}`}
              >
                {/* Mission text — debossed banner */}
                <div
                  className="p-5 m-2 mb-0 rounded-[1.5rem]"
                  style={{
                    backgroundColor: "#eeece5",
                    boxShadow: "var(--shadow-clay-inset)",
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60"
                    style={{ color: accent }}
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
                      className="w-full h-full object-cover rounded-clay-field"
                      alt="Mission Proof"
                      loading="lazy"
                      style={{
                        boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.15)",
                      }}
                    />
                  </div>
                )}

                {/* Footer */}
                <div className="p-4 flex items-center justify-between text-xs text-clay-muted font-bold">
                  <div className="flex items-center gap-2">
                    <span>בוצע בשטח 🎯</span>
                    <button
                      onClick={() => handleReport(match.id)}
                      className="w-11 h-11 -my-3 flex items-center justify-center rounded-full text-clay-muted hover:text-rose-400 transition-colors"
                      title="דווח"
                      aria-label="דיווח על תוכן פוגעני"
                    >
                      <AlertCircle size={16} />
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
          onClick={() => setConfirmLeaveOpen(true)}
          className="fade-up-item w-full py-5 flex items-center justify-center gap-2 text-clay-muted hover:text-slate-700 transition-colors font-bold text-sm"
        >
          <UserMinus size={15} /> הסר אותי מהמאגר
        </button>
      </div>

      <Modal
        open={confirmLeaveOpen}
        onClose={() => !leaving && setConfirmLeaveOpen(false)}
        title="להסיר אותך מהמאגר?"
        size="sm"
        variant="sheet"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmLeaveOpen(false)}
              disabled={leaving}
              className="flex-1 font-bold py-3.5 rounded-full text-slate-600 bg-clay-chip shadow-clay-md active:shadow-clay-pressed transition-all disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleLeavePool}
              disabled={leaving}
              className="flex-1 font-bold py-3.5 rounded-full text-white flex justify-center items-center active:scale-[0.97] transition-all disabled:opacity-50"
              style={clayButtonStyle(primaryColor)}
            >
              {leaving ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "כן, הסר אותי"
              )}
            </button>
          </div>
        }
      >
        <p className="text-slate-600 font-medium leading-relaxed">
          אורחים אחרים לא יוכלו להגריל אותך יותר. קיר התהילה שלך נשאר, ואפשר
          לחזור למשחק בכל רגע.
        </p>
      </Modal>
    </div>
  );
};

export default Icebreaker;
