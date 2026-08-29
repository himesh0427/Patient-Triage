import React, { useState, useEffect } from 'react';
import { systemApi, triageApi } from '../services/api';
import TopNav from '../components/TopNav';
import SurgeBanner from '../components/SurgeBanner';
import {
  ShieldCheck, Radio, Hospital, CheckCircle2, AlertTriangle, Zap,
  Lock, KeyRound, FileText, FlaskConical, UserCog
} from 'lucide-react';

export default function SettingsPage() {
  const [config, setConfig] = useState(null);
  const [threshold, setThreshold] = useState(0.50);
  const [surgeScale, setSurgeScale] = useState(3);
  const [loading, setLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchConfig = async () => {
    try {
      const res = await systemApi.getConfig();
      setConfig(res.data);
      setThreshold(res.data.confidence_threshold);
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError("Unable to connect to backend configuration.");
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleHospitalTypeChange = async (type) => {
    setLoading(true);
    setSavedMessage(null);
    try {
      await systemApi.setHospitalType(type);
      await fetchConfig();
      setSavedMessage(`Facility mode updated to: ${type}`);
    } catch (err) {
      setError("Failed to update hospital mode.");
    } finally {
      setLoading(false);
    }
  };

  const handleSurgeToggle = async () => {
    setLoading(true);
    setSavedMessage(null);
    try {
      await systemApi.toggleSurge();
      await fetchConfig();
      setSavedMessage("Emergency Surge mode status updated.");
    } catch (err) {
      setError("Failed to toggle surge mode.");
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdSave = async () => {
    setLoading(true);
    setSavedMessage(null);
    try {
      await systemApi.setConfidenceThreshold(threshold);
      await fetchConfig();
      setSavedMessage(`AI warning threshold saved: ${(threshold * 100).toFixed(0)}%`);
    } catch (err) {
      setError("Failed to save confidence threshold.");
    } finally {
      setLoading(false);
    }
  };

  const handleSurgeSimulate = async () => {
    setLoading(true);
    setSavedMessage(null);
    try {
      if (!config?.surge_mode) {
        await systemApi.toggleSurge();
      }
      const res = await triageApi.simulateSurge(surgeScale);
      await fetchConfig();
      setSavedMessage(res.data.message || `Simulated ${surgeScale * 30} patients.`);
    } catch (err) {
      setError("Failed to launch surge simulation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TopNav
        title="Settings & System Configuration"
        subtitle="Manage facility operational mode, safety thresholds, and surge simulations"
        surgeMode={config?.surge_mode}
      />

      <div className="page-container">
        <SurgeBanner active={config?.surge_mode} />

        {/* Role-aware notice (requirement #14) */}
        <div className="info-callout" style={{ marginBottom: '1.25rem' }}>
          <UserCog size={16} style={{ color: 'var(--primary-blue)', flexShrink: 0 }} />
          <span>
            Signed in as <strong>Jane Smith, RN — Nurse Supervisor (Administrator)</strong>. Configuration
            and surge controls require administrator role. Clinicians only see read-only settings.
          </span>
        </div>
        {savedMessage && (
          <div className="alert-banner alert-success" style={{ marginBottom: '1.25rem' }}>
            <CheckCircle2 size={18} />
            <span>{savedMessage}</span>
          </div>
        )}

        {error && (
          <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Facility Operating Mode */}
          <div className="ui-card">
            <div className="ui-card-header">
              <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Hospital size={18} style={{ color: 'var(--primary-blue)' }} /> Facility Operating Mode
              </h3>
              <span className="status-pill in-room">{config?.hospital_type || 'URBAN'} Mode</span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
              Select between <strong>Urban 5-Level ESI</strong> for tertiary trauma/multi-specialty EDs or <strong>Rural Critical Access 3-Tier</strong> (Critical, Urgent, Non-Urgent) optimized for transfer and stabilization.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div
                onClick={() => handleHospitalTypeChange('URBAN')}
                style={{
                  padding: '1.25rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  border: config?.hospital_type === 'URBAN' ? '2px solid var(--primary-blue)' : '1px solid var(--card-border)',
                  background: config?.hospital_type === 'URBAN' ? '#eff6ff' : '#ffffff',
                  transition: 'all 0.15s ease'
                }}
              >
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-title)' }}>Urban Tertiary (5-Level ESI)</strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Granular triage levels 1 to 5. Comprehensive resource requirement modeling.
                </p>
              </div>

              <div
                onClick={() => handleHospitalTypeChange('RURAL')}
                style={{
                  padding: '1.25rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  border: config?.hospital_type === 'RURAL' ? '2px solid #06b6d4' : '1px solid var(--card-border)',
                  background: config?.hospital_type === 'RURAL' ? '#f0fdfa' : '#ffffff',
                  transition: 'all 0.15s ease'
                }}
              >
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-title)' }}>Rural Critical Access (3-Tier)</strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Tier 1: Immediate Transfer, Tier 2: Stabilize, Tier 3: Standard Care.
                </p>
              </div>
            </div>
          </div>

          {/* AI Confidence Safety Threshold */}
          <div className="ui-card">
            <div className="ui-card-header">
              <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} style={{ color: '#eab308' }} /> AI Confidence Safety Threshold
              </h3>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>
                {(threshold * 100).toFixed(0)}%
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
              Whenever model prediction confidence falls below this threshold, the patient record is automatically flagged with an <strong>"Uncertain AI"</strong> warning for mandatory clinician verification.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                style={{ width: '100%', height: '6px', accentColor: '#1d4ed8', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.35rem' }}>
                <span>10% (Permissive)</span>
                <span>50% (Standard)</span>
                <span>90% (High Assurance)</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleThresholdSave} disabled={loading} className="btn-blue" style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}>
                Save Threshold
              </button>
            </div>
          </div>

          {/* Surge Simulation Panel */}
          <div className="ui-card">
            <div className="ui-card-header">
              <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Radio size={18} style={{ color: '#ef4444' }} /> Emergency Surge &amp; Simulation Controls
              </h3>
              <span className={`status-pill ${config?.surge_mode ? 'waiting' : 'discharged'}`}>
                {config?.surge_mode ? 'Surge Active' : 'Normal Operations'}
              </span>
            </div>

            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <FlaskConical size={16} style={{ color: '#0369a1', flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                <strong>Simulated demo data.</strong> The surge generator creates synthetic patients through
                the prototype pipeline for stress-testing only. It does not reflect real ED performance.
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Simulate mass casualty and stress-test the waiting room queue velocity.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label-clean" style={{ fontSize: '0.78rem' }}>Simulation Batch Scale</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={surgeScale}
                  onChange={(e) => setSurgeScale(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#ef4444' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {surgeScale}× Multiplier ({surgeScale * 30} Patients)
                </span>
              </div>

              <button
                onClick={handleSurgeSimulate}
                disabled={loading}
                className="btn-blue"
                style={{ background: '#ef4444', borderColor: '#dc2626' }}
              >
                <Zap size={16} /> Simulate {surgeScale * 30} Patients
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--card-border)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Emergency Surge Protocol</span>
              <button
                onClick={handleSurgeToggle}
                disabled={loading}
                className="btn-white"
              >
                {config?.surge_mode ? 'Turn Off Surge Mode' : 'Activate 3× Surge Mode'}
              </button>
            </div>
          </div>

          {/* Privacy & Security (requirement #14) */}
          <div className="ui-card">
            <div className="ui-card-header">
              <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={18} style={{ color: '#16a34a' }} /> Privacy &amp; Security
              </h3>
              <span className="status-pill in-room">HIPAA-aligned</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.82rem' }}>
              <div className="info-callout">
                <KeyRound size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                <span>
                  <strong>Role-based access.</strong> This session is an administrator account. Clinician accounts
                  cannot modify thresholds, activate surge mode, or run simulations. All changes are logged to the audit trail.
                </span>
              </div>
              <div className="info-callout">
                <FileText size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                <span>
                  <strong>Consent &amp; PHI.</strong> Triage data is processed only with patient/guardian consent captured at
                  intake. Demo data is entirely simulated; production deployments encrypt PHI in transit and at rest.
                </span>
              </div>
              <div className="info-callout">
                <ShieldCheck size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                <span>
                  <strong>Decision-support only.</strong> This is a prototype clinical decision-support tool, not a medical
                  device. It never replaces clinician judgment.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
