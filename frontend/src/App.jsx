
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, Users, Settings as SettingsIcon, LayoutDashboard, PlusCircle, ShieldAlert } from 'lucide-react';
import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import TriageWizard from './pages/TriageWizard';
import Queue from './pages/Queue';

function Sidebar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <ShieldAlert size={28} color="#3b82f6" />
        <div>
          <div>PatientTriage.ai</div>
          <div style={{fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400}}>ED North Wing</div>
        </div>
      </div>
      <div className="nav-links">
        <Link to="/" className={`nav-link ${isActive('/')}`}>
          <LayoutDashboard size={20} /> Dashboard
        </Link>
        <Link to="/triage" className={`nav-link ${isActive('/triage')}`}>
          <PlusCircle size={20} /> Patient Intake
        </Link>
        <Link to="/queue" className={`nav-link ${isActive('/queue')}`}>
          <Users size={20} /> Live Queue
        </Link>
        
        {/* Placeholder disabled links for MVP */}
        <div style={{opacity: 0.5, cursor: 'not-allowed', padding: '1rem 1.5rem', color: 'var(--text-sidebar)', display: 'flex', gap: '0.75rem', alignItems: 'center', fontWeight: 500}}>
          <Activity size={20} /> Surge Sim (Disabled)
        </div>
        <div style={{opacity: 0.5, cursor: 'not-allowed', padding: '1rem 1.5rem', color: 'var(--text-sidebar)', display: 'flex', gap: '0.75rem', alignItems: 'center', fontWeight: 500}}>
          <SettingsIcon size={20} /> Settings (Disabled)
        </div>
      </div>
    </div>
  );
}

function TopBar() {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="top-bar">
      <div style={{fontWeight: 600, color: 'var(--text-muted)'}}>{new Date().toLocaleDateString()}</div>
      <div style={{display: 'flex', gap: '2rem', alignItems: 'center'}}>
        <div style={{fontWeight: 700, fontSize: '1.25rem'}}>{time}</div>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
          <div style={{width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>RN</div>
          <div>
            <div style={{fontWeight: 600, fontSize: '0.9rem'}}>Jane Smith, RN</div>
            <div style={{color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600}}>● Online</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-wrapper">
          <TopBar />
          <div className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/triage" element={<TriageWizard />} />
              <Route path="/queue" element={<Queue />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
