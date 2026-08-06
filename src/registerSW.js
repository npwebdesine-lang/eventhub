// registerSW.js - רישום ה-Service Worker
// הועבר לכאן מתוך תגית script בתוך index.html כדי שה-CSP
// יוכל להישאר עם script-src 'self' ללא 'unsafe-inline'.

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(
      (registration) => {
        console.log(
          "ServiceWorker registration successful with scope: ",
          registration.scope,
        );
      },
      (err) => {
        console.log("ServiceWorker registration failed: ", err);
      },
    );
  });
}
