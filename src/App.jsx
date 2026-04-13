import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import OfflineBanner from "./components/OfflineBanner";
import { ToastProvider } from "./components/Toast";

// ייבוא הקבצים שלנו
import ScanQR from "./pages/ScanQR";
import Invite from "./pages/Invite";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import Album from "./pages/Album";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

// ייבוא המודולים
import Photos from "./modules/Photos";
import Rideshare from "./modules/Rideshare";
import Dating from "./modules/Dating";
import Icebreaker from "./modules/Icebreaker";
import Blessing from "./modules/blessing";

function App() {
  return (
    <ToastProvider>
      <Router>
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
                <Blessing />
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

        {/* באנר גלובלי לאין-חיבור */}
        <OfflineBanner />
      </Router>
    </ToastProvider>
  );
}

export default App;
