import React, { useState, useEffect } from 'react';
import { hospitalConfigApi } from '../services/api';
import TopNav from '../components/TopNav';
import EsiSquareBadge from '../components/EsiSquareBadge';
import {
  Hospital, Building2, ShieldCheck, Clock, Users, Stethoscope,
  Bell, Database, CheckCircle2, AlertTriangle, Save, RefreshCw,
  Sliders, Cpu, Lock, Sparkles, Check, ChevronRight, Info, FileText, KeyRound
} from 'lucide-react';

const ALL_SPECIALTIES = [
  "Emergency Medicine",
  "Trauma Surgery",
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Internal Medicine",
  "Radiology",
  "General Surgery",
  "Critical Care",
  "Anesthesiology",
  "Psychiatry",
];

const PROFILE_CARDS = [
  {
    id: 'urban_trauma',
    name: 'Urban Trauma Center',
    tagline: 'High volume / multi-specialty tertiary referral hospital with advanced digital infrastructure.',
    volume: 'High (350+ ED visits/day)',
    integration: 'High (Epic EHR / Real-time telemetry)',
    staffing: '24/7 Multi-attending team & trauma bay',
    waitPreview: '0m / 5m / 15m / 30m / 60m',
  },
  {
    id: 'community',
    name: 'Community Hospital',
    tagline: 'Medium volume hospital with standard medical/surgical specialties and shift coverage.',
    volume: 'Medium (150–250 ED visits/day)',
    integration: 'Moderate (Cerner / Standard labs)',
    staffing: 'Shift-based attending & resident staff',
    waitPreview: '0m / 10m / 30m / 60m / 120m',
  },
  {
    id: 'rural_ed',
    name: 'Rural Emergency Department',
    tagline: 'Lower volume facility with limited on-site specialist coverage, optimized for transfer & tele-triage.',
    volume: 'Low (<80 ED visits/day)',
    integration: 'Basic (Standalone / Tele-health)',
    staffing: 'Single physician & on-call specialist',
    waitPreview: '0m / 15m / 40m / 90m / 180m',
  },
];

