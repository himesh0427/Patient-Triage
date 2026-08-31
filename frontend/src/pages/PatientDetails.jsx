import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { triageApi, systemApi } from '../services/api';
import TopNav from '../components/TopNav';
import EsiSquareBadge from '../components/EsiSquareBadge';
import OverrideModal from '../components/OverrideModal';
import RevitalsModal from '../components/RevitalsModal';
import AcceptModal from '../components/AcceptModal';
import ReassessmentTimer from '../components/ReassessmentTimer';
import { PathwayBadge, HistoryBadge, ConfidencePill, CompletenessBar } from '../components/ClinicalBadges';
import {
  vitalsCompleteness,
  pathwayOf,
  historyStatus,
  confidenceLevel,
  VITAL_KEYS,
  VITAL_LABELS,
} from '../services/clinical';
import {
  ShieldCheck, Activity, AlertTriangle, Clock, User, CheckCircle2,
  History, RotateCcw, Thermometer, Wind, Droplets, Gauge, Heart,
  Brain, Stethoscope, ClipboardList, TrendingUp, FileText, SearchCode,
  UserX, BadgeCheck, Info,
} from 'lucide-react';

const ESI_TIME_SLABS = {
  1: 'Immediate (0 min)',
  2: '10 min Reassessment Slab',
  3: '30 min Reassessment Slab',
  4: '60 min Reassessment Slab',
  5: '120 min Reassessment Slab',
};

const ESI_COLORS = {
  1: 'var(--esi-1)', 2: 'var(--esi-2)', 3: 'var(--esi-3)', 4: 'var(--esi-4)', 5: 'var(--esi-5)',
};

const VITAL_META = {
  hr: { label: 'Heart Rate', unit: 'bpm', low: 60, high: 100, critLow: 40, critHigh: 130, icon: Heart },
  sbp: { label: 'Systolic BP', unit: 'mmHg', low: 90, high: 140, critLow: 80, critHigh: 180, icon: Droplets },
  dbp: { label: 'Diastolic BP', unit: 'mmHg', low: 60, high: 90, critLow: 50, critHigh: 120, icon: Droplets },
  rr: { label: 'Resp Rate', unit: '/min', low: 12, high: 20, critLow: 8, critHigh: 30, icon: Wind },
  spo2: { label: 'SpO₂', unit: '%', low: 94, high: 100, critLow: 90, critHigh: null, icon: Gauge },
  temp: { label: 'Temperature', unit: '°C', low: 36, high: 38, critLow: 35, critHigh: 39.5, icon: Thermometer },
};

const vitalStatus = (val, meta) => {
  if (val === null || val === undefined || val === '') return 'missing';
  if (meta.critLow !== null && val < meta.critLow) return 'critical';
  if (meta.critHigh !== null && val > meta.critHigh) return 'critical';
  if (val < meta.low || val > meta.high) return 'borderline';
  return 'normal';
};

const STATUS_TONE = {
  normal: '#16a34a',
  borderline: '#d97706',
  critical: '#dc2626',
  missing: '#94a3b8',
};

const CC_LABELS = {
  cc_chestpain: 'Chest Pain',
  cc_shortnessofbreath: 'Shortness of Breath',
  cc_abdominalpain: 'Abdominal Pain',
  cc_abdominalcramping: 'Abdominal Cramping',
  cc_headache: 'Headache',
  cc_dizziness: 'Dizziness / Vertigo',
  cc_fever: 'Fever',
  cc_cough: 'Cough',
  cc_nausea: 'Nausea',
  cc_vomiting: 'Vomiting',
  cc_diarrhea: 'Diarrhea',
  cc_syncope: 'Syncope / Fainting',
  cc_fall: 'Fall / Injury',
  cc_fracture: 'Fracture',
  cc_laceration: 'Laceration / Wound',
  cc_trauma: 'Trauma',
  cc_backpain: 'Back Pain',
  cc_neckpain: 'Neck Pain',
  cc_anxiety: 'Anxiety / Panic',
  cc_alteredmentalstatus: 'Altered Mental Status',
  cc_seizure: 'Seizure',
  cc_weakness: 'Generalized Weakness',
  cc_palpitation: 'Palpitations',
  cc_edema: 'Edema / Swelling',
  cc_rash: 'Rash / Skin',
  cc_allergicreaction: 'Allergic Reaction',
  cc_sorethroat: 'Sore Throat',
  cc_urinary: 'Urinary Complaint',
  cc_abnormallab: 'Abnormal Labs',
};

