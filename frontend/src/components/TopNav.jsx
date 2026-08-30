import React, { useState, useEffect, useRef } from 'react';
import {
  Bell, ChevronDown, Radio, Check, Building2, ExternalLink,
  Shield, Stethoscope, Compass, User, LogOut, KeyRound, Settings,
  ShieldCheck, ClipboardCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { hospitalConfigApi } from '../services/api';
import { useAuth, DEMO_CREDENTIALS } from '../context/AuthContext';

const FACILITIES = [
  {
    id: 'urban_trauma',
    label: 'ED North Wing',
    fullName: 'Urban Trauma Center',
    badge: 'Level 1 Trauma',
    badgeTone: '#ef4444',
    badgeBg: '#fef2f2',
    badgeBorder: '#fecaca',
    desc: 'High volume tertiary hospital · 5m ESI-2 threshold · 24/7 trauma bay',
    hospitalType: 'URBAN',
    icon: Shield,
  },
  {
    id: 'community',
    label: 'Community Emergency Unit',
    fullName: 'Community Hospital',
    badge: 'General ED',
    badgeTone: '#2563eb',
    badgeBg: '#eff6ff',
    badgeBorder: '#bfdbfe',
    desc: 'Standard volume · 10m ESI-2 threshold · Core medical & surgical',
    hospitalType: 'COMMUNITY',
    icon: Stethoscope,
  },
  {
    id: 'rural_ed',
    label: 'Rural Access Unit',
    fullName: 'Rural Emergency Dept',
    badge: 'Critical Access',
    badgeTone: '#d97706',
    badgeBg: '#fffbeb',
    badgeBorder: '#fde68a',
    desc: 'Tele-triage · 15m ESI-2 threshold · 3-Tier rural acuity mapping',
    hospitalType: 'RURAL',
    icon: Compass,
  },
];

const ROLE_DISPLAY = {
  nurse: { label: 'Emergency Nurse', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: Stethoscope },
  triage_nurse: { label: 'Emergency Nurse', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: Stethoscope },
  charge_nurse: { label: 'Emergency Nurse', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: Stethoscope },
  admin: { label: 'Administrator', bg: '#faf5ff', border: '#e9d5ff', text: '#7c3aed', icon: ShieldCheck },
};

function getInitials(name) {
  if (!name) return 'ST';
  const parts = name.replace(/^(Dr\.|RN|BSN|MD|,)\s*/i, '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function TopNav({
  title,
  subtitle,
  alertsCount = 3,
  hospitalType = 'URBAN',
  surgeMode = false,
  hospitalName = null,
}) {
  const navigate = useNavigate();
  const { user, logout, switchDemoRole, hasRole } = useAuth();

  const [facilityOpen, setFacilityOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentProfile, setCurrentProfile] = useState('urban_trauma');
  const [switching, setSwitching] = useState(false);

  const facilityRef = useRef(null);
  const profileRef = useRef(null);

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

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (facilityRef.current && !facilityRef.current.contains(event.target)) {
        setFacilityOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeFacility = FACILITIES.find((f) => f.id === currentProfile) || (
    hospitalType === 'RURAL' ? FACILITIES[2] : FACILITIES[0]
  );

  const handleSelectFacility = async (facility) => {
    if (facility.id === currentProfile && !switching) {
      setFacilityOpen(false);
      return;
    }

    setSwitching(true);
    try {
      await hospitalConfigApi.applyProfile(facility.id);
      setCurrentProfile(facility.id);
      setFacilityOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Failed to switch hospital facility:', err);
    } finally {
      setSwitching(false);
    }
  };

  const handleDemoSwitch = async (roleKey) => {
    setProfileOpen(false);
    try {
      await switchDemoRole(roleKey);
      window.location.reload();
    } catch (e) {
      console.error('Failed to switch demo role:', e);
    }
  };

  const initials = getInitials(user?.full_name);
  const roleInfo = ROLE_DISPLAY[user?.role] || ROLE_DISPLAY.triage_nurse;
  const RoleIcon = roleInfo.icon;

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
        {/* Facility Dropdown Selector */}
        <div style={{ position: 'relative' }} ref={facilityRef}>
          <button
            type="button"
            className="dept-selector"
            onClick={() => {
              setFacilityOpen((prev) => !prev);
              setProfileOpen(false);
            }}
            aria-expanded={facilityOpen}
            title="Switch Hospital Profile / Department"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.55rem',
              background: facilityOpen ? '#eff6ff' : '#ffffff',
              border: `1px solid ${facilityOpen ? 'var(--primary-blue)' : 'var(--card-border)'}`,
              boxShadow: facilityOpen
                ? '0 0 0 3px rgba(29, 78, 216, 0.12)'
                : '0 1px 2px rgba(0, 0, 0, 0.04)',
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-title)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '5px',
                background: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-blue)',
                flexShrink: 0,
              }}
            >
              <Building2 size={13} />
            </div>

            <span style={{ whiteSpace: 'nowrap' }}>
              {hospitalName || activeFacility.label}
            </span>

            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: activeFacility.badgeBg,
                color: activeFacility.badgeTone,
                border: `1px solid ${activeFacility.badgeBorder}`,
                letterSpacing: '0.02em',
              }}
            >
              {activeFacility.badge}
            </span>

            <ChevronDown
              size={14}
              style={{
                color: 'var(--text-muted)',
                transform: facilityOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                marginLeft: '0.1rem',
              }}
            />
          </button>

          {facilityOpen && (
            <div
              className="ui-card"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '350px',
                zIndex: 9999,
                padding: '0.65rem',
                background: '#ffffff',
                boxShadow: '0 20px 30px -8px rgba(15, 23, 42, 0.16), 0 8px 12px -4px rgba(15, 23, 42, 0.08)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                animation: 'dropdownFadeIn 0.15s ease',
              }}
            >
              <div
                style={{
                  padding: '0.4rem 0.6rem 0.6rem',
                  borderBottom: '1px solid var(--card-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Facility Operating Profiles
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>
                  3 Presets Available
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.45rem' }}>
                {FACILITIES.map((facility) => {
                  const isSelected = facility.id === currentProfile;
                  const FacilityIcon = facility.icon;
                  return (
                    <div
                      key={facility.id}
                      onClick={() => handleSelectFacility(facility)}
                      style={{
                        padding: '0.75rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        border: `1px solid ${isSelected ? '#93c5fd' : 'transparent'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '0.65rem',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isSelected ? 'var(--primary-blue)' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '1px',
                        }}
                      >
                        <FacilityIcon size={16} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.88rem', color: isSelected ? 'var(--primary-blue)' : 'var(--text-title)' }}>
                            {facility.fullName}
                          </strong>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: facility.badgeBg,
                              color: facility.badgeTone,
                              border: `1px solid ${facility.badgeBorder}`,
                            }}
                          >
                            {facility.badge}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: '1.4' }}>
                          {facility.desc}
                        </div>
                      </div>

                      <div style={{ flexShrink: 0, marginTop: '4px' }}>
                        {isSelected && (
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: 'var(--primary-blue)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasRole('admin') && (
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
                      setFacilityOpen(false);
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
                      padding: '0.35rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    Configure Hospital Profiles &amp; Wait SLAs <ExternalLink size={12} />
                  </button>
                </div>
              )}
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

        {/* Interactive Profile Avatar & Dropdown */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <div
            className="profile-avatar"
            style={{ width: '38px', height: '38px', cursor: 'pointer', userSelect: 'none', fontSize: '0.82rem', fontWeight: 700 }}
            onClick={() => {
              setProfileOpen((prev) => !prev);
              setFacilityOpen(false);
            }}
            title={`${user?.full_name || 'Staff'} (${roleInfo.label})`}
          >
            {initials}
          </div>

          {profileOpen && (
            <div
              className="ui-card"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '320px',
                zIndex: 9999,
                padding: '0.75rem',
                background: '#ffffff',
                boxShadow: '0 20px 30px -8px rgba(15, 23, 42, 0.16), 0 8px 12px -4px rgba(15, 23, 42, 0.08)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                animation: 'dropdownFadeIn 0.15s ease',
              }}
            >
              {/* User Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--card-border)' }}>
                <div className="profile-avatar" style={{ width: '42px', height: '42px', fontSize: '0.9rem' }}>
                  {initials}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-title)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.full_name || 'Staff Member'}
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: roleInfo.bg,
                        color: roleInfo.text,
                        border: `1px solid ${roleInfo.border}`,
                      }}
                    >
                      {roleInfo.label}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.username}
                    </span>
                  </div>
                </div>
              </div>

              {/* Demo Account Switcher */}
              <div style={{ marginTop: '0.65rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Quick Switch Role (Demo)
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
                  {Object.entries(DEMO_CREDENTIALS).map(([key, cred]) => {
                    const isCurrent = user?.role === cred.role;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleDemoSwitch(key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.45rem 0.65rem',
                          borderRadius: 'var(--radius-md)',
                          background: isCurrent ? '#eff6ff' : 'transparent',
                          border: isCurrent ? '1px solid #bfdbfe' : '1px solid transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isCurrent ? 'var(--primary-blue)' : 'var(--text-title)' }}>
                            {cred.name}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {cred.badge}
                          </div>
                        </div>
                        {isCurrent && <Check size={14} style={{ color: 'var(--primary-blue)' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Menu Links & Sign Out */}
              <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {hasRole('admin') && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'none',
                      border: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-title)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Settings size={15} style={{ color: 'var(--text-muted)' }} /> System Settings
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    setProfileOpen(false);
                    await logout();
                    navigate('/login');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'none',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#dc2626',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <LogOut size={15} /> Sign Out of Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
