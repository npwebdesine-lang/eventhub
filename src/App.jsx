import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Photos from './modules/Photos';
import Dating from './modules/Dating';
import Admin from './pages/Admin';
import Album from './pages/Album'; // <-- וודא שהשורה הזו קיימת!

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/photos" element={<Photos />} />
        <Route path="/dating" element={<Dating />} />
        <Route path="/admin" element={<Admin />} />
        
        {/* הכתובת שהייתה חסרה לנו */}
        <Route path="/album/:id" element={<Album />} /> 
      </Routes>
    </Router>
  );
}

export default App;