export default function HospitalConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [profile, setProfile] = useState('community');
  const [hospitalName, setHospitalName] = useState('Community Hospital');
  const [waitMinutes, setWaitMinutes] = useState({ 1: 0, 2: 10, 3: 30, 4: 60, 5: 120 });
  const [surgeWaitMinutes, setSurgeWaitMinutes] = useState({ 1: 0, 2: 5, 3: 15, 4: 30, 5: 60 });
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.50);
  const [capacity, setCapacity] = useState(40);
  const [physicians, setPhysicians] = useState(6);
  const [nurses, setNurses] = useState(12);
  const [specialties, setSpecialties] = useState([]);
  const [alertReassessment, setAlertReassessment] = useState(true);
  const [alertLowConfidence, setAlertLowConfidence] = useState(true);
  const [alertQueueWait, setAlertQueueWait] = useState(30);
  const [ehrSystem, setEhrSystem] = useState('cerner');
  const [ehrEndpoint, setEhrEndpoint] = useState('');

  const fetchConfig = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await hospitalConfigApi.getConfig();
      const data = res.data;
      setConfig(data);
      populateForm(data);
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to load hospital config:", err);
      setErrorMessage("Unable to connect to hospital configuration API. Please ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data) => {
    setProfile(data.profile || 'community');
    setHospitalName(data.hospital_name || 'Community Hospital');
    setWaitMinutes({
      1: Math.round((data.wait_thresholds?.esi_1 || 0) / 60),
      2: Math.round((data.wait_thresholds?.esi_2 || 600) / 60),
      3: Math.round((data.wait_thresholds?.esi_3 || 1800) / 60),
      4: Math.round((data.wait_thresholds?.esi_4 || 3600) / 60),
      5: Math.round((data.wait_thresholds?.esi_5 || 7200) / 60),
    });
    setSurgeWaitMinutes({
      1: Math.round((data.surge_wait_thresholds?.esi_1 || 0) / 60),
      2: Math.round((data.surge_wait_thresholds?.esi_2 || 300) / 60),
      3: Math.round((data.surge_wait_thresholds?.esi_3 || 900) / 60),
      4: Math.round((data.surge_wait_thresholds?.esi_4 || 1800) / 60),
      5: Math.round((data.surge_wait_thresholds?.esi_5 || 3600) / 60),
    });
    setConfidenceThreshold(data.confidence_threshold !== undefined ? data.confidence_threshold : 0.50);
    setCapacity(data.department_capacity || 40);
    setPhysicians(data.attending_physicians || 6);
    setNurses(data.nurses_on_duty || 12);
    setSpecialties(data.specialties || []);
    setAlertReassessment(data.alert_reassessment_enabled ?? true);
    setAlertLowConfidence(data.alert_low_confidence_enabled ?? true);
    setAlertQueueWait(data.alert_queue_wait_threshold || 30);
    setEhrSystem(data.ehr_system || 'none');
    setEhrEndpoint(data.ehr_endpoint || '');
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleProfileSelect = async (profileId) => {
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await hospitalConfigApi.applyProfile(profileId);
      setConfig(res.data.config);
      populateForm(res.data.config);
      setSuccessMessage(`Preset profile applied: ${PROFILE_CARDS.find(p => p.id === profileId)?.name}. Triage engine parameters synchronized.`);
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to apply profile:", err);
      setErrorMessage("Failed to apply profile preset.");
    } finally {
      setSaving(false);
    }
  };

  const handleSpecialtyToggle = (spec) => {
    setHasChanges(true);
    setSpecialties(prev =>
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  };

  const handleWaitChange = (esi, val) => {
    setHasChanges(true);
    const num = Math.max(0, parseInt(val, 10) || 0);
    setWaitMinutes(prev => ({ ...prev, [esi]: num }));
  };

  const handleSurgeWaitChange = (esi, val) => {
    setHasChanges(true);
    const num = Math.max(0, parseInt(val, 10) || 0);
    setSurgeWaitMinutes(prev => ({ ...prev, [esi]: num }));
  };

  const handleSaveAll = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      profile,
      hospital_name: hospitalName.trim() || 'Community Hospital',
      wait_esi_1: (waitMinutes[1] || 0) * 60,
      wait_esi_2: (waitMinutes[2] || 10) * 60,
      wait_esi_3: (waitMinutes[3] || 30) * 60,
      wait_esi_4: (waitMinutes[4] || 60) * 60,
      wait_esi_5: (waitMinutes[5] || 120) * 60,
      surge_wait_esi_1: (surgeWaitMinutes[1] || 0) * 60,
      surge_wait_esi_2: (surgeWaitMinutes[2] || 5) * 60,
      surge_wait_esi_3: (surgeWaitMinutes[3] || 15) * 60,
      surge_wait_esi_4: (surgeWaitMinutes[4] || 30) * 60,
      surge_wait_esi_5: (surgeWaitMinutes[5] || 60) * 60,
      confidence_threshold: parseFloat(confidenceThreshold),
      department_capacity: parseInt(capacity, 10) || 40,
      attending_physicians: parseInt(physicians, 10) || 6,
      nurses_on_duty: parseInt(nurses, 10) || 12,
      specialties,
      alert_reassessment_enabled: alertReassessment,
      alert_low_confidence_enabled: alertLowConfidence,
      alert_queue_wait_threshold: parseInt(alertQueueWait, 10) || 30,
      ehr_system: ehrSystem,
      ehr_endpoint: ehrEndpoint.trim(),
      updated_by: 'Admin / Nurse Supervisor',
    };

    try {
      const res = await hospitalConfigApi.saveConfig(payload);
      setConfig(res.data.config);
      populateForm(res.data.config);
      setSuccessMessage("Hospital configuration saved to database and synchronized live with the triage engine.");
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save config:", err);
      setErrorMessage(err.response?.data?.detail || "Failed to save hospital configuration.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '0.75rem' }}>
        <RefreshCw size={20} className="spin-icon" style={{ color: 'var(--primary-blue)' }} />
        <span>Loading Hospital Configuration...</span>
      </div>
    );
  }

  const activeProfileData = PROFILE_CARDS.find(p => p.id === profile) || PROFILE_CARDS[1];

  return (
    <>
      <TopNav
        title="Hospital Configuration & Scalability"
        subtitle="Adapt core triage safety engine across different hospital profiles without code changes"
        hospitalType={profile === 'rural_ed' ? 'RURAL' : 'URBAN'}
      />

      <div className="page-container">
        {/* Banner Alert Feedback */}
        {successMessage && (
          <div className="alert-banner alert-success" style={{ marginBottom: '1.25rem' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* SECTION 1: HOSPITAL PROFILES */}
        <div className="ui-card" style={{ marginBottom: '1.5rem' }}>
          <div className="ui-card-header" style={{ marginBottom: '1rem' }}>
            <div>
              <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={18} style={{ color: 'var(--primary-blue)' }} /> 1. Hospital Profile &amp; Facility Type
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Select an operational profile preset to load tailored clinical thresholds, staffing ratios, and integration policies.
              </p>
            </div>
            <span className="status-pill in-room" style={{ fontWeight: 700 }}>
              Active: {activeProfileData.name}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {PROFILE_CARDS.map((p) => {
              const isActive = profile === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleProfileSelect(p.id)}
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    border: isActive ? '2px solid var(--primary-blue)' : '1px solid var(--card-border)',
                    background: isActive ? '#eff6ff' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 4px 12px rgba(29, 78, 216, 0.08)' : 'none',
                    position: 'relative'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '1rem', color: 'var(--text-title)' }}>{p.name}</strong>
                      {isActive ? (
                        <span className="status-pill in-room" style={{ fontSize: '0.7rem' }}>ACTIVE</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary-blue)', fontWeight: 600 }}>Select</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-body)', lineHeight: '1.45', marginBottom: '0.85rem' }}>
                      {p.tagline}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Volume: </span><strong>{p.volume}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Integration: </span><strong>{p.integration}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Staffing: </span><strong>{p.staffing}</strong></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Wait Limits: </span><strong style={{ fontFamily: 'var(--font-mono)' }}>{p.waitPreview}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>

          {/* How the active profile affects the clinical workflow (requirement #13) */}
          <div className="ui-card" style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
            <div className="ui-card-header" style={{ marginBottom: '0.9rem' }}>
              <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Info size={18} style={{ color: 'var(--primary-blue)' }} /> How This Profile Affects Your Workflow
              </h3>
              <span className="status-pill in-room">{activeProfileData.name}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ background: '#ffffff', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  <Clock size={14} style={{ color: '#f97316' }} /> Reassessment Intervals
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-body)', lineHeight: '1.5' }}>
                  Patients are flagged when their wait exceeds <strong style={{ fontFamily: 'var(--font-mono)' }}>
                  {waitMinutes[1] || 0}/{waitMinutes[2] || 10}/{waitMinutes[3] || 30}/{waitMinutes[4] || 60}/{waitMinutes[5] || 120}
                  </strong> min by ESI level. This drives the live "Reassess In" timers and overdue alerts across Dashboard, Queue, and Alerts.
                </p>
              </div>

              <div style={{ background: '#ffffff', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  <ShieldCheck size={14} style={{ color: '#eab308' }} /> AI Confidence Floor
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-body)', lineHeight: '1.5' }}>
                  Predictions below <strong>{(confidenceThreshold * 100).toFixed(0)}%</strong> confidence are flagged
                  for mandatory clinician review. Lowering the floor accepts more risk; raising it creates more review workload.
                </p>
              </div>

              <div style={{ background: '#ffffff', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  <Users size={14} style={{ color: 'var(--primary-blue)' }} /> Staffing Ratios
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-body)', lineHeight: '1.5' }}>
                  {capacity} staffed beds with {nurses} RNs ({capacity > 0 ? (nurses / capacity).toFixed(2) : 0} RNs/bed)
                  and {physicians} physicians. These ratios influence escalation urgency and surge capacity planning.
                </p>
              </div>

              <div style={{ background: '#ffffff', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  <Bell size={14} style={{ color: '#ef4444' }} /> Surge Behavior
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-body)', lineHeight: '1.5' }}>
                  Under 3× Surge Mode, reassessment intervals drop to{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>
                    {surgeWaitMinutes[1] || 0}/{surgeWaitMinutes[2] || 5}/{surgeWaitMinutes[3] || 15}/{surgeWaitMinutes[4] || 30}/{surgeWaitMinutes[5] || 60}
                  </strong>{' '}
                  min and eligible patients auto-escalate one ESI level when their reduced wait is exceeded.
                </p>
              </div>
            </div>
          </div>

        {/* FORM CONTAINER */}
        <form onSubmit={handleSaveAll}>
          {/* SECTION 2: WAITING TIME & REASSESSMENT CONFIGURATION */}
          <div className="ui-card" style={{ marginBottom: '1.5rem' }}>
            <div className="ui-card-header" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} style={{ color: '#f97316' }} /> 2. Waiting-Time &amp; Reassessment Configuration
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Define safe wait timeouts and reassessment slabs per ESI acuity level. These values drive the live queue timers and retriage alarms.
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="clean-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Acuity Level</th>
                    <th>Clinical Description</th>
                    <th style={{ width: '180px' }}>Normal Reassessment (min)</th>
                    <th style={{ width: '180px' }}>Surge Reassessment (min)</th>
                    <th>Timer Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { esi: 1, label: 'ESI 1 - Resuscitation', desc: 'Immediate life threat (Cardiac arrest, shock)', action: '0 min (Immediate Care / Bed)' },
                    { esi: 2, label: 'ESI 2 - Very Urgent', desc: 'High risk / acute distress / severe pain', action: 'Triggers nurse reassessment alert' },
                    { esi: 3, label: 'ESI 3 - Urgent', desc: 'Multiple resources required; stable vitals', action: 'Triggers vital drift re-check' },
                    { esi: 4, label: 'ESI 4 - Less Urgent', desc: 'One resource required (e.g. X-ray / suture)', action: 'Standard queue monitoring' },
                    { esi: 5, label: 'ESI 5 - Non-Urgent', desc: 'No complex diagnostic resources required', action: 'Fast-track / clinic routing' },
                  ].map((row) => (
                    <tr key={row.esi}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <EsiSquareBadge level={row.esi} />
                          <strong>L{row.esi}</strong>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-title)' }}>{row.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.desc}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="number"
                            min="0"
                            max="720"
                            disabled={row.esi === 1}
                            className="input-clean"
                            style={{ width: '85px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                            value={waitMinutes[row.esi] ?? 0}
                            onChange={(e) => handleWaitChange(row.esi, e.target.value)}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>min</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="number"
                            min="0"
                            max="360"
                            disabled={row.esi === 1}
                            className="input-clean"
                            style={{ width: '85px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, borderColor: '#fca5a5' }}
                            value={surgeWaitMinutes[row.esi] ?? 0}
                            onChange={(e) => handleSurgeWaitChange(row.esi, e.target.value)}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>min</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {row.action}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3 & 4: 2-COLUMN SECTION FOR STAFFING & SPECIALTIES */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* SECTION 3: STAFFING & CAPACITY */}
            <div className="ui-card">
              <div className="ui-card-header" style={{ marginBottom: '1rem' }}>
                <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} style={{ color: 'var(--primary-blue)' }} /> 3. Staffing &amp; Capacity
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group-clean">
                  <label className="form-label-clean">Emergency Department Bed Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    className="input-clean"
                    value={capacity}
                    onChange={(e) => { setHasChanges(true); setCapacity(e.target.value); }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Total staffed treatment beds in ED unit</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group-clean">
                    <label className="form-label-clean">Attending Physicians</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="input-clean"
                      value={physicians}
                      onChange={(e) => { setHasChanges(true); setPhysicians(e.target.value); }}
                    />
                  </div>

                  <div className="form-group-clean">
                    <label className="form-label-clean">Nurses on Duty</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      className="input-clean"
                      value={nurses}
                      onChange={(e) => { setHasChanges(true); setNurses(e.target.value); }}
                    />
                  </div>
                </div>

                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Nurse-to-Bed Ratio:</span>
                    <strong>1 : {(capacity / Math.max(1, nurses)).toFixed(1)} beds</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Physician-to-Bed Ratio:</span>
                    <strong>1 : {(capacity / Math.max(1, physicians)).toFixed(1)} beds</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: AVAILABLE SPECIALTIES */}
            <div className="ui-card">
              <div className="ui-card-header" style={{ marginBottom: '1rem' }}>
                <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Stethoscope size={18} style={{ color: '#22c55e' }} /> 4. Available Specialties &amp; Routing
                </h3>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Select available on-site clinical services. Patient routing flags unserved specialties for transfer.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '230px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {ALL_SPECIALTIES.map((spec) => {
                  const isChecked = specialties.includes(spec);
                  return (
                    <label
                      key={spec}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        background: isChecked ? '#eff6ff' : '#f8fafc',
                        border: isChecked ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        fontWeight: isChecked ? 600 : 400,
                        color: isChecked ? 'var(--primary-blue)' : 'var(--text-body)',
                        transition: 'all 0.1s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleSpecialtyToggle(spec)}
                        style={{ accentColor: '#1d4ed8' }}
                      />
                      <span>{spec}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 5: ALERT POLICY */}
          <div className="ui-card" style={{ marginBottom: '1.5rem' }}>
            <div className="ui-card-header" style={{ marginBottom: '1rem' }}>
              <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={18} style={{ color: '#eab308' }} /> 5. Alert Policy &amp; Clinical Safety Thresholds
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Left: AI Confidence Safety Threshold */}
              <div>
                <label className="form-label-clean" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>AI Confidence Safety Threshold</span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--primary-blue)' }}>
                    {(confidenceThreshold * 100).toFixed(0)}%
                  </strong>
                </label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Predictions below this confidence trigger a mandatory clinician review badge.
                </p>
                <input
                  type="range"
                  min="0.10"
                  max="0.90"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => { setHasChanges(true); setConfidenceThreshold(parseFloat(e.target.value)); }}
                  style={{ width: '100%', accentColor: '#1d4ed8', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                  <span>10% (Permissive)</span>
                  <span>50% (Standard)</span>
                  <span>90% (Strict)</span>
                </div>
              </div>

              {/* Right: Alert Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox"
                    checked={alertReassessment}
                    onChange={(e) => { setHasChanges(true); setAlertReassessment(e.target.checked); }}
                    style={{ accentColor: '#1d4ed8', width: '16px', height: '16px' }}
                  />
                  <span>
                    <strong>Reassessment Timeout Alerts</strong>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Flag patients whose waiting time exceeds the ESI reassessment slab
                    </span>
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox"
                    checked={alertLowConfidence}
                    onChange={(e) => { setHasChanges(true); setAlertLowConfidence(e.target.checked); }}
                    style={{ accentColor: '#1d4ed8', width: '16px', height: '16px' }}
                  />
                  <span>
                    <strong>Low AI Confidence Warnings</strong>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Show warning when ordinal boundary margin &lt; threshold
                    </span>
                  </span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Queue Overdue Alarm:</span>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    className="input-clean"
                    style={{ width: '80px', textAlign: 'center', fontWeight: 700 }}
                    value={alertQueueWait}
                    onChange={(e) => { setHasChanges(true); setAlertQueueWait(e.target.value); }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>minutes max wait</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6: INTEGRATION & HOSPITAL SETTINGS */}
          <div className="ui-card" style={{ marginBottom: '1.5rem' }}>
            <div className="ui-card-header" style={{ marginBottom: '0.75rem' }}>
              <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={18} style={{ color: '#38bdf8' }} /> 6. Hospital EHR &amp; Integration Settings
              </h3>
              <span className="status-pill waiting" style={{ fontSize: '0.7rem' }}>HL7 / FHIR Gateway</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.25rem' }}>
              <div className="form-group-clean">
                <label className="form-label-clean">Primary Hospital EHR System</label>
                <select
                  className="input-clean"
                  value={ehrSystem}
                  onChange={(e) => { setHasChanges(true); setEhrSystem(e.target.value); }}
                >
                  <option value="none">Standalone (No EHR Sync)</option>
                  <option value="epic">Epic Systems (FHIR R4)</option>
                  <option value="cerner">Oracle Cerner (Millennium)</option>
                  <option value="meditech">MEDITECH Expanse</option>
                </select>
              </div>

              <div className="form-group-clean">
                <label className="form-label-clean" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>EHR Integration Endpoint (URL)</span>
                  {ehrSystem !== 'none' && (
                    <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>Coming Soon (Read-Only)</span>
                  )}
                </label>
                <input
                  type="text"
                  className="input-clean"
                  placeholder={ehrSystem === 'none' ? 'Disabled in standalone mode' : 'https://fhir.hospital.org/r4'}
                  value={ehrEndpoint}
                  disabled={ehrSystem === 'none'}
                  onChange={(e) => { setHasChanges(true); setEhrEndpoint(e.target.value); }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 7: CONFIGURATION SUMMARY */}
          <div className="ui-card" style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
            <div className="ui-card-header" style={{ marginBottom: '0.75rem' }}>
              <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={18} style={{ color: 'var(--primary-blue)' }} /> 7. Active Configuration Summary
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontFamily: 'var(--font-mono)' }}>
                {config?.updated_at ? `Last saved: ${new Date(config.updated_at).toLocaleString()}` : 'System Defaults'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: '0.8rem' }}>
              <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Active Profile</div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-title)' }}>{activeProfileData.name}</strong>
              </div>
              <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Staffed Capacity</div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-title)' }}>{capacity} Beds · {nurses} RNs</strong>
              </div>
              <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Specialties Available</div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-title)' }}>{specialties.length} of {ALL_SPECIALTIES.length} active</strong>
              </div>
              <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>AI Safety Floor</div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-title)' }}>{(confidenceThreshold * 100).toFixed(0)}% Confidence</strong>
              </div>
            </div>

            <div style={{ marginTop: '0.85rem', padding: '0.75rem', background: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
              <span>
                <strong>Clinical Guardrail Assurance:</strong> The deterministic safety rules, vital drift triggers, and audit logging remain 100% active and enforced across all hospital presets.
              </span>
            </div>
          </div>

          {/* SECTION 8: PRIVACY & SECURITY (requirement #14) */}
          <div className="ui-card" style={{ marginBottom: '1.5rem', border: '1px solid #cbd5e1' }}>
            <div className="ui-card-header" style={{ marginBottom: '0.75rem' }}>
              <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={18} style={{ color: '#16a34a' }} /> 8. Privacy &amp; Security
              </h3>
              <span className="status-pill in-room" style={{ fontSize: '0.7rem' }}>Role-aware</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div className="info-callout">
                  <KeyRound size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span><strong>Role-based access.</strong> Configuration changes are restricted to administrators / nurse supervisors. Clinicians see read-only operational settings.</span>
                </div>
                <div className="info-callout">
                  <FileText size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span><strong>Audit trail.</strong> Every override, acceptance, reassessment, discharge, and configuration change is recorded permanently with clinician ID and timestamp.</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div className="info-callout">
                  <Lock size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span><strong>Data protection.</strong> All demo data is simulated. In production, PHI is encrypted in transit (TLS) and at rest, with HIPAA-aligned consent captured at intake.</span>
                </div>
                <div className="info-callout">
                  <ShieldCheck size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span><strong>Clinical decision support.</strong> This is a prototype decision-support tool. It does not replace clinician judgment and is not a clinical device.</span>
                </div>
              </div>
            </div>
          </div>

          {/* ACTION BAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0' }}>
            <div>
              {hasChanges && (
                <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Info size={15} /> Unsaved configuration changes
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-white"
                onClick={fetchConfig}
                disabled={saving}
              >
                Reset to Saved
              </button>

              <button
                type="submit"
                className="btn-blue"
                disabled={saving}
                style={{ padding: '0.65rem 1.5rem', fontSize: '0.9rem' }}
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="spin-icon" /> Saving &amp; Synchronizing...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save All Configuration
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
