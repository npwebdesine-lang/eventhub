// קודי QR פשוטים וחדים: שחור על לבן, מודולים מרובעים ושוליים לבנים.
// נועדו לסריקה מהירה מהטלפון או מדף מודפס על השולחן, לא לעיצוב.
import QRCodeStyling from "qr-code-styling";

export const createQr = (data, size, margin) =>
  new QRCodeStyling({
    type: "canvas",
    width: size,
    height: size,
    margin,
    data,
    qrOptions: { errorCorrectionLevel: "M" },
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { type: "square", color: "#000000" },
    cornersSquareOptions: { type: "square", color: "#000000" },
    cornersDotOptions: { type: "square", color: "#000000" },
  });

// PNG בגודל הדפסה (1000px) עם אזור שקט רחב סביב הקוד.
export const downloadQrPng = (data, name) =>
  createQr(data, 1000, 48).download({ name, extension: "png" });
