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
  nurse: { label: 'Nurse', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: Stethoscope },
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
  const roleInfo = ROLE_DISPLAY[user?.role] || ROLE_DISPLAY.nurse;
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
        <div style={{ position: 'relative' }} ref={facilityRef}>
          <button
            type="button"
            className="facility-selector-btn"
            onClick={() => {
              setFacilityOpen((prev) => !prev);
              setProfileOpen(false);
            }}
            disabled={switching}
            aria-expanded={facilityOpen}
            aria-haspopup="listbox"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              border: facilityOpen ? '1px solid var(--primary-blue)' : '1px solid var(--card-border)',
              background: facilityOpen ? '#f8fafc' : '#ffffff',
              cursor: switching ? 'wait' : 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: activeFacility.badgeBg,
                color: activeFacility.badgeTone,
              }}
            >
              <activeFacility.icon size={15} />
            </div>

            <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-title)' }}>
                {hospitalName || activeFacility.fullName}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {activeFacility.label}
              </div>
            </div>

            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: activeFacility.badgeBg,
                color: activeFacility.badgeTone,
                border: `1px solid ${activeFacility.badgeBorder}`,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              {activeFacility.badge}
            </span>

            <ChevronDown
              size={14}
              style={{
                color: 'var(--text-light)',
                transform: facilityOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>

          {facilityOpen && (
            <div
              className="ui-card facility-dropdown-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '340px',
                zIndex: 9999,
                padding: '0.5rem',
                background: '#ffffff',
                boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                animation: 'dropdownFadeIn 0.15s ease',
              }}
            >
              <div
                style={{
                  padding: '0.4rem 0.6rem 0.5rem',
                  borderBottom: '1px solid var(--card-border)',
                  marginBottom: '0.4rem',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                  Active Hospital Presets
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: '2px' }}>
                  Switches wait SLAs, triage rules, &amp; department defaults
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {FACILITIES.map((facility) => {
                  const isSelected = facility.id === currentProfile;
                  const Icon = facility.icon;

                  return (
                    <div
                      key={facility.id}
                      onClick={() => handleSelectFacility(facility)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? '#eff6ff' : 'transparent',
                        border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#f8fafc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: facility.badgeBg,
                          color: facility.badgeTone,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        <Icon size={16} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.84rem', color: isSelected ? 'var(--primary-blue)' : 'var(--text-title)' }}>
                            {facility.fullName}
                          </strong>
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: facility.badgeBg,
                              color: facility.badgeTone,
                              border: `1px solid ${facility.badgeBorder}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {facility.badge}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.3' }}>
                          {facility.desc}
                        </div>
                      </div>

                      {isSelected && (
                        <div style={{ color: 'var(--primary-blue)', marginTop: '4px' }}>
                          <Check size={16} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {hasRole('admin') && (
                <div
                  style={{
                    padding: '0.5rem 0.6rem 0.2rem',
                    borderTop: '1px solid var(--card-border)',
                    marginTop: '0.4rem',
                    textAlign: 'center',
                  }}
                >
                  <button
                    type="button"
                    className="btn-white"
                    onClick={() => {
                      setFacilityOpen(false);
                      navigate('/hospital-config');
                    }}
                    style={{
                      width: '100%',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      justifyContent: 'center',
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

        <button
          className="icon-button"
          onClick={() => navigate('/alerts')}
          title="View Alerts & Notifications"
        >
          <Bell size={18} />
          {alertsCount > 0 && <span className="icon-badge">{alertsCount}</span>}
        </button>

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
