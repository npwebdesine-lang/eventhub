import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Shared modal behavior for overlays that keep their own custom markup
 * (e.g. full-screen lightboxes, the multi-step RSVP sheet, Admin dialogs).
 *
 * Handles: Escape-to-close, body scroll-locking while open, and optional
 * ArrowRight/ArrowLeft navigation. Call it once per open overlay.
 */
export function useModalBehavior({
  open = true,
  onClose,
  onArrowRight,
  onArrowLeft,
} = {}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowRight") onArrowRight?.();
      else if (e.key === "ArrowLeft") onArrowLeft?.();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, onArrowRight, onArrowLeft]);
}

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-4xl",
};

/**
 * Standard centered / bottom-sheet modal.
 *
 * Provides backdrop-click-to-close, Escape, body scroll-lock, a labelled
 * role="dialog", a capped height with an internal scroll area, iOS safe-area
 * bottom padding, and a consistent z-index (100; lightboxes use 200, toasts
 * 9999). Pass `variant="sheet"` for a mobile bottom-sheet that centers on
 * larger screens.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  variant = "center",
  hideClose = false,
  className = "",
}) {
  const panelRef = useRef(null);
  useModalBehavior({ open, onClose });

  useEffect(() => {
    if (open && panelRef.current) panelRef.current.focus();
  }, [open]);

  if (!open) return null;

  const alignment =
    variant === "sheet" ? "items-end sm:items-center" : "items-center";
  const radius =
    variant === "sheet"
      ? "rounded-t-[2rem] sm:rounded-[2rem]"
      : "rounded-[2rem]";

  return (
    <div
      className={`fixed inset-0 z-[100] flex justify-center ${alignment} bg-[rgba(74,82,89,0.35)] sm:p-4`}
      onClick={onClose}
      dir="rtl"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${SIZES[size] || SIZES.md} bg-[#e8e4da] shadow-[0_-14px_40px_rgba(0,0,0,0.16),0_14px_40px_rgba(0,0,0,0.12)] flex flex-col max-h-[90vh] overflow-hidden outline-none ${radius} ${className}`}
      >
        {(title || !hideClose) && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#dcd7ca] shrink-0">
            <h2 className="text-lg font-black text-slate-700 truncate">
              {title}
            </h2>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="סגור"
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-[#e0dccf] transition active:scale-95 shrink-0"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-[#dcd7ca] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
