import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Photos from './modules/Photos';
import Dating from './modules/Dating';
import Admin from './pages/Admin';
import Album from './pages/Album'; 

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Admin />} />
        <Route path="/event/:id" element={<Home />} />
        <Route path="/photos" element={<Photos />} />
        <Route path="/dating" element={<Dating />} />
        <Route path="/album/:id" element={<Album />} /> 
      </Routes>
    </Router>
  );
}

export default App;