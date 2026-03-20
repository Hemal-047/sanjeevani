import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Nav from './components/Nav';
import Entry from './pages/Entry';
import Upload from './pages/Upload';
import Analysis from './pages/Analysis';
import Attestation from './pages/Attestation';
import Research from './pages/Research';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-fade">
      <Routes location={location}>
        <Route path="/" element={<Entry />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/analyze" element={<Analysis />} />
        <Route path="/attest" element={<Attestation />} />
        <Route path="/research" element={<Research />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Nav />
        <AnimatedRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
