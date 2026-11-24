import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Link2,
  Loader2,
  MessageCircle,
  Search,
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
  UNDER_5_DIETARY,
} from "../lib/dietary";
import { parseGuestFile, isValidGuestRow } from "../lib/guestImport";
import { buildRsvpLink } from "../lib/rsvpLink";
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

// צל בלבד — לכל אלמנט כאן כבר יש רקע משלו.
const CLAY_RAISED = "shadow-clay-md";
const CLAY_INSET = "shadow-clay-inset-deep";

const PHONE_PATTERN = /^[0-9+\-\s]{7,15}$/; // זהה ל-check constraint בטבלה

// השוואת טלפונים בחיפוש: ספרות בלבד, ו-972 בהתחלה שקול ל-0. כך "050-123",
// "050 123" ו-"+972 50 123" מוצאים את אותו מוזמן.
const searchablePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("972") ? `0${digits.slice(3)}` : digits;
};

// מפתח קיבוץ לחבורה: אותה נרמול כמו בחיפוש, ובנוסף מסנן מספרים שאינם
// מספר אמיתי — קצר מדי, או מספר "ממלא מקום" כמו 050-0000000 שבו שבע הספרות
// האחרונות זהות. בלי הסינון הזה כל המוזמנים עם טלפון פיקטיבי היו מתמזגים
// לחבורה אחת גדולה. null = שורה בודדת.
const groupingPhoneKey = (value) => {
  const normalized = searchablePhone(value);
  if (normalized.length < 9 || normalized.length > 13) return null;
  if (/^(\d)\1+$/.test(normalized.slice(-7))) return null;
  return normalized;
};

// 0501234567 -> 050-1234567 לתצוגה בכותרת החבורה; כל צורה אחרת נשארת כמות שהיא.
const formatPhoneForDisplay = (normalized) =>
  /^05\d{8}$/.test(normalized)
    ? `${normalized.slice(0, 3)}-${normalized.slice(3)}`
    : normalized;

// חיפוש לפי שם (בלי תלות ברישיות) או טלפון. שאילתה ריקה מתאימה לכולם.
const matchesSearch = (guest, query) => {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  if ((guest.guest_name || "").toLowerCase().includes(text)) return true;
  const digits = searchablePhone(text);
  // שאילתת טלפון צריכה לפחות 2 ספרות, אחרת "0" מתאים לכל מספר.
  return digits.length >= 2 && searchablePhone(guest.phone).includes(digits);
};

// wa.me דורש ספרות בפורמט בינלאומי: 0501234567 -> 972501234567
export const toWhatsAppPhone = (phone) => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  if (digits.length >= 9 && digits.length <= 15) return digits;
  return null;
};

// שני קישורים קצרים (/r/<code>?s=1|0 — ראו lib/rsvpLink.js). RsvpLink.jsx
// מעביר את האורח להזמנה המאוחדת, ו-Invite.jsx מחיל את הסטטוס מיד עם
// הטעינה, ולכן לחיצה אחת מספיקה. הסטטוס חייב להישאר בכתובת: בלעדיו
// "לאישור" ו"לביטול" היו אותה כתובת בדיוק.
//
// ההודעה נבנית כמערך שורות שמחובר ב-"\n", ולא כמחרוזת אחת עם שבירות בתוך
// הקוד: כך אין רווחים נגררים לפני שבירת שורה, ופורמט אוטומטי של הקובץ לא
// יכול לשנות את ההודעה. שורה ריקה = "". מי שבונה קישור wa.me חייב לעטוף
// ב-encodeURIComponent (ה-"\n" הופך ל-%0A) — אחרת וואטסאפ מקבל שורה אחת.
export const buildRsvpMessage = (guest, origin) =>
  [
    `היי ${String(guest.guest_name ?? "").trim()},`,
    "אנחנו מתרגשים מאוד לקראת האירוע ונשמח לאישור סופי! 💍",
    "",
    "לאישור הגעה לחצו כאן:",
    buildRsvpLink(origin, guest.id, "confirmed"),
    "",
    "לעדכון על חוסר יכולת להגיע:",
    buildRsvpLink(origin, guest.id, "canceled"),
  ].join("\n");

