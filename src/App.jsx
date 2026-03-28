import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Photos from './modules/Photos';
import Dating from './modules/Dating';
import Icebreaker from './modules/Icebreaker';
import Admin from './pages/Admin';
import Rideshare from './modules/Rideshare';
import Album from './pages/Album'; 
import Invite from './pages/Invite'; // <--- הוספנו את זה

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Admin />} />
        <Route path="/event/:id" element={<Home />} />
        <Route path="/photos" element={<Photos />} />
        <Route path="/dating" element={<Dating />} />
        <Route path="/icebreaker" element={<Icebreaker />} />
        <Route path="/rideshare" element={<Rideshare />} />
        <Route path="/album/:id" element={<Album />} /> 
        <Route path="/invite/:id" element={<Invite />} /> {/* <--- והוספנו את זה */}
      </Routes>
    </Router>
  );
}

export default App;