const formatFeature = (f) => CC_LABELS[f] || (f.replace(/^cc_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

const ACTION_META = {
  OVERRIDE: { icon: ShieldCheck, color: '#2563eb', bg: '#eff6ff' },
  ACCEPT: { icon: BadgeCheck, color: '#16a34a', bg: '#f0fdf4' },
  VITAL_DRIFT_ALERT: { icon: Activity, color: '#dc2626', bg: '#fef2f2' },
  RETRIAGE_ALERT: { icon: AlertTriangle, color: '#d97706', bg: '#fffbeb' },
  DISCHARGE: { icon: UserX, color: '#64748b', bg: '#f1f5f9' },
  STAGE_TRIAGE_COMPLETED: { icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4' },
};

const actionMeta = (action) => ACTION_META[action] || { icon: ClipboardList, color: '#64748b', bg: '#f8fafc' };

function VitalsGrid({ vitals, large = false }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: large ? '1rem' : '0.65rem' }}>
      {Object.entries(VITAL_META).map(([key, meta]) => {
        const val = vitals?.[key];
        const status = vitalStatus(val, meta);
        const color = STATUS_TONE[status];
        const Icon = meta.icon;

        return (
          <div
            key={key}
            style={{
              background: '#f8fafc',
              border: `1px solid ${status === 'critical' ? '#fca5a5' : status === 'borderline' ? '#fde68a' : 'var(--card-border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: large ? '0.85rem 1rem' : '0.6rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Icon size={12} style={{ color }} /> {meta.label}
              </span>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: color,
                  display: 'inline-block',
                }}
                title={status}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
              <span style={{ fontSize: large ? '1.5rem' : '1.15rem', fontWeight: 800, color: 'var(--text-title)', fontFamily: 'var(--font-mono)' }}>
                {val !== null && val !== undefined && val !== '' ? val : '--'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{meta.unit}</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
              Normal: {meta.low}–{meta.high}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FactorBars({ factors }) {
  if (!factors || factors.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '1rem 0' }}>
        No explainable factor weights stored for this visit.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {factors.map((f, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-title)' }} title={f.raw || f.label}>
              {f.label}
            </span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              {f.weight}
            </span>
          </div>
          <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(10, Math.abs(parseFloat(f.weight) || 0.5) * 100))}%`,
                height: '100%',
                background: i === 0 ? 'var(--primary-blue)' : i === 1 ? '#06b6d4' : '#8b5cf6',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [surgeMode, setSurgeMode] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showRevitalsModal, setShowRevitalsModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [discharging, setDischarging] = useState(false);

  const fetchVisitData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [visitRes, statsRes] = await Promise.all([
        triageApi.getVisit(id),
        systemApi.getStats(),
      ]);
      setVisit(visitRes.data);
      setStats(statsRes.data);
      setSurgeMode(statsRes.data?.surge_mode || false);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch patient visit record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitData();
  }, [id]);

  const handleDischarge = async () => {
    if (!window.confirm('Confirm patient discharge? This marks the emergency visit complete and stops reassessment timers.')) {
      return;
    }
    setDischarging(true);
    try {
      await triageApi.discharge(visit.visit_id);
      await fetchVisitData();
    } catch (err) {
      console.error(err);
      alert('Failed to discharge patient.');
    } finally {
      setDischarging(false);
    }
  };

  if (loading && !visit) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        Loading patient clinical chart...
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="page-container">
        <div className="alert-banner alert-danger">
          <AlertTriangle size={20} />
          <span>{error || 'Patient visit not found.'}</span>
        </div>
        <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate('/queue')}>
          Return to Queue
        </button>
      </div>
    );
  }

  const patient = visit.patient;
  const vitals = visit.vitals || {};
  const vitals_history = visit.vitals_history || [];
  const audit_trail = visit.audit_trail || [];
  const cc_features = visit.cc_features || [];

  const esiLevel = visit.esi_final || visit.esi_predicted || 3;
  const esiLabel = {
    1: 'Immediate (Resuscitation)',
    2: 'Emergent (High Risk)',
    3: 'Urgent (Multiple Resources)',
    4: 'Less Urgent (One Resource)',
    5: 'Non-Urgent (No Resources)',
  }[esiLevel];

  const confidenceScore = visit.confidence !== null && visit.confidence !== undefined
    ? visit.confidence
    : (visit.confidence_score !== null && visit.confidence_score !== undefined ? visit.confidence_score : null);

  const confidenceThreshold = stats?.confidence_threshold ?? 0.50;
  const isLowConfidence = confidenceScore !== null && confidenceScore < confidenceThreshold;

  const hasAccepted = audit_trail.some((l) => l.action === 'ACCEPT');

  const completeness = vitalsCompleteness(vitals);
  const pathway = pathwayOf(patient?.age);
  const history = historyStatus(patient?.has_history, visit.prior_visits);
  const confInfo = confidenceLevel(confidenceScore, confidenceThreshold);

  const triageLog = audit_trail.find((l) => l.action === 'STAGE_TRIAGE_COMPLETED') || audit_trail[audit_trail.length - 1];
  const triageCompletedTime = triageLog ? triageLog.timestamp : visit.arrival_time;

  const lastReassessLog = [...audit_trail].reverse().find((l) => l.action === 'VITAL_DRIFT_ALERT' || l.action === 'OVERRIDE' || l.action === 'ACCEPT');
  const lastReassessTime = lastReassessLog ? lastReassessLog.timestamp : null;

  const dischargeLog = audit_trail.find((l) => l.action === 'DISCHARGE');
  const dischargeTime = dischargeLog ? dischargeLog.timestamp : visit.discharge_time;

  const timelineStages = [
    {
      key: 'arrival',
      label: 'Patient Arrived',
      time: visit.arrival_time,
      icon: User,
      state: 'done',
      note: `Intake registered with ID P-${patient?.id || id}`,
    },
    {
      key: 'triage',
      label: 'AI Triage Completed',
      time: triageCompletedTime,
      icon: Brain,
      state: 'done',
      note: `Initial prediction: ESI-${visit.esi_predicted}${confidenceScore !== null ? ` (${(confidenceScore * 100).toFixed(0)}% conf)` : ''}`,
    },
    {
      key: 'reassess',
      label: 'Reassessment & Drift',
      time: lastReassessTime,
      icon: Activity,
      state: lastReassessTime ? 'done' : (visit.is_active ? 'active' : 'idle'),
      note: lastReassessTime
        ? `Last evaluated at ${new Date(lastReassessTime).toLocaleTimeString()}`
        : (visit.is_active ? `Due every ${ESI_TIME_SLABS[esiLevel]}` : 'Not reassessed prior to discharge'),
    },
    {
      key: 'discharge',
      label: 'Visit Outcome / Discharge',
      time: dischargeTime,
      icon: UserX,
      state: !visit.is_active ? 'done' : 'idle',
      note: !visit.is_active
        ? `Discharged at ${new Date(dischargeTime).toLocaleTimeString()}`
        : 'Patient currently active in waiting queue',
    },
  ];

  const patientInitials = (patient?.name || 'Pt')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const factors = visit.reasons && Array.isArray(visit.reasons) && visit.reasons.length > 0
    ? visit.reasons.map((r, i) => ({
      label: r.length > 28 ? r.substring(0, 28) + '...' : r,
      raw: r,
      weight: (0.85 - i * 0.12).toFixed(2),
    }))
    : [];

  const source = visit.source || (visit.esi_predicted !== null && visit.esi_predicted <= 2 && confidenceScore === 1.0 ? 'hard_gate' : 'ml');
  const sourceLabel = source === 'bypass' ? 'Immediate Bypass' : source === 'hard_gate' ? 'Deterministic Hard Rules' : 'ML Model (LightGBM)';

  const boundaries = [1.5, 2.5, 3.5, 4.5];
  const rawScore = visit.raw_ml_score;
  const boundaryDist = rawScore !== null && rawScore !== undefined
    ? Math.min(...boundaries.map((b) => Math.abs(rawScore - b)))
    : null;
  const uncertaintyLabel = boundaryDist === null
    ? 'Unknown'
    : boundaryDist < 0.25
      ? 'High uncertainty — raw score sits close to an ESI boundary'
      : boundaryDist < 0.5
        ? 'Moderate uncertainty — near an ESI boundary'
        : 'Low uncertainty — clearly separated from boundaries';

  let safetyRecommendation;
  if (esiLevel === 1) {
    safetyRecommendation = 'Immediate resuscitation. ESI-1 patients must not wait. Continuous reassessment during resuscitation.';
  } else if (visit.retriage_overdue) {
    safetyRecommendation = `Reassessment overdue for ESI-${esiLevel}. Record re-vitals now and re-evaluate acuity against the current presentation.`;
  } else if (isLowConfidence) {
    safetyRecommendation = `AI confidence (${(confidenceScore * 100).toFixed(0)}%) is below the institutional threshold (${Math.round(confidenceThreshold * 100)}%). Clinician review and ESI confirmation are required before finalizing.`;
  } else if (history.key === 'first') {
    safetyRecommendation = 'First-time patient with no prior records. Base assessment on current presentation only and reassess at the scheduled interval.';
  } else {
    safetyRecommendation = `Continue scheduled reassessment at the ESI-${esiLevel} interval. Re-vitals are flagged automatically on vital-sign drift.`;
  }

  const TABS = [
    { key: 'overview', label: 'Overview', icon: ClipboardList },
    { key: 'vitals', label: 'Vitals & History', icon: Activity },
    { key: 'symptoms', label: 'Symptoms', icon: Stethoscope },
    { key: 'analysis', label: 'Explainable AI', icon: Brain },
    { key: 'timeline', label: 'Clinical Timeline', icon: Clock },
  ];

  return (
    <>
      <TopNav
        title={`Patient Chart · ${patient?.name || 'Emergency Intake'}`}
        subtitle={`Patient ID: P-${patient?.id || id} · Visit #${visit.visit_id}`}
        surgeMode={surgeMode}
      />

      <div className="page-container">
        {isLowConfidence && (
          <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem', border: '2px solid #ef4444', background: '#fef2f2' }}>
            <AlertTriangle size={24} style={{ flexShrink: 0, color: '#ef4444' }} />
            <div>
              <strong style={{ fontSize: '0.95rem', color: '#991b1b', display: 'block', marginBottom: '0.2rem' }}>
                LOW CONFIDENCE AI RECOMMENDATION ({(confidenceScore * 100).toFixed(0)}%)
              </strong>
              <span style={{ fontSize: '0.82rem', color: '#7f1d1d' }}>
                The AI recommendation is below the institutional confidence threshold ({Math.round(confidenceThreshold * 100)}%).
                Manual nurse assessment and clinician verification of ESI acuity is required before finalizing.
              </span>
            </div>
          </div>
        )}

        {!visit.is_active ? (
          <div className="alert-banner" style={{ marginBottom: '1.25rem', border: '1px solid #cbd5e1', background: '#f1f5f9' }}>
            <CheckCircle2 size={20} style={{ flexShrink: 0, color: '#64748b' }} />
            <div>
              <strong style={{ fontSize: '0.9rem', color: '#334155', display: 'block' }}>
                PATIENT DISCHARGED — VISIT COMPLETE
              </strong>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                {visit.discharge_time
                  ? `Discharged at ${new Date(visit.discharge_time).toLocaleString()}. This patient is no longer in the waiting queue; all timers and alerts are stopped. History is retained.`
                  : 'This patient is no longer in the active waiting queue.'}
              </span>
            </div>
          </div>
        ) : (
          visit.retriage_overdue && (
            <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem', border: '2px solid #ef4444', background: '#fef2f2' }}>
              <AlertTriangle size={24} style={{ flexShrink: 0, color: '#ef4444' }} />
              <div>
                <strong style={{ fontSize: '0.95rem', color: '#991b1b', display: 'block', marginBottom: '0.2rem' }}>
                  REASSESSMENT OVERDUE
                </strong>
                <span style={{ fontSize: '0.82rem', color: '#7f1d1d' }}>
                  The safe reassessment interval for ESI-{esiLevel} has elapsed. Please re-assess the patient and update vitals.
                </span>
              </div>
            </div>
          )
        )}

        <div className="ui-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #06b6d4)', color: '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '1.25rem', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)'
              }}>
                {patientInitials}
              </div>

              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '0.25rem' }}>
                  {patient?.name || 'Registered Patient'}
                </h2>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>Patient ID: <strong>P-{patient?.id || id}</strong></span>
                  <span>• Age: {patient?.age || 'N/A'} ({patient?.gender || 'Other'})</span>
                  <PathwayBadge age={patient?.age} showHint />
                  <HistoryBadge hasHistory={patient?.has_history} priorVisits={visit.prior_visits} />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>Arrived: {visit.arrival_time ? new Date(visit.arrival_time).toLocaleString() : 'N/A'}</span>
                  <span>• Reassessment Slab: <strong>{ESI_TIME_SLABS[esiLevel]}</strong></span>
                  <CompletenessBar vitals={vitals} width={64} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{
                background: '#ffffff',
                border: `1px solid ${ESI_COLORS[esiLevel]}`,
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px',
                  background: ESI_COLORS[esiLevel], color: '#ffffff',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, lineHeight: 1
                }}>
                  <span style={{ fontSize: '0.58rem' }}>ESI {esiLevel}</span>
                  <span style={{ fontSize: '1.15rem' }}>{esiLevel}</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>ESI Triage Result</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-title)' }}>{esiLabel}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                    {visit.is_overridden ? 'Status: Overridden by RN' : hasAccepted ? 'Status: Accepted by RN' : 'Model: LightGBM (prototype)'}
                  </div>
                </div>
                <div style={{ borderLeft: '1px solid var(--card-border)', paddingLeft: '0.75rem', textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Confidence</div>
                  <ConfidencePill confidence={confidenceScore} threshold={confidenceThreshold} />
                </div>
              </div>

              <div style={{ minWidth: '150px' }}>
                {!visit.is_active ? (
                  <span className="status-pill discharged" style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.8rem', fontWeight: 700, padding: '0.4rem 0.75rem' }}>
                    <UserX size={13} /> Discharged
                  </span>
                ) : (
                  <>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.3rem' }}>
                      Reassessment Timer
                    </div>
                    <ReassessmentTimer deadlineIso={visit.reassessment_deadline_at} esiLevel={esiLevel} />
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn-white"
                  onClick={() => setShowAcceptModal(true)}
                  style={{ padding: '0.55rem 0.85rem', borderColor: '#bbf7d0', color: '#15803d' }}
                  title="Accept the AI ESI recommendation (audited)"
                  disabled={!visit.is_active}
                >
                  <BadgeCheck size={15} /> Accept
                </button>

                <button
                  className="btn-blue"
                  onClick={() => setShowRevitalsModal(true)}
                  style={{ padding: '0.55rem 1rem' }}
                  title="Reassess patient vitals & check for deterioration"
                  disabled={!visit.is_active}
                >
                  <RotateCcw size={15} /> Reassess
                </button>

                <button
                  className="btn-white"
                  onClick={() => setShowOverrideModal(true)}
                  style={{ padding: '0.55rem 0.85rem' }}
                  title="Override ESI Level (mandatory reason)"
                  disabled={!visit.is_active}
                >
                  <ShieldCheck size={16} /> Override ESI
                </button>

                <button
                  className="btn"
                  onClick={handleDischarge}
                  disabled={discharging || !visit.is_active}
                  style={{
                    padding: '0.55rem 0.85rem',
                    background: '#dc2626', color: '#ffffff', border: '1px solid #b91c1c',
                    borderRadius: 'var(--radius-md)', fontSize: '0.88rem', fontWeight: 600,
                    cursor: discharging || !visit.is_active ? 'not-allowed' : 'pointer',
                    opacity: !visit.is_active ? 0.5 : 1,
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
                  }}
                  title="Discharge patient from the emergency queue"
                >
                  <UserX size={15} /> {discharging ? 'Discharging...' : 'Discharge'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="tab-navigation">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setActiveTab(t.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="ui-card">
              <div className="ui-card-header" style={{ marginBottom: '0.75rem' }}>
                <h4 className="ui-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Stethoscope size={16} style={{ color: 'var(--primary-blue)' }} /> Chief Complaint
                </h4>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', padding: '0.9rem 1rem', marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.9rem', color: '#1e3a8a', lineHeight: '1.55', fontStyle: 'italic', margin: 0 }}>
                  “{visit.symptom_text || 'No chief complaint text entered.'}”
                </p>
              </div>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <FileText size={15} style={{ color: 'var(--primary-blue)' }} /> Medical History &amp; Record Completeness
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HistoryBadge hasHistory={patient?.has_history} priorVisits={visit.prior_visits} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{history.note}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Vitals completeness:</span>
                  <CompletenessBar vitals={vitals} width={110} />
                  {completeness.missing > 0 && (
                    <span style={{ color: '#d97706', fontSize: '0.72rem' }}>
                      Missing: {completeness.missingKeys.map((k) => VITAL_LABELS[k]).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="ui-card">
              <div className="ui-card-header" style={{ marginBottom: '0.75rem' }}>
                <h4 className="ui-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Activity size={16} style={{ color: 'var(--primary-blue)' }} /> Vital Signs
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {visit.arrival_time ? new Date(visit.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <VitalsGrid vitals={vitals} />

              <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--card-border)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-blue)', cursor: 'pointer' }} onClick={() => setShowRevitalsModal(true)}>
                  + Reassess / Update Vitals
                </span>
              </div>
            </div>

            <div className="ui-card">
              <div className="ui-card-header" style={{ marginBottom: '0.75rem' }}>
                <h4 className="ui-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Brain size={16} style={{ color: 'var(--primary-blue)' }} /> AI Decision Factors
                </h4>
              </div>
              <FactorBars factors={factors} />
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Prediction source</span>
                  <strong style={{ color: 'var(--text-title)' }}>{sourceLabel}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Raw regression score</span>
                  <strong style={{ color: 'var(--text-title)' }}>{visit.raw_ml_score !== null ? Number(visit.raw_ml_score).toFixed(3) : 'N/A'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Confidence</span>
                  <strong style={{ color: isLowConfidence ? '#ef4444' : 'var(--text-title)' }}>
                    {confidenceScore !== null ? `${(confidenceScore * 100).toFixed(0)}%` : 'N/A'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vitals' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="ui-card">
                <div className="ui-card-header" style={{ marginBottom: '0.9rem' }}>
                  <h4 className="ui-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Activity size={16} style={{ color: 'var(--primary-blue)' }} /> Latest Vital Signs
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {vitals_history.length > 0 ? new Date(vitals_history[vitals_history.length - 1].recorded_at).toLocaleString() : 'No readings'}
                  </span>
                </div>
                <VitalsGrid vitals={vitals} large />
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-white" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }} onClick={() => setShowRevitalsModal(true)}>
                    <RotateCcw size={14} /> Record Re-Vitals
                  </button>
                </div>
              </div>

              <div className="ui-card">
                <div className="ui-card-header" style={{ marginBottom: '0.9rem' }}>
                  <h4 className="ui-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <History size={16} style={{ color: 'var(--primary-blue)' }} /> Vitals History
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{vitals_history.length} reading(s)</span>
                </div>

                {vitals_history.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '1.5rem 0', textAlign: 'center' }}>
                    No vital readings recorded yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {vitals_history.map((v, idx) => {
                      const latest = idx === vitals_history.length - 1;
                      return (
                        <div key={v.id || idx} className="vitals-history-row" style={{ borderColor: latest ? 'var(--primary-blue)' : 'var(--card-border)' }}>
                          <div className="vitals-history-time">
                            <strong>{new Date(v.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                            <span>{new Date(v.recorded_at).toLocaleDateString()}</span>
                          </div>
                          <div className="vitals-history-values">
                            <span>HR <b>{v.hr ?? '--'}</b></span>
                            <span>BP <b>{v.sbp ?? '--'}/{v.dbp ?? '--'}</b></span>
                            <span>RR <b>{v.rr ?? '--'}</b></span>
                            <span>SpO₂ <b>{v.spo2 ?? '--'}</b></span>
                            <span>Temp <b>{v.temp ?? '--'}</b></span>
                          </div>
                          {latest && <span className="status-pill in-room" style={{ whiteSpace: 'nowrap' }}>Latest</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="ui-card">
                <div className="ui-card-header" style={{ marginBottom: '0.9rem' }}>
                  <h4 className="ui-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <User size={16} style={{ color: 'var(--primary-blue)' }} /> Patient History
                  </h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Patient ID</span>
                    <strong>P-{patient?.id || id}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total ER Visits</span>
                    <strong>{visit.prior_visits || 1}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Gender</span>
                    <strong>{patient?.gender || 'Other'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Age</span>
                    <strong>{patient?.age || 'N/A'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Pathway</span>
                    <PathwayBadge age={patient?.age} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Current ESI</span>
                    <strong><EsiSquareBadge level={esiLevel} /></strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Medical History</span>
                    <HistoryBadge hasHistory={patient?.has_history} priorVisits={visit.prior_visits} />
                  </div>
                </div>
              </div>

              <div className="ui-card" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#92400e' }}>Wait-time Safety</strong>
                    <p style={{ fontSize: '0.8rem', color: '#78350f', marginTop: '0.25rem', lineHeight: '1.45' }}>
                      This patient's current ESI requires reassessment within {ESI_TIME_SLABS[esiLevel]}.
                      Re-vitals are flagged automatically if SpO₂ drops &gt;5%, HR rises &gt;20 bpm, or SBP drops &gt;15 mmHg.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'symptoms' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem' }}>
            <div className="ui-card">
              <div className="ui-card-header" style={{ marginBottom: '0.9rem' }}>
                <h4 className="ui-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Stethoscope size={16} style={{ color: 'var(--primary-blue)' }} /> Chief Complaint (Free Text)
                </h4>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #eff6ff, #f0fdfa)',
                border: '1px solid #bfdbfe', borderRadius: 'var(--radius-lg)',
                padding: '1.5rem', minHeight: '140px'
              }}>
                <p style={{ fontSize: '1.05rem', color: '#1e3a8a', lineHeight: '1.7', fontStyle: 'italic', margin: 0 }}>
                  “{visit.symptom_text || 'No chief complaint text entered.'}”
                </p>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: '1.5' }}>
                This is the raw free-text recorded by the triage nurse. The system maps it to structured clinical features
                (175 cc_* flags) using keyword matching, before passing them to the LightGBM model.
              </p>
            </div>

            <div className="ui-card">
              <div className="ui-card-header" style={{ marginBottom: '0.9rem' }}>
                <h4 className="ui-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <SearchCode size={16} style={{ color: 'var(--primary-blue)' }} /> Detected Clinical Features
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{cc_features.length} feature(s)</span>
              </div>

              {cc_features.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '1.5rem 0', textAlign: 'center' }}>
                  No structured features could be extracted (no symptom text on file).
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {cc_features.map((f, i) => (
                    <span key={i} className="feature-chip">{formatFeature(f)}</span>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--card-border)', background: '#f8fafc', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  <strong style={{ color: 'var(--text-title)' }}>How features are extracted:</strong><br />
                  Keyword matching maps symptom text to a binary vector (e.g. "crushing chest pain and dyspnea" →
                  <code style={{ fontSize: '0.75rem' }}> cc_chestpain, cc_shortnessofbreath</code>). A semantic
                  Sentence-BERT adapter is available for synonyms &amp; typos but disabled by default for zero-latency performance.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '1.25rem' }}>
            <div className="ui-card">
              <div className="ui-card-header" style={{ marginBottom: '1rem' }}>
                <h4 className="ui-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Brain size={16} style={{ color: 'var(--primary-blue)' }} /> ESI Recommendation
                </h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <div className="esi-result-square" style={{ width: '88px', height: '88px', background: ESI_COLORS[esiLevel], color: '#ffffff', borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 6px 16px rgba(0,0,0,0.12)' }}>
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.85 }}>ESI {esiLevel}</span>
                  <span style={{ fontSize: '2.6rem', fontWeight: 800 }}>{esiLevel}</span>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-title)' }}>{esiLabel}</div>
                <span className="status-pill waiting">{sourceLabel}</span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Model Confidence</span>
                  <strong style={{ color: isLowConfidence ? '#ef4444' : 'var(--text-title)' }}>
                    {confidenceScore !== null ? `${(confidenceScore * 100).toFixed(0)}%` : 'N/A'}
                  </strong>
                </div>
                <div className="conf-track">
                  <div className="conf-fill" style={{
                    width: `${confidenceScore !== null ? confidenceScore * 100 : 0}%`,
                    background: isLowConfidence ? '#ef4444' : 'var(--primary-blue)'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>Low</span>
                  <span style={{ color: isLowConfidence ? '#ef4444' : 'inherit' }}>Threshold {Math.round(confidenceThreshold * 100)}%</span>
                  <span>High</span>
                </div>
              </div>

              <div className="info-callout" style={{ marginBottom: '1rem', background: isLowConfidence ? '#fef2f2' : '#f8fafc', borderColor: isLowConfidence ? '#fecaca' : 'var(--card-border)' }}>
                <Info size={16} style={{ color: isLowConfidence ? '#dc2626' : 'var(--primary-blue)', flexShrink: 0 }} />
                <div style={{ fontSize: '0.78rem', lineHeight: '1.5' }}>
                  <strong>Uncertainty:</strong> {uncertaintyLabel}
                  {rawScore !== null && rawScore !== undefined && (
                    <span style={{ color: 'var(--text-muted)' }}> Raw score <strong style={{ fontFamily: 'var(--font-mono)' }}>{Number(rawScore).toFixed(2)}</strong> vs ESI boundaries at 1.5 / 2.5 / 3.5 / 4.5.</span>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Data Completeness</span>
                  <CompletenessBar vitals={vitals} width={90} />
                </div>
                {completeness.missing > 0 ? (
                  <p style={{ fontSize: '0.76rem', color: '#d97706', lineHeight: '1.5' }}>
                    Missing data increases uncertainty: <strong>{completeness.missingKeys.map((k) => VITAL_LABELS[k]).join(', ')}</strong> not recorded.
                  </p>
                ) : (
                  <p style={{ fontSize: '0.76rem', color: '#15803d' }}>All six vital signs recorded. Complete input vector.</p>
                )}
              </div>

              <div style={{ padding: '0.85rem 0.95rem', background: esiLevel === 1 || isLowConfidence ? '#fef2f2' : '#eff6ff', border: `1px solid ${esiLevel === 1 || isLowConfidence ? '#fecaca' : '#bfdbfe'}`, borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', fontWeight: 800, color: esiLevel === 1 || isLowConfidence ? '#991b1b' : '#1e3a8a', marginBottom: '0.25rem' }}>
                  <ShieldCheck size={15} /> SAFETY RECOMMENDATION
                </div>
                <p style={{ fontSize: '0.8rem', color: esiLevel === 1 || isLowConfidence ? '#7f1d1d' : '#1e3a8a', lineHeight: '1.5', margin: 0 }}>
                  {safetyRecommendation}
                </p>
              </div>
            </div>

            <div className="ui-card">
              <div className="ui-card-header" style={{ marginBottom: '0.9rem' }}>
                <h4 className="ui-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <TrendingUp size={16} style={{ color: 'var(--primary-blue)' }} /> Contributing Factors &amp; Explanation
                </h4>
              </div>
              <FactorBars factors={factors} />

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--card-border)' }}>
                <h5 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '0.5rem' }}>Why this score?</h5>
                {visit.reasons && visit.reasons.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {visit.reasons.map((r, i) => (
                      <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-body)', lineHeight: '1.45' }}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {source === 'bypass'
                      ? 'Immediate critical presentation — assigned ESI-1 via bypass protocol without model scoring.'
                      : source === 'hard_gate'
                        ? 'Vital signs triggered deterministic safety rules, bypassing the ML model (ESI ≤ 2 assigned automatically).'
                        : 'No explicit factor explanations were stored for this prediction.'}
                  </p>
                )}
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h5 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-title)' }}>Prediction Summary</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Raw Score</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-title)' }}>{visit.raw_ml_score !== null ? Number(visit.raw_ml_score).toFixed(2) : 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Predicted</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-title)' }}>ESI {visit.esi_predicted || 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Final (RN)</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-title)' }}>ESI {visit.esi_final || 'N/A'}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Prototype / simulated AI output — not clinically validated.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="ui-card">
            <div className="ui-card-header" style={{ marginBottom: '1rem' }}>
              <h4 className="ui-card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <Clock size={16} style={{ color: 'var(--primary-blue)' }} /> Clinical Timeline
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {audit_trail.length} audited event(s) · {vitals_history.length} vital reading(s)
              </span>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              {timelineStages.map((stage, idx) => {
                const Icon = stage.icon;
                const isLast = idx === timelineStages.length - 1;
                return (
                  <div key={stage.key} className={`ct-stage ${stage.state} ${isLast ? 'is-last' : ''}`}>
                    <div className="ct-dot"><Icon size={15} /></div>
                    <div className="ct-body">
                      <div className="ct-head">
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-title)' }}>{stage.label}</strong>
                        <span className="ct-time">
                          {stage.time ? new Date(stage.time).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div className="ct-note">{stage.note}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)' }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '0.5rem' }}>
                Detailed Audit Trail ({audit_trail.length} event(s))
              </h5>
              {audit_trail.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No reassessment, override, or workflow events recorded yet.
                </p>
              ) : (
                <div className="timeline" style={{ marginTop: '0.5rem' }}>
                  {audit_trail.map((log, idx) => {
                    const meta = actionMeta(log.action);
                    const Icon = meta.icon;
                    const isLast = idx === audit_trail.length - 1;
                    const detail = log.old_value && log.new_value && log.action === 'OVERRIDE'
                      ? `ESI ${log.old_value} → ESI ${log.new_value}`
                      : (log.old_value && log.new_value ? `${log.old_value} → ${log.new_value}` : null);
                    return (
                      <div key={idx} className={`timeline-item ${isLast ? 'last' : ''}`}>
                        <div className="timeline-marker" style={{ background: meta.color, borderColor: meta.bg }}>
                          <Icon size={15} color="#ffffff" />
                        </div>
                        <div className="timeline-body" style={{ background: meta.bg, borderLeft: `3px solid ${meta.color}` }}>
                          <div className="timeline-head">
                            <span className="status-pill" style={{ background: meta.color, color: '#ffffff' }}>{log.action}</span>
                            <span className="timeline-time">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</span>
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-title)', margin: '0.3rem 0 0.2rem' }}>
                            {detail || log.action.replace(/_/g, ' ')}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-body)', lineHeight: '1.45' }}>
                            {log.reason || 'Workflow event'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                            Clinician / Actor: <strong>{log.user_id || 'SYSTEM'}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {showAcceptModal && (
          <AcceptModal
            visitId={visit.visit_id}
            patientName={patient?.name}
            esiLevel={esiLevel}
            confidence={confidenceScore}
            onClose={() => setShowAcceptModal(false)}
            onSuccess={fetchVisitData}
          />
        )}

        {showOverrideModal && (
          <OverrideModal
            visitId={visit.visit_id}
            currentEsi={visit.esi_final}
            patientName={patient?.name}
            onClose={() => setShowOverrideModal(false)}
            onSuccess={fetchVisitData}
          />
        )}

        {showRevitalsModal && (
          <RevitalsModal
            visitId={visit.visit_id}
            patientName={patient?.name}
            baselineVitals={vitals}
            onClose={() => setShowRevitalsModal(false)}
            onSuccess={fetchVisitData}
          />
        )}
      </div>
    </>
  );
}
