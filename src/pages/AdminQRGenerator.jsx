// AdminQRGenerator.jsx - דף ליצירת QR Code מותאם אישית לאירועים

import React, { useState, useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";
import { Capacitor } from "@capacitor/core";
import { DEFAULT_PRIMARY } from "../lib/clay";
import {
  POSTER_SIZES,
  posterQrColor,
  printQrPoster,
} from "../lib/qrPoster";
import {
  DownloadCloud,
  Image as ImageIcon,
  Link,
  Loader2,
  Palette,
  Printer,
  Upload,
  X,
} from "lucide-react";

const QR_IMAGE_OPTIONS = {
  crossOrigin: "anonymous",
  margin: 10,
  imageSize: 0.4,
};

// קוד לייצוא (הדפסה או הורדה), נפרד מהתצוגה המקדימה הקטנה.
const createExportQr = ({ type, margin, data, image, color }) => {
  const exportColor = posterQrColor(color);
  return new QRCodeStyling({
    type,
    width: 1000,
    height: 1000,
    margin,
    data,
    image,
    dotsOptions: { type: "dots", color: exportColor },
    cornersSquareOptions: { type: "extra-rounded", color: exportColor },
    // מרכז מלא: ברירת המחדל יורשת "dots" ומפרקת אותו לנקודות, וסורקים
    // מתקשים לזהות את ריבועי הפינה בקוד מודפס.
    cornersDotOptions: { type: "dot", color: exportColor },
    imageOptions: QR_IMAGE_OPTIONS,
  });
};

const blobToDataUri = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const AdminQRGenerator = ({
  defaultUrl = "https://example.com",
  defaultColor = DEFAULT_PRIMARY,
  eventName = "",
  backgroundColor = "",
}) => {
  const [url, setUrl] = useState(defaultUrl);
  const [imageUrl, setImageUrl] = useState("");
  const [dotsColor, setDotsColor] = useState(defaultColor);
  const [posterSize, setPosterSize] = useState("A4");
  const [isPreparingPoster, setIsPreparingPoster] = useState(false);
  const [posterError, setPosterError] = useState("");

  // WebView של אנדרואיד מתעלם מ-window.print, והכפתור היה פשוט לא עושה כלום.
  const canPrint = !Capacitor.isNativePlatform();

  const qrRef = useRef(null);
  const qrCodeInstance = useRef(null);

  // אין effect שמסנכרן את ה-props ל-state: Admin מרנדר את הרכיב עם
  // key={selectedEvent.id}, ולכן מעבר אירוע מרכיב אותו מחדש עם ה-defaults
  // החדשים. ה-effect הקודם רק הוסיף רינדור כפול (setState בתוך effect).

  // יצירה חד-פעמית עם האפשרויות הקבועות בלבד; הנתונים והצבעים מוחלים
  // ב-effect הבא, שרץ מיד אחרי זה גם ב-mount.
  useEffect(() => {
    qrCodeInstance.current = new QRCodeStyling({
      width: 260,
      height: 260,
      dotsOptions: { type: "dots" },
      cornersSquareOptions: { type: "extra-rounded" },
      imageOptions: QR_IMAGE_OPTIONS,
    });

    if (qrRef.current) {
      qrRef.current.innerHTML = "";
      qrCodeInstance.current.append(qrRef.current);
    }
  }, []);

  useEffect(() => {
    if (qrCodeInstance.current) {
      qrCodeInstance.current.update({
        data: url,
        image: imageUrl,
        dotsOptions: { color: dotsColor },
        cornersSquareOptions: { color: dotsColor },
      });
    }
  }, [url, imageUrl, dotsColor]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      setImageUrl(localUrl);
    }
  };

  const handleDownload = async () => {
    setPosterError("");
    try {
      // שוליים לבנים בתוך התמונה: בעיצוב צבעוני (Canva) בלעדיהם אין לסורק
      // אזור שקט סביב הקוד.
      await createExportQr({
        type: "canvas",
        margin: 40,
        data: url.trim(),
        image: imageUrl,
        color: dotsColor,
      }).download({ name: "event-qr-code", extension: "png" });
    } catch (error) {
      console.error("Failed to download QR image", error);
      setPosterError("הורדת הקוד נכשלה. בדקו את הקישור ונסו שוב.");
    }
  };

  const handlePrintPoster = async () => {
    setPosterError("");
    setIsPreparingPoster(true);
    try {
      // SVG להדפסה: וקטור נשאר חד בכל גודל.
      const svgQr = createExportQr({
        type: "svg",
        margin: 0,
        data: url.trim(),
        image: imageUrl,
        color: dotsColor,
      });
      await printQrPoster({
        qrDataUri: await blobToDataUri(await svgQr.getRawData("svg")),
        eventName,
        color: defaultColor,
        background: backgroundColor,
        size: posterSize,
      });
    } catch (error) {
      console.error("Failed to create QR poster", error);
      setPosterError("יצירת הפוסטר נכשלה. בדקו את הקישור ונסו שוב.");
    } finally {
      setIsPreparingPoster(false);
    }
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="bg-clay-surface p-6 rounded-clay shadow-clay space-y-6">
        <div>
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
            <Link size={16} className="text-clay-muted" /> קישור הברקוד (URL)
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full p-4 rounded-clay-field outline-none font-bold text-slate-700 bg-clay-well shadow-clay-inset focus:shadow-clay-inset-deep transition-all text-left text-sm"
            dir="ltr"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
              <Palette size={16} className="text-clay-muted" /> צבע הברקוד
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-clay-sm shrink-0 transition-colors">
                <input
                  type="color"
                  value={dotsColor}
                  onChange={(e) => setDotsColor(e.target.value)}
                  className="absolute -inset-2 w-16 h-16 cursor-pointer"
                />
              </div>
              <span
                className="text-xs font-mono bg-clay-well text-clay-muted font-bold px-3 py-1.5 rounded-full shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] uppercase"
                dir="ltr"
              >
                {dotsColor}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
              <ImageIcon size={16} className="text-clay-muted" /> לוגו במרכז
              הברקוד
            </label>
            {imageUrl ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white flex items-center justify-center p-1 shadow-clay-sm shrink-0">
                  <img
                    src={imageUrl}
                    className="max-w-full max-h-full object-contain"
                    alt="Logo preview"
                  />
                </div>
                <button
                  onClick={() => setImageUrl("")}
                  className="text-xs bg-rose-50 text-rose-700 px-3 min-h-11 rounded-xl font-bold hover:bg-rose-100 transition-colors flex items-center gap-1"
                >
                  <X size={14} /> הסר תמונה
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 w-full h-12 bg-clay-well text-clay-muted font-bold rounded-full cursor-pointer transition-all shadow-clay-inset">
                <Upload size={18} /> בחר תמונה
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center p-8 bg-clay-well-deep rounded-clay-lg shadow-clay-inset-deep relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_2px,transparent_2px)] [background-size:16px_16px]"></div>
        <div
          ref={qrRef}
          className="relative z-10 rounded-3xl overflow-hidden bg-white p-4 shadow-[8px_8px_20px_rgba(0,0,0,0.14)] transform hover:scale-105 transition-transform duration-500"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-bold text-slate-700 mb-3">
          גודל הפוסטר
        </legend>
        <div className="grid grid-cols-2 gap-1 p-1 bg-clay-well rounded-full shadow-clay-inset">
          {Object.keys(POSTER_SIZES).map((size) => (
            <label
              key={size}
              className="min-h-11 flex items-center justify-center rounded-full font-black text-clay-muted cursor-pointer transition-all has-[:checked]:bg-clay-surface has-[:checked]:text-slate-800 has-[:checked]:shadow-clay-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-clay-ink/40"
              dir="ltr"
            >
              <input
                type="radio"
                name="poster-size"
                value={size}
                checked={posterSize === size}
                onChange={() => setPosterSize(size)}
                className="sr-only"
              />
              {size}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <div className="flex items-stretch gap-2">
          <button
            onClick={handlePrintPoster}
            disabled={!canPrint || isPreparingPoster || !url.trim()}
            className="flex-1 min-w-0 text-white font-black py-4 rounded-full flex justify-center items-center gap-2 transition-all active:scale-95 bg-clay-ink hover:bg-clay-ink-hover shadow-clay-btn disabled:opacity-50 disabled:active:scale-100"
          >
            {isPreparingPoster ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <Printer size={22} />
            )}
            הפק פוסטר
          </button>
          <button
            onClick={handleDownload}
            disabled={!url.trim()}
            className="shrink-0 px-4 min-h-11 rounded-full text-sm font-bold text-slate-700 flex justify-center items-center gap-1.5 bg-clay-surface shadow-clay-md active:shadow-clay-pressed transition-all disabled:opacity-50"
          >
            <DownloadCloud size={16} /> הורד קוד QR נקי
          </button>
        </div>
        {!canPrint && (
          <p className="text-sm font-bold text-clay-muted text-center">
            הדפסת הפוסטר זמינה בדפדפן בלבד. פתחו את פאנל הניהול במחשב.
          </p>
        )}
        {posterError && (
          <p role="alert" className="text-sm font-bold text-rose-700 text-center">
            {posterError}
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminQRGenerator;
