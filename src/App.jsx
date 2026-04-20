import React, { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import ErrorBoundary from "./components/ErrorBoundary";
import OfflineBanner from "./components/OfflineBanner";
import { ToastProvider } from "./components/Toast";
import { Loader2 } from "lucide-react"; // ייבוא האייקון המסתובב שלנו במקום הקובץ החסר

// ייבוא קבצים באופן עצל (lazy loading)
const ScanQR = React.lazy(() => import("./pages/ScanQR"));
const Invite = React.lazy(() => import("./pages/Invite"));
const Home = React.lazy(() => import("./pages/Home"));
const Admin = React.lazy(() => import("./pages/Admin"));
const Album = React.lazy(() => import("./pages/Album"));
const Privacy = React.lazy(() => import("./pages/Privacy"));
const Terms = React.lazy(() => import("./pages/Terms"));

// ייבוא המודולים באופן עצל
const Photos = React.lazy(() => import("./modules/Photos"));
const Rideshare = React.lazy(() => import("./modules/Rideshare"));
const Dating = React.lazy(() => import("./modules/Dating"));
const Icebreaker = React.lazy(() => import("./modules/Icebreaker"));
const BlessingModule = React.lazy(() => import("./modules/BlessingModule"));

// קומפוננטת טעינה גלובלית שתוצג בזמן שהעמודים נטענים
const GlobalLoader = () => (
  <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
    <Loader2 className="animate-spin text-white mb-4" size={48} />
  </div>
);

function App() {
  return (
    <ToastProvider>
      <Router>
        <Analytics />
        {/* Suspense עוטף את כל הראוטים ומציג את ה-Loader שלנו בזמן הטעינה */}
        <Suspense fallback={<GlobalLoader />}>
          <Routes>
            {/* אפליקציית קצה - אורחים */}
            <Route
              path="/"
              element={
                <ErrorBoundary>
                  <ScanQR />
                </ErrorBoundary>
              }
            />
            <Route
              path="/invite/:id"
              element={
                <ErrorBoundary>
                  <Invite />
                </ErrorBoundary>
              }
            />
            <Route
              path="/event/:id"
              element={
                <ErrorBoundary>
                  <Home />
                </ErrorBoundary>
              }
            />
            <Route
              path="/album/:id"
              element={
                <ErrorBoundary>
                  <Album />
                </ErrorBoundary>
              }
            />
            <Route
              path="/privacy"
              element={
                <ErrorBoundary>
                  <Privacy />
                </ErrorBoundary>
              }
            />
            <Route
              path="/terms"
              element={
                <ErrorBoundary>
                  <Terms />
                </ErrorBoundary>
              }
            />

            {/* מודולים */}
            <Route
              path="/photos"
              element={
                <ErrorBoundary>
                  <Photos />
                </ErrorBoundary>
              }
            />
            <Route
              path="/rideshare"
              element={
                <ErrorBoundary>
                  <Rideshare />
                </ErrorBoundary>
              }
            />
            <Route
              path="/dating"
              element={
                <ErrorBoundary>
                  <Dating />
                </ErrorBoundary>
              }
            />
            <Route
              path="/icebreaker"
              element={
                <ErrorBoundary>
                  <Icebreaker />
                </ErrorBoundary>
              }
            />
            <Route
              path="/blessing"
              element={
                <ErrorBoundary>
                  <BlessingModule />
                </ErrorBoundary>
              }
            />

            {/* מערכת מנהל */}
            <Route
              path="/admin"
              element={
                <ErrorBoundary>
                  <Admin />
                </ErrorBoundary>
              }
            />
          </Routes>
        </Suspense>

        {/* באנר גלובלי לאין-חיבור */}
        <OfflineBanner />
      </Router>
    </ToastProvider>
  );
}

export default App;