// קישור שליחה עם טקסט מוכן. מכוון: api.whatsapp.com/send ולא wa.me.
// wa.me מפנה (302) ל-api.whatsapp.com ובדרך מקלקל אימוג'י: תו של 4 בתים
// כמו 💍 (%F0%9F%92%8D) יוצא מההפניה כ-%EF%BF%BD — סימן השאלה "�". הקידוד
// שלנו תקין; הפנייה ישירה ליעד של ההפניה פשוט מדלגת על השלב שמקלקל.
const buildWhatsAppSendUrl = (waPhone, text) =>
  `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(text)}`;

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

// הכותרת נדבקת לראש אזור הגלילה; הרקע אטום כדי שהשורות לא ייראו דרכה.
// הצל התחתון מפריד בינה לבין השורות שנגללות מתחתיה.
const STICKY_HEAD =
  "sticky top-0 z-20 bg-clay-surface px-3 pt-2 pb-2 shadow-[0_8px_8px_-8px_rgba(0,0,0,0.18)]";
// עמודת השם (הראשונה, בצד ימין ב-RTL) נשארת במקום בגלילה אופקית, כדי
// שתמיד יהיה ברור של מי השורה. רק מ-md: בטלפון היא תופסת חצי מסך.
// הרקע חובה: בתא רגיל הוא מגיע מה-tr, אבל תא דביק זז בנפרד מהשורה ובלעדיו
// העמודות שנגללות מתחתיו נראות דרכו.
const STICKY_NAME = "md:sticky md:right-0 bg-clay-surface";

// table-fixed עם רוחבים קבועים, כי כל חבורה מצוירת כטבלה מקוננת משלה בתוך
// כרטיס: רק כשהעמודות מוגדרות במפורש הן מתיישרות בין השורות הבודדות לבין
// השורות שבתוך החבורות. "הערות" בלי רוחב — היא סופגת את שארית השטח.
const COLUMN_WIDTHS = [190, 160, 120, 88, 88, 170, null, 150, 110];
const ColumnGroup = () => (
  <colgroup>
    {COLUMN_WIDTHS.map((width, index) => (
      <col key={index} style={width ? { width } : undefined} />
    ))}
  </colgroup>
);
const TABLE_CLASS =
  "w-full table-fixed border-separate border-spacing-y-2 text-right";

