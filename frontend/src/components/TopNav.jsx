import React from 'react';
import { Bell, ChevronDown, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TopNav({
  title, subtitle, alertsCount = 3, hospitalType = 'URBAN',
  surgeMode = false, hospitalName = null,
}) {
  const navigate = useNavigate();

  return (
    <header className="top-header">
      <div className="header-title-area">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2>{title}</h2>
          {surgeMode && (
            <span className="surge-badge is-on" style={{ background: '#dc2626', color: '#ffffff' }}>
              <Radio size={11} /> 3× SURGE
            </span>
          )}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="header-actions">
        {/* Department / Wing selector matching screenshot */}
        <div className="dept-selector" title={hospitalName ? `Active profile: ${hospitalName}` : 'Department selector'}>
          <span>{hospitalType === 'RURAL' ? 'Rural Access Unit' : 'ED North Wing'}</span>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </div>

        {/* Notification Icon with Badge */}
        <button
          className="icon-button"
          onClick={() => navigate('/alerts')}
          title="View Alerts & Notifications"
        >
          <Bell size={18} />
          {alertsCount > 0 && <span className="icon-badge">{alertsCount}</span>}
        </button>

        {/* Profile Badge */}
        <div className="profile-avatar" style={{ width: '38px', height: '38px', cursor: 'pointer' }} onClick={() => navigate('/settings')}>
          JS
        </div>
      </div>
    </header>
  );
}
