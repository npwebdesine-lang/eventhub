import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Loader2,
  MessageCircle,
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

export const buildRsvpMessage = (guest, origin) =>
  `היי ${guest.guest_name}, מתרגשים לקראת האירוע! נשמח לאישור סופי. לאישור: ${origin}/rsvp-action?id=${guest.id}&status=confirmed | לביטול: ${origin}/rsvp-action?id=${guest.id}&status=canceled`;

// "שם, טלפון, כמות" בכל שורה. טלפון וכמות אופציונליים.
export const parseGuestLines = (text) => {
  const valid = [];
  const invalid = [];

  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const [rawName, rawPhone, rawCount] = line.split(",").map((p) => p?.trim());
      const lineNumber = index + 1;

      if (!rawName || rawName.length < 1 || rawName.length > 100) {
        invalid.push({ lineNumber, line, reason: "שם חסר או ארוך מ-100 תווים" });
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

  const counts = useMemo(
    () => ({
      all: guests.length,
      confirmed: guests.filter((g) => g.status === "confirmed").length,
      canceled: guests.filter((g) => g.status === "canceled").length,
      pending: guests.filter((g) => g.status === "pending").length,
    }),
    [guests],
  );

  // המספר היחיד שאולם או קייטרינג מבקשים
  const confirmedSeats = useMemo(
    () =>
      guests
        .filter((g) => g.status === "confirmed")
        .reduce((sum, g) => sum + (g.guests_count || 0), 0),
    [guests],
  );

  const filtered = useMemo(
    () => (activeTab === "all" ? guests : guests.filter((g) => g.status === activeTab)),
    [guests, activeTab],
  );

  const preview = useMemo(
    () => (importText.trim() ? parseGuestLines(importText) : { valid: [], invalid: [] }),
    [importText],
  );

  const handleImport = async () => {
    if (preview.valid.length === 0) {
      showToast("לא זיהינו שורות תקינות", "warning");
      return;
    }
    setImporting(true);
    try {
      const { error } = await supabase.from("event_guests").insert(
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

  const saveNotes = async (guest, notes) => {
    if ((guest.notes ?? "") === notes) return;
    setGuests((prev) =>
      prev.map((g) => (g.id === guest.id ? { ...g, notes } : g)),
    );
    const { error } = await supabase
      .from("event_guests")
      .update({ notes: notes || null })
      .eq("id", guest.id);
    if (error) {
      console.error(error);
      showToast("ההערה לא נשמרה", "error");
      fetchGuests();
    }
  };

  // בחירה בדידה — במקום fetchGuests מלא בכישלון, מחזירים את השורה לערך הקודם
  // כדי שהטבלה לא תקפוץ ושאר העריכות הפתוחות לא יאבדו.
  const saveDietary = async (guest, dietary) => {
    const previous = guest.dietary || DEFAULT_DIETARY;
    if (previous === dietary) return;
    setGuests((prev) =>
      prev.map((g) => (g.id === guest.id ? { ...g, dietary } : g)),
    );
    const { error } = await supabase
      .from("event_guests")
      .update({ dietary })
      .eq("id", guest.id);
    if (error) {
      console.error(error);
      showToast("העדפת התזונה לא נשמרה", "error");
      setGuests((prev) =>
        prev.map((g) => (g.id === guest.id ? { ...g, dietary: previous } : g)),
      );
    }
  };

  const copyMessage = async (guest) => {
    try {
      await navigator.clipboard.writeText(buildRsvpMessage(guest, origin));
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

        {importOpen && (
          <div className="shrink-0 border-b border-[#e4e0d5] bg-[#f5f3ee] p-6">
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
                          שורה {row.lineNumber}: {sanitize(row.line)} — {row.reason}
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
              <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-right">
                <thead>
                  <tr className="text-xs font-bold text-slate-400">
                    <th className="px-3 pb-1">שם</th>
                    <th className="px-3 pb-1">טלפון</th>
                    <th className="px-3 pb-1">סטטוס</th>
                    <th className="px-3 pb-1">כמות</th>
                    <th className="px-3 pb-1">העדפת תזונה</th>
                    <th className="px-3 pb-1">הערות</th>
                    <th className="px-3 pb-1">קישור קסם</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((guest) => {
                    const waPhone = toWhatsAppPhone(guest.phone);
                    return (
                      <tr key={guest.id} className="bg-[#f0eee7]">
                        <td
                          className={`${CLAY_RAISED} rounded-r-2xl px-3 py-3 font-bold text-slate-700`}
                        >
                          {sanitize(guest.guest_name || "")}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-500">
                          {sanitize(guest.phone || "—")}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${STATUS_BADGE[guest.status]}`}
                          >
                            {STATUS_LABEL[guest.status]}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold text-slate-700">
                          {guest.guests_count}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={guest.dietary || DEFAULT_DIETARY}
                            onChange={(event) =>
                              saveDietary(guest, event.target.value)
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
                            defaultValue={guest.notes || ""}
                            onBlur={(event) =>
                              saveNotes(guest, event.target.value.trim())
                            }
                            maxLength={500}
                            placeholder="הוסף הערה..."
                            className={`${CLAY_INSET} w-full rounded-xl bg-[#f0eee7] px-3 py-1.5 text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none`}
                          />
                        </td>
                        <td className={`${CLAY_RAISED} rounded-l-2xl px-3 py-3`}>
                          {waPhone ? (
                            <a
                              href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                buildRsvpMessage(guest, origin),
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:text-emerald-700"
                            >
                              <MessageCircle size={16} /> וואטסאפ
                            </a>
                          ) : (
                            <button
                              onClick={() => copyMessage(guest)}
                              title="אין טלפון תקין — העתקת ההודעה"
                              className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700"
                            >
                              <Copy size={16} /> העתק
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
