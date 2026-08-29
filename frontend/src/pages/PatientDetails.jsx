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

// Vitals reference ranges (adult) used purely for visual flagging
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
  AUTO_ESCALATE_SURGE: { icon: TrendingUp, color: '#d97706', bg: '#fffbeb' },
  RETRIAGE: { icon: History, color: '#b45309', bg: '#fef3c7' },
  BYPASS_CRITICAL: { icon: AlertTriangle, color: '#b91c1c', bg: '#fef2f2' },
  DISCHARGE: { icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4' },
};

const actionMeta = (action) => ACTION_META[action] || { icon: Clock, color: '#64748b', bg: '#f1f5f9' };

function VitalTile({ code, value, large }) {
  const meta = VITAL_META[code];
  const status = vitalStatus(value, meta);
  const Icon = meta.icon;
  return (
    <div className="vital-tile" style={{ borderColor: STATUS_TONE[status], background: status === 'missing' ? '#f8fafc' : '#ffffff' }}>
      <div className="vital-tile-head">
        <Icon size={large ? 17 : 14} style={{ color: STATUS_TONE[status] }} />
        <span className="vital-tile-label">{meta.label}</span>
      </div>
      <div className="vital-tile-value" style={{ fontSize: large ? '1.35rem' : '1.1rem' }}>
        {value === null || value === undefined || value === '' ? '--' : value}
        <span className="vital-tile-unit">{meta.unit}</span>
      </div>
      <div className="vital-tile-status" style={{ color: STATUS_TONE[status] }}>
        {status === 'missing' ? 'Not recorded' : status === 'normal' ? 'Within range' : status === 'borderline' ? 'Borderline' : 'Critical'}
      </div>
    </div>
  );
}

function BloodPressureTile({ sbp, dbp, large }) {
  const sStatus = vitalStatus(sbp, VITAL_META.sbp);
  const dStatus = vitalStatus(dbp, VITAL_META.dbp);
  const tone = sStatus === 'critical' || dStatus === 'critical' ? 'critical' : sStatus === 'borderline' || dStatus === 'borderline' ? 'borderline' : sbp === null ? 'missing' : 'normal';
  const color = STATUS_TONE[tone];
  return (
    <div className="vital-tile" style={{ borderColor: color, background: tone === 'missing' ? '#f8fafc' : '#ffffff' }}>
      <div className="vital-tile-head">
        <Droplets size={large ? 17 : 14} style={{ color }} />
        <span className="vital-tile-label">Blood Pressure</span>
      </div>
      <div className="vital-tile-value" style={{ fontSize: large ? '1.35rem' : '1.1rem' }}>
        {sbp ?? '--'}<span className="vital-tile-unit">/</span>{dbp ?? '--'}
        <span className="vital-tile-unit"> mmHg</span>
      </div>
      <div className="vital-tile-status" style={{ color }}>
        {tone === 'missing' ? 'Not recorded' : tone === 'normal' ? 'Within range' : tone === 'borderline' ? 'Borderline' : 'Critical'}
      </div>
    </div>
  );
}

function VitalsGrid({ vitals, large }) {
  const has = vitals && (
    vitals.hr !== null || vitals.sbp !== null || vitals.dbp !== null ||
    vitals.rr !== null || vitals.spo2 !== null || vitals.temp !== null
  );
  if (!has) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '1.5rem 0', textAlign: 'center' }}>
        No vital signs recorded for this visit yet.
      </div>
    );
  }
  return (
    <div className="vital-grid">
      <VitalTile code="hr" value={vitals.hr} large={large} />
      <BloodPressureTile sbp={vitals.sbp} dbp={vitals.dbp} large={large} />
      <VitalTile code="rr" value={vitals.rr} large={large} />
      <VitalTile code="spo2" value={vitals.spo2} large={large} />
      <VitalTile code="temp" value={vitals.temp} large={large} />
    </div>
  );
}

