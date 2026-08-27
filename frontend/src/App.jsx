import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, Users, Settings as SettingsIcon, LayoutDashboard, PlusCircle } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import TriageWizard from './pages/TriageWizard';
import Queue from './pages/Queue';
import VisitDetail from './pages/VisitDetail';
import Settings from './pages/Settings';
import SurgeSim from './pages/SurgeSim';

function Sidebar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Activity size={24} />
        <span>PatientTriage.ai</span>
      </div>
      <div className="nav-links">
        <Link to="/" className={`nav-link ${isActive('/')}`}>
          <LayoutDashboard size={20} /> Dashboard
        </Link>
        <Link to="/triage" className={`nav-link ${isActive('/triage')}`}>
          <PlusCircle size={20} /> New Triage
        </Link>
        <Link to="/queue" className={`nav-link ${isActive('/queue')}`}>
          <Users size={20} /> Live Queue
        </Link>
        <Link to="/surge" className={`nav-link ${isActive('/surge')}`}>
          <Activity size={20} /> Surge Sim
        </Link>
        <Link to="/settings" className={`nav-link ${isActive('/settings')}`}>
          <SettingsIcon size={20} /> Settings
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/triage" element={<TriageWizard />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/visit/:id" element={<VisitDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/surge" element={<SurgeSim />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