export default function GuestListManager({ eventId, eventName, onClose }) {
  const { showToast } = useToast();

  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);
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
          "id, guest_name, phone, status, guests_count, under_5_count, notes, dietary, responded_at",
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

  // אדם אחד = שורה אחת, ולכן חבורה מזוהה רק לפי טלפון משותף (מנורמל). הקיבוץ
  // מתבצע על כל המוזמנים ולא על התצוגה המסוננת, אחרת מעבר ללשונית "אישרו"
  // היה מקטין את מספר בני החבורה ונראה כמו באג.
  const phoneGroups = useMemo(() => {
    const groups = new Map();
    guests.forEach((guest) => {
      const key = groupingPhoneKey(guest.phone);
      if (!key) return; // בלי טלפון אמיתי אין מפתח קיבוץ — שורה בודדת
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(guest);
    });
    return groups;
  }, [guests]);

  // חבורות מקופלות. ברירת המחדל פתוחה, כדי שכל בני החבורה זמינים לעריכה מיד.
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const toggleGroup = (key) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // המספר שהאולם מבקש: מנות בתשלום בלבד (מגיל 5 ומעלה). ילדים עד גיל 5
  // נספרים בנפרד — הם לא מנה, אבל צריכים כיסא תינוק / מקום לעגלה.
  const { confirmedSeats, confirmedUnder5 } = useMemo(
    () =>
      guests
        .filter((g) => g.status === "confirmed")
        .reduce(
          (totals, g) => ({
            confirmedSeats: totals.confirmedSeats + (g.guests_count || 0),
            confirmedUnder5: totals.confirmedUnder5 + (g.under_5_count || 0),
          }),
          { confirmedSeats: 0, confirmedUnder5: 0 },
        ),
    [guests],
  );

  // לשונית הסטטוס והחיפוש פועלים יחד. מוני הלשוניות נשארים על כל הרשימה,
  // כדי שהקלדה בחיפוש לא תשנה את המספרים שליד "אישרו" / "ממתינים".
  const filtered = useMemo(
    () =>
      guests.filter(
        (g) =>
          (activeTab === "all" || g.status === activeTab) &&
          matchesSearch(g, searchQuery),
      ),
    [guests, activeTab, searchQuery],
  );
  const isSearching = searchQuery.trim() !== "";
  const isFiltering = isSearching || activeTab !== "all";

  // מה שמוצג בפועל: שורות בודדות וחבורות, לפי סדר ההופעה של החבר הראשון.
  // חבורה מוצגת בשלמותה אם לפחות אחד מבניה תואם ללשונית ולחיפוש — כך רואים
  // את ההקשר — ומי שלא תואם מוצג מעומעם. filtered נשאר הרשימה המסוננת
  // השטוחה, ועליו נשענים הייצוא והמצבים הריקים.
  const listItems = useMemo(() => {
    const filteredIds = new Set(filtered.map((g) => g.id));
    const placed = new Set();
    const items = [];
    guests.forEach((guest) => {
      const key = groupingPhoneKey(guest.phone);
      const members = key ? phoneGroups.get(key) : null;
      if (members && members.length > 1) {
        if (placed.has(key)) return;
        placed.add(key);
        const matchingIds = new Set(
          members.filter((m) => filteredIds.has(m.id)).map((m) => m.id),
        );
        if (matchingIds.size > 0) {
          items.push({ type: "group", key, members, matchingIds });
        }
      } else if (filteredIds.has(guest.id)) {
        items.push({ type: "single", guest });
      }
    });
    return items;
  }, [guests, filtered, phoneGroups]);

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

    if (field === "under_5_count") {
      value = Number(rawValue);
      if (!Number.isInteger(value) || value < 0 || value > 20) {
        showToast("מספר הילדים עד גיל 5 חייב להיות בין 0 ל-20", "warning");
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

    // שורה של ילד מתחת לגיל 5 היא תמיד 0 מנות וילד אחד — הטריגר
    // event_guests_sync_under_5 כופה את זה ב-DB, כך שעריכת הכמות הייתה
    // "נשמרת" על המסך ומתבטלת בשקט בשרת.
    if (
      (field === "guests_count" || field === "under_5_count") &&
      guest.dietary === UNDER_5_DIETARY
    ) {
      showToast(
        "זו שורה של ילד מתחת לגיל 5 (ללא מנה). לשינוי הכמות שנו קודם את העדפת התזונה",
        "warning",
      );
      setGuests((prev) => [...prev]);
      return;
    }

    // אותו טריגר מעדכן את הכמויות כשהעדפת התזונה עוברת אל "מתחת לגיל 5" או
    // ממנה. משקפים את זה מקומית כדי שהסכומים בכותרת יתעדכנו בלי טעינה מחדש.
    const localPatch = { [field]: value };
    if (field === "dietary") {
      if (value === UNDER_5_DIETARY) {
        localPatch.guests_count = 0;
        localPatch.under_5_count = 1;
      } else if (previous === UNDER_5_DIETARY) {
        localPatch.under_5_count = 0;
        if ((guest.guests_count || 0) === 0) localPatch.guests_count = 1;
      }
    }

    setGuests((prev) =>
      prev.map((g) => (g.id === guest.id ? { ...g, ...localPatch } : g)),
    );
    const { error } = await supabase
      .from("event_guests")
      .update({ [field]: value })
      .eq("id", guest.id);
    if (error) {
      console.error(error);
      showToast("השינוי לא נשמר", "error");
      // החזרת השורה כולה, כולל הכמויות שעודכנו יחד עם העדפת התזונה.
      setGuests((prev) => prev.map((g) => (g.id === guest.id ? guest : g)));
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
      "מנות (מעל גיל 5)",
      "תינוקות/ילדים עד גיל 5 (ללא מנה)",
      "העדפת תזונה",
      "הערות",
    ];
    const rows = filtered.map((g) =>
      [
        g.guest_name,
        g.phone || "",
        STATUS_LABEL[g.status] || g.status,
        g.guests_count,
        g.under_5_count ?? 0,
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

  // שורת מוזמן אחת. group מגיע רק לשורה שבתוך כרטיס חבורה.
  const renderGuestRow = (guest, group = null) => {
    const waPhone = toWhatsAppPhone(guest.phone);
    // מעומעם = בן חבורה שמוצג רק כהקשר, כי הוא עצמו לא תואם לסינון. מעמעמים
    // את התוכן ולא את התא: תא דביק שקוף היה חושף את העמודות שנגללות מתחתיו.
    const dimmed = group && !group.matchingIds.has(guest.id);
    return (
      <tr
        key={guest.id}
        className={`bg-clay-surface ${dimmed ? "[&>td>*]:opacity-50" : ""}`}
      >
        <td
          className={`${CLAY_RAISED} ${STICKY_NAME} z-10 rounded-r-2xl px-3 py-3`}
        >
          <input
            key={`name-${guest.id}-${guest.guest_name}`}
            defaultValue={guest.guest_name || ""}
            onBlur={(event) =>
              saveField(guest, "guest_name", event.target.value)
            }
            maxLength={100}
            aria-label="שם המוזמן"
            className={`${CLAY_INSET} w-full rounded-xl bg-clay-surface px-3 min-h-11 text-sm font-bold text-slate-700 focus:outline-none`}
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
            className={`${CLAY_INSET} w-full rounded-xl bg-clay-surface px-3 min-h-11 text-right text-sm text-slate-600 placeholder:text-clay-muted focus:outline-none`}
          />
        </td>
        <td className="px-3 py-3">
          <select
            value={guest.status}
            onChange={(event) =>
              saveField(guest, "status", event.target.value)
            }
            aria-label="סטטוס"
            className={`w-full rounded-lg px-2.5 min-h-11 text-xs font-bold focus:outline-none ${STATUS_BADGE[guest.status]}`}
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
            aria-label="מנות (מגיל 5 ומעלה)"
            className={`${CLAY_INSET} w-16 rounded-xl bg-clay-surface px-2 min-h-11 text-center text-sm font-bold text-slate-700 focus:outline-none`}
          />
        </td>
        <td className="px-3 py-3">
          {/* מודגש כשיש ילדים — כך רואים במבט אילו משפחות
              צריכות כיסא תינוק בסידורי ההושבה. */}
          <input
            key={`under5-${guest.id}-${guest.under_5_count}`}
            type="number"
            min={0}
            max={20}
            defaultValue={guest.under_5_count ?? 0}
            onBlur={(event) =>
              saveField(
                guest,
                "under_5_count",
                event.target.value,
              )
            }
            aria-label="תינוקות/ילדים עד גיל 5 (ללא מנה)"
            className={`${CLAY_INSET} w-16 rounded-xl px-2 min-h-11 text-center text-sm font-bold focus:outline-none ${
              (guest.under_5_count || 0) > 0
                ? "bg-amber-100 text-amber-800"
                : "bg-clay-surface text-clay-muted"
            }`}
          />
        </td>
        <td className="px-3 py-3">
          <select
            value={guest.dietary || DEFAULT_DIETARY}
            onChange={(event) =>
              saveField(guest, "dietary", event.target.value)
            }
            aria-label={`העדפת תזונה עבור ${guest.guest_name}`}
            className={`${CLAY_INSET} w-full rounded-xl bg-clay-surface px-3 min-h-11 text-sm text-slate-600 focus:outline-none`}
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
            className={`${CLAY_INSET} w-full rounded-xl bg-clay-surface px-3 min-h-11 text-sm text-slate-600 placeholder:text-clay-muted focus:outline-none`}
          />
        </td>
        <td className="px-3 py-3">
          {group?.sharedIds.has(guest.id) ? (
            // הקישור המשותף בכותרת החבורה כבר פותח את השורה הזו — הודעה
            // נפרדת לכל אחד הייתה שולחת לאותו טלפון את אותו טופס שוב ושוב.
            <span
              title="נשלח בקישור המשותף שבכותרת החבורה"
              className="flex items-center gap-1.5 px-1 text-xs font-bold text-clay-muted"
            >
              {sentIds.has(guest.id) ? <Check size={14} /> : <Link2 size={14} />}
              בקישור המשותף
            </span>
          ) : waPhone ? (
            <a
              href={buildWhatsAppSendUrl(
                waPhone,
                buildRsvpMessage(guest, origin),
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => markSent(guest.id)}
              aria-label={`שליחת וואטסאפ אל ${guest.guest_name}`}
              className={`flex items-center gap-1.5 rounded-xl px-3 min-h-11 text-sm font-bold transition-all ${
                sentIds.has(guest.id)
                  ? `${CLAY_INSET} bg-clay-surface text-clay-muted`
                  : `${CLAY_RAISED} bg-emerald-700 text-white hover:bg-emerald-800`
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
              className={`flex items-center gap-1.5 rounded-xl px-3 min-h-11 text-sm font-bold transition-all ${
                sentIds.has(guest.id)
                  ? `${CLAY_INSET} bg-clay-surface text-clay-muted`
                  : `${CLAY_RAISED} bg-clay-surface text-slate-600`
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
              className="flex items-center gap-1.5 rounded-xl bg-rose-700 px-3 min-h-11 text-sm font-bold text-white transition-colors hover:bg-rose-800"
            >
              <Trash2 size={16} /> לאשר?
            </button>
          ) : (
            <button
              onClick={() => requestDelete(guest.id)}
              aria-label={`מחיקת ${guest.guest_name}`}
              className="flex items-center gap-1.5 rounded-xl px-3 min-h-11 text-sm font-bold text-clay-muted transition-colors hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 size={16} /> מחק
            </button>
          )}
        </td>
      </tr>
    );
  };

  // כרטיס חבורה: שורה אחת ברוחב כל הטבלה, ובתוכה טבלה מקוננת עם אותן
  // עמודות בדיוק (ColumnGroup + table-fixed), כך שהשדות מתיישרים עם שאר
  // הרשימה. ה-mx-2- מושך את המסגרת אל השוליים הפנימיים של עוטף הטבלה, כך
  // שהטבלה המקוננת ברוחב התא בדיוק והעמודות לא זזות.
  const renderGroup = ({ key, members, matchingIds }) => {
    const collapsed = collapsedGroups.has(key);
    // הקישור המשותף הוא הקישור של החבר הראשון. rsvp_guest_group מקבץ לפי
    // הטלפון כפי שנשמר, תו בתו, ולכן הוא פותח רק את מי שהטלפון שלו כתוב
    // בדיוק כמו של הראשון. מי שכתוב אחרת (למשל 972... מול 050-...) מקבל
    // כפתור שליחה משלו בשורה, ומסומן כאן.
    const primary = members[0];
    const primaryRawPhone = (primary.phone || "").trim();
    const sharedIds = new Set(
      members
        .filter((m) => (m.phone || "").trim() === primaryRawPhone)
        .map((m) => m.id),
    );
    const mismatchedCount = members.length - sharedIds.size;
    const waPhone = toWhatsAppPhone(primary.phone);
    const meals = members.reduce((sum, m) => sum + (m.guests_count || 0), 0);
    const under5 = members.reduce((sum, m) => sum + (m.under_5_count || 0), 0);
    const confirmedCount = members.filter(
      (m) => m.status === "confirmed",
    ).length;
    const sharedSent = [...sharedIds].every((id) => sentIds.has(id));
    const markGroupSent = () =>
      setSentIds((prev) => new Set([...prev, ...sharedIds]));
    const bodyId = `guest-group-${key}`;

    return (
      <tr key={`group-${key}`}>
        <td colSpan={COLUMN_WIDTHS.length} className="p-0">
          <div className="-mx-2 rounded-3xl bg-clay-well-deep px-2 pt-2 shadow-clay-md ring-1 ring-indigo-200/80">
            {/* הכותרת דביקה לימין, כדי שתישאר גלויה גם כשגוללים את הטבלה
                הצידה. w-fit — אחרת היא ברוחב הטבלה כולה ואין לה לאן להידבק. */}
            <div className="sticky right-0 flex w-fit max-w-[calc(100vw_-_4.5rem)] flex-wrap items-center gap-x-3 gap-y-2 px-1 py-1.5 md:max-w-none">
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                aria-expanded={!collapsed}
                aria-controls={bodyId}
                aria-label={collapsed ? "הצגת בני החבורה" : "הסתרת בני החבורה"}
                className={`${CLAY_RAISED} flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-surface text-slate-600 transition-colors hover:text-slate-800`}
              >
                <ChevronDown
                  size={18}
                  className={`transition-transform ${collapsed ? "rotate-90" : ""}`}
                />
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-100 px-2.5 py-1 text-sm font-black text-indigo-800">
                <Users size={15} /> חבורה של {members.length}
              </span>
              <span
                dir="ltr"
                className="text-sm font-bold tabular-nums text-slate-600"
              >
                {formatPhoneForDisplay(key)}
              </span>
              <span className="text-xs font-bold text-clay-muted">
                {meals} מנות (5+) · {under5} עד גיל 5 · אישרו {confirmedCount}/
                {members.length}
              </span>
              {isFiltering && matchingIds.size < members.length && (
                <span className="rounded-lg bg-clay-surface px-2 py-0.5 text-xs font-bold text-slate-600">
                  {matchingIds.size} תואמים לסינון
                </span>
              )}
              {mismatchedCount > 0 && (
                <span
                  title="הטלפון של חלק מבני החבורה כתוב בפורמט אחר, ולכן הקישור המשותף לא יפתח אותם. אפשר לשלוח להם מהשורה, או לכתוב את הטלפון זהה לכולם."
                  className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800"
                >
                  {mismatchedCount} בפורמט טלפון שונה
                </span>
              )}
              <div className="flex items-center gap-2">
                {waPhone && (
                  <a
                    href={buildWhatsAppSendUrl(
                      waPhone,
                      buildRsvpMessage(primary, origin),
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={markGroupSent}
                    aria-label={`שליחת קישור קסם משותף לחבורה של ${primary.guest_name}`}
                    className={`flex items-center gap-1.5 rounded-xl px-3 min-h-11 text-sm font-bold transition-all ${
                      sharedSent
                        ? `${CLAY_INSET} bg-clay-surface text-clay-muted`
                        : `${CLAY_RAISED} bg-emerald-700 text-white hover:bg-emerald-800`
                    }`}
                  >
                    {sharedSent ? (
                      <>
                        <Check size={16} /> נשלח
                      </>
                    ) : (
                      <>
                        <MessageCircle size={16} /> שלח לחבורה
                      </>
                    )}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    copyMessage(primary);
                    markGroupSent();
                  }}
                  title="העתקת קישור הקסם המשותף"
                  aria-label="העתקת קישור הקסם המשותף לחבורה"
                  className={`${CLAY_RAISED} flex items-center gap-1.5 rounded-xl bg-clay-surface px-3 min-h-11 text-sm font-bold text-slate-600`}
                >
                  <Copy size={16} />
                  <span className="hidden sm:inline">העתק קישור</span>
                </button>
              </div>
            </div>
            <div id={bodyId} hidden={collapsed}>
              <table className={TABLE_CLASS}>
                <ColumnGroup />
                <tbody>
                  {members.map((guest) =>
                    renderGuestRow(guest, { matchingIds, sharedIds }),
                  )}
                </tbody>
              </table>
            </div>
            {collapsed && <div className="h-2" />}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-clay-lg bg-clay-surface shadow-2xl animate-in zoom-in-95">
        {/* במובייל: כותרת + סגירה בשורה הראשונה, ייבוא/ייצוא ברוחב מלא
            בשורה השנייה. מ-md חוזרים לשורה אחת. בלי ה-wrap הכפתורים בגודל
            מגע (44px) חרגו מהמסך ב-360px. */}
        <div className="flex shrink-0 flex-wrap items-start gap-x-4 gap-y-3 border-b border-clay-well-deep p-5 md:items-center md:p-8">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black text-slate-800">
              רשימת מוזמנים
            </h2>
            <p className="mt-1 font-bold text-emerald-800">
              סה״כ מנות (מעל גיל 5): {confirmedSeats} · תינוקות (ללא מנה):{" "}
              {confirmedUnder5} · {counts.all} מוזמנים
              {sentIds.size > 0 && (
                <span className="text-clay-muted">
                  {" "}
                  · נשלחו {sentIds.size} בסשן הזה
                </span>
              )}
            </p>
          </div>
          <div className="order-3 flex w-full gap-3 md:order-2 md:w-auto">
            <button
              onClick={() => setImportOpen((open) => !open)}
              className={`${CLAY_RAISED} flex flex-1 items-center justify-center gap-2 rounded-xl bg-clay-surface px-4 min-h-11 font-bold text-slate-700 md:flex-none`}
            >
              <Upload size={18} /> ייבוא
            </button>
            <button
              onClick={exportToCSV}
              disabled={filtered.length === 0}
              className={`${CLAY_RAISED} flex flex-1 items-center justify-center gap-2 rounded-xl bg-clay-surface px-4 min-h-11 font-bold text-slate-700 disabled:opacity-50 md:flex-none`}
            >
              <Download size={18} /> ייצוא
            </button>
          </div>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="order-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-clay-muted transition-colors hover:bg-slate-200 md:order-3"
          >
            <X size={24} />
          </button>
        </div>

        {/* --- תצוגה מקדימה של קובץ: מחליפה את אזור הייבוא עד אישור/ביטול --- */}
        {filePreview && (
          <div className="flex min-h-0 shrink-0 flex-col border-b border-clay-well-deep bg-[#f5f3ee]">
            <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-3">
              <div>
                <h3 className="font-black text-slate-800">
                  תצוגה מקדימה — {fileName}
                </h3>
                <p className="mt-1 text-sm font-bold text-clay-muted">
                  {filePreview.rows.filter(isValidGuestRow).length} שורות תקינות
                  {filePreview.rows.length -
                    filePreview.rows.filter(isValidGuestRow).length >
                    0 && (
                    <span className="text-rose-700">
                      {" "}
                      ·{" "}
                      {filePreview.rows.length -
                        filePreview.rows.filter(isValidGuestRow).length}{" "}
                      ידולגו
                    </span>
                  )}
                </p>
                {!filePreview.headerDetected && (
                  <p className="mt-1 text-xs font-bold text-amber-800">
                    לא זוהו כותרות — העמודה הראשונה נקראה כשם והשנייה כטלפון
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={resetFileImport}
                  disabled={importing}
                  className={`${CLAY_RAISED} rounded-xl bg-clay-surface px-4 min-h-11 font-bold text-slate-600 disabled:opacity-50`}
                >
                  ביטול
                </button>
                <button
                  onClick={saveImportedGuests}
                  disabled={importing}
                  className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
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
                  <tr className="text-xs font-bold text-clay-muted">
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
                        className={invalid ? "bg-rose-50" : "bg-clay-surface"}
                      >
                        <td className="rounded-r-xl px-3 py-2 text-xs font-bold text-clay-muted">
                          {row.rowNumber}
                        </td>
                        <td
                          className={`px-3 py-2 font-bold ${row.issues.includes("missing_name") ? "text-rose-700" : "text-slate-700"}`}
                        >
                          {row.name ? row.name : "— חסר שם —"}
                        </td>
                        <td
                          dir="ltr"
                          className={`px-3 py-2 text-right text-sm font-bold ${row.issues.includes("invalid_phone") ? "text-rose-700" : "text-slate-600"}`}
                        >
                          {row.phone
                            ? row.phone
                            : row.rawPhone
                              ? `${row.rawPhone} ✗`
                              : "—"}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-700">
                          {row.guestsCount}
                        </td>
                        <td className="rounded-l-xl px-3 py-2 text-xs font-bold">
                          {invalid ? (
                            <span className="text-rose-700">ידולג</span>
                          ) : (
                            <span className="text-emerald-800">תקין</span>
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
          <div className="shrink-0 border-b border-clay-well-deep bg-[#f5f3ee] p-6">
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
                  : "border-clay-line bg-clay-surface hover:border-emerald-300"
              }`}
            >
              {parsingFile ? (
                <Loader2
                  className="mx-auto animate-spin text-emerald-800"
                  size={26}
                />
              ) : (
                <Upload className="mx-auto text-clay-muted" size={26} />
              )}
              <p className="mt-2 text-sm font-black text-slate-700">
                {parsingFile
                  ? "קורא את הקובץ..."
                  : "גררו לכאן קובץ Excel או CSV"}
              </p>
              <p className="mt-1 text-xs font-medium text-clay-muted">
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
              <div className="h-px flex-1 bg-clay-line" />
              <span className="text-xs font-bold text-clay-muted">
                או הדבקה ידנית
              </span>
              <div className="h-px flex-1 bg-clay-line" />
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
              className={`${CLAY_INSET} w-full resize-none rounded-2xl bg-clay-surface p-4 text-slate-700 placeholder:text-clay-muted focus:outline-none`}
            />
            {importText.trim() && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-bold text-emerald-800">
                  {preview.valid.length} שורות תקינות
                </p>
                {preview.invalid.length > 0 && (
                  <div className="rounded-2xl bg-rose-50 p-3">
                    <p className="mb-1 text-sm font-bold text-rose-700">
                      {preview.invalid.length} שורות ידולגו:
                    </p>
                    <ul className="space-y-0.5 text-xs text-rose-700">
                      {preview.invalid.map((row) => (
                        <li key={row.lineNumber}>
                          שורה {row.lineNumber}: {row.line} — {row.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={handleImport}
                  disabled={importing || preview.valid.length === 0}
                  className={`${CLAY_RAISED} flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 font-bold text-white disabled:opacity-50`}
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

        {/* לשוניות בצד ימין, חיפוש בצד שמאל (RTL). בטלפון החיפוש יורד
            לשורה משלו, ברוחב מלא, מתחת ללשוניות. */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 p-4 md:px-8">
          {/* בטלפון: ארבע עמודות שוות, כדי שהלשוניות לא יישברו לשורה
              עקומה (שלוש + אחת). */}
          <div className="grid w-full grid-cols-4 gap-2 md:flex md:w-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-2xl bg-clay-surface px-2 md:px-4 min-h-11 text-sm font-bold transition-all ${
                  activeTab === tab.key
                    ? `${CLAY_INSET} text-slate-800`
                    : `${CLAY_RAISED} text-clay-muted`
                }`}
              >
                {tab.label} ({counts[tab.key]})
              </button>
            ))}
          </div>

          <div className="relative w-full md:ms-auto md:w-72">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-clay-muted"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                // Escape מנקה את החיפוש במקום לסגור את המסך כולו.
                if (event.key === "Escape" && searchQuery) {
                  event.stopPropagation();
                  setSearchQuery("");
                }
              }}
              placeholder="חיפוש לפי שם או טלפון..."
              aria-label="חיפוש מוזמנים לפי שם או טלפון"
              className={`${CLAY_INSET} w-full rounded-xl bg-clay-surface pr-10 pl-10 min-h-11 text-sm text-slate-600 placeholder:text-clay-muted focus:outline-none focus:ring-2 focus:ring-clay-ink/30 [&::-webkit-search-cancel-button]:hidden`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                aria-label="ניקוי החיפוש"
                className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-clay-muted hover:text-slate-700 hover:bg-clay-well transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* אזור גלילה אחד לשני הצירים. קודם הגלילה האופקית ישבה בתוך
            האנכית, ולכן פס הגלילה האופקי הופיע רק אחרי השורה האחרונה —
            ברשימה ארוכה לא היה אפשר להגיע לעמודות השמאליות. כאן הפס תמיד
            בתחתית החלון, הכותרת נדבקת למעלה ועמודת השם נשארת בצד ימין. */}
        {/* השוליים הצדדיים הם border שקוף ולא padding: תוכן נגלל מצויר גם
            בתוך ה-padding, ואז עמודות שגלשו מתחת לעמודת השם הדביקה הציצו
            ברצועה שמימינה. */}
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain border-x-[0.5rem] border-transparent pb-6 md:border-x-[1.5rem]">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-clay-muted" size={36} />
            </div>
          ) : filtered.length === 0 ? (
            isSearching ? (
              <div className="py-16 text-center text-clay-muted" role="status">
                <Search size={40} className="mx-auto mb-3 opacity-50" />
                <p className="font-bold">לא נמצאו מוזמנים התואמים לחיפוש</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-sm font-bold underline underline-offset-4 hover:text-slate-700"
                >
                  ניקוי החיפוש
                </button>
              </div>
            ) : guests.length > 0 ? (
              // יש מוזמנים, רק לא בלשונית הזו — "ייבאו רשימה" היה מטעה כאן.
              <div className="py-16 text-center text-clay-muted">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p className="font-bold">אין מוזמנים בסטטוס הזה</p>
              </div>
            ) : (
              <div className="py-16 text-center text-clay-muted">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p className="font-bold">אין מוזמנים להצגה</p>
                <p className="text-sm">ייבאו רשימה כדי להתחיל</p>
              </div>
            )
          ) : (
            // px-2 כאן ולא על אזור הגלילה: זה תוכן שנגלל, ולכן עמודת השם
            // הדביקה עדיין נצמדת לקצה (ראו למעלה), אבל יש מקום למסגרת של
            // כרטיסי החבורות. הרוחב המינימלי (1260 + הריפוד) נקבע על העוטף
            // ולא על הטבלה, כדי שהריפוד יעטוף גם את הצד שגולש. לא w-max: עם
            // עמודת הערות בלי רוחב, הרוחב הטבעי של table-fixed מתפוצץ.
            <div className="min-w-[1276px] px-2">
              <table className={TABLE_CLASS}>
                <ColumnGroup />
                <thead>
                  <tr className="text-xs font-bold text-clay-muted">
                    <th className={`${STICKY_HEAD} ${STICKY_NAME} z-30`}>שם</th>
                    <th className={STICKY_HEAD}>טלפון</th>
                    <th className={STICKY_HEAD}>סטטוס</th>
                    <th className={STICKY_HEAD}>מנות (5+)</th>
                    <th className={STICKY_HEAD}>עד גיל 5</th>
                    <th className={STICKY_HEAD}>העדפת תזונה</th>
                    <th className={STICKY_HEAD}>הערות</th>
                    <th className={STICKY_HEAD}>קישור קסם</th>
                    <th className={STICKY_HEAD}>מחיקה</th>
                  </tr>
                </thead>
                <tbody>
                  {listItems.map((item) =>
                    item.type === "group"
                      ? renderGroup(item)
                      : renderGuestRow(item.guest),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
