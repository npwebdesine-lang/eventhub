import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * Shows a fixed banner at the bottom of the screen when the user loses internet connection.
 * Auto-dismisses 2 seconds after connection is restored.
 *
 * Usage: <OfflineBanner /> inside App.jsx (outside <Routes>)
 */
const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 2500);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  return (
    <div
      className="fixed bottom-6 inset-x-4 z-[9998] flex justify-center pointer-events-none"
      dir="rtl"
    >
      <div
        className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-bold transition-all duration-500 ${
          isOnline
            ? "bg-emerald-500 animate-in fade-in"
            : "bg-slate-800 animate-in slide-in-from-bottom-4"
        }`}
      >
        {isOnline ? (
          <>
            <Wifi size={16} />
            <span>החיבור חזר</span>
          </>
        ) : (
          <>
            <WifiOff size={16} />
            <span>אין חיבור לאינטרנט</span>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
