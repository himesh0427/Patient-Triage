import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { systemApi, triageApi, alertsApi } from '../services/api';
import TopNav from '../components/TopNav';
import EsiSquareBadge from '../components/EsiSquareBadge';
import SurgeBanner from '../components/SurgeBanner';
import { PathwayBadge, ConfidencePill, SafetyPill } from '../components/ClinicalBadges';
import {
  waitLabelFor,
  dueLabelFor,
  formatInterval,
  intervalForEsi,
  safetyStatusOf,
  nextActionOf,
  ALERT_META,
} from '../services/clinical';
import { ArrowRight, CheckCircle2, ShieldAlert, Activity, FlaskConical, Info } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [alertsData, setAlertsData] = useState({ alerts: [], counts: {}, total: 0 });
  const [thresholds, setThresholds] = useState(null);
  const [surgeMode, setSurgeMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [nowTime, setNowTime] = useState(Date.now());

  const loadDashboardData = async () => {
    try {
      const [statsRes, queueRes, alertsRes] = await Promise.all([
        systemApi.getStats(),
        triageApi.getQueue(),
        alertsApi.getAll(),
      ]);
      setStats(statsRes.data);
      setQueue(queueRes.data.queue || []);
      setThresholds(queueRes.data.reassessment_thresholds || null);
      setSurgeMode(statsRes.data.surge_mode || queueRes.data.surge_mode || false);
      setAlertsData(alertsRes.data || { alerts: [], counts: {}, total: 0 });
      setNowTime(Date.now());
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error("Dashboard load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const esiDist = stats?.esi_distribution || {
    esi_1: queue.filter((p) => p.esi_level === 1).length,
    esi_2: queue.filter((p) => p.esi_level === 2).length,
    esi_3: queue.filter((p) => p.esi_level === 3).length,
    esi_4: queue.filter((p) => p.esi_level === 4).length,
    esi_5: queue.filter((p) => p.esi_level === 5).length,
  };
  const totalInQueue = stats?.total_active ?? queue.length;
  const counts = alertsData.counts || {};
  const confidenceThreshold = stats?.confidence_threshold || 0.5;

  const safetyTiles = [
    {
      key: 'critical',
      label: 'Critical (ESI-1)',
      value: counts.critical ?? esiDist.esi_1,
      tone: 'critical',
      note: 'Immediate care required',
    },
    {
      key: 'overdue',
      label: 'Reassessment Overdue',
      value: counts.reassessment_overdue ?? stats?.retriage_needed,
      tone: 'warning',
      note: 'Safe interval elapsed',
    },
    {
      key: 'deterioration',
      label: 'Vital Deterioration',
      value: counts.vital_deterioration ?? 0,
      tone: 'critical',
      note: 'Vital sign drift detected',
    },
    {
      key: 'lowconf',
      label: 'Low Confidence',
      value: counts.low_confidence ?? stats?.low_confidence_active,
      tone: 'amber',
      note: `AI below ${Math.round(confidenceThreshold * 100)}% threshold`,
    },
  ];

  const alertList = alertsData.alerts || [];
  const topPatients = queue.slice(0, 6);

  return (
    <>
      <TopNav
        title="Triage Dashboard"
        subtitle="Clinical safety overview · AI-assisted triage decision support"
        hospitalType={stats?.hospital_type}
        surgeMode={surgeMode}
        alertsCount={alertList.length}
      />

      <div className="page-container">
        <div className="esi-cards-grid">
          <div className="esi-metric-card esi-1">
            <div className="esi-metric-header"><span className="esi-metric-badge esi-1">ESI 1</span></div>
            <div className="esi-metric-count esi-1">{esiDist.esi_1 || 0}</div>
            <div className="esi-metric-sub">Immediate</div>
          </div>
          <div className="esi-metric-card esi-2">
            <div className="esi-metric-header"><span className="esi-metric-badge esi-2">ESI 2</span></div>
            <div className="esi-metric-count esi-2">{esiDist.esi_2 || 0}</div>
            <div className="esi-metric-sub">Very Urgent</div>
          </div>
          <div className="esi-metric-card esi-3">
            <div className="esi-metric-header"><span className="esi-metric-badge esi-3">ESI 3</span></div>
            <div className="esi-metric-count esi-3">{esiDist.esi_3 || 0}</div>
            <div className="esi-metric-sub">Urgent</div>
          </div>
          <div className="esi-metric-card esi-4">
            <div className="esi-metric-header"><span className="esi-metric-badge esi-4">ESI 4</span></div>
            <div className="esi-metric-count esi-4">{esiDist.esi_4 || 0}</div>
            <div className="esi-metric-sub">Less Urgent</div>
          </div>
          <div className="esi-metric-card esi-5">
            <div className="esi-metric-header"><span className="esi-metric-badge esi-5">ESI 5</span></div>
            <div className="esi-metric-count esi-5">{esiDist.esi_5 || 0}</div>
            <div className="esi-metric-sub">Non-Urgent</div>
          </div>
          <div className="esi-metric-card total">
            <div className="esi-metric-header"><span className="esi-metric-badge total">Total Patients</span></div>
            <div className="esi-metric-count" style={{ color: 'var(--text-title)' }}>{totalInQueue}</div>
            <div className="esi-metric-sub">In Queue</div>
          </div>
        </div>

        <SurgeBanner active={surgeMode} />

        <div className="ui-card" style={{ marginBottom: '1.5rem', borderTop: '3px solid #b91c1c' }}>
          <div className="ui-card-header" style={{ marginBottom: '0.9rem' }}>
            <div>
              <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} style={{ color: '#b91c1c' }} /> Clinical Safety Status
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Active safety flags across the waiting room · driven by live reassessment timers and AI confidence
              </p>
            </div>
            <Link to="/alerts" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              View All Alerts →
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '0.9rem' }}>
            {safetyTiles.map((t) => (
              <div
                key={t.key}
                style={{
                  background: t.tone === 'critical' ? '#fef2f2' : t.tone === 'warning' ? '#fff7ed' : t.tone === 'amber' ? '#fefce8' : '#f8fafc',
                  border: `1px solid ${t.tone === 'critical' ? '#fecaca' : t.tone === 'warning' ? '#fed7aa' : t.tone === 'amber' ? '#fef08a' : '#e2e8f0'}`,
                  borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem',
                }}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)' }}>
                  {t.label}
                </div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, lineHeight: 1.1, margin: '0.2rem 0', color: t.tone === 'critical' ? '#b91c1c' : t.tone === 'warning' ? '#c2410c' : t.tone === 'amber' ? '#a16207' : 'var(--text-title)' }}>
                  {t.value ?? 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--text-body)', flexWrap: 'wrap' }}>
            <Info size={15} style={{ color: 'var(--primary-blue)', flexShrink: 0 }} />
            <span>
              {totalInQueue} patients in queue ·{' '}
              <strong style={{ color: counts.critical ? '#b91c1c' : 'var(--text-title)' }}>
                {counts.critical ?? esiDist.esi_1} require immediate care
              </strong>{' '}
              · {counts.reassessment_overdue ?? 0} overdue for reassessment ·{' '}
              {counts.low_confidence ?? 0} AI recommendations below the confidence floor.
              AI is a decision-support tool; final acuity is always confirmed by a clinician.
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="ui-card">
            <div className="ui-card-header">
              <h3 className="ui-card-title">Live Queue Overview</h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Sorted by ESI acuity
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="clean-table">
                <thead>
                  <tr>
                    <th>Acuity</th>
                    <th>Patient</th>
                    <th>Demographics</th>
                    <th>Wait Time</th>
                    <th>Reassessment Interval</th>
                    <th>Due In</th>
                    <th>Safety Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && topPatients.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Loading clinical queue...
                      </td>
                    </tr>
                  ) : topPatients.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No patients currently waiting in triage queue.
                      </td>
                    </tr>
                  ) : (
                    topPatients.map((p) => {
                      const wait = waitLabelFor(p, nowTime);
                      const due = dueLabelFor(p);
                      const status = safetyStatusOf(p, confidenceThreshold);
                      const next = nextActionOf(p, confidenceThreshold);
                      const intervalSec = intervalForEsi(thresholds, p.esi_level);

                      return (
                        <tr
                          key={p.visit_id}
                          className="clickable-row"
                          onClick={() => navigate(`/visit/${p.visit_id}`)}
                        >
                          <td>
                            <EsiSquareBadge level={p.esi_level} />
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: 'var(--text-title)' }}>{p.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Visit #{p.visit_id}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span>{p.age}y · {p.gender?.[0] || '—'}</span>
                              <PathwayBadge age={p.age} />
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                            {wait.text}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {Number(p.esi_level) === 1 ? 'Immediate' : formatInterval(intervalSec)}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                            <span style={{ color: due.tone === 'critical' ? '#dc2626' : 'inherit', fontWeight: due.tone === 'critical' ? 700 : 500 }}>
                              {due.text}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <SafetyPill status={status} />
                              <ConfidencePill confidence={p.confidence} threshold={confidenceThreshold} />
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-white"
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/visit/${p.visit_id}`);
                              }}
                            >
                              {next.action} →
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--card-border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Last updated: {lastUpdated}</span>
              <Link to="/queue" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                View Full Queue →
              </Link>
            </div>
          </div>

          <div className="ui-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div>
              <div className="ui-card-header" style={{ marginBottom: '0.85rem' }}>
                <h3 className="ui-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                  <FlaskConical size={17} style={{ color: '#0284c7', flexShrink: 0 }} /> AI Snapshot
                </h3>
              </div>

              <div style={{ padding: '0.75rem 0.9rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                <Info size={16} style={{ color: '#0369a1', flexShrink: 0, marginTop: '1px' }} />
                <span style={{ fontSize: '0.75rem', color: '#075985', lineHeight: '1.5' }}>
                  <strong>Prototype / simulated metrics.</strong> This system is not clinically validated
                  and must not be relied on for real patient care decisions. All recommendations require
                  clinician review.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingBottom: '0.55rem', borderBottom: '1px solid var(--card-border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Active queue</span>
                  <strong style={{ color: 'var(--text-title)' }}>{totalInQueue} patients</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingBottom: '0.55rem', borderBottom: '1px solid var(--card-border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Predictions below confidence floor</span>
                  <strong style={{ color: counts.low_confidence ? '#a16207' : 'var(--text-title)' }}>{counts.low_confidence ?? 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingBottom: '0.55rem', borderBottom: '1px solid var(--card-border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Clinician overrides logged</span>
                  <strong style={{ color: 'var(--text-title)' }}>{stats?.overrides_logged ?? 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Vital-drift alerts</span>
                  <strong style={{ color: counts.vital_deterioration ? '#b91c1c' : 'var(--text-title)' }}>{counts.vital_deterioration ?? 0}</strong>
                </div>
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--card-border)', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                <Activity size={14} style={{ color: 'var(--primary-blue)', marginRight: '0.35rem', verticalAlign: '-2px' }} />
                Continuous monitoring: every prediction is paired with an uncertainty score and a
                reassessment deadline. Reassessments and overrides are audited.
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--card-border)' }}>
              <Link to="/reports" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-blue)', textDecoration: 'none' }}>
                View Prototype Model Details →
              </Link>
            </div>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card-header" style={{ marginBottom: '0.75rem' }}>
            <h3 className="ui-card-title">Alerts &amp; Notifications</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{alertList.length} active</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {alertList.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
                <span>No critical escalations detected. All patients within safety parameters.</span>
              </div>
            )}

            {alertList.slice(0, 5).map((a) => {
              const meta = ALERT_META[a.type] || { tone: 'warning', label: a.type };
              const bg = a.type === 'SURGE'
                ? '#7f1d1d'
                : meta.tone === 'critical'
                  ? '#fef2f2'
                  : meta.tone === 'warning'
                    ? '#fff7ed'
                    : '#fefce8';
              const border = a.type === 'SURGE' ? '#b91c1c' : meta.tone === 'critical' ? '#fecaca' : meta.tone === 'warning' ? '#fed7aa' : '#fef08a';
              const textColor = a.type === 'SURGE' ? '#ffffff' : meta.tone === 'critical' ? '#7f1d1d' : meta.tone === 'warning' ? '#9a3412' : '#713f12';
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                    background: bg, border: `1px solid ${border}`, padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.type === 'SURGE' ? '#f87171' : meta.tone === 'critical' ? '#ef4444' : meta.tone === 'warning' ? '#f97316' : '#eab308', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: '0.88rem', color: textColor, display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{ opacity: 0.9, fontSize: '0.7rem', letterSpacing: '0.04em' }}>{meta.label}</span>
                        {a.title}
                      </strong>
                      <p style={{ fontSize: '0.78rem', color: textColor, opacity: 0.9, marginTop: '0.15rem' }}>{a.message}</p>
                    </div>
                  </div>
                  <button
                    className="btn"
                    style={{ flexShrink: 0, padding: '0.4rem 0.9rem', fontSize: '0.78rem', fontWeight: 700, background: a.type === 'SURGE' ? '#ffffff' : '#ffffff', color: '#334155', border: '1px solid #cbd5e1' }}
                    onClick={() => {
                      if (a.type === 'SURGE') navigate('/queue');
                      else navigate(`/visit/${a.visit_id}`);
                    }}
                  >
                    {a.action}
                  </button>
                </div>
              );
            })}

            {alertList.length > 5 && (
              <Link to="/alerts" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                View all {alertList.length} alerts <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
