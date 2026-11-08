import { supabase } from "./supabase";

const LIST_PAGE_SIZE = 1000;
const REMOVE_BATCH_SIZE = 100;

// כל המקומות שבהם נשמרים קבצים של אירוע. keep מסנן לפי שם הקובץ כשהתיקייה
// משותפת לכמה אירועים, כי search של list() הוא חיפוש "מכיל" בלבד.
const eventFileLocations = (eventId) => [
  {
    bucket: "event-assets",
    folder: "",
    search: eventId,
    keep: (name) => name.startsWith(`${eventId}_`),
  },
  {
    bucket: "event-assets",
    folder: "photos",
    search: eventId,
    keep: (name) =>
      name.startsWith(`photo_${eventId}_`) ||
      name.startsWith(`video_${eventId}_`),
  },
  { bucket: "blessings-uploads", folder: eventId },
  { bucket: "dating-profiles", folder: eventId },
  { bucket: "icebreaker-uploads", folder: `profiles/${eventId}` },
  { bucket: "icebreaker-uploads", folder: `proofs/${eventId}` },
];

const listPaths = async ({ bucket, folder, search, keep = () => true }) => {
  const paths = [];
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: LIST_PAGE_SIZE,
      offset,
      search,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const entries = data || [];
    // תיקיות חוזרות מ-list() בלי id.
    entries
      .filter((entry) => entry.id && keep(entry.name))
      .forEach((entry) =>
        paths.push(folder ? `${folder}/${entry.name}` : entry.name),
      );
    if (entries.length < LIST_PAGE_SIZE) return paths;
  }
};

const removePaths = async (bucket, paths) => {
  for (let i = 0; i < paths.length; i += REMOVE_BATCH_SIZE) {
    const batch = paths.slice(i, i + REMOVE_BATCH_SIZE);
    const { data, error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw error;
    // מחיקה שנחסמה מחזירה מערך קצר או ריק בלי שגיאה.
    if ((data?.length ?? 0) < batch.length) {
      throw new Error(`Storage files not removed from ${bucket}`);
    }
  }
};

/**
 * מוחק את כל הקבצים של האירוע וזורק אם משהו נכשל. חייב לרוץ לפני מחיקת שורת
 * האירוע: הרשאות האחסון בודקות בעלות דרכה, ובלעדיה הקבצים כבר לא נגישים.
 */
export const removeAllEventFiles = async (eventId) => {
  for (const location of eventFileLocations(eventId)) {
    const paths = await listPaths(location);
    await removePaths(location.bucket, paths);
  }
};
