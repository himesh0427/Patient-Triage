import React from 'react';
import { Baby, User, PersonStanding } from 'lucide-react';
import {
  pathwayOf,
  historyStatus,
  confidenceLevel,
  vitalsCompleteness,
  VITAL_LABELS,
} from '../services/clinical';

// Requirement #5: PEDIATRIC / ADULT / GERIATRIC pathways based on age
export function PathwayBadge({ age, showHint = false }) {
  const pathway = pathwayOf(age);
  const Icon = pathway.key === 'pediatric' ? Baby : pathway.key === 'geriatric' ? PersonStanding : User;
  return (
    <span className={`pathway-pill ${pathway.key}`} title={pathway.hint || pathway.range}>
      <Icon size={12} /> {pathway.label}
      {showHint && <span style={{ textTransform: 'none', fontWeight: 500, opacity: 0.85 }}>{pathway.range}</span>}
    </span>
  );
}

// Requirement #6: FIRST-TIME / LIMITED HISTORY / ESTABLISHED
export function HistoryBadge({ hasHistory, priorVisits, showNote = false }) {
  const h = historyStatus(hasHistory, priorVisits);
  return (
    <span className={`history-pill ${h.key}`} title={h.note}>
      {h.label}
      {showNote && <span style={{ textTransform: 'none', fontWeight: 500, opacity: 0.85 }}>{h.note}</span>}
    </span>
  );
}

// Requirement #1: confidence level
export function ConfidencePill({ confidence, threshold = 0.5, showPercent = true }) {
  const c = confidenceLevel(confidence, threshold);
  const toneClass = c.key === 'low' ? 'low' : c.key === 'high' ? 'high' : c.key === 'medium' ? 'medium' : 'muted';
  return (
    <span className={`conf-pill ${toneClass}`} title={`AI confidence${c.pct !== null ? ` ${c.pct}%` : ''}${c.key === 'low' ? ' — below institutional threshold, clinician review required' : ''}`}>
      {c.label}
    </span>
  );
}

// Requirement #1: safety status pill
export function SafetyPill({ status, showLabel = true }) {
  return (
    <span className={`safety-pill ${status?.tone || 'muted'}`}>
      {showLabel ? status?.label || 'UNKNOWN' : status?.label || 'UNKNOWN'}
    </span>
  );
}

// Requirement #6: data completeness of the vitals record
export function CompletenessBar({ vitals, width = 88 }) {
  const c = vitalsCompleteness(vitals);
  const color = c.level === 'complete' ? '#16a34a' : c.level === 'good' ? '#2563eb' : c.level === 'partial' ? '#d97706' : '#dc2626';
  const missingText = c.missing > 0 ? c.missingKeys.map((k) => VITAL_LABELS[k]).join(', ') : 'All vitals recorded';
  return (
    <div title={`Vitals recorded: ${c.present}/6 (${missingText})`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      <div className="completeness-bar" style={{ width }}>
        <div className="completeness-fill" style={{ width: `${c.pct}%`, background: color }} />
      </div>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {c.present}/6
      </span>
    </div>
  );
}
