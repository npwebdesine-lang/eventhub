import {
  useState,
  useCallback,
  createContext,
  useContext,
  useRef,
} from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, X } from "lucide-react";

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
};

const COLORS = {
  success: "bg-emerald-500",
  error: "bg-rose-500",
  warning: "bg-amber-500",
};

/**
 * Wrap your app (or page) with <ToastProvider> then call useToast() anywhere inside.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast('ההעלאה הצליחה!', 'success');
 *   showToast('קרתה שגיאה', 'error');
 *   showToast('שים לב', 'warning');
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const showToast = useCallback((message, type = "error", duration = 4000) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);

    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete timers.current[id];
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container — fixed top of screen, RTL-aware */}
      <div
        className="fixed top-4 inset-x-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        dir="rtl"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type] || AlertCircle;
          const bg = COLORS[toast.type] || COLORS.error;
          return (
            <div
              key={toast.id}
              className={`${bg} text-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3 pointer-events-auto animate-in slide-in-from-top-2 fade-in duration-300 max-w-sm mx-auto w-full`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="flex-1 text-sm font-bold leading-tight">
                {toast.message}
              </span>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 hover:opacity-70 transition-opacity p-0.5"
                aria-label="סגור"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
};
