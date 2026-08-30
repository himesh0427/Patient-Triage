import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, DEMO_CREDENTIALS } from '../context/AuthContext';
import {
  HeartPulse, ShieldCheck, Lock, User, Eye, EyeOff,
  AlertTriangle, ArrowRight, Stethoscope, ClipboardCheck, ShieldAlert
} from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('nurse');
  const [password, setPassword] = useState('nurse123');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from?.pathname || '/';

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter both username/email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(identifier.trim(), password, rememberMe);
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
        'Authentication failed. Please verify your credentials and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (roleKey) => {
    const creds = DEMO_CREDENTIALS[roleKey];
    if (!creds) return;

    setIdentifier(creds.username);
    setPassword(creds.password);
    setLoading(true);
    setError(null);

    try {
      await login(creds.username, creds.password, true);
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError('Demo authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '850px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: 'var(--sidebar-bg)',
              color: '#ffffff',
              marginBottom: '0.85rem',
              boxShadow: '0 8px 16px rgba(13, 21, 39, 0.15)',
            }}
          >
            <HeartPulse size={28} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-title)', letterSpacing: '-0.02em' }}>
            PatientTriage.ai
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Clinical Decision Support &amp; Emergency Department Access Portal
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
            gap: '1.75rem',
            alignItems: 'start',
          }}
        >
          {/* Main Login Form Card */}
          <div
            className="ui-card"
            style={{
              padding: '2rem',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
              border: '1px solid var(--card-border)',
            }}
          >
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-title)' }}>
                Sign In to Clinical Workspace
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Enter your hospital credentials to access the triage queue.
              </p>
            </div>

            {error && (
              <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit}>
              {/* Username / Email */}
              <div className="form-group-clean" style={{ marginBottom: '1.2rem' }}>
                <label className="form-label-clean" htmlFor="login-identifier">
                  Staff Email or Username
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={17}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-light)',
                    }}
                  />
                  <input
                    id="login-identifier"
                    type="text"
                    className="input-clean"
                    style={{ paddingLeft: '2.4rem' }}
                    placeholder="nurse@hospital.org or nurse"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group-clean" style={{ marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label-clean" htmlFor="login-password">
                    Password
                  </label>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={17}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-light)',
                    }}
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="input-clean"
                    style={{ paddingLeft: '2.4rem', paddingRight: '2.4rem' }}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Session */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-body)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember my session on this terminal</span>
                </label>
              </div>

              <button
                type="submit"
                className="btn-blue"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight size={16} />
              </button>
            </form>
          </div>

          {/* Quick 1-Click Demo Accounts Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ padding: '0.4rem 0.2rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                1-Click Quick Demo Sign-In
              </span>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-light)', marginTop: '0.15rem' }}>
                Select a clinical role to test permissions &amp; RBAC workflows:
              </p>
            </div>

            {/* Emergency Nurse */}
            <div
              className="ui-card"
              onClick={() => handleDemoLogin('nurse')}
              style={{
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-blue)';
                e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--card-border)';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: '#eff6ff',
                    color: 'var(--primary-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Stethoscope size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-title)' }}>Sarah Jenkins, RN</strong>
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: '#eff6ff',
                      color: 'var(--primary-blue)',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    Emergency Nurse
                  </span>
                </div>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Intake &amp; triage, queue monitoring, overrides, surge management &amp; <strong>operational reports</strong>.
              </p>
            </div>

            {/* Clinical Administrator */}
            <div
              className="ui-card"
              onClick={() => handleDemoLogin('admin')}
              style={{
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#7c3aed';
                e.currentTarget.style.background = '#faf5ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--card-border)';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: '#faf5ff',
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-title)' }}>Dr. Eleanor Davis</strong>
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: '#faf5ff',
                      color: '#7c3aed',
                      border: '1px solid #e9d5ff',
                    }}
                  >
                    Administrator
                  </span>
                </div>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Full access: Hospital configurations, wait SLAs, audit logs &amp; system settings.
              </p>
            </div>
          </div>
        </div>

        {/* Security & HIPAA notice */}
        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text-light)' }}>
          <p>
            🔒 All authentication actions, clinical decisions, and access attempts are permanently audited for HIPAA compliance.
          </p>
        </div>
      </div>
    </div>
  );
}
