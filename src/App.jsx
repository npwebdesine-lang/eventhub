import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// ייבוא הקבצים שלנו
import ScanQR from './pages/ScanQR';
import Invite from './pages/Invite';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Album from './pages/Album';

// ייבוא המודולים
import Photos from './modules/Photos';
import Rideshare from './modules/Rideshare';
import Dating from './modules/Dating';
import Icebreaker from './modules/Icebreaker';

function App() {
  return (
    <Router>
      <Routes>
        {/* אפליקציית קצה - אורחים */}
        <Route path="/" element={<ScanQR />} />  {/* <--- המסך הראשי עכשיו הוא הסורק */}
        <Route path="/invite/:id" element={<Invite />} />
        <Route path="/event/:id" element={<Home />} />
        <Route path="/album/:id" element={<Album />} />
        
        {/* מודולים */}
        <Route path="/photos" element={<Photos />} />
        <Route path="/rideshare" element={<Rideshare />} />
        <Route path="/dating" element={<Dating />} />
        <Route path="/icebreaker" element={<Icebreaker />} />

        {/* מערכת מנהל (Event Manager) - בעתיד נוציא את זה לאפליקציה נפרדת */}
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;