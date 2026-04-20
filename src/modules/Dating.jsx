import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getLuminance } from "../lib/colors";
import { compressImage, isAllowedImageType } from "../lib/imageUtils";
import { useToast } from "../components/Toast";
import {
  Heart,
  Camera,
  Loader2,
  User,
  MessageCircle,
  Sparkles,
  Send,
  ChevronLeft,
  MessageSquare,
  ShieldAlert,
  MapPin,
  Users,
} from "lucide-react";
import gsap from "gsap";

const PROFILES_PAGE = 20;
const MESSAGES_LIMIT = 50;

const Dating = () => {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("event");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [eventData, setEventData] = useState(null);
  const [view, setView] = useState("loading");
  const [regStep, setRegStep] = useState(1);

  const [profiles, setProfiles] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [chatHistory, setChatHistory] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});

  const [blockedUsers, setBlockedUsers] = useState(() =>
    JSON.parse(localStorage.getItem("blocked_users") || "[]"),
  );

  const guestName = localStorage.getItem("guest_name");
  const guestId = localStorage.getItem("guest_id");

  const formRef = useRef(null);
  const chatBoxRef = useRef(null);

  const [formData, setFormData] = useState({
    age: "",
    gender: "זכר",
    seeking: "נקבה",
    connection: "",
    location: "",
    bio: "",
    photo_url: "",
  });
  const [uploading, setUploading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Initial load
  useEffect(() => {
    if (!eventId || !guestId) return navigate("/");
    let isMounted = true;
    const init = async () => {
      try {
        const { data: event } = await supabase
          .from("events")
          .select("id, name, design_config")
          .eq("id", eventId)
          .single();
        if (!isMounted) return;
        setEventData(event);

        const { data: profile } = await supabase
          .from("dating_profiles")
          .select(
            "id, guest_id, name, age, gender, seeking, connection, location, bio, photo_url",
          )
          .eq("event_id", eventId)
          .eq("guest_id", guestId)
          .single();

        if (!isMounted) return;
        if (profile) {
          setMyProfile(profile);
          setFormData(profile);
          setView("gallery");
          await loadGalleryData(profile, isMounted);
        } else {
          setView("register");
        }
      } catch {
        if (isMounted) setView("register");
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [eventId, guestId]);

  const loadGalleryData = async (me, isMounted = true) => {
    let query = supabase
      .from("dating_profiles")
      .select(
        "id, guest_id, name, age, gender, seeking, connection, location, bio, photo_url",
      )
      .eq("event_id", eventId)
      .neq("guest_id", guestId)
      .order("created_at", { ascending: false })
      .limit(PROFILES_PAGE);
    if (me.seeking !== "הכל") query = query.eq("gender", me.seeking);
    const { data: others } = await query;

    const matched = (others || []).filter(
      (p) =>
        (p.seeking === me.gender || p.seeking === "הכל") &&
        !blockedUsers.includes(p.guest_id),
    );
    if (isMounted) setProfiles(matched);

    // Load messages — only last 50, newest first, then reverse for display
    const { data: msgs } = await supabase
      .from("dating_messages")
      .select("id, sender_id, receiver_id, message, is_read, created_at")
      .eq("event_id", eventId)
      .or(`sender_id.eq.${guestId},receiver_id.eq.${guestId}`)
      .order("created_at", { ascending: false })
      .limit(MESSAGES_LIMIT);

    if (msgs && isMounted) {
      const historyIds = new Set();
      const unreads = {};
      msgs.forEach((m) => {
        const otherId = m.sender_id === guestId ? m.receiver_id : m.sender_id;
        historyIds.add(otherId);
        if (m.receiver_id === guestId && !m.is_read) {
          unreads[m.sender_id] = (unreads[m.sender_id] || 0) + 1;
        }
      });
      setUnreadCounts(unreads);
      const historyProfiles = (others || []).filter(
        (p) => historyIds.has(p.guest_id) && !blockedUsers.includes(p.guest_id),
      );
      setChatHistory(historyProfiles);
    }
  };

  // Animations
  useEffect(() => {
    if (view === "register" && formRef.current) {
      gsap.fromTo(
        formRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
      );
    }
    if (view === "gallery") {
      gsap.fromTo(
        ".profile-card",
        { opacity: 0, y: 40, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          stagger: 0.12,
          ease: "back.out(1.2)",
        },
      );
    }
    if (view === "chatList") {
      gsap.fromTo(
        ".chat-item",
        { opacity: 0, x: 20 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.05 },
      );
    }
  }, [view, regStep, profiles]);

  // Auto-scroll logic for new messages
  useEffect(() => {
    if (view === "chat" && chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, view]);

  // Realtime subscription for active chat
  useEffect(() => {
    if (view !== "chat" || !activeChat) return;
    const channel = supabase
      .channel(`dating_chat_${eventId}_${guestId}_${activeChat.guest_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dating_messages",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const m = payload.new;
          const isRelevant =
            (m.sender_id === guestId &&
              m.receiver_id === activeChat.guest_id) ||
            (m.sender_id === activeChat.guest_id && m.receiver_id === guestId);
          if (isRelevant) {
            setMessages((prev) => [...prev, m]);
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [view, activeChat, guestId, eventId]);

  const handlePhotoUpload = async (e) => {
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
      const fileName = `${eventId}/${guestId}_${Date.now()}.jpg`;
      await supabase.storage
        .from("dating-profiles")
        .upload(fileName, compressed, {
          contentType: "image/jpeg",
          upsert: true,
        });
      const {
        data: { publicUrl },
      } = supabase.storage.from("dating-profiles").getPublicUrl(fileName);
      setFormData((prev) => ({ ...prev, photo_url: publicUrl }));
    } catch {
      showToast("תקלה בהעלאת התמונה, נסה שוב", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (isSavingProfile) return;
    setIsSavingProfile(true);
    try {
      const payload = {
        event_id: eventId,
        guest_id: guestId,
        name: guestName,
        age: formData.age,
        gender: formData.gender,
        seeking: formData.seeking,
        connection: formData.connection,
        location: formData.location,
        bio: formData.bio,
        photo_url: formData.photo_url,
      };

      // מעבר ל-Update ו-Insert מפורש כדי למנוע את שגיאת 409 Conflict
      const { data: existingProfile } = await supabase
        .from("dating_profiles")
        .select("id")
        .eq("event_id", eventId)
        .eq("guest_id", guestId)
        .maybeSingle();

      let saveError;

      if (existingProfile) {
        // עדכון פרופיל קיים
        const { error } = await supabase
          .from("dating_profiles")
          .update(payload)
          .eq("id", existingProfile.id);
        saveError = error;
      } else {
        // יצירת פרופיל חדש
        const { error } = await supabase
          .from("dating_profiles")
          .insert([payload]);
        saveError = error;
      }

      if (saveError) throw saveError;

      // Reload profile
      const { data: profile } = await supabase
        .from("dating_profiles")
        .select(
          "id, guest_id, name, age, gender, seeking, connection, location, bio, photo_url",
        )
        .eq("event_id", eventId)
        .eq("guest_id", guestId)
        .single();
        
      setMyProfile(profile);
      setView("gallery");
      await loadGalleryData(profile);
    } catch (err) {
      console.error("Save profile error:", err);
      showToast("שגיאה בשמירת הנתונים, נסה שוב", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleReportAndBlock = async (partnerId, partnerName) => {
    const confirmed = window.confirm(
      `האם לחסום את ${partnerName} ולדווח עליו/עליה? לא תוכלו לראות אחד את השני יותר.`,
    );
    if (!confirmed) return;

    const newBlocked = [...blockedUsers, partnerId];
    localStorage.setItem("blocked_users", JSON.stringify(newBlocked));
    setBlockedUsers(newBlocked);

    try {
      await supabase.from("reports").insert([
        {
          event_id: eventId,
          reported_item_id: partnerId,
          item_type: "dating_profile",
          reporter_id: guestId,
        },
      ]);
    } catch (e) {
      console.error(e);
    }

    showToast("המשתמש נחסם והועבר לבדיקה", "success");
    setView("chatList");
    if (myProfile) await loadGalleryData(myProfile);
  };

  const openChat = async (partner) => {
    setActiveChat(partner);
    setView("chat");
    setMessages([]);

    if (unreadCounts[partner.guest_id]) {
      await supabase
        .from("dating_messages")
        .update({ is_read: true })
        .eq("sender_id", partner.guest_id)
        .eq("receiver_id", guestId)
        .eq("event_id", eventId);
      setUnreadCounts((prev) => ({ ...prev, [partner.guest_id]: 0 }));
    }

    // Load latest 50 messages, display oldest first
    const { data } = await supabase
      .from("dating_messages")
      .select("id, sender_id, receiver_id, message, is_read, created_at")
      .eq("event_id", eventId)
      .or(
        `and(sender_id.eq.${guestId},receiver_id.eq.${partner.guest_id}),and(sender_id.eq.${partner.guest_id},receiver_id.eq.${guestId})`,
      )
      .order("created_at", { ascending: false })
      .limit(MESSAGES_LIMIT);

    const ordered = (data || []).reverse();
    setMessages(ordered);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;
    setIsSending(true);
    const text = newMessage.trim();
    setNewMessage("");
    try {
      const { error } = await supabase.from("dating_messages").insert([
        {
          event_id: eventId,
          sender_id: guestId,
          receiver_id: activeChat.guest_id,
          message: text,
          is_read: false,
        },
      ]);
      if (error) {
        showToast("שגיאה בשליחה, נסה שוב", "error");
        setNewMessage(text);
      }
    } finally {
      setIsSending(false);
    }
  };

  // ---- Render guards ----
  if (view === "loading" || !eventData) {
    return (
      <div className="min-h-screen bg-slate-900 flex justify-center items-center">
        <Loader2 className="animate-spin text-rose-400" size={48} />
      </div>
    );
  }

  const primaryColor = eventData.design_config?.colors?.primary || "#f43f5e";
  const bgColor = eventData.design_config?.colors?.background || "#f8fafc";
  const primaryTextColor =
    getLuminance(primaryColor) > 150 ? "#1e293b" : "#ffffff";

  // ---- Registration ----
  if (view === "register") {
    return (
      <div
        className="min-h-screen flex flex-col font-sans transition-colors duration-1000 pb-10"
        style={{ backgroundColor: bgColor }}
        dir="rtl"
      >
        <div
          className="rounded-b-[3rem] pt-12 pb-24 px-6 relative z-10 shadow-lg text-center"
          style={{ backgroundColor: primaryColor }}
        >
          <button
            onClick={() => navigate(-1)}
            className="absolute right-6 top-10 p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors"
            style={{ color: primaryTextColor }}
          >
            <ChevronLeft size={24} />
          </button>
          <div className="inline-flex items-center justify-center p-4 bg-white/20 rounded-[1.2rem] mb-4 border border-white/20">
            <Heart
              style={{ fill: primaryTextColor, color: primaryTextColor }}
              size={32}
            />
          </div>
          <h1
            className="text-3xl font-black mb-1"
            style={{ color: primaryTextColor }}
          >
            היי {guestName}!
          </h1>
          <p
            className="font-medium opacity-70 text-sm"
            style={{ color: primaryTextColor }}
          >
            ספר/י לנו קצת על עצמך
          </p>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: s === regStep ? 24 : 8,
                  backgroundColor:
                    s <= regStep ? "white" : "rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </div>
        </div>

        <div
          ref={formRef}
          className="px-5 -mt-12 relative z-20 w-full max-w-md mx-auto"
        >
          <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100">
            {regStep === 1 && (
              <div className="space-y-5">
                <h2 className="text-xl font-black text-slate-800 mb-4">
                  פרטים בסיסיים
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="text-xs font-bold mb-1.5 block"
                      style={{ color: primaryColor }}
                    >
                      גיל
                    </label>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) =>
                        setFormData({ ...formData, age: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all"
                      placeholder="24"
                    />
                  </div>
                  <div>
                    <label
                      className="text-xs font-bold mb-1.