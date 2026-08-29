import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { systemApi, triageApi, alertsApi } from './services/api';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import TriageQueue from './pages/TriageQueue';
import PatientIntake from './pages/PatientIntake';
import PatientDetails from './pages/PatientDetails';
import PatientsList from './pages/PatientsList';
import Reports from './pages/Reports';
import Alerts from './pages/Alerts';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';
import HospitalConfig from './pages/HospitalConfig';

export default function App() {
  const [stats, setStats] = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [surgeMode, setSurgeMode] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);

  const fetchGlobalMetrics = async () => {
    try {
      const [statsRes, queueRes, alertsRes] = await Promise.all([
        systemApi.getStats(),
        triageApi.getQueue(),
        alertsApi.getAll(),
      ]);
      setStats(statsRes.data);
      setQueueCount(queueRes.data.queue?.length || 0);
      setSurgeMode(statsRes.data.surge_mode || queueRes.data.surge_mode || false);
      setAlertsCount(alertsRes.data?.total || 0);
    } catch (err) {
      console.error("Global state sync error:", err);
    }
  };

  useEffect(() => {
    fetchGlobalMetrics();
    const interval = setInterval(fetchGlobalMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const alertsCountDerived = alertsCount || (stats?.retriage_needed || 0) + (stats?.low_confidence_active || 0) + (surgeMode ? 1 : 0);

  return (
    <Router>
      <div className="app-layout">
        {/* Modern Dark Sidebar matching screenshot */}
        <Sidebar queueCount={queueCount} alertsCount={alertsCountDerived} surgeMode={surgeMode} />
        <div className="main-wrapper">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/queue" element={<TriageQueue />} />
            <Route path="/intake" element={<PatientIntake />} />
            <Route path="/patients" element={<PatientsList />} />
            <Route path="/visit/:id" element={<PatientDetails />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/audit" element={<AuditLogPage />} />
            <Route path="/hospital-config" element={<HospitalConfig />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
