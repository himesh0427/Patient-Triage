import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { systemApi, triageApi, alertsApi } from './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
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

function MainAppLayout() {
  const location = useLocation();
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [surgeMode, setSurgeMode] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);

  const isLoginPage = location.pathname === '/login';

  const fetchGlobalMetrics = async () => {
    // Only fetch clinical queue metrics if user is authenticated
    if (!user) return;
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
    if (user) {
      fetchGlobalMetrics();
      const interval = setInterval(fetchGlobalMetrics, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const alertsCountDerived = alertsCount || (stats?.retriage_needed || 0) + (stats?.low_confidence_active || 0) + (surgeMode ? 1 : 0);

  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      {/* Modern Dark Sidebar matching screenshot */}
      <Sidebar queueCount={queueCount} alertsCount={alertsCountDerived} surgeMode={surgeMode} />
      <div className="main-wrapper">
        <Routes>
          {/* Public Login Route fallback */}
          <Route path="/login" element={<LoginPage />} />

          {/* All Clinical Roles: Nurse and Admin */}
          <Route
            path="/"
            element={
              <ProtectedRoute requiredRoles={['nurse', 'admin']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/queue"
            element={
              <ProtectedRoute requiredRoles={['nurse', 'admin']}>
                <TriageQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/intake"
            element={
              <ProtectedRoute requiredRoles={['nurse', 'admin']}>
                <PatientIntake />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients"
            element={
              <ProtectedRoute requiredRoles={['nurse', 'admin']}>
                <PatientsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visit/:id"
            element={
              <ProtectedRoute requiredRoles={['nurse', 'admin']}>
                <PatientDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute requiredRoles={['nurse', 'admin']}>
                <Alerts />
              </ProtectedRoute>
            }
          />

          {/* Operational Reports: Nurse & Clinical Administrator */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredRoles={['nurse', 'admin']}>
                <Reports />
              </ProtectedRoute>
            }
          />

          {/* Clinical Administrator Only */}
          <Route
            path="/audit"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AuditLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hospital-config"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <HospitalConfig />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <MainAppLayout />
      </AuthProvider>
    </Router>
  );
}
