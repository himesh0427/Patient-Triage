import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCheck, FilePlus, Bell,
  BarChart2, FileText, Settings, HeartPulse, Building2, Radio,
  Lock, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_BADGES = {
  nurse: { label: 'Emergency Nurse', bg: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd' },
  triage_nurse: { label: 'Emergency Nurse', bg: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd' },
  charge_nurse: { label: 'Emergency Nurse', bg: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd' },
  admin: { label: 'Administrator', bg: 'rgba(168, 85, 247, 0.2)', text: '#d8b4fe' },
};

function getInitials(name) {
  if (!name) return 'ST';
  const parts = name.replace(/^(Dr\.|RN|BSN|MD|,)\s*/i, '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Sidebar({ queueCount = 0, alertsCount = 3, surgeMode = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, canAccess } = useAuth();

  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, feature: 'dashboard' },
    { path: '/queue', label: 'Triage Queue', icon: Users, badge: queueCount, feature: 'queue' },
    { path: '/patients', label: 'Patients', icon: UserCheck, feature: 'patients' },
    { path: '/intake', label: 'Intake', icon: FilePlus, feature: 'intake' },
    { path: '/alerts', label: 'Alerts', icon: Bell, badge: alertsCount, isAlert: true, feature: 'alerts' },
    { path: '/reports', label: 'Reports', icon: BarChart2, feature: 'reports' },
    { path: '/audit', label: 'Audit Log', icon: FileText, feature: 'audit_log' },
    { path: '/hospital-config', label: 'Hospital Config', icon: Building2, feature: 'hospital_config' },
    { path: '/settings', label: 'Settings', icon: Settings, feature: 'settings' },
  ];

  const roleStyle = ROLE_BADGES[user?.role] || ROLE_BADGES.triage_nurse;
  const initials = getInitials(user?.full_name);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo-icon">
          <HeartPulse size={20} />
        </div>
        <div className="sidebar-brand-text">
          <h1>PatientTriage.ai</h1>
          <p>Clinical Decision Support</p>
        </div>
      </div>

      {surgeMode && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.25rem 0.75rem 0',
            padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.18)', border: '1px solid rgba(239, 68, 68, 0.45)',
            color: '#fca5a5', fontSize: '0.74rem', fontWeight: 700
          }}
        >
          <Radio size={14} className="pulse-alert" />
          <span>3× SURGE MODE ACTIVE</span>
        </div>
      )}

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const permitted = canAccess(item.feature);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${active ? 'active' : ''}`}
              style={{
                opacity: permitted ? 1 : 0.65,
              }}
              title={permitted ? item.label : `${item.label} (Restricted to authorized roles)`}
            >
              <Icon size={18} />
              <span>{item.label}</span>

              {!permitted && (
                <Lock size={12} style={{ marginLeft: 'auto', color: 'var(--sidebar-text)', opacity: 0.8 }} />
              )}

              {permitted && item.badge !== undefined && item.badge > 0 && (
                <span className={`sidebar-badge ${item.isAlert ? 'alert' : ''}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Active Logged-In User Profile */}
      <div className="sidebar-profile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
          <div className="profile-avatar" style={{ flexShrink: 0, fontSize: '0.78rem' }}>
            {initials}
          </div>
          <div className="profile-info" style={{ minWidth: 0 }}>
            <div className="profile-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
              {user?.full_name || 'Clinical Staff'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '3px',
                  background: roleStyle.bg,
                  color: roleStyle.text,
                  whiteSpace: 'nowrap',
                }}
              >
                {roleStyle.label}
              </span>
              <div className="profile-status" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem' }}>
                <span className="online-dot" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Logout Button */}
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
          title="Sign out of session"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--sidebar-text)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sidebar-text)'; }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
