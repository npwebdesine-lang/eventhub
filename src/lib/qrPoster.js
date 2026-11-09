/**
 * פוסטר "ברוכים הבאים" להדפסה, בסגנון שלט שולחן: מסמך HTML שנטען ב-iframe
 * נסתר ומודפס דרך window.print, כך שרק השלט מודפס והמנהל יכול לשמור PDF.
 */
import { eventBackdrop } from "./clay";
import { CLAY_PAGE_HEX, LIGHT_TEXT, accentOn } from "./colors";

// כל מידות הפוסטר ב-rem (גם ה-utilities של Tailwind), ו-A3 רק מגדיל את ה-rem
// של ה-iframe ביחס של √2 בין הגדלים.
export const POSTER_SIZES = {
  A4: { width: 210, height: 297, rem: 4 },
  A3: { width: 297, height: 420, rem: 5.657 },
};

const SERIF_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500&display=swap";

const POSTER_FONTS = [
  "400 1rem 'Frank Ruhl Libre'",
  "500 1rem 'Frank Ruhl Libre'",
  "600 1rem Assistant",
];

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

// מחרוזות מלאות ולא חישוב, כדי ש-Tailwind ימצא אותן בסריקה.
const nameSizeClass = (name) => {
  if (name.length <= 12) return "text-[6.5rem]";
  if (name.length <= 22) return "text-[5rem]";
  if (name.length <= 40) return "text-[4rem]";
  return "text-[3.2rem]";
};

// ענף עלים לראש השלט: העלים מחושבים לאורך עקומה, והצד השני הוא שיקוף שלה.
const buildSprig = () => {
  const start = [200, 76];
  const control = [292, 82];
  const end = [378, 28];
  const pointAt = (t, axis) =>
    (1 - t) ** 2 * start[axis] +
    2 * (1 - t) * t * control[axis] +
    t ** 2 * end[axis];
  const slopeAt = (t, axis) =>
    2 * (1 - t) * (control[axis] - start[axis]) +
    2 * t * (end[axis] - control[axis]);

  const leaves = [0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86, 1]
    .map((t, index) => {
      const tangent = (Math.atan2(slopeAt(t, 1), slopeAt(t, 0)) * 180) / Math.PI;
      const isTip = t === 1;
      const angle = isTip ? tangent : tangent + (index % 2 ? 42 : -42);
      const x = pointAt(t, 0).toFixed(1);
      const y = pointAt(t, 1).toFixed(1);
      const scale = (1 - t * 0.4).toFixed(2);
      return `<path transform="translate(${x} ${y}) rotate(${angle.toFixed(1)}) scale(${scale})" d="M0 0C8-9 22-9 32 0 22 8 8 8 0 0Z"/>`;
    })
    .join("");
  const branch = `<path d="M${start} Q${control} ${end}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>${leaves}`;

  return `<svg class="w-[17rem] h-auto" viewBox="0 0 400 110" fill="currentColor" aria-hidden="true"><g>${branch}</g><g transform="matrix(-1 0 0 1 400 0)">${branch}</g></svg>`;
};

/**
 * צבע לנקודות הברקוד על הכרטיס הלבן. המנהל יכול לבחור פסטל שנראה טוב במסך
 * אבל סורק לא קורא מודפס, ולכן מכהים אותו עד לניגודיות בטוחה.
 */
export const posterQrColor = (color) => accentOn(color, LIGHT_TEXT);

export const buildPosterHtml = ({
  qrDataUri,
  eventName = "",
  color,
  background,
  size = "A4",
  appStyles = "",
}) => {
  const { width, height, rem } = POSTER_SIZES[size];
  // אותו חישוב כמו רקע האפליקציה: צבע כהה שמור באירועים ישנים (#020617) הופך
  // לגוון בהיר, אחרת הכותרת והמסגרת לא היו נקראות עליו.
  const page = eventBackdrop(background)?.page || CLAY_PAGE_HEX;
  const accent = accentOn(color, page);
  const name = eventName.trim();

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(`פוסטר כניסה ${name}`.trim())}</title>
${appStyles}
<link rel="stylesheet" href="${SERIF_FONT_URL}">
<style>
  @media print {
    @page { size: ${size} portrait; margin: 0; }
  }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { font-size: ${rem}mm; }
  html, body { background: ${page}; }
  /* index.css קובע font-family על * מחוץ ל-layer, וזה גובר על utility של Tailwind. */
  .poster-serif, .poster-serif * { font-family: "Frank Ruhl Libre", serif; }
</style>
</head>
<body>
  <main class="relative overflow-hidden break-inside-avoid bg-(--poster-page) text-(--poster-accent)" style="width:${width}mm;height:${height}mm;--poster-page:${page};--poster-accent:${accent}">
    <div class="absolute inset-[3rem] rounded-t-[16rem] border-[0.1rem] border-current"></div>
    <div class="absolute inset-[3.8rem] rounded-t-[15.2rem] border-[0.04rem] border-current"></div>
    <div class="relative h-full flex flex-col items-center text-center pt-[7rem] pb-[6.5rem] px-[6rem]">
      <div class="flex-1 min-h-0 flex flex-col items-center justify-center">
        ${buildSprig()}
        <h1 class="poster-serif mt-[1.5rem] leading-[1.15] text-balance">
          <span class="block text-[3.2rem] font-normal">ברוכים הבאים לאירוע</span>
          ${name ? `<span class="mt-[0.5rem] line-clamp-3 font-medium ${nameSizeClass(name)}"><bdi>${escapeHtml(name)}</bdi></span>` : ""}
        </h1>
        <p class="mt-[1.5rem] text-[2.1rem] font-semibold text-slate-800 text-balance">לכניסה לאפליקציית האירוע סרקו את הקוד</p>
      </div>
      <div class="flex-none mt-[2rem] w-[31rem] h-[31rem] p-[2rem] bg-white rounded-[1.5rem] border-[0.04rem] border-current">
        <img class="block w-full h-full" src="${qrDataUri}" alt="קוד QR לכניסה לאירוע">
      </div>
    </div>
  </main>
</body>
</html>`;
};

let activeFrame = null;

const printHtml = (html) =>
  new Promise((resolve, reject) => {
    // Safari לא תמיד יורה afterprint בתוך iframe, אז מנקים גם בהדפסה הבאה.
    activeFrame?.remove();

    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    // לא display:none: חלק מהדפדפנים מדפיסים iframe מוסתר כדף ריק.
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0";

    frame.onload = async () => {
      try {
        const printWindow = frame.contentWindow;
        // הפונטים נטענים רק אחרי layout, ואירוע load לא מחכה להם. בלי הורדה
        // מפורשת המשקלים לא מגיעים בזמן. נפילה לפונט מערכת עדיף על ביטול.
        await Promise.all(
          POSTER_FONTS.map((font) =>
            printWindow.document.fonts.load(font, "אa").catch(() => {}),
          ),
        );
        printWindow.addEventListener("afterprint", () => frame.remove(), {
          once: true,
        });
        printWindow.focus();
        printWindow.print();
        resolve();
      } catch (error) {
        reject(error);
      }
    };

    frame.srcdoc = html;
    document.body.appendChild(frame);
    activeFrame = frame;
  });

export const printQrPoster = (poster) => {
  // ה-iframe מקבל את גיליונות האפליקציה כדי שה-utilities של Tailwind יעבדו בו.
  const appStyles = [
    ...document.querySelectorAll('link[rel="stylesheet"], style'),
  ]
    .map((node) => node.outerHTML)
    .join("");
  return printHtml(buildPosterHtml({ ...poster, appStyles }));
};
