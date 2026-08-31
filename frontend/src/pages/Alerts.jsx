import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { alertsApi, systemApi, triageApi } from '../services/api';
import TopNav from '../components/TopNav';
import EsiSquareBadge from '../components/EsiSquareBadge';
import SurgeBanner from '../components/SurgeBanner';
import { PathwayBadge } from '../components/ClinicalBadges';
import { alertMeta } from '../services/clinical';
import {
  Bell, AlertTriangle, Activity, CheckCircle2, ShieldAlert, Radio,
  Clock, RefreshCw, ArrowRight,
} from 'lucide-react';

const ICONS = { AlertTriangle, Activity, ShieldAlert, Radio, Clock, Bell };

const TONE_STYLE = {
  critical: { bg: '#fef2f2', border: '#fecaca', text: '#7f1d1d', chipBg: '#dc2626', chipText: '#ffffff' },
  warning: { bg: '#fff7ed', border: '#fed7aa', text: '#7c2d12', chipBg: '#f97316', chipText: '#ffffff' },
  amber: { bg: '#fefce8', border: '#fef08a', text: '#713f12', chipBg: '#eab308', chipText: '#422006' },
  info: { bg: '#f8fafc', border: '#cbd5e1', text: '#334155', chipBg: '#64748b', chipText: '#ffffff' },
};

export default function Alerts() {
  const navigate = useNavigate();
  const [alertsData, setAlertsData] = useState({ alerts: [], counts: {}, total: 0 });
  const [surgeMode, setSurgeMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const fetchData = async () => {
    try {
      const [alertsRes, statsRes] = await Promise.all([
        alertsApi.getAll(),
        systemApi.getStats(),
      ]);
      setAlertsData(alertsRes.data || { alerts: [], counts: {}, total: 0 });
      setSurgeMode(statsRes.data?.surge_mode || alertsRes.data?.surge_mode || false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const counts = alertsData.counts || {};
  const allAlerts = alertsData.alerts || [];

  const filterOptions = [
    { key: 'ALL', label: 'All', value: allAlerts.length },
    { key: 'CRITICAL', label: 'Critical', value: counts.critical ?? 0 },
    { key: 'REASSESSMENT_OVERDUE', label: 'Reassessment Overdue', value: counts.reassessment_overdue ?? 0 },
    { key: 'LOW_CONFIDENCE', label: 'Low Confidence', value: counts.low_confidence ?? 0 },
    { key: 'VITAL_DETERIORATION', label: 'Vital Deterioration', value: counts.vital_deterioration ?? 0 },
    { key: 'SURGE', label: 'Surge', value: counts.surge ?? 0 },
  ];

  const filtered = filter === 'ALL' ? allAlerts : allAlerts.filter((a) => a.type === filter);

  return (
    <>
      <TopNav
        title="Clinical Alerts & Safety Warnings"
        subtitle="Consolidated safety alerts · critical, reassessment, confidence & deterioration"
        alertsCount={allAlerts.length}
        surgeMode={surgeMode}
      />

      <div className="page-container">
        <SurgeBanner active={surgeMode} />

        <div className="filter-chip-group" style={{ marginBottom: '1.25rem' }}>
          {filterOptions.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`filter-chip ${filter === o.key ? 'active' : ''}`}
              onClick={() => setFilter(o.key)}
            >
              {o.label} ({o.value})
            </button>
          ))}
          <button className="btn-white" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }} onClick={fetchData}>
            <RefreshCw size={13} className={loading ? 'pulse-alert' : ''} /> Refresh
          </button>
        </div>

        {loading && allAlerts.length === 0 ? (
          <div className="ui-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
            Loading active alerts...
          </div>
        ) : filtered.length === 0 ? (
          <div className="ui-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem' }}>
            <CheckCircle2 size={22} style={{ color: '#22c55e' }} />
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-title)' }}>No active alerts in this category</strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                All patients are within their safety parameters for this alert type.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {filtered.map((a) => {
              const meta = alertMeta(a.type);
              const tone = TONE_STYLE[meta.tone] || TONE_STYLE.info;
              const Icon = ICONS[meta.icon] || Bell;
              const isSurge = a.type === 'SURGE';
              return (
                <div
                  key={a.id}
                  className="ui-card"
                  style={{
                    borderLeft: `4px solid ${tone.chipBg}`,
                    background: isSurge ? '#7f1d1d' : '#ffffff',
                    borderColor: isSurge ? '#7f1d1d' : 'var(--card-border)',
                    padding: '1rem 1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '8px', flexShrink: 0,
                        background: isSurge ? '#ef4444' : tone.chipBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={19} color={isSurge ? '#ffffff' : tone.chipText} />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <span
                            style={{
                              fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.05em',
                              padding: '2px 8px', borderRadius: '4px',
                              background: isSurge ? 'rgba(255,255,255,0.18)' : tone.chipBg,
                              color: isSurge ? '#ffffff' : tone.chipText,
                            }}
                          >
                            {meta.label}
                          </span>
                          <strong style={{ fontSize: '0.95rem', color: isSurge ? '#ffffff' : 'var(--text-title)' }}>
                            {a.title}
                          </strong>
                        </div>

                        <p style={{ fontSize: '0.82rem', color: isSurge ? '#fecaca' : 'var(--text-body)', lineHeight: '1.5' }}>
                          {a.message}
                        </p>

                        {!isSurge && a.patient_name && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            <span className="status-pill waiting" style={{ fontSize: '0.7rem' }}>{a.patient_name}</span>
                            <EsiSquareBadge level={a.esi_level} />
                            <PathwayBadge age={a.age} />
                            {a.esi_level === 1 && (
                              <span className="status-pill discharged" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                                Requires immediate care
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.7rem', color: isSurge ? '#fecaca' : 'var(--text-light)', fontFamily: 'var(--font-mono)' }}>
                        {a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      <button
                        className="btn"
                        style={{
                          padding: '0.45rem 0.95rem', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap',
                          background: isSurge ? '#ffffff' : '#ffffff', color: '#334155', border: '1px solid #cbd5e1',
                        }}
                        onClick={() => {
                          if (a.action === 'Manage Queue') navigate('/queue');
                          else navigate(`/visit/${a.visit_id}`);
                        }}
                      >
                        {a.action} <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="info-callout" style={{ marginTop: '1.25rem' }}>
          <ShieldAlert size={16} style={{ color: 'var(--primary-blue)', flexShrink: 0 }} />
          <span>
            Alerts are generated from live reassessment timers, AI confidence scores, and the clinical
            audit trail. <strong>AI recommendations are prototype/simulated output — always confirm with
            clinician assessment.</strong> Reassessment and override actions are logged permanently.
          </span>
        </div>
      </div>
    </>
  );
}
