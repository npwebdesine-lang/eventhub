/**
 * בדיקות לסרטונים של "כל אחד צלם", לפני שמעלים אותם.
 */

export const MAX_VIDEO_SIZE_MB = 25;
export const MAX_VIDEO_SECONDS = 15;

const VIDEO_EXTENSIONS = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

// קובץ שהדפדפן לא מצליח לפענח לעולם לא יורה loadedmetadata או error.
const METADATA_TIMEOUT_MS = 10000;

export const isAllowedVideoType = (file) => file.type in VIDEO_EXTENSIONS;

export const videoExtension = (file) => VIDEO_EXTENSIONS[file.type];

export const isVideoMedia = (item) => item?.media_type === "video";

/**
 * משך הסרטון בשניות, דרך אלמנט video שלא מוצג.
 * נדחה כשאי אפשר לקרוא אותו: בלי משך ידוע אין דרך לאכוף את מגבלת הזמן.
 */
export const readVideoDuration = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let timer = null;

    const finish = (settle, value) => {
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      settle(value);
    };

    timer = setTimeout(
      () => finish(reject, new Error("video metadata timeout")),
      METADATA_TIMEOUT_MS,
    );
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      // סרטון מ-MediaRecorder יכול לדווח על משך Infinity.
      if (Number.isFinite(video.duration)) finish(resolve, video.duration);
      else finish(reject, new Error("video duration unknown"));
    };
    video.onerror = () => finish(reject, new Error("video unreadable"));
    video.src = url;
  });
