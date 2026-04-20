import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  Settings,
  Plus,
  Calendar,
  LogOut,
  Loader2,
  X,
  Save,
  Image as ImageIcon,
  Trash2,
  DownloadCloud,
  Share2,
  Check,
  Users,
  QrCode,
  Heart,
  ChevronRight,
  Camera,
  User,
  Sparkles,
  Edit2,
  Zap,
  Target,
  ListPlus,
  Wine,
  Briefcase,
  Music,
  PartyPopper,
  Gem,
  Link,
  UploadCloud,
  Car,
  CheckCircle2,
  Download,
  Info,
  Palette,
  ShieldAlert,
  MessageCircle,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import AdminQRGenerator from "./AdminQRGenerator";

const MISSION_PRESETS = {
  wedding_young: [
    "שוט טקילה ביחד! תוכיחו בתמונה",
    "תצטלמו רוקדים על שולחן (או כיסא)",
    "סלפי עם החתן/כלה",
    "תעשו פרצוף הכי מכוער שלכם",
    "סלפי מצחיק בשירותים",
    "שוט כפול עם מישהו שרוקד כמו משוגע",
  ],
  corporate: [
    'סלפי עם המנכ"ל',
    "תמונה עם מישהו ממחלקת HR",
    "תעשו הרמת כוסית עם מישהו ממחלקה אחרת",
    "צלמו מישהו מדבר על עבודה",
    "סלפי עם מתכנת/ת",
    "תמונה של שניכם בפוזה של 'עובדי החודש'",
  ],
};

const COLOR_PRESETS = [
  { name: "קפוצ'ינו", primary: "#4e342e", background: "#fff8e7" },
  { name: "מי ים", primary: "#003f5c", background: "#a8d8c8" },
  { name: "יונה מדברית", primary: "#7a2e00", background: "#ffdcc2" },
  { name: "היער הקסום", primary: "#1e4d2b", background: "#d0f0c0" },
  { name: "לוליפופ", primary: "#7a0050", background: "#ffd1e8" },
  { name: "קרמל מלוח", primary: "#2e1f26", background: "#c87740" },
];

