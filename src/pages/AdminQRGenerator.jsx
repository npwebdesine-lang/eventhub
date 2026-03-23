import React, { useState, useEffect, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { DownloadCloud, Image as ImageIcon } from 'lucide-react';

const AdminQRGenerator = ({ defaultUrl = "https://example.com", defaultColor = "#3b82f6" }) => {
  const [url, setUrl] = useState(defaultUrl);
  const [imageUrl, setImageUrl] = useState("");
  const [dotsColor, setDotsColor] = useState(defaultColor);

  const qrRef = useRef(null);
  const qrCodeInstance = useRef(null);

  useEffect(() => {
    qrCodeInstance.current = new QRCodeStyling({
      width: 260,
      height: 260,
      data: url,
      image: imageUrl,
      dotsOptions: {
        color: dotsColor,
        type: "dots"
      },
      cornersSquareOptions: {
        type: "extra-rounded",
        color: dotsColor
      },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 10,
        imageSize: 0.4
      }
    });

    if (qrRef.current) {
      qrRef.current.innerHTML = "";
      qrCodeInstance.current.append(qrRef.current);
    }
  }, []);

  // עדכון בזמן אמת של ה-QR
  useEffect(() => {
    if (qrCodeInstance.current) {
      qrCodeInstance.current.update({
        data: url,
        image: imageUrl,
        dotsOptions: { color: dotsColor },
        cornersSquareOptions: { color: dotsColor }
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
      qrCodeInstance.current.download({ name: "event-qr-code", extension: "png" });
    }
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      
      {/* הגדרות חזותיות */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-1">קישור הברקוד (URL)</label>
          <input 
            type="text" 
            value={url} 
            onChange={(e) => setUrl(e.target.value)} 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-left" 
            dir="ltr"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm font-bold text-slate-700">צבע האלמנטים:</label>
          <input 
            type="color" 
            value={dotsColor} 
            onChange={(e) => setDotsColor(e.target.value)} 
            className="w-10 h-10 rounded-lg cursor-pointer border-2 border-slate-100 p-0" 
          />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-1">
            <ImageIcon size={16} /> תמונה למרכז הברקוד (לוגו/טבעות)
          </label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload} 
            className="w-full text-sm text-slate-500 file:mr-0 file:ml-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-all cursor-pointer"
          />
        </div>
      </div>

      {/* תצוגה מקדימה של ה-QR */}
      <div className="flex justify-center p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
        <div ref={qrRef} className="rounded-2xl overflow-hidden bg-white p-2 shadow-sm" />
      </div>

      <button 
        onClick={handleDownload}
        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl flex justify-center items-center gap-2 transition-all shadow-xl shadow-slate-200"
      >
        <DownloadCloud size={22} /> הורד QR מוכן (PNG)
      </button>
    </div>
  );
};

export default AdminQRGenerator;