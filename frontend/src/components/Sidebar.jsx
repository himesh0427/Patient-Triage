import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCheck, FilePlus, Bell,
  BarChart2, FileText, Settings, HeartPulse, Building2, Radio
} from 'lucide-react';

export default function Sidebar({ queueCount = 0, alertsCount = 3, surgeMode = false }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/queue', label: 'Triage Queue', icon: Users, badge: queueCount },
    { path: '/patients', label: 'Patients', icon: UserCheck },
    { path: '/intake', label: 'Intake', icon: FilePlus },
    { path: '/alerts', label: 'Alerts', icon: Bell, badge: alertsCount, isAlert: true },
    { path: '/reports', label: 'Reports', icon: BarChart2 },
    { path: '/audit', label: 'Audit Log', icon: FileText },
    { path: '/hospital-config', label: 'Hospital Config', icon: Building2 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

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
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${active ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`sidebar-badge ${item.isAlert ? 'alert' : ''}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-profile">
        <div className="profile-avatar">JS</div>
        <div className="profile-info">
          <div className="profile-name">Jane Smith, RN</div>
          <div className="profile-status">
            <span className="online-dot" />
            <span>Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
