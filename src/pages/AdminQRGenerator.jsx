// AdminQRGenerator.jsx - דף ליצירת QR Code מותאם אישית לאירועים

import React, { useState, useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";
import {
  DownloadCloud,
  Image as ImageIcon,
  Link,
  Palette,
  Upload,
  X,
} from "lucide-react";

const AdminQRGenerator = ({
  defaultUrl = "https://example.com",
  defaultColor = "#3b82f6",
}) => {
  const [url, setUrl] = useState(defaultUrl);
  const [imageUrl, setImageUrl] = useState("");
  const [dotsColor, setDotsColor] = useState(defaultColor);

  const qrRef = useRef(null);
  const qrCodeInstance = useRef(null);

  // סנכרון המידע כשמחליפים אירוע בלוח הבקרה
  useEffect(() => {
    setUrl(defaultUrl);
    setDotsColor(defaultColor);
  }, [defaultUrl, defaultColor]);

  useEffect(() => {
    qrCodeInstance.current = new QRCodeStyling({
      width: 260,
      height: 260,
      data: url,
      image: imageUrl,
      dotsOptions: {
        color: dotsColor,
        type: "dots",
      },
      cornersSquareOptions: {
        type: "extra-rounded",
        color: dotsColor,
      },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 10,
        imageSize: 0.4,
      },
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

  const handleDownload = () => {
    if (qrCodeInstance.current) {
      qrCodeInstance.current.download({
        name: "event-qr-code",
        extension: "png",
      });
    }
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="bg-[#f0eee7] p-6 rounded-[2.25rem] shadow-[8px_8px_20px_rgba(0,0,0,0.09),-8px_-8px_20px_rgba(255,255,255,0.9)] space-y-6">
        <div>
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
            <Link size={16} className="text-[#8296ab]" /> קישור הברקוד (URL)
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full p-4 rounded-[1.4rem] outline-none font-bold text-slate-700 bg-[#eeece5] shadow-[inset_4px_4px_9px_rgba(0,0,0,0.07),inset_-4px_-4px_9px_rgba(255,255,255,0.85)] focus:shadow-[inset_5px_5px_11px_rgba(0,0,0,0.09),inset_-5px_-5px_11px_rgba(255,255,255,0.9)] transition-all text-left text-sm"
            dir="ltr"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
              <Palette size={16} className="text-[#8296ab]" /> צבע הברקוד
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-[3px_3px_7px_rgba(0,0,0,0.09),-3px_-3px_7px_rgba(255,255,255,0.9)] shrink-0 transition-colors">
                <input
                  type="color"
                  value={dotsColor}
                  onChange={(e) => setDotsColor(e.target.value)}
                  className="absolute -inset-2 w-16 h-16 cursor-pointer"
                />
              </div>
              <span
                className="text-xs font-mono bg-[#eeece5] text-slate-500 font-bold px-3 py-1.5 rounded-full shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] uppercase"
                dir="ltr"
              >
                {dotsColor}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
              <ImageIcon size={16} className="text-[#8296ab]" /> לוגו במרכז
              הברקוד
            </label>
            {imageUrl ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white flex items-center justify-center p-1 shadow-[3px_3px_7px_rgba(0,0,0,0.09),-3px_-3px_7px_rgba(255,255,255,0.9)] shrink-0">
                  <img
                    src={imageUrl}
                    className="max-w-full max-h-full object-contain"
                    alt="Logo preview"
                  />
                </div>
                <button
                  onClick={() => setImageUrl("")}
                  className="text-xs bg-rose-50 text-rose-600 px-3 py-2 rounded-xl font-bold hover:bg-rose-100 transition-colors flex items-center gap-1"
                >
                  <X size={14} /> הסר תמונה
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 w-full h-12 bg-[#eeece5] text-[#8296ab] font-bold rounded-full cursor-pointer transition-all shadow-[inset_3px_3px_7px_rgba(0,0,0,0.07),inset_-3px_-3px_7px_rgba(255,255,255,0.85)]">
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

      <div className="flex justify-center p-8 bg-[#e4e0d5] rounded-[2.5rem] shadow-[inset_5px_5px_10px_rgba(0,0,0,0.08),inset_-5px_-5px_10px_rgba(255,255,255,0.8)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_2px,transparent_2px)] [background-size:16px_16px]"></div>
        <div
          ref={qrRef}
          className="relative z-10 rounded-3xl overflow-hidden bg-white p-4 shadow-[8px_8px_20px_rgba(0,0,0,0.14)] transform hover:scale-105 transition-transform duration-500"
        />
      </div>

      <button
        onClick={handleDownload}
        className="w-full text-white font-black py-4 rounded-full flex justify-center items-center gap-2 transition-all active:scale-95 bg-[#8296ab] hover:bg-[#7389a0] shadow-[5px_5px_14px_rgba(0,0,0,0.14),-4px_-4px_12px_rgba(255,255,255,0.7),inset_2px_2px_4px_rgba(255,255,255,0.3),inset_-2px_-2px_4px_rgba(0,0,0,0.12)]"
      >
        <DownloadCloud size={22} /> הורד QR מוכן (PNG)
      </button>
    </div>
  );
};

export default AdminQRGenerator;
