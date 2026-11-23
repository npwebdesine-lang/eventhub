// תצוגת קוד QR חד (ראו lib/qrImage.js). הקומפוננטה נטענת בעצלות בהזמנה,
// כדי שהספרייה תירד רק כשמישהו באמת פותח QR.
import { useEffect, useRef } from "react";
import { createQr } from "../lib/qrImage";

const QrCodeView = ({ data, size = 220, label, className = "" }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !data) return undefined;
    el.replaceChildren();
    createQr(data, size, 12).append(el);
    return () => el.replaceChildren();
  }, [data, size]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={`inline-flex rounded-2xl bg-white p-2 shadow-clay-inset [&_canvas]:block [&_canvas]:max-w-full [&_canvas]:h-auto ${className}`}
    />
  );
};

export default QrCodeView;
