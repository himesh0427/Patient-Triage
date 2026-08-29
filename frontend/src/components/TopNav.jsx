import React, { useState, useEffect, useRef } from 'react';
import { Bell, ChevronDown, Radio, Check, Building2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { hospitalConfigApi } from '../services/api';

const FACILITIES = [
  {
    id: 'urban_trauma',
    label: 'ED North Wing',
    fullName: 'Urban Trauma Center',
    badge: 'Level 1 Trauma',
    desc: 'High volume · 5m ESI-2 threshold · Full subspecialties',
    hospitalType: 'URBAN',
  },
  {
    id: 'community',
    label: 'Community Emergency Unit',
    fullName: 'Community Hospital',
    badge: 'General ED',
    desc: 'Standard volume · 10m ESI-2 threshold · Core specialties',
    hospitalType: 'COMMUNITY',
  },
  {
    id: 'rural_ed',
    label: 'Rural Access Unit',
    fullName: 'Rural Emergency Dept',
    badge: 'Critical Access',
    desc: 'Tele-triage · 15m ESI-2 threshold · 3-Tier rural mode',
    hospitalType: 'RURAL',
  },
];

export default function TopNav({
  title,
  subtitle,
  alertsCount = 3,
  hospitalType = 'URBAN',
  surgeMode = false,
  hospitalName = null,
}) {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentProfile, setCurrentProfile] = useState('urban_trauma');
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch active configuration profile on mount
  useEffect(() => {
    let isMounted = true;
    hospitalConfigApi.getConfig()
      .then((res) => {
        if (isMounted && res.data?.profile) {
          setCurrentProfile(res.data.profile);
        }
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const activeFacility = FACILITIES.find((f) => f.id === currentProfile) || (
    hospitalType === 'RURAL' ? FACILITIES[2] : FACILITIES[0]
  );

  const handleSelectFacility = async (facility) => {
    if (facility.id === currentProfile && !switching) {
      setDropdownOpen(false);
      return;
    }

    setSwitching(true);
    try {
      await hospitalConfigApi.applyProfile(facility.id);
      setCurrentProfile(facility.id);
      setDropdownOpen(false);
      // Reload window to immediately sync all queue timers, hospital thresholds & stats
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch hospital facility:', err);
    } finally {
      setSwitching(false);
    }
  };

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
        {/* Interactive Department / Facility Dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <div
            className="dept-selector"
            onClick={() => setDropdownOpen((prev) => !prev)}
            title="Switch Hospital Profile / Department"
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              background: dropdownOpen ? '#eff6ff' : '#f8fafc',
              borderColor: dropdownOpen ? 'var(--primary-blue)' : 'var(--card-border)',
            }}
          >
            <Building2 size={15} style={{ color: 'var(--primary-blue)' }} />
            <span>{hospitalName || activeFacility.label}</span>
            <ChevronDown
              size={14}
              style={{
                color: 'var(--text-muted)',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </div>

          {dropdownOpen && (
            <div
              className="ui-card"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '320px',
                zIndex: 1000,
                padding: '0.6rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                animation: 'fadeIn 0.15s ease',
              }}
            >
              <div style={{ padding: '0.4rem 0.6rem 0.6rem', borderBottom: '1px solid var(--card-border)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Select Active Facility / Profile
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>
                {FACILITIES.map((facility) => {
                  const isSelected = facility.id === currentProfile;
                  return (
                    <div
                      key={facility.id}
                      onClick={() => handleSelectFacility(facility)}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? '#eff6ff' : 'transparent',
                        border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <strong style={{ fontSize: '0.86rem', color: isSelected ? 'var(--primary-blue)' : 'var(--text-title)' }}>
                            {facility.label}
                          </strong>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: isSelected ? '#dbeafe' : '#f1f5f9',
                              color: isSelected ? 'var(--primary-blue)' : 'var(--text-muted)',
                            }}
                          >
                            {facility.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: '1.35' }}>
                          {facility.desc}
                        </div>
                      </div>
                      {isSelected && (
                        <Check size={16} style={{ color: 'var(--primary-blue)', flexShrink: 0, marginTop: '2px' }} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--card-border)',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/hospital-config');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-blue)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem',
                  }}
                >
                  Configure Hospital Profiles <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}
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
        <div
          className="profile-avatar"
          style={{ width: '38px', height: '38px', cursor: 'pointer' }}
          onClick={() => navigate('/settings')}
        >
          JS
        </div>
      </div>
    </header>
  );
}
