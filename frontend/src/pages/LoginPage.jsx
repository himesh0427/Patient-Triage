import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, DEMO_CREDENTIALS } from '../context/AuthContext';
import {
  HeartPulse, ShieldCheck, Lock, User, Eye, EyeOff,
  AlertTriangle, ArrowRight, Stethoscope, Mail, UserPlus,
  LogIn, CheckCircle2
} from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();

  // Mode: 'signin' | 'register'
  const [activeTab, setActiveTab] = useState('signin');

  // Sign In state
  const [identifier, setIdentifier] = useState('nurse');
  const [password, setPassword] = useState('nurse123');
  const [rememberMe, setRememberMe] = useState(true);

  // Register state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('nurse');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const from = location.state?.from?.pathname || '/';

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter both username/email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

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

  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!regFullName.trim() || !regEmail.trim() || !regUsername.trim() || !regPassword) {
      setError('All fields are required to register a new staff account.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await register({
        full_name: regFullName.trim(),
        email: regEmail.trim().toLowerCase(),
        username: regUsername.trim().toLowerCase(),
        password: regPassword,
        role: regRole,
        rememberMe: true,
      });
      setSuccessMessage('Account registered successfully! Redirecting to clinical workspace...');
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 600);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
        'Registration failed. Please check your information and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (roleKey) => {
    const creds = DEMO_CREDENTIALS[roleKey];
    if (!creds) return;

    setActiveTab('signin');
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
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
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
            gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)',
            gap: '1.75rem',
            alignItems: 'start',
          }}
        >
          {/* Main Auth Form Card */}
          <div
            className="ui-card"
            style={{
              padding: '1.75rem',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
              border: '1px solid var(--card-border)',
              background: '#ffffff',
            }}
          >
            {/* Tab Switcher */}
            <div
              style={{
                display: 'flex',
                background: '#f1f5f9',
                padding: '4px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setError(null);
                  setSuccessMessage(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: activeTab === 'signin' ? 700 : 500,
                  color: activeTab === 'signin' ? 'var(--text-title)' : 'var(--text-muted)',
                  background: activeTab === 'signin' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'signin' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <LogIn size={15} /> Sign In
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setError(null);
                  setSuccessMessage(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: activeTab === 'register' ? 700 : 500,
                  color: activeTab === 'register' ? 'var(--text-title)' : 'var(--text-muted)',
                  background: activeTab === 'register' ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'register' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <UserPlus size={15} /> Register New Staff
              </button>
            </div>

            {/* Error & Success Messages */}
            {error && (
              <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="alert-banner alert-success" style={{ marginBottom: '1.25rem' }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span>{successMessage}</span>
              </div>
            )}

            {/* TAB 1: SIGN IN FORM */}
            {activeTab === 'signin' ? (
              <form onSubmit={handleLoginSubmit}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-title)' }}>
                    Sign In to Clinical Workspace
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Enter your staff credentials to access the live triage queue.
                  </p>
                </div>

                {/* Username / Email */}
                <div className="form-group-clean" style={{ marginBottom: '1.1rem' }}>
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
                <div className="form-group-clean" style={{ marginBottom: '1.1rem' }}>
                  <label className="form-label-clean" htmlFor="login-password">
                    Password
                  </label>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-body)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember session on this terminal</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="btn-blue"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight size={16} />
                </button>

                <div style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Need to add a new clinical staff member?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    Register new nurse
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: REGISTER NEW NURSE / STAFF FORM */
              <form onSubmit={handleRegisterSubmit}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-title)' }}>
                    Register New Staff Member
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Create a new clinical account to grant hospital access.
                  </p>
                </div>

                {/* Full Name */}
                <div className="form-group-clean" style={{ marginBottom: '1rem' }}>
                  <label className="form-label-clean" htmlFor="reg-fullname">
                    Full Name &amp; Credentials
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
                      id="reg-fullname"
                      type="text"
                      className="input-clean"
                      style={{ paddingLeft: '2.4rem' }}
                      placeholder="e.g. Jessica Taylor, RN"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Work Email */}
                <div className="form-group-clean" style={{ marginBottom: '1rem' }}>
                  <label className="form-label-clean" htmlFor="reg-email">
                    Hospital Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
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
                      id="reg-email"
                      type="email"
                      className="input-clean"
                      style={{ paddingLeft: '2.4rem' }}
                      placeholder="jtaylor@hospital.org"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Username */}
                <div className="form-group-clean" style={{ marginBottom: '1rem' }}>
                  <label className="form-label-clean" htmlFor="reg-username">
                    Username
                  </label>
                  <input
                    id="reg-username"
                    type="text"
                    className="input-clean"
                    placeholder="e.g. jtaylor"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    required
                  />
                </div>

                {/* Password */}
                <div className="form-group-clean" style={{ marginBottom: '1rem' }}>
                  <label className="form-label-clean" htmlFor="reg-password">
                    Password
                  </label>
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
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      className="input-clean"
                      style={{ paddingLeft: '2.4rem', paddingRight: '2.4rem' }}
                      placeholder="Create secure password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
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

                {/* Role Selector */}
                <div className="form-group-clean" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label-clean">Assigned Clinical Role</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.3rem' }}>
                    <button
                      type="button"
                      onClick={() => setRegRole('nurse')}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        background: regRole === 'nurse' ? '#eff6ff' : '#ffffff',
                        border: `1.5px solid ${regRole === 'nurse' ? 'var(--primary-blue)' : 'var(--card-border)'}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <Stethoscope size={16} style={{ color: 'var(--primary-blue)' }} />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-title)' }}>Nurse</div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Triage, Queue &amp; Reports</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegRole('admin')}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        background: regRole === 'admin' ? '#faf5ff' : '#ffffff',
                        border: `1.5px solid ${regRole === 'admin' ? '#7c3aed' : 'var(--card-border)'}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <ShieldCheck size={16} style={{ color: '#7c3aed' }} />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-title)' }}>Admin</div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Full System Control</div>
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-blue"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {loading ? 'Creating Account...' : 'Create Account & Sign In'} <ArrowRight size={16} />
                </button>

                <div style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('signin')}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    Sign in here
                  </button>
                </div>
              </form>
            )}
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

            {/* Nurse */}
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
                    Nurse
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