const Admin = () => {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(null);
  const [uploadingAsset, setUploadingAsset] = useState(false);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const [copiedEventId, setCopiedEventId] = useState(null);
  const [copiedInviteId, setCopiedInviteId] = useState(null);

  const [isSeatingModalOpen, setIsSeatingModalOpen] = useState(false);
  const [seatingText, setSeatingText] = useState("");
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [savedGuestsCount, setSavedGuestsCount] = useState(0);
  const [seatingGuests, setSeatingGuests] = useState([]);
  const [editingGuestId, setEditingGuestId] = useState(null);
  const [editGuestName, setEditGuestName] = useState("");
  const [editGuestTable, setEditGuestTable] = useState("");

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isDatingManagerOpen, setIsDatingManagerOpen] = useState(false);
  const [datingProfiles, setDatingProfiles] = useState([]);
  const [datingLoading, setDatingLoading] = useState(false);

  const [isIcebreakerModalOpen, setIsIcebreakerModalOpen] = useState(false);
  const [icebreakerMissions, setIcebreakerMissions] = useState([]);
  const [icebreakerLoading, setIcebreakerLoading] = useState(false);
  const [newMissionText, setNewMissionText] = useState("");
  const [isIcebreakerUserManagerOpen, setIsIcebreakerUserManagerOpen] =
    useState(false);
  const [icebreakerProfiles, setIcebreakerProfiles] = useState([]);
  const [icebreakerUsersLoading, setIcebreakerUsersLoading] = useState(false);

  const [isRideshareManagerOpen, setIsRideshareManagerOpen] = useState(false);
  const [rideshareList, setRideshareList] = useState([]);
  const [rideshareLoading, setRideshareLoading] = useState(false);

  const [isRsvpManagerOpen, setIsRsvpManagerOpen] = useState(false);
  const [rsvpList, setRsvpList] = useState([]);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [editingRsvpId, setEditingRsvpId] = useState(null);
  const [editRsvpName, setEditRsvpName] = useState("");

  // --- מרכז הדיווחים והמודרציה ---
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [reportsList, setReportsList] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // --- ניהול ברכות ---
  const [isBlessingsManagerOpen, setIsBlessingsManagerOpen] = useState(false);
  const [blessingsList, setBlessingsList] = useState([]);
  const [blessingsLoading, setBlessingsLoading] = useState(false);
  const [editingBlessingId, setEditingBlessingId] = useState(null);
  const [editBlessingName, setEditBlessingName] = useState("");
  const [editBlessingMessage, setEditBlessingMessage] = useState("");

  const [eventStats, setEventStats] = useState({
    rsvps: 0,
    photos: 0,
    dating: 0,
    reports: 0,
    blessings: 0, // התווסף נתון לברכות
  });

  useEffect(() => {
    if (selectedEvent && !selectedEvent.isNew) {
      const fetchStats = async () => {
        const [rsvps, photos, dating, reports, blessings] = await Promise.all([
          supabase
            .from("rsvps")
            .select("id", { count: "exact", head: true })
            .eq("event_id", selectedEvent.id),
          supabase
            .from("photos")
            .select("id", { count: "exact", head: true })
            .eq("event_id", selectedEvent.id),
          supabase
            .from("dating_profiles")
            .select("id", { count: "exact", head: true })
            .eq("event_id", selectedEvent.id),
          supabase
            .from("reports")
            .select("id", { count: "exact", head: true })
            .eq("event_id", selectedEvent.id)
            .eq("status", "pending"),
          supabase
            .from("blessings")
            .select("id", { count: "exact", head: true })
            .eq("event_id", selectedEvent.id),
        ]);
        setEventStats({
          rsvps: rsvps.data?.length ?? rsvps.count ?? 0,
          photos: photos.data?.length ?? photos.count ?? 0,
          dating: dating.data?.length ?? dating.count ?? 0,
          reports: reports.data?.length ?? reports.count ?? 0,
          blessings: blessings.data?.length ?? blessings.count ?? 0,
        });
      };
      fetchStats();
    }
  }, [selectedEvent]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session) fetchEvents();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchEvents();
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchEvents = async () => {
    setDataLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setEvents(data);
    } catch (error) {
      console.error(error);
    } finally {
      setDataLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) alert("פרטים שגויים");
    setAuthLoading(false);
  };

  const handleManageEvent = (event) => {
    setSelectedEvent(event);
    setFormData({
      name: event.name,
      event_date: event.event_date || "",
      location: event.location || "",
      short_code: event.short_code || "",
      active_modules: {
        photo: false,
        seating: false,
        dating: false,
        icebreaker: false,
        rideshare: false,
        rsvp: false,
        blessings: false, // הוספת מודול ברכות
        ...event.active_modules,
      },
      design_config: {
        template: event.design_config?.template || "glass",
        colors: event.design_config?.colors || {
          primary: "#3b82f6",
          background: "#020617",
        },
        invite_template: event.design_config?.invite_template || "modern",
        invite_image: event.design_config?.invite_image || "",
      },
    });
  };

  const handleCreateNew = () => {
    setSelectedEvent({ id: null, isNew: true });
    setFormData({
      name: "",
      event_date: "",
      location: "",
      short_code: "",
      active_modules: {
        photo: false,
        seating: false,
        dating: false,
        icebreaker: false,
        rideshare: false,
        rsvp: false,
        blessings: false, // הוספת מודול ברכות
      },
      design_config: {
        template: "glass",
        colors: { primary: "#3b82f6", background: "#020617" },
        invite_template: "modern",
        invite_image: "",
      },
    });
  };

  const handleSave = async () => {
    if (!formData.name) return alert("יש להזין שם אירוע");
    const payloadToSave = {
      ...formData,
      short_code: formData.short_code
        ? formData.short_code.trim().toUpperCase()
        : null,
    };

    setSaving(true);
    try {
      if (selectedEvent.id) {
        const { error } = await supabase
          .from("events")
          .update(payloadToSave)
          .eq("id", selectedEvent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert([payloadToSave]);
        if (error) throw error;
      }
      setSelectedEvent(null);
      fetchEvents();
    } catch (error) {
      if (error.code === "23505") {
        alert("הקוד הקצר הזה כבר תפוס על ידי אירוע אחר. אנא בחרו קוד אחר.");
      } else {
        alert(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `האם אתה בטוח שברצונך למחוק את האירוע "${formData.name}" לחלוטין?`,
      )
    )
      return;
    setSaving(true);
    try {
      await Promise.all([
        supabase.from("photos").delete().eq("event_id", selectedEvent.id),
        supabase.from("seating").delete().eq("event_id", selectedEvent.id),
        supabase
          .from("dating_profiles")
          .delete()
          .eq("event_id", selectedEvent.id),
        supabase
          .from("dating_messages")
          .delete()
          .eq("event_id", selectedEvent.id),
        supabase
          .from("icebreaker_missions")
          .delete()
          .eq("event_id", selectedEvent.id),
        supabase
          .from("icebreaker_profiles")
          .delete()
          .eq("event_id", selectedEvent.id),
        supabase.from("rsvps").delete().eq("event_id", selectedEvent.id),
        supabase.from("rideshares").delete().eq("event_id", selectedEvent.id),
        supabase.from("reports").delete().eq("event_id", selectedEvent.id),
        supabase.from("blessings").delete().eq("event_id", selectedEvent.id), // מחיקת ברכות
      ]);
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", selectedEvent.id);
      if (error) throw error;
      setSelectedEvent(null);
      fetchEvents();
    } catch (error) {
      console.error(error);
      alert("שגיאה במחיקה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  };

  const copyEventLink = async (eventId) => {
    const url = `${window.location.origin}/event/${eventId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedEventId(eventId);
      setTimeout(() => setCopiedEventId(null), 2000);
    } catch (err) {
      alert("הקישור הוא: " + url);
    }
  };
  const copyInviteLink = async (eventId) => {
    const url = `${window.location.origin}/invite/${eventId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteId(eventId);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch (err) {
      alert("הקישור הוא: " + url);
    }
  };

  const handleInviteImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAsset(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${selectedEvent.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("event-assets")
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("event-assets").getPublicUrl(fileName);
      setFormData({
        ...formData,
        design_config: { ...formData.design_config, invite_image: publicUrl },
      });
    } catch (error) {
      alert("שגיאה בהעלאת התמונה");
      console.error(error);
    } finally {
      setUploadingAsset(false);
    }
  };

  const applyColorPreset = (preset) => {
    setFormData({
      ...formData,
      design_config: {
        ...formData.design_config,
        colors: { primary: preset.primary, background: preset.background },
      },
    });
  };

  const openGallery = async () => {
    setIsGalleryOpen(true);
    const { data } = await supabase
      .from("photos")
      .select("*")
      .eq("event_id", selectedEvent.id)
      .order("created_at", { ascending: false });
    setGalleryPhotos(data || []);
  };
  const downloadAlbum = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const imgFolder = zip.folder(`Album_${formData.name}`);
      await Promise.all(
        galleryPhotos.map(async (p, i) => {
          const res = await fetch(p.image_url);
          const blob = await res.blob();
          imgFolder.file(`${p.guest_name}_${i + 1}.jpg`, blob);
        }),
      );
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${formData.name}_Photos.zip`);
    } catch (error) {
      console.error(error);
    } finally {
      setDownloadingZip(false);
    }
  };
  const handleDeletePhoto = async (photo) => {
    if (!window.confirm(`למחוק את התמונה של ${photo.guest_name}?`)) return;
    try {
      await supabase.from("photos").delete().eq("id", photo.id);
      setGalleryPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setEventStats((prev) => ({
        ...prev,
        photos: Math.max(0, prev.photos - 1),
      }));
    } catch (error) {
      alert(error.message);
    }
  };

  const openSeatingManager = async () => {
    setSeatingText("");
    setIsSeatingModalOpen(true);
    setSeatingLoading(true);
    try {
      const { data, count, error } = await supabase
        .from("seating")
        .select("*", { count: "exact" })
        .eq("event_id", selectedEvent.id)
        .order("guest_name", { ascending: true });
      if (error) throw error;
      setSeatingGuests(data || []);
      setSavedGuestsCount(count || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setSeatingLoading(false);
    }
  };
  const handleSaveSeating = async () => {
    if (!seatingText.trim()) return alert("אנא הדבק רשימה");
    setSeatingLoading(true);
    try {
      const parsedGuests = seatingText
        .split("\n")
        .map((line) => {
          const match = line.trim().match(/^(.*?)[-,\s]*(\d+)\s*$/);
          return match
            ? {
                event_id: selectedEvent.id,
                guest_name: match[1].trim(),
                table_number: match[2].trim(),
              }
            : null;
        })
        .filter(Boolean);
      if (parsedGuests.length === 0)
        throw new Error("לא זיהינו שמות בפורמט תקין");
      await supabase.from("seating").insert(parsedGuests);
      openSeatingManager();
      alert(`נוספו בהצלחה ${parsedGuests.length} מוזמנים.`);
    } catch (error) {
      alert(error.message);
    } finally {
      setSeatingLoading(false);
    }
  };
  const handleDeleteGuest = async (guestId, name) => {
    if (!window.confirm(`למחוק את ${name}?`)) return;
    try {
      await supabase.from("seating").delete().eq("id", guestId);
      setSeatingGuests((prev) => prev.filter((g) => g.id !== guestId));
      setSavedGuestsCount((prev) => prev - 1);
    } catch (error) {
      alert("שגיאה במחיקת האורח");
    }
  };
  const startEditingGuest = (guest) => {
    setEditingGuestId(guest.id);
    setEditGuestName(guest.guest_name);
    setEditGuestTable(guest.table_number);
  };
  const saveGuestEdit = async (guestId) => {
    if (!editGuestName.trim() || !editGuestTable.trim())
      return alert("שדות חסרים");
    try {
      const { error } = await supabase
        .from("seating")
        .update({ guest_name: editGuestName, table_number: editGuestTable })
        .eq("id", guestId);
      if (error) throw error;
      setSeatingGuests((prev) =>
        prev.map((g) =>
          g.id === guestId
            ? { ...g, guest_name: editGuestName, table_number: editGuestTable }
            : g,
        ),
      );
      setEditingGuestId(null);
    } catch (error) {
      alert("שגיאה בעדכון");
    }
  };

  const openDatingManager = async () => {
    setIsDatingManagerOpen(true);
    setDatingLoading(true);
    try {
      const { data } = await supabase
        .from("dating_profiles")
        .select("*")
        .eq("event_id", selectedEvent.id)
        .order("created_at", { ascending: false });
      setDatingProfiles(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setDatingLoading(false);
    }
  };
  const handleDeleteDatingProfile = async (profileId, name) => {
    if (!window.confirm(`למחוק את הפרופיל של ${name}?`)) return;
    try {
      await supabase.from("dating_profiles").delete().eq("id", profileId);
      setDatingProfiles((prev) => prev.filter((p) => p.id !== profileId));
      setEventStats((prev) => ({
        ...prev,
        dating: Math.max(0, prev.dating - 1),
      }));
    } catch (error) {
      alert("תקלה במחיקה");
    }
  };

  const openRideshareManager = async () => {
    setIsRideshareManagerOpen(true);
    setRideshareLoading(true);
    try {
      const { data } = await supabase
        .from("rideshares")
        .select("*")
        .eq("event_id", selectedEvent.id)
        .order("created_at", { ascending: false });
      setRideshareList(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setRideshareLoading(false);
    }
  };

  const handleDeleteRideshare = async (id, name) => {
    if (!window.confirm(`למחוק את המודעה של ${name}?`)) return;
    try {
      await supabase.from("rideshares").delete().eq("id", id);
      setRideshareList((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      alert("תקלה במחיקה");
    }
  };

  const openIcebreakerManager = async () => {
    setIsIcebreakerModalOpen(true);
    setIcebreakerLoading(true);
    try {
      const { data } = await supabase
        .from("icebreaker_missions")
        .select("*")
        .eq("event_id", selectedEvent.id)
        .order("created_at", { ascending: false });
      setIcebreakerMissions(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIcebreakerLoading(false);
    }
  };
  const handleAddMission = async () => {
    if (!newMissionText.trim()) return;
    setIcebreakerLoading(true);
    try {
      const { data, error } = await supabase
        .from("icebreaker_missions")
        .insert([
          { event_id: selectedEvent.id, content: newMissionText.trim() },
        ])
        .select();
      if (error) throw error;
      setIcebreakerMissions([data[0], ...icebreakerMissions]);
      setNewMissionText("");
    } catch (error) {
      alert("שגיאה בהוספת משימה");
    } finally {
      setIcebreakerLoading(false);
    }
  };
  const handleDeleteMission = async (missionId) => {
    if (!window.confirm("בטוח שרוצים למחוק משימה זו?")) return;
    try {
      await supabase.from("icebreaker_missions").delete().eq("id", missionId);
      setIcebreakerMissions((prev) => prev.filter((m) => m.id !== missionId));
    } catch (error) {
      alert("תקלה במחיקה");
    }
  };
  const loadPreset = async (presetType) => {
    const missionsToAdd = MISSION_PRESETS[presetType];
    if (!missionsToAdd) return;
    if (!window.confirm(`להוסיף משימות מוכנות לבנק?`)) return;
    setIcebreakerLoading(true);
    try {
      const inserts = missionsToAdd.map((content) => ({
        event_id: selectedEvent.id,
        content,
      }));
      const { data, error } = await supabase
        .from("icebreaker_missions")
        .insert(inserts)
        .select();
      if (error) throw error;
      setIcebreakerMissions([...data, ...icebreakerMissions]);
      alert("החבילה נטענה!");
    } catch (error) {
      alert("שגיאה בטעינת החבילה");
    } finally {
      setIcebreakerLoading(false);
    }
  };
  const openIcebreakerUserManager = async () => {
    setIsIcebreakerUserManagerOpen(true);
    setIcebreakerUsersLoading(true);
    try {
      const { data } = await supabase
        .from("icebreaker_profiles")
        .select("*")
        .eq("event_id", selectedEvent.id)
        .order("created_at", { ascending: false });
      setIcebreakerProfiles(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIcebreakerUsersLoading(false);
    }
  };
  const handleDeleteIcebreakerProfile = async (profileId, name) => {
    if (!window.confirm(`למחוק את ${name} מהמשחק?`)) return;
    try {
      await supabase.from("icebreaker_profiles").delete().eq("id", profileId);
      setIcebreakerProfiles((prev) => prev.filter((p) => p.id !== profileId));
    } catch (error) {
      alert("תקלה במחיקה");
    }
  };

  const openRsvpManager = async () => {
    setIsRsvpManagerOpen(true);
    setRsvpLoading(true);
    try {
      const { data, error } = await supabase
        .from("rsvps")
        .select("*")
        .eq("event_id", selectedEvent.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRsvpList(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setRsvpLoading(false);
    }
  };
  const handleDeleteRsvp = async (rsvpId, name) => {
    if (!window.confirm(`למחוק את אישור ההגעה של ${name}?`)) return;
    try {
      await supabase.from("rsvps").delete().eq("id", rsvpId);
      setRsvpList((prev) => prev.filter((r) => r.id !== rsvpId));
      setEventStats((prev) => ({
        ...prev,
        rsvps: Math.max(0, prev.rsvps - 1),
      }));
    } catch (error) {
      alert("שגיאה במחיקה");
    }
  };
  const startEditingRsvp = (rsvp) => {
    setEditingRsvpId(rsvp.id);
    setEditRsvpName(rsvp.guest_name);
  };
  const saveRsvpEdit = async (rsvpId) => {
    if (!editRsvpName.trim()) return alert("חובה להזין שם");
    try {
      const { error } = await supabase
        .from("rsvps")
        .update({ guest_name: editRsvpName })
        .eq("id", rsvpId);
      if (error) throw error;
      setRsvpList((prev) =>
        prev.map((r) =>
          r.id === rsvpId ? { ...r, guest_name: editRsvpName } : r,
        ),
      );
      setEditingRsvpId(null);
    } catch (error) {
      alert("שגיאה בעדכון");
    }
  };
  const exportRsvpToCSV = () => {
    const sorted = [...rsvpList].sort((a, b) =>
      (a.group_id || "").localeCompare(b.group_id || ""),
    );
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "שם האורח,מי מילא את הטופס,טלפון,אלרגנים,תאריך רישום\n";
    sorted.forEach((row) => {
      const date = new Date(row.created_at).toLocaleDateString("he-IL");
      const allergens =
        Array.isArray(row.allergens) && row.allergens.length > 0
          ? row.allergens.join(", ")
          : "";
      csvContent += `"${row.guest_name}","${row.submitter_name}","${row.submitter_phone}","${allergens}","${date}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RSVP_${formData.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // פונקציות המודרציה
  const openReportsManager = async () => {
    setIsReportsModalOpen(true);
    setReportsLoading(true);
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("event_id", selectedEvent.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setReportsList(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setReportsLoading(false);
    }
  };

  const handleResolveReport = async (reportId, action, itemType, itemId) => {
    try {
      if (action === "delete_item") {
        if (
          !window.confirm(
            "פעולה בלתי הפיכה! האם למחוק את התוכן שדווח מהמערכת לחלוטין?",
          )
        )
          return;

        if (itemType === "photo") {
          await supabase.from("photos").delete().eq("id", itemId);
        } else if (itemType === "icebreaker") {
          await supabase.from("icebreaker_matches").delete().eq("id", itemId);
        }
        alert("התוכן הפוגעני נמחק בהצלחה.");
      }

      await supabase
        .from("reports")
        .update({ status: "resolved" })
        .eq("id", reportId);
      setReportsList((prev) => prev.filter((r) => r.id !== reportId));
      setEventStats((prev) => ({
        ...prev,
        reports: Math.max(0, prev.reports - 1),
      }));
    } catch (error) {
      alert("שגיאה בטיפול בדיווח");
    }
  };

  // פונקציות ניהול ברכות (Blessings)
  const openBlessingsManager = async () => {
    setIsBlessingsManagerOpen(true);
    setBlessingsLoading(true);
    try {
      const { data, error } = await supabase
        .from("blessings")
        .select("*")
        .eq("event_id", selectedEvent.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBlessingsList(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setBlessingsLoading(false);
    }
  };

  const handleDeleteBlessing = async (blessingId, name) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את הברכה של ${name}?`))
      return;
    try {
      await supabase.from("blessings").delete().eq("id", blessingId);
      setBlessingsList((prev) => prev.filter((b) => b.id !== blessingId));
      setEventStats((prev) => ({
        ...prev,
        blessings: Math.max(0, prev.blessings - 1),
      }));
    } catch (error) {
      alert("שגיאה במחיקת הברכה");
    }
  };

  const startEditingBlessing = (blessing) => {
    setEditingBlessingId(blessing.id);
    setEditBlessingName(blessing.guest_name);
    setEditBlessingMessage(blessing.message);
  };

  const saveBlessingEdit = async (blessingId) => {
    if (!editBlessingName.trim() || !editBlessingMessage.trim())
      return alert("חובה להזין שם ותוכן ברכה");
    try {
      const { error } = await supabase
        .from("blessings")
        .update({ guest_name: editBlessingName, message: editBlessingMessage })
        .eq("id", blessingId);
      if (error) throw error;

      setBlessingsList((prev) =>
        prev.map((b) =>
          b.id === blessingId
            ? {
                ...b,
                guest_name: editBlessingName,
                message: editBlessingMessage,
              }
            : b,
        ),
      );
      setEditingBlessingId(null);
    } catch (error) {
      alert("שגיאה בעדכון הברכה");
    }
  };

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  if (!session) {
    return (
      <div
        className="min-h-screen bg-slate-100 flex items-center justify-center p-4"
        dir="rtl"
      >
        <form
          onSubmit={handleLogin}
          className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-slate-800">
              Event Manager
            </h1>
            <p className="text-slate-500 mt-2">ניהול מערכת האירועים שלך</p>
          </div>
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="אימייל"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              dir="ltr"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="סיסמה"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              dir="ltr"
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all"
            >
              התחבר למערכת
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8" dir="rtl">
      {!selectedEvent && (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 gap-6">
            <div>
              <h1 className="text-4xl font-black text-slate-900">לוח בקרה</h1>
              <p className="text-slate-500 font-medium text-lg mt-1">
                מערכת ה-SaaS שלך לניהול חוויות
              </p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button
                onClick={handleCreateNew}
                className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-indigo-100"
              >
                <Plus size={22} /> אירוע חדש
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                className="bg-slate-100 p-4 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <LogOut size={22} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dataLoading ? (
              <Loader2
                className="animate-spin text-indigo-600 mx-auto col-span-full"
                size={48}
              />
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col group hover:border-indigo-300 hover:shadow-xl transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-indigo-100 p-4 rounded-2xl text-indigo-600">
                      <Calendar size={28} />
                    </div>
                    <div>
                      <h3 className="font-black text-2xl text-slate-800 line-clamp-1">
                        {event.name}
                      </h3>
                      <p className="text-slate-500 font-medium">
                        {new Date(event.event_date).toLocaleDateString("he-IL")}
                      </p>
                    </div>
                  </div>
                  {event.short_code && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 text-center">
                      <span className="text-xs text-slate-400 font-bold block mb-1">
                        קוד לאורחים:
                      </span>
                      <span className="font-mono text-xl font-black text-indigo-600 tracking-widest">
                        {event.short_code}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <button
                      onClick={() => handleManageEvent(event)}
                      className="col-span-2 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2"
                    >
                      <Settings size={18} /> ניהול אירוע
                    </button>
                    <button
                      onClick={() => copyEventLink(event.id)}
                      className={`py-2 rounded-xl transition-all border flex justify-center items-center gap-2 text-sm font-bold ${copiedEventId === event.id ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600"}`}
                      title="העתק קישור לאפליקציה"
                    >
                      {copiedEventId === event.id ? (
                        <Check size={16} />
                      ) : (
                        <Share2 size={16} />
                      )}{" "}
                      אפליקציה
                    </button>
                    <button
                      onClick={() => copyInviteLink(event.id)}
                      className={`py-2 rounded-xl transition-all border flex justify-center items-center gap-2 text-sm font-bold ${copiedInviteId === event.id ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100"}`}
                      title="העתק קישור לדף ההזמנה"
                    >
                      {copiedInviteId === event.id ? (
                        <Check size={16} />
                      ) : (
                        <Link size={16} />
                      )}{" "}
                      הזמנה
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
          <button
            onClick={() => setSelectedEvent(null)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold mb-6 transition-colors"
          >
            <ChevronRight size={20} /> חזרה לכל האירועים
          </button>

          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden mb-8">
            <div className="p-8 md:p-10 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-3xl font-black text-slate-900">
                  {selectedEvent.isNew
                    ? "יצירת אירוע חדש"
                    : `ניהול: ${formData.name}`}
                </h2>
                <p className="text-slate-500 mt-2">
                  הגדרות כלליות, עיצוב ומודולים
                </p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                {!selectedEvent.isNew && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all border border-rose-100"
                    title="מחק אירוע לחלוטין"
                  >
                    <Trash2 size={22} />
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 md:flex-none bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex justify-center items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      <Save size={22} /> שמור שינויים
                    </>
                  )}
                </button>
              </div>
            </div>

            {!selectedEvent.isNew && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-8 md:p-10 pb-0">
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="bg-blue-500 text-white p-3 rounded-xl">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-blue-600/70">
                      אישורי הגעה
                    </p>
                    <p className="text-2xl font-black text-blue-700">
                      {eventStats.rsvps}
                    </p>
                  </div>
                </div>
                <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="bg-orange-500 text-white p-3 rounded-xl">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-orange-600/70">
                      תמונות באלבום
                    </p>
                    <p className="text-2xl font-black text-orange-700">
                      {eventStats.photos}
                    </p>
                  </div>
                </div>
                <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="bg-purple-500 text-white p-3 rounded-xl">
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-purple-600/70">
                      ברכות באלבום
                    </p>
                    <p className="text-2xl font-black text-purple-700">
                      {eventStats.blessings}
                    </p>
                  </div>
                </div>
                <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="bg-rose-500 text-white p-3 rounded-xl">
                    <Heart size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-600/70">
                      משתמשי דייטליין
                    </p>
                    <p className="text-2xl font-black text-rose-700">
                      {eventStats.dating}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50/50 border border-slate-200 p-4 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="bg-slate-700 text-white p-3 rounded-xl">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">
                      דיווחים פתוחים
                    </p>
                    <p className="text-2xl font-black text-slate-700">
                      {eventStats.reports}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-8 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-1 space-y-6">
                <h3 className="text-xl font-black text-slate-800 border-b pb-4">
                  הגדרות ועיצוב
                </h3>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    שם האירוע
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    תאריך
                  </label>
                  <input
                    type="date"
                    value={formData.event_date}
                    onChange={(e) =>
                      setFormData({ ...formData, event_date: e.target.value })
                    }
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    מיקום / כתובת האולם (לניווט ב-Waze)
                  </label>
                  <input
                    type="text"
                    value={formData.location || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="לדוגמה: אולמי שושנים, תל אביב"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
                </div>

                <div className="space-y-2 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                  <label className="text-sm font-bold text-indigo-900 block">
                    קוד כניסה לאורחים (אופציונלי)
                  </label>
                  <p className="text-xs text-indigo-700/70 mb-3">
                    יאפשר לאורחים להיכנס לאפליקציה על ידי הקלדת קוד במקום סריקת
                    QR.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.short_code || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, short_code: e.target.value })
                      }
                      placeholder="למשל: DANI26 או 123456"
                      className="w-full p-4 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-black tracking-widest text-center uppercase"
                      dir="ltr"
                      maxLength={10}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          short_code: Math.floor(
                            100000 + Math.random() * 900000,
                          ).toString(),
                        })
                      }
                      className="bg-indigo-600 text-white px-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      הגרל
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">
                      צבע מיתוג עיקרי (Primary)
                    </label>
                    <div className="flex items-center gap-3">
                      <div
                        className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-slate-200 shrink-0 shadow-sm transition-colors"
                        style={{
                          backgroundColor:
                            formData.design_config.colors.primary,
                        }}
                      >
                        <input
                          type="color"
                          value={
                            /^#[0-9A-F]{6}$/i.test(
                              formData.design_config.colors.primary,
                            )
                              ? formData.design_config.colors.primary
                              : "#3b82f6"
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              design_config: {
                                ...formData.design_config,
                                colors: {
                                  ...formData.design_config.colors,
                                  primary: e.target.value,
                                },
                              },
                            })
                          }
                          className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                          title="בחר צבע"
                        />
                      </div>
                      <input
                        type="text"
                        value={formData.design_config.colors.primary}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            design_config: {
                              ...formData.design_config,
                              colors: {
                                ...formData.design_config.colors,
                                primary: e.target.value,
                              },
                            },
                          })
                        }
                        placeholder="למשל: #3b82f6 / rgb()"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-left text-sm"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">
                      צבע רקע (Background)
                    </label>
                    <div className="flex items-center gap-3">
                      <div
                        className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-slate-200 shrink-0 shadow-sm transition-colors"
                        style={{
                          backgroundColor:
                            formData.design_config.colors.background,
                        }}
                      >
                        <input
                          type="color"
                          value={
                            /^#[0-9A-F]{6}$/i.test(
                              formData.design_config.colors.background,
                            )
                              ? formData.design_config.colors.background
                              : "#020617"
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              design_config: {
                                ...formData.design_config,
                                colors: {
                                  ...formData.design_config.colors,
                                  background: e.target.value,
                                },
                              },
                            })
                          }
                          className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                          title="בחר צבע"
                        />
                      </div>
                      <input
                        type="text"
                        value={formData.design_config.colors.background}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            design_config: {
                              ...formData.design_config,
                              colors: {
                                ...formData.design_config.colors,
                                background: e.target.value,
                              },
                            },
                          })
                        }
                        placeholder="למשל: #020617 / rgb()"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-left text-sm"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                      <Palette size={16} className="text-indigo-500" /> ערכות
                      צבעים מוכנות
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => applyColorPreset(preset)}
                          className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all bg-white text-right group"
                        >
                          <div className="w-8 h-8 rounded-full flex overflow-hidden border border-slate-200 shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                            <div
                              className="w-1/2 h-full"
                              style={{ backgroundColor: preset.primary }}
                            ></div>
                            <div
                              className="w-1/2 h-full"
                              style={{ backgroundColor: preset.background }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-slate-700 leading-tight">
                            {preset.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">
                    עיצוב ההזמנה הדיגיטלית
                  </label>
                  <select
                    value={formData.design_config.invite_template || "modern"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        design_config: {
                          ...formData.design_config,
                          invite_template: e.target.value,
                        },
                      })
                    }
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700"
                  >
                    <option value="modern">
                      מודרני / מסיבה (טקסט מוגדל ורקע צבעוני)
                    </option>
                    <option value="elegant">
                      אלגנטי (מתאים לחתונות ובר/בת מצווה)
                    </option>
                    <option value="corporate">
                      משרדי / כנסים (קלאסי ונקי)
                    </option>
                  </select>

                  {(formData.design_config.invite_template === "elegant" ||
                    formData.design_config.invite_template === "corporate") && (
                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                      <label className="text-sm font-bold text-indigo-800 block mb-2">
                        תמונה / לוגו להזמנה
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="flex-1 cursor-pointer bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-600 font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2">
                          {uploadingAsset ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <>
                              <UploadCloud size={18} /> בחר קובץ
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleInviteImageUpload}
                            disabled={uploadingAsset}
                            className="hidden"
                          />
                        </label>
                      </div>
                      {formData.design_config.invite_image && (
                        <div className="mt-3 relative w-full h-32 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                          <img
                            src={formData.design_config.invite_image}
                            alt="Cover"
                            className="w-full h-full object-contain"
                          />
                          <button
                            onClick={() =>
                              setFormData({
                                ...formData,
                                design_config: {
                                  ...formData.design_config,
                                  invite_image: "",
                                },
                              })
                            }
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!selectedEvent.isNew && (
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <button
                      onClick={() => setIsQrModalOpen(true)}
                      className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                    >
                      <QrCode size={20} /> הפק שילוט QR לאירוע
                    </button>

                    {/* כפתור מרכז הדיווחים */}
                    <button
                      onClick={openReportsManager}
                      className="w-full bg-rose-50 text-rose-600 border border-rose-200 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-all relative"
                    >
                      <ShieldAlert size={20} /> מרכז דיווחים (UGC)
                      {eventStats.reports > 0 && (
                        <span className="absolute top-0 right-0 -mt-2 -mr-2 bg-rose-500 text-white text-xs px-2 py-1 rounded-full shadow-sm animate-pulse">
                          {eventStats.reports} חדשים
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* מודולים */}
              <div className="lg:col-span-2 space-y-8">
                <h3 className="text-xl font-black text-slate-800 border-b pb-4">
                  מודולים ופיצ'רים
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* מודול אישורי הגעה */}
                  <div
                    className={`border-2 rounded-3xl p-6 transition-all md:col-span-2 ${formData.active_modules.rsvp ? "border-blue-500 bg-blue-50/30" : "border-slate-100 opacity-60 grayscale"}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-3 rounded-xl ${formData.active_modules.rsvp ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-500"}`}
                        >
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-lg text-slate-800">
                            אישורי הגעה (RSVP)
                          </h4>
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                            מערכת קצה לקצה
                          </span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.active_modules.rsvp || false}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              active_modules: {
                                ...formData.active_modules,
                                rsvp: e.target.checked,
                              },
                            })
                          }
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                    </div>
                    {formData.active_modules.rsvp && !selectedEvent.isNew && (
                      <div className="p-4 bg-white rounded-xl border border-blue-100 text-center animate-in fade-in space-y-3">
                        <p className="text-sm text-slate-600 font-medium mb-3">
                          כפתור לאישור הגעה יופיע כעת בדף ההזמנה הדיגיטלית.
                        </p>
                        <button
                          onClick={openRsvpManager}
                          className="w-full py-3 bg-white border border-blue-200 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors flex justify-center items-center gap-2 shadow-sm"
                        >
                          <Users size={18} /> ניהול אישורי הגעה
                        </button>
                      </div>
                    )}
                  </div>

                  {/* מודול ברכות - חדש */}
                  <div
                    className={`border-2 rounded-3xl p-6 transition-all md:col-span-2 ${formData.active_modules.blessings ? "border-purple-500 bg-purple-50/30" : "border-slate-100 opacity-60 grayscale"}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-3 rounded-xl ${formData.active_modules.blessings ? "bg-purple-500 text-white" : "bg-slate-200 text-slate-500"}`}
                        >
                          <MessageCircle size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-lg text-slate-800">
                            ספר ברכות דיגיטלי
                          </h4>
                          <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                            כולל העלאת תמונות
                          </span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.active_modules.blessings || false}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              active_modules: {
                                ...formData.active_modules,
                                blessings: e.target.checked,
                              },
                            })
                          }
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                      </label>
                    </div>
                    {formData.active_modules.blessings &&
                      !selectedEvent.isNew && (
                        <div className="animate-in fade-in">
                          <button
                            onClick={openBlessingsManager}
                            className="w-full py-3 bg-white border border-purple-200 text-purple-600 font-bold rounded-xl hover:bg-purple-50 transition-colors flex justify-center items-center gap-2 shadow-sm"
                          >
                            <Settings size={18} /> ניהול הברכות
                          </button>
                        </div>
                      )}
                  </div>

                  {/* מודול כל אחד צלם */}
                  <div
                    className={`border-2 rounded-3xl p-6 transition-all ${formData.active_modules.photo ? "border-orange-500 bg-orange-50/30" : "border-slate-100 opacity-60 grayscale"}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-3 rounded-xl ${formData.active_modules.photo ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-500"}`}
                        >
                          <Camera size={24} />
                        </div>
                        <h4 className="font-black text-lg text-slate-800">
                          כל אחד צלם
                        </h4>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.active_modules.photo}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              active_modules: {
                                ...formData.active_modules,
                                photo: e.target.checked,
                              },
                            })
                          }
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    </div>
                    {formData.active_modules.photo && !selectedEvent.isNew && (
                      <div className="space-y-3 animate-in fade-in">
                        <button
                          onClick={openGallery}
                          className="w-full py-3 bg-white border border-orange-200 text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition-colors flex justify-center items-center gap-2"
                        >
                          <ImageIcon size={18} /> ניהול תמונות (הורדת ZIP)
                        </button>
                        <button
                          onClick={() =>
                            window.open(`/album/${selectedEvent.id}`, "_blank")
                          }
                          className="w-full py-3 bg-gradient-to-r from-orange-400 to-orange-500 text-white font-black rounded-xl hover:from-orange-500 hover:to-orange-600 transition-all flex justify-center items-center gap-2 shadow-lg shadow-orange-500/30"
                        >
                          <Sparkles size={18} /> צפייה באלבום הדיגיטלי
                        </button>
                      </div>
                    )}
                  </div>

                  {/* מודול סידור הושבה */}
                  <div
                    className={`border-2 rounded-3xl p-6 transition-all ${formData.active_modules.seating ? "border-emerald-500 bg-emerald-50/30" : "border-slate-100 opacity-60 grayscale"}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-3 rounded-xl ${formData.active_modules.seating ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}
                        >
                          <Users size={24} />
                        </div>
                        <h4 className="font-black text-lg text-slate-800">
                          סידור הושבה
                        </h4>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.active_modules.seating}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              active_modules: {
                                ...formData.active_modules,
                                seating: e.target.checked,
                              },
                            })
                          }
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                    {formData.active_modules.seating &&
                      !selectedEvent.isNew && (
                        <div className="space-y-3 animate-in fade-in">
                          <button
                            onClick={openSeatingManager}
                            className="w-full py-3 bg-white border border-emerald-200 text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-colors flex justify-center items-center gap-2"
                          >
                            <Settings size={18} /> ניהול רשימת הושבה
                          </button>
                        </div>
                      )}
                  </div>

                  {/* מודול דייטליין */}
                  <div
                    className={`border-2 rounded-3xl p-6 transition-all md:col-span-2 ${formData.active_modules.dating ? "border-rose-500 bg-rose-50/30" : "border-slate-100 opacity-60 grayscale"}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-3 rounded-xl ${formData.active_modules.dating ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-500"}`}
                        >
                          <Heart size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-lg text-slate-800">
                            Daitline (דייטליין)
                          </h4>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.active_modules.dating}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              active_modules: {
                                ...formData.active_modules,
                                dating: e.target.checked,
                              },
                            })
                          }
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                      </label>
                    </div>
                    {formData.active_modules.dating && !selectedEvent.isNew && (
                      <div className="animate-in fade-in">
                        <button
                          onClick={openDatingManager}
                          className="w-full py-3 bg-white border border-rose-200 text-rose-600 font-bold rounded-xl hover:bg-rose-50 transition-colors flex justify-center items-center gap-2 shadow-sm"
                        >
                          <Users size={18} /> ניהול משתמשי דייטליין
                        </button>
                      </div>
                    )}
                  </div>

                  {/* מודול אייסברייקר */}
                  <div
                    className={`border-2 rounded-3xl p-6 transition-all md:col-span-2 ${formData.active_modules.icebreaker ? "border-cyan-500 bg-cyan-50/30" : "border-slate-100 opacity-60 grayscale"}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-3 rounded-xl ${formData.active_modules.icebreaker ? "bg-cyan-500 text-white" : "bg-slate-200 text-slate-500"}`}
                        >
                          <Zap size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-lg text-slate-800">
                            שובר קרח (IceBreaker)
                          </h4>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.active_modules.icebreaker || false}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              active_modules: {
                                ...formData.active_modules,
                                icebreaker: e.target.checked,
                              },
                            })
                          }
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                    </div>
                    {formData.active_modules.icebreaker &&
                      !selectedEvent.isNew && (
                        <div className="flex flex-col md:flex-row gap-3 animate-in fade-in">
                          <button
                            onClick={openIcebreakerManager}
                            className="flex-1 py-3 bg-white border border-cyan-200 text-cyan-600 font-bold rounded-xl hover:bg-cyan-50 transition-colors flex justify-center items-center gap-2 shadow-sm"
                          >
                            <Target size={18} /> בנק המשימות
                          </button>
                          <button
                            onClick={openIcebreakerUserManager}
                            className="flex-1 py-3 bg-white border border-cyan-200 text-cyan-600 font-bold rounded-xl hover:bg-cyan-50 transition-colors flex justify-center items-center gap-2 shadow-sm"
                          >
                            <Users size={18} /> משתמשים
                          </button>
                        </div>
                      )}
                  </div>

                  {/* מודול טרמפים */}
                  <div
                    className={`border-2 rounded-3xl p-6 transition-all ${formData.active_modules.rideshare ? "border-amber-500 bg-amber-50/30" : "border-slate-100 opacity-60 grayscale"}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-3 rounded-xl ${formData.active_modules.rideshare ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"}`}
                        >
                          <Car size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-lg text-slate-800">
                            לוח טרמפים
                          </h4>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.active_modules.rideshare || false}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              active_modules: {
                                ...formData.active_modules,
                                rideshare: e.target.checked,
                              },
                            })
                          }
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>
                    {formData.active_modules.rideshare &&
                      !selectedEvent.isNew && (
                        <div className="animate-in fade-in">
                          <button
                            onClick={openRideshareManager}
                            className="w-full py-3 bg-white border border-amber-200 text-amber-600 font-bold rounded-xl hover:bg-amber-50 transition-colors flex justify-center items-center gap-2 shadow-sm"
                          >
                            <Car size={18} /> ניהול לוח טרמפים
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- פופ-אפ מרכז הדיווחים --- */}
      {isReportsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-rose-50/50 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <ShieldAlert className="text-rose-500" /> מרכז דיווחים
                </h2>
                <p className="text-rose-600 font-bold mt-1">
                  ממתינים לטיפול: {reportsList.length}
                </p>
              </div>
              <button
                onClick={() => setIsReportsModalOpen(false)}
                className="p-2 hover:bg-rose-100 text-rose-600 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 bg-slate-50 p-6 md:p-8 overflow-y-auto">
              {reportsLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-rose-500" size={48} />
                </div>
              ) : reportsList.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <CheckCircle2 size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-lg">
                    איזה שקט... אין דיווחים לטיפול.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reportsList.map((report) => (
                    <div
                      key={report.id}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 uppercase tracking-widest mb-2 inline-block">
                            סוג: {report.item_type}
                          </span>
                          <p className="text-sm font-medium text-slate-600">
                            ID פריט:{" "}
                            <span className="font-mono text-xs">
                              {report.reported_item_id}
                            </span>
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            דווח בתאריך:{" "}
                            {new Date(report.created_at).toLocaleDateString(
                              "he-IL",
                            )}{" "}
                            {new Date(report.created_at).toLocaleTimeString(
                              "he-IL",
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 pt-3 border-t border-slate-50">
                        <button
                          onClick={() =>
                            handleResolveReport(
                              report.id,
                              "delete_item",
                              report.item_type,
                              report.reported_item_id,
                            )
                          }
                          className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 rounded-xl text-sm transition-colors"
                        >
                          מחק תוכן פוגעני
                        </button>
                        <button
                          onClick={() =>
                            handleResolveReport(report.id, "dismiss")
                          }
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-sm transition-colors"
                        >
                          סגור כדיווח שווא
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- פופ-אפ ניהול ברכות (חדש) --- */}
      {isBlessingsManagerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-purple-50/50 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <MessageCircle className="text-purple-600" /> ספר ברכות
                </h2>
                <p className="text-purple-600 font-bold mt-1">
                  סה"כ ברכות נשלחו: {blessingsList.length}
                </p>
              </div>
              <button
                onClick={() => setIsBlessingsManagerOpen(false)}
                className="p-2 hover:bg-purple-100 text-purple-600 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 bg-slate-50 p-6 md:p-8 overflow-y-auto">
              {blessingsLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-purple-500" size={48} />
                </div>
              ) : blessingsList.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <CheckCircle2 size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-lg">עדיין אין ברכות בספר...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {blessingsList.map((blessing) => (
                    <div
                      key={blessing.id}
                      className={`bg-white p-5 rounded-2xl border flex flex-col shadow-sm transition-all ${editingBlessingId === blessing.id ? "border-purple-300 ring-2 ring-purple-100" : "border-slate-200 hover:border-purple-200"}`}
                    >
                      {editingBlessingId === blessing.id ? (
                        <div className="space-y-3 w-full">
                          <input
                            type="text"
                            value={editBlessingName}
                            onChange={(e) =>
                              setEditBlessingName(e.target.value)
                            }
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="שם השולח"
                          />
                          <textarea
                            value={editBlessingMessage}
                            onChange={(e) =>
                              setEditBlessingMessage(e.target.value)
                            }
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 h-24 resize-none"
                            placeholder="תוכן הברכה"
                          />
                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              onClick={() => setEditingBlessingId(null)}
                              className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors font-bold text-sm"
                            >
                              ביטול
                            </button>
                            <button
                              onClick={() => saveBlessingEdit(blessing.id)}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors font-bold text-sm flex items-center gap-1"
                            >
                              <Check size={16} /> שמור שינויים
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                              {blessing.guest_name}
                            </h4>
                            <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
                              <button
                                onClick={() => startEditingBlessing(blessing)}
                                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                                title="ערוך ברכה"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteBlessing(
                                    blessing.id,
                                    blessing.guest_name,
                                  )
                                }
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                title="מחק ברכה"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <p className="text-slate-600 text-sm whitespace-pre-wrap mb-4 flex-1">
                            {blessing.message}
                          </p>
                          {blessing.image_url && (
                            <div className="mt-auto pt-4 border-t border-slate-100">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-2">
                                <ImageIcon size={14} /> תמונה מצורפת:
                              </div>
                              <img
                                src={blessing.image_url}
                                alt="Selfie"
                                className="w-full h-32 object-cover rounded-xl border border-slate-100"
                              />
                            </div>
                          )}
                          <div className="mt-auto pt-3 text-[10px] text-slate-400 font-mono">
                            נשלח:{" "}
                            {new Date(blessing.created_at).toLocaleString(
                              "he-IL",
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ניהול טרמפים --- */}
      {isRideshareManagerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-amber-50/50 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <Car className="text-amber-500" /> ניהול טרמפים
                </h2>
                <p className="text-amber-600 font-bold mt-1">
                  סה"כ מודעות: {rideshareList.length}
                </p>
              </div>
              <button
                onClick={() => setIsRideshareManagerOpen(false)}
                className="p-2 hover:bg-amber-100 text-amber-600 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 bg-slate-50 p-6 md:p-8 overflow-y-auto">
              {rideshareLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-amber-500" size={48} />
                </div>
              ) : rideshareList.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <CheckCircle2 size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-lg">אין מודעות טרמפים בלוח</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rideshareList.map((ride) => (
                    <div
                      key={ride.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm hover:border-amber-200 transition-colors gap-4"
                    >
                      <div className="flex-1 w-full">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className="text-[10px] font-black px-2.5 py-1 rounded-md"
                            style={{
                              backgroundColor:
                                ride.role === "driver"
                                  ? "#f59e0b15"
                                  : "#3b82f615",
                              color:
                                ride.role === "driver" ? "#d97706" : "#2563eb",
                            }}
                          >
                            {ride.role === "driver"
                              ? "מציע/ה טרמפ"
                              : "מחפש/ת טרמפ"}
                          </span>
                          <h4 className="font-bold text-slate-800">
                            {ride.guest_name}
                          </h4>
                        </div>
                        <div className="text-sm text-slate-600 space-y-1">
                          <p className="font-semibold">{ride.phone}</p>
                          {ride.direction && (
                            <p className="text-xs text-slate-500">
                              {ride.direction === "there"
                                ? "הלוך בלבד"
                                : ride.direction === "back"
                                  ? "חזור בלבד"
                                  : "הלוך וחזור"}
                            </p>
                          )}
                          {ride.from_location && (
                            <p className="text-xs text-slate-500">
                              הלוך:{" "}
                              <span className="font-semibold">
                                {ride.from_location}
                              </span>
                            </p>
                          )}
                          {ride.to_location && (
                            <p className="text-xs text-slate-500">
                              חזור:{" "}
                              <span className="font-semibold">
                                {ride.to_location}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handleDeleteRideshare(ride.id, ride.guest_name)
                        }
                        className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-600 font-bold rounded-xl transition-colors flex items-center gap-2 text-sm shrink-0"
                      >
                        <Trash2 size={16} /> מחק
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- שאר הפופאפים... --- */}
      {isRsvpManagerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-blue-50/50 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800">
                  אישורי הגעה (RSVP)
                </h2>
                <p className="text-blue-600 font-bold mt-1">
                  סה"כ אישרו הגעה: {rsvpList.length} אורחים
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={exportRsvpToCSV}
                  disabled={rsvpList.length === 0}
                  className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Download size={18} /> ייצוא לאקסל
                </button>
                <button
                  onClick={() => setIsRsvpManagerOpen(false)}
                  className="p-2 hover:bg-blue-100 text-blue-600 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-50 p-6 md:p-8 overflow-y-auto">
              {rsvpLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-blue-500" size={48} />
                </div>
              ) : rsvpList.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <CheckCircle2 size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-lg">
                    עדיין לא התקבלו אישורי הגעה.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rsvpList.map((guest) => (
                    <div
                      key={guest.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm hover:border-blue-200 transition-colors gap-4"
                    >
                      <div className="flex-1 w-full">
                        {editingRsvpId === guest.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editRsvpName}
                              onChange={(e) => setEditRsvpName(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ) : (
                          <div>
                            <h4 className="font-bold text-slate-800 text-lg">
                              {guest.guest_name}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                              נרשם ע"י: {guest.submitter_name} |{" "}
                              {guest.submitter_phone}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2 shrink-0 bg-slate-50 p-1.5 rounded-xl w-full md:w-auto">
                        {editingRsvpId === guest.id ? (
                          <>
                            <button
                              onClick={() => saveRsvpEdit(guest.id)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="שמור"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={() => setEditingRsvpId(null)}
                              className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors"
                              title="ביטול"
                            >
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditingRsvp(guest)}
                              className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 font-bold text-sm"
                              title="ערוך"
                            >
                              <Edit2 size={16} /> ערוך
                            </button>
                            <div className="w-px h-6 bg-slate-200 mx-1"></div>
                            <button
                              onClick={() =>
                                handleDeleteRsvp(guest.id, guest.guest_name)
                              }
                              className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1 font-bold text-sm"
                              title="מחק"
                            >
                              <Trash2 size={16} /> מחק
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isGalleryOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
          <div className="p-6 md:p-8 flex justify-between items-center bg-white">
            <div>
              <h2 className="text-3xl font-black text-slate-800">
                גלריית האירוע
              </h2>
            </div>
            <button
              onClick={() => setIsGalleryOpen(false)}
              className="bg-slate-100 text-slate-600 p-3 rounded-xl"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {galleryPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group rounded-2xl overflow-hidden aspect-square"
                >
                  <img
                    src={photo.image_url}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleDeletePhoto(photo)}
                    className="absolute top-2 right-2 bg-rose-500 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {isSeatingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800">
                  ניהול הושבה
                </h2>
                <p className="text-emerald-600 font-bold mt-1">
                  סה"כ במערכת: {savedGuestsCount} אורחים
                </p>
              </div>
              <button
                onClick={() => setIsSeatingModalOpen(false)}
                className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-full transition-colors"
              >
                <X size={28} />
              </button>
            </div>
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              <div className="w-full md:w-1/2 p-8 border-l border-slate-100 flex flex-col bg-white shrink-0">
                <textarea
                  value={seatingText}
                  onChange={(e) => setSeatingText(e.target.value)}
                  placeholder="ישראל ישראלי 12&#10;שרה כהן - 5"
                  className="w-full flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[200px]"
                />
                <button
                  onClick={handleSaveSeating}
                  className="w-full mt-4 bg-emerald-500 text-white font-black py-4 rounded-2xl hover:bg-emerald-600"
                >
                  פענח והוסף לרשימה
                </button>
              </div>
              <div className="w-full md:w-1/2 bg-slate-50 p-8 overflow-y-auto">
                <div className="space-y-3">
                  {seatingGuests.map((guest) => (
                    <div
                      key={guest.id}
                      className="bg-white p-3 rounded-2xl flex justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 text-emerald-700 w-10 h-10 flex items-center justify-center rounded-xl">
                          {guest.table_number}
                        </div>
                        <span className="font-bold text-slate-700">
                          {guest.guest_name}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          handleDeleteGuest(guest.id, guest.guest_name)
                        }
                        className="text-rose-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {isQrModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 flex justify-between items-center bg-slate-50">
              <h2 className="text-2xl font-black text-slate-800">QR מעוצב</h2>
              <button onClick={() => setIsQrModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <AdminQRGenerator
                key={selectedEvent.id}
                defaultUrl={`${window.location.origin}/event/${selectedEvent.id}`}
                defaultColor={
                  formData.design_config?.colors?.primary || "#3b82f6"
                }
              />
            </div>
          </div>
        </div>
      )}
      {isDatingManagerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-rose-50/50 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <Heart className="text-rose-500" /> ניהול דייטליין (פרופילים)
                </h2>
                <p className="text-rose-600 font-bold mt-1">
                  סה"כ פרופילים: {datingProfiles.length}
                </p>
              </div>
              <button
                onClick={() => setIsDatingManagerOpen(false)}
                className="p-2 hover:bg-rose-100 text-rose-600 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 bg-slate-50 p-6 md:p-8 overflow-y-auto">
              {datingLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-rose-500" size={48} />
                </div>
              ) : datingProfiles.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <Heart size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-lg">אין פרופילים בדייטליין</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {datingProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="bg-white rounded-[1.5rem] overflow-hidden shadow-sm border border-slate-100 hover:border-rose-200 hover:shadow-md transition-all flex flex-col"
                    >
                      {/* Profile Image */}
                      <div className="w-full h-40 bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center overflow-hidden">
                        {profile.photo_url ? (
                          <img
                            src={profile.photo_url}
                            alt={profile.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Heart
                            size={48}
                            className="text-rose-300 opacity-50"
                          />
                        )}
                      </div>

                      {/* Profile Info */}
                      <div className="p-4 flex flex-col flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-black text-slate-800 text-lg">
                              {profile.name}
                            </h3>
                            {profile.age && (
                              <p className="text-sm text-slate-500 font-semibold">
                                {profile.age} שנים
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Connection & Location */}
                        {(profile.connection || profile.location) && (
                          <div className="text-xs text-slate-600 mb-3 space-y-1">
                            {profile.connection && (
                              <p className="font-semibold">
                                <span className="text-slate-400">קשר:</span>{" "}
                                {profile.connection}
                              </p>
                            )}
                            {profile.location && (
                              <p className="font-semibold">
                                <span className="text-slate-400">מיקום:</span>{" "}
                                {profile.location}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Bio */}
                        {profile.bio && (
                          <p className="text-sm text-slate-600 mb-4 line-clamp-2 flex-1">
                            {profile.bio}
                          </p>
                        )}

                        {/* Delete Button */}
                        <button
                          onClick={() =>
                            handleDeleteDatingProfile(profile.id, profile.name)
                          }
                          className="w-full mt-auto bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          <Trash2 size={16} /> מחק פרופיל
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isIcebreakerUserManagerOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
          <div className="p-6 md:p-8 flex justify-between items-center bg-white shadow-sm z-10">
            <div>
              <h2 className="text-3xl font-black text-slate-800">
                משתמשי IceBreaker
              </h2>
            </div>
            <button
              onClick={() => setIsIcebreakerUserManagerOpen(false)}
              className="bg-slate-100 p-3 rounded-xl"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {icebreakerProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="bg-white rounded-[2rem] p-5 shadow-xl flex items-center gap-4"
                >
                  <h3 className="font-black">{profile.name}</h3>
                  <button
                    onClick={() =>
                      handleDeleteIcebreakerProfile(profile.id, profile.name)
                    }
                    className="text-rose-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {isIcebreakerModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex flex-col animate-in fade-in duration-300">
          <div className="p-6 md:p-8 flex justify-between items-center bg-white shadow-sm z-10">
            <div>
              <h2 className="text-3xl font-black text-slate-800">
                בנק המשימות
              </h2>
            </div>
            <button
              onClick={() => setIsIcebreakerModalOpen(false)}
              className="bg-slate-100 p-3 rounded-xl"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-4xl mx-auto w-full">
            <div className="bg-white p-6 rounded-3xl mb-6 flex">
              <input
                type="text"
                value={newMissionText}
                onChange={(e) => setNewMissionText(e.target.value)}
                placeholder="הוסף משימה..."
                className="w-full flex-1 p-4 bg-slate-50 rounded-xl"
              />
              <button
                onClick={handleAddMission}
                className="bg-cyan-500 text-white font-black px-6 py-4 rounded-xl"
              >
                הוסף
              </button>
            </div>
            <div className="space-y-3">
              {icebreakerMissions.map((mission) => (
                <div
                  key={mission.id}
                  className="bg-white p-5 rounded-2xl flex justify-between"
                >
                  <p className="font-medium">{mission.content}</p>
                  <button
                    onClick={() => handleDeleteMission(mission.id)}
                    className="text-rose-500"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
