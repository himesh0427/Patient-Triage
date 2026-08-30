import { useNavigate } from 'react-router-dom';

export const PATHWAYS = {
  pediatric: { key: 'pediatric', label: 'PEDIATRIC', range: 'Age < 18', hint: 'Age-specific vital thresholds apply' },
  adult: { key: 'adult', label: 'ADULT', range: '18–64' },
  geriatric: { key: 'geriatric', label: 'GERIATRIC', range: 'Age ≥ 65', hint: 'Fall / polypharmacy / fragility risk' },
};

export function pathwayOf(age) {
  const a = Number(age);
  if (Number.isFinite(a) && a < 18) return PATHWAYS.pediatric;
  if (Number.isFinite(a) && a >= 65) return PATHWAYS.geriatric;
  return PATHWAYS.adult;
}

export function historyStatus(hasHistory, priorVisits) {
  if (hasHistory) {
    const visits = Number(priorVisits) || 0;
    if (visits > 1) {
      return { key: 'established', label: 'ESTABLISHED', note: `${visits} prior visit(s) on file` };
    }
    return { key: 'limited', label: 'LIMITED HISTORY', note: '1 prior visit on file' };
  }
  return { key: 'first', label: 'FIRST-TIME', note: 'No prior records — current presentation only' };
}

export const VITAL_KEYS = ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'temp'];

export const VITAL_LABELS = {
  hr: 'Heart Rate',
  sbp: 'Systolic BP',
  dbp: 'Diastolic BP',
  rr: 'Resp Rate',
  spo2: 'SpO₂',
  temp: 'Temperature',
};

export function vitalsCompleteness(vitals) {
  if (!vitals) return { pct: 0, present: 0, missing: VITAL_KEYS.length, level: 'minimal', missingKeys: VITAL_KEYS };
  const presentKeys = VITAL_KEYS.filter(
    (k) => vitals[k] !== null && vitals[k] !== undefined && vitals[k] !== ''
  );
  const pct = Math.round((presentKeys.length / VITAL_KEYS.length) * 100);
  const level = pct >= 100 ? 'complete' : pct >= 67 ? 'good' : pct >= 34 ? 'partial' : 'minimal';
  return {
    pct,
    present: presentKeys.length,
    missing: VITAL_KEYS.length - presentKeys.length,
    level,
    missingKeys: VITAL_KEYS.filter((k) => !presentKeys.includes(k)),
  };
}

export function confidenceLevel(conf, threshold = 0.5) {
  if (conf === null || conf === undefined) {
    return { key: 'unknown', label: 'N/A', tone: 'muted', pct: null };
  }
  const pct = Math.round(conf * 100);
  if (conf < threshold) return { key: 'low', label: `${pct}% LOW`, tone: 'danger', pct };
  if (conf >= 0.8) return { key: 'high', label: `${pct}% HIGH`, tone: 'ok', pct };
  return { key: 'medium', label: `${pct}%`, tone: 'warn', pct };
}

export function safetyStatusOf(p, threshold = 0.5) {
  if (!p) return { key: 'unknown', label: 'Unknown', tone: 'muted' };
  const esi = Number(p.esi_level);
  if (esi === 1) return { key: 'critical', label: 'CRITICAL · Immediate', tone: 'critical' };
  if (p.drift || p.has_drift) return { key: 'drift', label: 'VITAL DETERIORATION', tone: 'critical' };
  if (p.retriage_overdue || p.retriage_needed) return { key: 'overdue', label: 'REASSESSMENT DUE', tone: 'warning' };
  const conf = p.confidence !== undefined ? p.confidence : p.confidence_score;
  if (conf !== null && conf !== undefined && conf < threshold) {
    return { key: 'lowconf', label: 'LOW CONFIDENCE', tone: 'amber' };
  }
  return { key: 'monitor', label: 'MONITORING', tone: 'ok' };
}

