import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Lock, UserCheck, KeyRound } from 'lucide-react';
import { useAuth, DEMO_CREDENTIALS } from '../context/AuthContext';

const ROLE_LABELS = {
  nurse: 'Emergency Nurse',
  triage_nurse: 'Emergency Nurse',
  charge_nurse: 'Emergency Nurse',
  admin: 'Clinical Administrator',
};

export default function AccessRestricted({ requiredRoles = ['admin'], featureName = 'this section' }) {
  const navigate = useNavigate();
  const { user, switchDemoRole } = useAuth();

  const requiredRoleLabels = (Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles])
    .map((r) => ROLE_LABELS[r] || r)
    .join(' or ');

  const currentRoleLabel = ROLE_LABELS[user?.role] || user?.role || 'Guest';

  return (
    <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '65vh' }}>
      <div
        className="ui-card"
        style={{
          maxWidth: '560px',
          width: '100%',
          textAlign: 'center',
          padding: '2.5rem 2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
          border: '1px solid #fed7aa',
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#fff7ed',
            color: '#ea580c',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            border: '2px solid #fed7aa',
          }}
        >
          <ShieldAlert size={32} />
        </div>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '0.5rem' }}>
          Access Restricted
        </h2>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-body)', lineHeight: '1.5', marginBottom: '1.25rem' }}>
          You are currently signed in as <strong>{user?.full_name || 'Staff'}</strong> with the role of{' '}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              background: '#f1f5f9',
              fontWeight: 700,
              color: 'var(--text-title)',
              fontSize: '0.82rem',
            }}
          >
            {currentRoleLabel}
          </span>
          . This area requires <strong>{requiredRoleLabels}</strong> authorization.
        </p>

        <div
          style={{
            background: '#f8fafc',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            textAlign: 'left',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
          }}
        >
          <Lock size={16} style={{ color: 'var(--primary-blue)', flexShrink: 0, marginTop: '2px' }} />
          <span>
            Hospital compliance and security policies restrict modifications to configurations, system parameters,
            and compliance audit trails to authorized clinical leadership.
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-blue"
            onClick={() => navigate('/')}
            style={{ padding: '0.55rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ArrowLeft size={16} /> Return to Dashboard
          </button>

          {/* Quick Demo Switch to Admin */}
          {user?.role !== 'admin' && (
            <button
              type="button"
              className="btn-white"
              onClick={async () => {
                await switchDemoRole('admin');
                window.location.reload();
              }}
              style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              title="Switch demo session to Dr. Eleanor Davis (Admin)"
            >
              <KeyRound size={15} style={{ color: 'var(--primary-blue)' }} /> Switch to Admin (Demo)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
