import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Copy,
  Download,
  Loader2,
  MessageCircle,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  DEFAULT_DIETARY,
  DIETARY_OPTIONS,
  dietaryLabelOf,
} from "../lib/dietary";
import { parseGuestFile, isValidGuestRow } from "../lib/guestImport";
import { sanitize } from "../utils/sanitize";
import { useToast } from "./Toast";

// ניהול רשימת מוזמנים + "קישורי קסם" לוואטסאפ.
// הרשימה נקראת ישירות מהטבלה תחת event_guests_all_owner (מנהל מחובר שבבעלותו
// האירוע). האורח עצמו לעולם לא נוגע בטבלה — הוא עובר דרך ה-RPC rsvp_respond.

const TABS = [
  { key: "all", label: "הכל" },
  { key: "confirmed", label: "אישרו" },
  { key: "canceled", label: "ביטלו" },
  { key: "pending", label: "ממתינים" },
];

const STATUS_BADGE = {
  confirmed: "bg-emerald-100 text-emerald-700",
  canceled: "bg-rose-100 text-rose-700",
  pending: "bg-amber-100 text-amber-700",
};

const STATUS_LABEL = {
  confirmed: "אישר/ה",
  canceled: "ביטל/ה",
  pending: "ממתין/ה",
};

const CLAY_RAISED =
  "shadow-[6px_6px_14px_rgba(0,0,0,0.10),-6px_-6px_14px_rgba(255,255,255,0.95)]";
const CLAY_INSET =
  "shadow-[inset_5px_5px_10px_rgba(0,0,0,0.12),inset_-5px_-5px_10px_rgba(255,255,255,0.95)]";

const PHONE_PATTERN = /^[0-9+\-\s]{7,15}$/; // זהה ל-check constraint בטבלה

// wa.me דורש ספרות בפורמט בינלאומי: 0501234567 -> 972501234567
export const toWhatsAppPhone = (phone) => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  if (digits.length >= 9 && digits.length <= 15) return digits;
  return null;
};

// הקישור מצביע על ההזמנה המאוחדת (/invite/:eventId?guest_id=) — האורח רואה
// את האירוע ואת אישור ההגעה במקום אחד.
//
// ה-status נשאר בשאילתה כי שני הקישורים בהודעה חייבים להיות שונים: בלעדיו
// "לאישור" ו"לביטול" היו אותה כתובת בדיוק. Invite.jsx מחיל את הערך הזה מיד
// עם הטעינה, ולכן לחיצה אחת עדיין מספיקה — בדיוק כמו ב-/rsvp-action.
export const buildRsvpMessage = (guest, origin, eventId) =>
  `היי ${guest.guest_name}, מתרגשים לקראת האירוע! נשמח לאישור סופי. לאישור: ${origin}/invite/${eventId}?guest_id=${guest.id}&status=confirmed | לביטול: ${origin}/invite/${eventId}?guest_id=${guest.id}&status=canceled`;

// "שם, טלפון, כמות" בכל שורה. טלפון וכמות אופציונליים.
export const parseGuestLines = (text) => {
  const valid = [];
  const invalid = [];

  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const [rawName, rawPhone, rawCount] = line
        .split(",")
        .map((p) => p?.trim());
      const lineNumber = index + 1;

      if (!rawName || rawName.length < 1 || rawName.length > 100) {
        invalid.push({
          lineNumber,
          line,
          reason: "שם חסר או ארוך מ-100 תווים",
        });
        return;
      }
      if (rawPhone && !PHONE_PATTERN.test(rawPhone)) {
        invalid.push({ lineNumber, line, reason: "טלפון לא תקין" });
        return;
      }
      let count = 1;
      if (rawCount) {
        count = Number(rawCount);
        if (!Number.isInteger(count) || count < 0 || count > 20) {
          invalid.push({ lineNumber, line, reason: "כמות חייבת להיות 0-20" });
          return;
        }
      }
      valid.push({
        guest_name: rawName,
        phone: rawPhone || null,
        guests_count: count,
      });
    });

  return { valid, invalid };
};