export function nextActionOf(p, threshold = 0.5) {
  if (!p) return { label: 'View Patient', action: 'View' };
  const esi = Number(p.esi_level);
  if (esi === 1) return { label: 'Immediate Resuscitation', action: 'View' };
  if (p.retriage_overdue || p.retriage_needed) return { label: 'Re-Vitals & Reassess', action: 'Re-Vitals' };
  const conf = p.confidence !== undefined ? p.confidence : p.confidence_score;
  if (conf !== null && conf !== undefined && conf < threshold) {
    return { label: 'Clinician Review', action: 'Review' };
  }
  return { label: 'Continue Monitoring', action: 'View' };
}

export function formatElapsed(sec) {
  if (sec === null || sec === undefined || Number.isNaN(sec) || sec < 60) return '0 min';
  const totalMin = Math.floor(sec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  return `${hours}h ${String(remMin).padStart(2, '0')}m`;
}

export function waitLabelFor(p, nowTime = Date.now()) {
  if (!p) return { text: '—', tone: 'muted' };
  const esi = Number(p.esi_level);
  if (esi === 1) return { text: 'Immediate', tone: 'critical' };

  let sec = p.wait_time_seconds ?? 0;
  if (p.arrival_time) {
    const arrivalMs = new Date(p.arrival_time).getTime();
    if (!Number.isNaN(arrivalMs)) sec = Math.max(0, Math.floor((nowTime - arrivalMs) / 1000));
  }
  return { text: formatElapsed(sec), tone: 'body' };
}

export function formatInterval(sec) {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return '—';
  const totalMin = Math.round(sec / 60);
  if (totalMin < 1) return `${sec}s`;
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function intervalForEsi(thresholds, esi) {
  if (!thresholds) return null;
  return thresholds[String(esi)] ?? thresholds[esi] ?? null;
}

export function dueLabelFor(p) {
  if (!p) return { text: '—', tone: 'muted' };
  if (Number(p.esi_level) === 1) return { text: 'Immediate', tone: 'critical' };
  if (p.retriage_overdue) return { text: 'OVERDUE', tone: 'critical' };
  const sec = p.reassessment_due_in_seconds;
  if (sec === null || sec === undefined) return { text: '—', tone: 'muted' };
  return { text: formatElapsed(sec), tone: 'body' };
}

export const ALERT_META = {
  CRITICAL: {
    label: 'CRITICAL',
    tone: 'critical',
    title: 'Critical — Immediate Care',
    icon: 'AlertTriangle',
    defaultAction: 'View Patient',
  },
  REASSESSMENT_OVERDUE: {
    label: 'REASSESSMENT OVERDUE',
    tone: 'warning',
    title: 'Reassessment Overdue',
    icon: 'Clock',
    defaultAction: 'Re-Vitals',
  },
  LOW_CONFIDENCE: {
    label: 'LOW CONFIDENCE',
    tone: 'amber',
    title: 'Low-Confidence AI Recommendation',
    icon: 'ShieldAlert',
    defaultAction: 'Review & Override',
  },
  VITAL_DETERIORATION: {
    label: 'VITAL DETERIORATION',
    tone: 'critical',
    title: 'Vital Deterioration Detected',
    icon: 'Activity',
    defaultAction: 'Re-Vitals',
  },
  SURGE: {
    label: 'SURGE',
    tone: 'critical',
    title: '3× Surge Protocol Active',
    icon: 'Radio',
    defaultAction: 'Manage Queue',
  },
};

export function alertMeta(type) {
  return (
    ALERT_META[type] || {
      label: type || 'ALERT',
      tone: 'info',
      title: type || 'Alert',
      icon: 'Bell',
      defaultAction: 'View Patient',
    }
  );
}

export function useAlertAction() {
  const navigate = useNavigate();
  return (action, alertOrPatient) => {
    if (action === 'Manage Queue') return navigate('/queue');
    if (action === 'Re-Vitals' || action === 'Review & Override' || action === 'View Patient') {
      return navigate(`/visit/${alertOrPatient?.visit_id ?? alertOrPatient?.id}`);
    }
    return navigate(`/visit/${alertOrPatient?.visit_id ?? alertOrPatient?.id}`);
  };
}