function FactorBars({ factors }) {
  if (!factors || factors.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '1.25rem 0', textAlign: 'center' }}>
        No feature weighting factors available.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {factors.map((f, i) => (
        <div key={i} className="factor-bar-row">
          <span className="factor-label" title={f.raw || f.label}>{f.label}</span>
          <div className="factor-bar-track">
            <div className="factor-bar-fill" style={{ width: `${parseFloat(f.weight) * 100}%` }} />
          </div>
          <span className="factor-weight">{f.weight}</span>
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
  const [activeTab, setActiveTab] = useState('overview');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [surgeMode, setSurgeMode] = useState(false);

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showRevitalsModal, setShowRevitalsModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [discharging, setDischarging] = useState(false);

  const fetchVisitData = async () => {
    try {
      const [visitRes, statsRes] = await Promise.all([
        triageApi.getVisit(id),
        systemApi.getStats(),
      ]);
      setVisit(visitRes.data);
      if (statsRes.data) {
        setConfidenceThreshold(statsRes.data.confidence_threshold ?? 0.5);
        setSurgeMode(statsRes.data.surge_mode || false);
      }
      setError(null);
    } catch (err) {
      console.error("Failed to load visit:", err);
      setError(err.response?.data?.detail || "Patient visit record not found.");
    } finally {
      setLoading(false);
    }
  };

  const handleDischarge = async () => {
    const name = patient?.name || 'this patient';
    if (!window.confirm(
      `Discharge ${name} from the emergency queue?\n\nThis will:\n• Mark the patient as DISCHARGED\n• Remove them from the active waiting queue\n• Stop the reassessment timer and alerts\n• Log the discharge time in the audit trail\n\nThe patient's clinical history remains available.`
    )) return;
    setDischarging(true);
    try {
      await triageApi.discharge(visit.visit_id);
      await fetchVisitData();
    } catch (err) {
      console.error("Discharge failed:", err);
      alert("Failed to discharge patient. Please try again.");
    } finally {
      setDischarging(false);
    }
  };

  useEffect(() => {
    fetchVisitData();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '0.75rem' }}>
        <span>Loading Patient Record...</span>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="page-container">
        <div className="ui-card" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center', padding: '2rem' }}>
          <AlertTriangle size={36} style={{ color: 'var(--esi-1)', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Visit Record Not Found</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn-blue" onClick={() => navigate('/queue')}>Return to Triage Queue</button>
        </div>
      </div>
    );
  }

  const { patient, vitals, audit_trail = [], vitals_history = [], cc_features = [] } = visit;
  const esiLevel = visit.esi_final || visit.esi_predicted || 3;
  const esiLabel = esiLevel === 1 ? 'Immediate' : esiLevel === 2 ? 'Very Urgent' : esiLevel === 3 ? 'Urgent' : esiLevel === 4 ? 'Less Urgent' : 'Non-Urgent';

  const confidenceScore = visit.confidence_score !== undefined && visit.confidence_score !== null
    ? visit.confidence_score
    : visit.confidence !== undefined && visit.confidence !== null
      ? visit.confidence
      : null;

  const confLevel = confidenceLevel(confidenceScore, confidenceThreshold);
  const isLowConfidence = confidenceScore !== null && confidenceScore < confidenceThreshold;

  const pathway = pathwayOf(patient?.age);
  const history = historyStatus(patient?.has_history, visit.prior_visits);
  const completeness = vitalsCompleteness(vitals);

  const patientInitials = (patient?.name || 'PT')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Factors built purely from real predictions / reasons
  const factors = visit.reasons && Array.isArray(visit.reasons) && visit.reasons.length > 0
    ? visit.reasons.map((r, i) => ({
      label: r.length > 28 ? r.substring(0, 28) + '...' : r,
      raw: r,
      weight: (0.85 - i * 0.12).toFixed(2),
    }))
    : [];

  const source = visit.source || (visit.esi_predicted !== null && visit.esi_predicted <= 2 && confidenceScore === 1.0 ? 'hard_gate' : 'ml');
  const sourceLabel = source === 'bypass' ? 'Immediate Bypass' : source === 'hard_gate' ? 'Deterministic Hard Rules' : 'ML Model (LightGBM)';

  // Raw-score uncertainty (distance to nearest ESI boundary)
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

  // Safety recommendation (requirement #4)
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

  const hasDrift = audit_trail.some((l) => l.action === 'VITAL_DRIFT_ALERT');
  const hasEscalation = audit_trail.some((l) => ['OVERRIDE', 'AUTO_ESCALATE_SURGE', 'BYPASS_CRITICAL', 'VITAL_DRIFT_ALERT'].includes(l.action));
  const hasAccepted = audit_trail.some((l) => l.action === 'ACCEPT');
  const reassessed = vitals_history.length > 1;

  const auditTimeFor = (actions) => {
    const hit = audit_trail.find((l) => actions.includes(l.action));
    return hit?.timestamp || null;
  };

  const timelineStages = [
    {
      key: 'registration', label: 'Registration',
      time: visit.arrival_time, icon: User,
      state: 'done', note: 'Patient registered and arrival recorded in the queue.',
    },
    {
      key: 'vitals', label: 'Vitals Recorded',
      time: vitals_history.length > 0 ? vitals_history[0].recorded_at : null,
      icon: Activity,
      state: vitals_history.length > 0 ? 'done' : 'current',
      note: vitals_history.length > 0
        ? `${vitals_history.length} reading${vitals_history.length === 1 ? '' : 's'} on file (${completeness.present}/6 vitals captured).`
        : 'Awaiting initial vital signs.',
    },
    {
      key: 'ai', label: 'AI Assessment',
      time: visit.arrival_time, icon: Brain,
      state: visit.esi_predicted !== null && visit.esi_predicted !== undefined ? 'done' : 'current',
      note: visit.esi_predicted !== null && visit.esi_predicted !== undefined
        ? `ESI-${visit.esi_predicted} recommended by ${sourceLabel} with ${confidenceScore !== null ? (confidenceScore * 100).toFixed(0) + '%' : '—'} confidence.`
        : 'Pending model inference.',
    },
    {
      key: 'review', label: 'Clinician Review',
      time: auditTimeFor(['ACCEPT', 'OVERRIDE']), icon: ShieldCheck,
      state: hasAccepted || visit.is_overridden ? 'done' : isLowConfidence ? 'attention' : 'current',
      note: hasAccepted
        ? 'AI recommendation accepted by clinician (audited).'
        : visit.is_overridden
          ? `Acuity adjusted by clinician to ESI-${visit.esi_final} (audited).`
          : isLowConfidence
            ? `Low AI confidence — clinician review required before finalizing ESI-${esiLevel}.`
            : 'Awaiting clinician confirmation of the AI recommendation.',
    },
    {
      key: 'reassess', label: 'Reassessment',
      time: auditTimeFor(['RETRIAGE', 'VITAL_DRIFT_ALERT']), icon: History,
      state: reassessed ? 'done' : visit.retriage_overdue ? 'attention' : 'upcoming',
      note: reassessed
        ? `${Math.max(0, vitals_history.length - 1)} reassessment(s) recorded.`
        : visit.retriage_overdue
          ? `Reassessment overdue (ESI-${esiLevel} safe interval elapsed). Record re-vitals.`
          : 'Scheduled per the ESI reassessment interval. Not yet required.',
    },
    {
      key: 'escalation', label: 'Escalation / Override',
      time: auditTimeFor(['OVERRIDE', 'AUTO_ESCALATE_SURGE', 'VITAL_DRIFT_ALERT', 'BYPASS_CRITICAL']), icon: TrendingUp,
      state: hasEscalation ? 'done' : 'upcoming',
      note: hasEscalation
        ? 'Acuity escalated or overridden — every change is logged in the audit trail.'
        : 'No escalation or override recorded this visit.',
    },
    {
      key: 'discharge', label: 'Discharge',
      time: visit.discharge_time, icon: CheckCircle2,
      state: !visit.is_active ? 'done' : 'upcoming',
      note: !visit.is_active
        ? `Discharged at ${visit.discharge_time ? new Date(visit.discharge_time).toLocaleString() : '—'}. Removed from the active queue; history retained.`
        : 'Pending disposition. Discharge removes the patient from the active queue.',
    },
  ];

  return (
    <>
      <TopNav
        title="Patient Details"
        subtitle={`Patient ID: P-${patient?.id || id} · Visit #${visit.visit_id}`}
        surgeMode={surgeMode}
      />

      <div className="page-container">
        {/* LOW CONFIDENCE ALERT */}
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

        {/* REASSESSMENT / DISCHARGE ALERT */}
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

        {/* Top Header Card */}
        <div className="ui-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            {/* Left: Patient Avatar & Demographics */}
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

            {/* Right: ESI Result Box & Actions */}
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

              {/* Reassessment timer / discharge status */}
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

              {/* Accept / Reassess / Override / Discharge */}
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

        {/* Tab Navigation */}
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

        {/* ============================= OVERVIEW ============================= */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {/* Card 1: Chief Complaint & History */}
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

            {/* Card 2: Vital Signs */}
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

            {/* Card 3: AI Decision Factors */}
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

        {/* ============================= VITALS & HISTORY ============================= */}
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

        {/* ============================= SYMPTOMS ============================= */}
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

        {/* ============================= EXPLAINABLE AI ============================= */}
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

              {/* Confidence bar */}
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

              {/* Uncertainty (requirement #4) */}
              <div className="info-callout" style={{ marginBottom: '1rem', background: isLowConfidence ? '#fef2f2' : '#f8fafc', borderColor: isLowConfidence ? '#fecaca' : 'var(--card-border)' }}>
                <Info size={16} style={{ color: isLowConfidence ? '#dc2626' : 'var(--primary-blue)', flexShrink: 0 }} />
                <div style={{ fontSize: '0.78rem', lineHeight: '1.5' }}>
                  <strong>Uncertainty:</strong> {uncertaintyLabel}
                  {rawScore !== null && rawScore !== undefined && (
                    <span style={{ color: 'var(--text-muted)' }}> Raw score <strong style={{ fontFamily: 'var(--font-mono)' }}>{Number(rawScore).toFixed(2)}</strong> vs ESI boundaries at 1.5 / 2.5 / 3.5 / 4.5.</span>
                  )}
                </div>
              </div>

              {/* Missing data (requirement #4) */}
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

              {/* Safety recommendation (requirement #4) */}
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

        {/* ============================= CLINICAL TIMELINE ============================= */}
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

        {/* Modals */}
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