const CSV_BOM = "\uFEFF"; // אקסל מזהה UTF-8 רק לפי ה-BOM בתחילת הקובץ
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function GuestListManager({ eventId, eventName, onClose }) {
  const { showToast } = useToast();

  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const deleteTimerRef = useRef(null);

  // ייבוא מקובץ: filePreview הוא מצב הביניים בין פענוח לשמירה.
  const fileInputRef = useRef(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [parsingFile, setParsingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // מעקב שליחה — מקומי לסשן בלבד ולא נשמר ב-DB: המטרה היא לדעת איפה
  // עצרתי ברשימה עכשיו, לא לתעד היסטוריית שליחות.
  const [sentIds, setSentIds] = useState(() => new Set());

  useEffect(() => () => clearTimeout(deleteTimerRef.current), []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("event_guests")
        .select(
          "id, guest_name, phone, status, guests_count, notes, dietary, responded_at",
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setGuests(data || []);
    } catch (error) {
      console.error(error);
      showToast("תקלה בטעינת רשימת המוזמנים", "error");
    } finally {
      setLoading(false);
    }
  }, [eventId, showToast]);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  const resetFileImport = () => {
    setFilePreview(null);
    setFileName("");
    setParsingFile(false);
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      showToast("קובץ לא נתמך — יש להעלות xlsx או csv", "warning");
      return;
    }
    setParsingFile(true);
    setFileName(file.name);
    try {
      const result = await parseGuestFile(file);
      if (result.rows.length === 0) {
        showToast("לא נמצאו שורות בקובץ", "warning");
        resetFileImport();
        return;
      }
      setFilePreview(result);
    } catch (error) {
      console.error(error);
      showToast("לא הצלחנו לקרוא את הקובץ", "error");
      resetFileImport();
    } finally {
      setParsingFile(false);
    }
  };

  // השמירה היא שמייצרת את ה-UUID של כל אורח, ולכן רק אחריה יש קישור קסם לשלוח.
  const saveImportedGuests = async () => {
    if (!filePreview) return;
    const valid = filePreview.rows.filter(isValidGuestRow);
    if (valid.length === 0) {
      showToast("אין שורות תקינות לשמירה", "warning");
      return;
    }
    setImporting(true);
    try {
      const { error } = await supabase.from("event_guests").insert(
        valid.map((row) => ({
          event_id: eventId,
          guest_name: row.name,
          phone: row.phone, // כבר מנורמל ל-972…
          guests_count: row.guestsCount,
        })),
      );
      if (error) throw error;
      showToast(`נשמרו ${valid.length} מוזמנים`, "success");
      resetFileImport();
      setImportOpen(false);
      fetchGuests();
    } catch (error) {
      console.error(error);
      showToast("שמירת המוזמנים נכשלה", "error");
    } finally {
      setImporting(false);
    }
  };

  const markSent = (guestId) =>
    setSentIds((prev) => new Set(prev).add(guestId));

  const counts = useMemo(
    () => ({
      all: guests.length,
      confirmed: guests.filter((g) => g.status === "confirmed").length,
      canceled: guests.filter((g) => g.status === "canceled").length,
      pending: guests.filter((g) => g.status === "pending").length,
    }),
    [guests],
  );

  // אדם אחד = שורה אחת, ולכן חבורה מזוהה רק לפי טלפון משותף. הספירה מתבצעת
  // על כל המוזמנים ולא על התצוגה המסוננת, אחרת מעבר ללשונית "אישרו" היה
  // מקטין את מספר בני החבורה ונראה כמו באג.
  const phoneGroupSizes = useMemo(() => {
    const sizes = new Map();
    guests.forEach((guest) => {
      const key = (guest.phone || "").trim();
      if (!key) return; // בלי טלפון אין מפתח קיבוץ — שורה בודדת
      sizes.set(key, (sizes.get(key) || 0) + 1);
    });
    return sizes;
  }, [guests]);

  // המספר היחיד שאולם או קייטרינג מבקשים
  const confirmedSeats = useMemo(
    () =>
      guests
        .filter((g) => g.status === "confirmed")
        .reduce((sum, g) => sum + (g.guests_count || 0), 0),
    [guests],
  );

  const filtered = useMemo(
    () =>
      activeTab === "all"
        ? guests
        : guests.filter((g) => g.status === activeTab),
    [guests, activeTab],
  );

  const preview = useMemo(
    () =>
      importText.trim()
        ? parseGuestLines(importText)
        : { valid: [], invalid: [] },
    [importText],
  );

  const handleImport = async () => {
    if (preview.valid.length === 0) {
      showToast("לא זיהינו שורות תקינות", "warning");
      return;
    }
    setImporting(true);
    try {
      const { error } = await supabase
        .from("event_guests")
        .insert(
          preview.valid.map((guest) => ({ ...guest, event_id: eventId })),
        );
      if (error) throw error;
      showToast(`נוספו ${preview.valid.length} מוזמנים`, "success");
      setImportText("");
      setImportOpen(false);
      fetchGuests();
    } catch (error) {
      console.error(error);
      showToast("תקלה בייבוא המוזמנים", "error");
    } finally {
      setImporting(false);
    }
  };

  // עדכון שדה בודד בשורה. אופטימי, ובכישלון מחזיר את הערך הקודם בלבד — במקום
  // fetchGuests מלא, כדי שהטבלה לא תקפוץ ושאר העריכות הפתוחות לא יאבדו.
  // הוולידציה כאן מקבילה ל-check constraints על event_guests; בלעדיה השגיאה
  // חוזרת כ-23514 גולמי בלי שהמנהל יבין מה נדחה.
  const saveField = async (guest, field, rawValue) => {
    const previous = guest[field] ?? null;
    let value = rawValue;

    if (field === "guest_name") {
      value = String(rawValue ?? "").trim();
      if (value.length < 1 || value.length > 100) {
        showToast("השם חייב להכיל בין תו אחד ל-100 תווים", "warning");
        setGuests((prev) => [...prev]); // מאלץ רינדור מחדש כדי להחזיר את הקלט
        return;
      }
    }

    if (field === "phone") {
      value = String(rawValue ?? "").trim() || null;
      if (value && !PHONE_PATTERN.test(value)) {
        showToast("מספר הטלפון אינו תקין", "warning");
        setGuests((prev) => [...prev]);
        return;
      }
    }

    if (field === "guests_count") {
      value = Number(rawValue);
      if (!Number.isInteger(value) || value < 0 || value > 20) {
        showToast("כמות האורחים חייבת להיות בין 0 ל-20", "warning");
        setGuests((prev) => [...prev]);
        return;
      }
    }

    if (field === "notes") {
      value = String(rawValue ?? "").trim() || null;
      if (value && value.length > 500) {
        showToast("ההערה ארוכה מדי (עד 500 תווים)", "warning");
        return;
      }
    }

    if ((previous ?? "") === (value ?? "")) return;

    setGuests((prev) =>
      prev.map((g) => (g.id === guest.id ? { ...g, [field]: value } : g)),
    );
    const { error } = await supabase
      .from("event_guests")
      .update({ [field]: value })
      .eq("id", guest.id);
    if (error) {
      console.error(error);
      showToast("השינוי לא נשמר", "error");
      setGuests((prev) =>
        prev.map((g) => (g.id === guest.id ? { ...g, [field]: previous } : g)),
      );
    }
  };

  // מחיקה בשני שלבים: לחיצה ראשונה מסמנת, שנייה מוחקת. הסימון מתאפס לבד
  // אחרי 4 שניות כדי שכפתור "אשר?" לא יישאר דרוך על שורה שנשכחה.
  const requestDelete = (guestId) => {
    clearTimeout(deleteTimerRef.current);
    setConfirmingDeleteId(guestId);
    deleteTimerRef.current = setTimeout(
      () => setConfirmingDeleteId(null),
      4000,
    );
  };

  const confirmDelete = async (guest) => {
    clearTimeout(deleteTimerRef.current);
    setConfirmingDeleteId(null);
    const snapshot = guests;
    setGuests((prev) => prev.filter((g) => g.id !== guest.id));
    const { error } = await supabase
      .from("event_guests")
      .delete()
      .eq("id", guest.id);
    if (error) {
      console.error(error);
      showToast("המחיקה נכשלה", "error");
      setGuests(snapshot);
      return;
    }
    showToast(`${guest.guest_name} נמחק/ה`, "success");
  };

  const copyMessage = async (guest) => {
    try {
      await navigator.clipboard.writeText(
        buildRsvpMessage(guest, origin, eventId),
      );
      showToast("ההודעה הועתקה", "success");
    } catch {
      showToast("לא ניתן להעתיק", "error");
    }
  };

  const exportToCSV = () => {
    if (filtered.length === 0) return;
    const header = [
      "שם",
      "טלפון",
      "סטטוס",
      "כמות אורחים",
      "העדפת תזונה",
      "הערות",
    ];
    const rows = filtered.map((g) =>
      [
        g.guest_name,
        g.phone || "",
        STATUS_LABEL[g.status] || g.status,
        g.guests_count,
        dietaryLabelOf(g.dietary),
        g.notes || "",
      ]
        .map(csvCell)
        .join(","),
    );
    // BOM — בלעדיו אקסל מציג עברית כג'יבריש. כתוב כ-escape ולא כתו
    // ממשי כדי שלא ייעלם בעריכה או בפורמט אוטומטי.
    const csv = `${CSV_BOM}${header.map(csvCell).join(",")}\n${rows.join("\n")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `guests_${eventName || "event"}_${activeTab}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[3rem] bg-[#f0eee7] shadow-2xl animate-in zoom-in-95">
        <div className="flex shrink-0 items-center justify-between border-b border-[#e4e0d5] p-6 md:p-8">
          <div>
            <h2 className="text-2xl font-black text-slate-800">
              רשימת מוזמנים
            </h2>
            <p className="mt-1 font-bold text-emerald-600">
              {confirmedSeats} מקומות אושרו · {counts.all} מוזמנים
              {sentIds.size > 0 && (
                <span className="text-slate-500">
                  {" "}
                  · נשלחו {sentIds.size} בסשן הזה
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setImportOpen((open) => !open)}
              className={`${CLAY_RAISED} flex items-center gap-2 rounded-xl bg-[#f0eee7] px-4 py-2 font-bold text-slate-700`}
            >
              <Upload size={18} /> ייבוא
            </button>
            <button
              onClick={exportToCSV}
              disabled={filtered.length === 0}
              className={`${CLAY_RAISED} flex items-center gap-2 rounded-xl bg-[#f0eee7] px-4 py-2 font-bold text-slate-700 disabled:opacity-50`}
            >
              <Download size={18} /> ייצוא
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* --- תצוגה מקדימה של קובץ: מחליפה את אזור הייבוא עד אישור/ביטול --- */}
        {filePreview && (
          <div className="flex min-h-0 shrink-0 flex-col border-b border-[#e4e0d5] bg-[#f5f3ee]">
            <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-3">
              <div>
                <h3 className="font-black text-slate-800">
                  תצוגה מקדימה — {sanitize(fileName)}
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {filePreview.rows.filter(isValidGuestRow).length} שורות תקינות
                  {filePreview.rows.length -
                    filePreview.rows.filter(isValidGuestRow).length >
                    0 && (
                    <span className="text-rose-600">
                      {" "}
                      ·{" "}
                      {filePreview.rows.length -
                        filePreview.rows.filter(isValidGuestRow).length}{" "}
                      ידולגו
                    </span>
                  )}
                </p>
                {!filePreview.headerDetected && (
                  <p className="mt-1 text-xs font-bold text-amber-600">
                    לא זוהו כותרות — העמודה הראשונה נקראה כשם והשנייה כטלפון
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={resetFileImport}
                  disabled={importing}
                  className={`${CLAY_RAISED} rounded-xl bg-[#f0eee7] px-4 py-2 font-bold text-slate-600 disabled:opacity-50`}
                >
                  ביטול
                </button>
                <button
                  onClick={saveImportedGuests}
                  disabled={importing}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 font-black text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                >
                  {importing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Check size={18} />
                  )}
                  שמור מוזמנים
                </button>
              </div>
            </div>
            <div className="max-h-[38vh] overflow-y-auto px-6 pb-6">
              <table className="w-full border-separate border-spacing-y-2 text-right">
                <thead>
                  <tr className="text-xs font-bold text-slate-400">
                    <th className="px-3 pb-1">#</th>
                    <th className="px-3 pb-1">שם</th>
                    <th className="px-3 pb-1">טלפון (מנורמל)</th>
                    <th className="px-3 pb-1">כמות</th>
                    <th className="px-3 pb-1">סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {filePreview.rows.map((row) => {
                    const invalid = !isValidGuestRow(row);
                    return (
                      <tr
                        key={row.rowNumber}
                        className={invalid ? "bg-rose-50" : "bg-[#f0eee7]"}
                      >
                        <td className="rounded-r-xl px-3 py-2 text-xs font-bold text-slate-400">
                          {row.rowNumber}
                        </td>
                        <td
                          className={`px-3 py-2 font-bold ${row.issues.includes("missing_name") ? "text-rose-500" : "text-slate-700"}`}
                        >
                          {row.name ? sanitize(row.name) : "— חסר שם —"}
                        </td>
                        <td
                          dir="ltr"
                          className={`px-3 py-2 text-right text-sm font-bold ${row.issues.includes("invalid_phone") ? "text-rose-500" : "text-slate-600"}`}
                        >
                          {row.phone
                            ? sanitize(row.phone)
                            : row.rawPhone
                              ? `${sanitize(row.rawPhone)} ✗`
                              : "—"}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-700">
                          {row.guestsCount}
                        </td>
                        <td className="rounded-l-xl px-3 py-2 text-xs font-bold">
                          {invalid ? (
                            <span className="text-rose-600">ידולג</span>
                          ) : (
                            <span className="text-emerald-600">תקין</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importOpen && !filePreview && (
          <div className="shrink-0 border-b border-[#e4e0d5] bg-[#f5f3ee] p-6">
            {/* אזור גרירה — SheetJS נטען דינמית רק כשבאמת גוררים קובץ */}
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                handleFile(event.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`mb-4 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                dragOver
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-[#dcd7ca] bg-[#f0eee7] hover:border-emerald-300"
              }`}
            >
              {parsingFile ? (
                <Loader2
                  className="mx-auto animate-spin text-emerald-500"
                  size={26}
                />
              ) : (
                <Upload className="mx-auto text-slate-400" size={26} />
              )}
              <p className="mt-2 text-sm font-black text-slate-700">
                {parsingFile
                  ? "קורא את הקובץ..."
                  : "גררו לכאן קובץ Excel או CSV"}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-400">
                או לחצו לבחירה · xlsx, csv · מזהה כותרות שם/טלפון בעברית
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                handleFile(event.target.files?.[0]);
                event.target.value = ""; // מאפשר לבחור שוב את אותו קובץ
              }}
            />

            <div className="mb-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#dcd7ca]" />
              <span className="text-xs font-bold text-slate-400">
                או הדבקה ידנית
              </span>
              <div className="h-px flex-1 bg-[#dcd7ca]" />
            </div>

            <p className="mb-2 text-sm font-bold text-slate-600">
              הדביקו שורה לכל מוזמן: שם, טלפון, כמות
            </p>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={5}
              dir="rtl"
              placeholder={"דוד כהן, 0501234567, 2\nרות לוי, 0509876543, 1"}
              className={`${CLAY_INSET} w-full resize-none rounded-2xl bg-[#f0eee7] p-4 text-slate-700 placeholder:text-slate-400 focus:outline-none`}
            />
            {importText.trim() && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-bold text-emerald-600">
                  {preview.valid.length} שורות תקינות
                </p>
                {preview.invalid.length > 0 && (
                  <div className="rounded-2xl bg-rose-50 p-3">
                    <p className="mb-1 text-sm font-bold text-rose-700">
                      {preview.invalid.length} שורות ידולגו:
                    </p>
                    <ul className="space-y-0.5 text-xs text-rose-600">
                      {preview.invalid.map((row) => (
                        <li key={row.lineNumber}>
                          שורה {row.lineNumber}: {sanitize(row.line)} —{" "}
                          {row.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={handleImport}
                  disabled={importing || preview.valid.length === 0}
                  className={`${CLAY_RAISED} flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 font-bold text-white disabled:opacity-50`}
                >
                  {importing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Check size={18} />
                  )}
                  הוסף {preview.valid.length} מוזמנים
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex shrink-0 gap-2 p-4 md:px-8">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-2xl bg-[#f0eee7] px-4 py-2 text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? `${CLAY_INSET} text-slate-800`
                  : `${CLAY_RAISED} text-slate-500`
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-slate-400" size={36} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users size={40} className="mx-auto mb-3 opacity-50" />
              <p className="font-bold">אין מוזמנים להצגה</p>
              <p className="text-sm">ייבאו רשימה כדי להתחיל</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-separate border-spacing-y-2 text-right">
                <thead>
                  <tr className="text-xs font-bold text-slate-400">
                    <th className="px-3 pb-1">שם</th>
                    <th className="px-3 pb-1">טלפון</th>
                    <th className="px-3 pb-1">סטטוס</th>
                    <th className="px-3 pb-1">כמות</th>
                    <th className="px-3 pb-1">העדפת תזונה</th>
                    <th className="px-3 pb-1">הערות</th>
                    <th className="px-3 pb-1">קישור קסם</th>
                    <th className="px-3 pb-1">מחיקה</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((guest) => {
                    const waPhone = toWhatsAppPhone(guest.phone);
                    const groupSize =
                      phoneGroupSizes.get((guest.phone || "").trim()) || 1;
                    return (
                      <tr key={guest.id} className="bg-[#f0eee7]">
                        <td
                          className={`${CLAY_RAISED} rounded-r-2xl px-3 py-3`}
                        >
                          <input
                            key={`name-${guest.id}-${guest.guest_name}`}
                            defaultValue={guest.guest_name || ""}
                            onBlur={(event) =>
                              saveField(guest, "guest_name", event.target.value)
                            }
                            maxLength={100}
                            aria-label="שם המוזמן"
                            className={`${CLAY_INSET} w-full rounded-xl bg-[#f0eee7] px-3 py-1.5 text-sm font-bold text-slate-700 focus:outline-none`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            key={`phone-${guest.id}-${guest.phone}`}
                            defaultValue={guest.phone || ""}
                            onBlur={(event) =>
                              saveField(guest, "phone", event.target.value)
                            }
                            dir="ltr"
                            placeholder="050-0000000"
                            aria-label="טלפון"
                            className={`${CLAY_INSET} w-full rounded-xl bg-[#f0eee7] px-3 py-1.5 text-right text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none`}
                          />
                          {/* טלפון משותף = הגיעו יחד. הסימון הוא הרמז היחיד
                              לקיבוץ אחרי שכל אדם הפך לשורה עצמאית. */}
                          {groupSize > 1 && (
                            <span
                              title={`${groupSize} אורחים עם אותו טלפון — הגיעו יחד`}
                              className="mt-1 inline-flex items-center gap-1 rounded-lg bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700"
                            >
                              <Users size={11} /> חבורה של {groupSize}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={guest.status}
                            onChange={(event) =>
                              saveField(guest, "status", event.target.value)
                            }
                            aria-label="סטטוס"
                            className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none ${STATUS_BADGE[guest.status]}`}
                          >
                            {Object.entries(STATUS_LABEL).map(
                              ([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            key={`count-${guest.id}-${guest.guests_count}`}
                            type="number"
                            min={0}
                            max={20}
                            defaultValue={guest.guests_count}
                            onBlur={(event) =>
                              saveField(
                                guest,
                                "guests_count",
                                event.target.value,
                              )
                            }
                            aria-label="כמות אורחים"
                            className={`${CLAY_INSET} w-16 rounded-xl bg-[#f0eee7] px-2 py-1.5 text-center text-sm font-bold text-slate-700 focus:outline-none`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={guest.dietary || DEFAULT_DIETARY}
                            onChange={(event) =>
                              saveField(guest, "dietary", event.target.value)
                            }
                            aria-label={`העדפת תזונה עבור ${guest.guest_name}`}
                            className={`${CLAY_INSET} w-full rounded-xl bg-[#f0eee7] px-3 py-1.5 text-sm text-slate-600 focus:outline-none`}
                          >
                            {DIETARY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.emoji} {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            key={`notes-${guest.id}-${guest.notes}`}
                            defaultValue={guest.notes || ""}
                            onBlur={(event) =>
                              saveField(guest, "notes", event.target.value)
                            }
                            maxLength={500}
                            placeholder="הוסף הערה..."
                            aria-label="הערות"
                            className={`${CLAY_INSET} w-full rounded-xl bg-[#f0eee7] px-3 py-1.5 text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none`}
                          />
                        </td>
                        <td className="px-3 py-3">
                          {waPhone ? (
                            <a
                              href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                buildRsvpMessage(guest, origin, eventId),
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => markSent(guest.id)}
                              aria-label={`שליחת וואטסאפ אל ${guest.guest_name}`}
                              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                                sentIds.has(guest.id)
                                  ? `${CLAY_INSET} bg-[#f0eee7] text-slate-400`
                                  : `${CLAY_RAISED} bg-emerald-500 text-white hover:bg-emerald-600`
                              }`}
                            >
                              {sentIds.has(guest.id) ? (
                                <>
                                  <Check size={16} /> נשלח
                                </>
                              ) : (
                                <>
                                  <MessageCircle size={16} /> שלח וואטסאפ
                                </>
                              )}
                            </a>
                          ) : (
                            <button
                              onClick={() => {
                                copyMessage(guest);
                                markSent(guest.id);
                              }}
                              title="אין טלפון תקין — העתקת ההודעה"
                              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                                sentIds.has(guest.id)
                                  ? `${CLAY_INSET} bg-[#f0eee7] text-slate-400`
                                  : `${CLAY_RAISED} bg-[#f0eee7] text-slate-600`
                              }`}
                            >
                              <Copy size={16} />
                              {sentIds.has(guest.id) ? "הועתק" : "העתק"}
                            </button>
                          )}
                        </td>
                        <td
                          className={`${CLAY_RAISED} rounded-l-2xl px-3 py-3`}
                        >
                          {confirmingDeleteId === guest.id ? (
                            <button
                              onClick={() => confirmDelete(guest)}
                              className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-rose-600"
                            >
                              <Trash2 size={16} /> לאשר?
                            </button>
                          ) : (
                            <button
                              onClick={() => requestDelete(guest.id)}
                              aria-label={`מחיקת ${guest.guest_name}`}
                              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                            >
                              <Trash2 size={16} /> מחק
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
