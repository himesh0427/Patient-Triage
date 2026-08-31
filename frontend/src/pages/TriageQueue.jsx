import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { triageApi, systemApi, alertsApi } from '../services/api';
import TopNav from '../components/TopNav';
import EsiSquareBadge from '../components/EsiSquareBadge';
import SurgeBanner from '../components/SurgeBanner';
import { PathwayBadge, HistoryBadge, ConfidencePill, SafetyPill, CompletenessBar } from '../components/ClinicalBadges';
import {
  waitLabelFor,
  dueLabelFor,
  formatInterval,
  intervalForEsi,
  safetyStatusOf,
  nextActionOf,
  pathwayOf,
} from '../services/clinical';
import { RefreshCw } from 'lucide-react';

export default function TriageQueue() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [pathwayFilter, setPathwayFilter] = useState('ALL');
  const [safetyFilter, setSafetyFilter] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nowTime, setNowTime] = useState(Date.now());
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [alertTotal, setAlertTotal] = useState(0);

  const fetchQueueData = async () => {
    try {
      const [queueRes, statsRes, alertsRes] = await Promise.all([
        triageApi.getQueue(),
        systemApi.getStats(),
        alertsApi.getAll(),
      ]);
      setData(queueRes.data);
      setStats(statsRes.data);
      setAlertTotal(alertsRes.data?.total || 0);
      setNowTime(Date.now());
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error("Failed to fetch queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchQueueData, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const queueList = data?.queue || [];
  const thresholds = data?.reassessment_thresholds || null;
  const surgeMode = stats?.surge_mode || data?.surge_mode || false;
  const confidenceThreshold = stats?.confidence_threshold ?? data?.confidence_threshold ?? 0.5;
  const totalCount = queueList.length;

  const esiDist = {
    esi_1: queueList.filter((p) => p.esi_level === 1).length,
    esi_2: queueList.filter((p) => p.esi_level === 2).length,
    esi_3: queueList.filter((p) => p.esi_level === 3).length,
    esi_4: queueList.filter((p) => p.esi_level === 4).length,
    esi_5: queueList.filter((p) => p.esi_level === 5).length,
  };

  const filteredQueue = queueList.filter((p) => {
    if (activeFilter !== 'ALL' && p.esi_level?.toString() !== activeFilter) return false;
    if (pathwayFilter !== 'ALL' && pathwayOf(p.patient_age).key !== pathwayFilter) return false;
    if (safetyFilter !== 'ALL') {
      const s = safetyStatusOf(p, confidenceThreshold).key;
      if (safetyFilter === 'CRITICAL' && s !== 'critical') return false;
      if (safetyFilter === 'OVERDUE' && s !== 'overdue') return false;
      if (safetyFilter === 'LOWCONF' && s !== 'lowconf') return false;
      if (safetyFilter === 'OK' && !['monitor', 'ok'].includes(s)) return false;
    }
    return true;
  });

  return (
    <>
      <TopNav
        title="Live Queue"
        subtitle="Safety-focused queue · ESI acuity, reassessment status & confidence"
        hospitalType={data?.hospital_type}
        surgeMode={surgeMode}
        alertsCount={alertTotal}
      />

      <div className="page-container">
        <SurgeBanner active={surgeMode} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="filter-chip-group">
              <button type="button" className={`filter-chip ${activeFilter === 'ALL' ? 'active' : ''}`} onClick={() => setActiveFilter('ALL')}>All ({totalCount})</button>
              <button type="button" className={`filter-chip ${activeFilter === '1' ? 'active' : ''}`} onClick={() => setActiveFilter('1')}>ESI 1 ({esiDist.esi_1})</button>
              <button type="button" className={`filter-chip ${activeFilter === '2' ? 'active' : ''}`} onClick={() => setActiveFilter('2')}>ESI 2 ({esiDist.esi_2})</button>
              <button type="button" className={`filter-chip ${activeFilter === '3' ? 'active' : ''}`} onClick={() => setActiveFilter('3')}>ESI 3 ({esiDist.esi_3})</button>
              <button type="button" className={`filter-chip ${activeFilter === '4' ? 'active' : ''}`} onClick={() => setActiveFilter('4')}>ESI 4 ({esiDist.esi_4})</button>
              <button type="button" className={`filter-chip ${activeFilter === '5' ? 'active' : ''}`} onClick={() => setActiveFilter('5')}>ESI 5 ({esiDist.esi_5})</button>
            </div>
            <div className="filter-chip-group">
              <button type="button" className={`filter-chip ${pathwayFilter === 'ALL' ? 'active' : ''}`} onClick={() => setPathwayFilter('ALL')}>All Pathways</button>
              <button type="button" className={`filter-chip ${pathwayFilter === 'pediatric' ? 'active' : ''}`} onClick={() => setPathwayFilter('pediatric')}>Pediatric</button>
              <button type="button" className={`filter-chip ${pathwayFilter === 'adult' ? 'active' : ''}`} onClick={() => setPathwayFilter('adult')}>Adult</button>
              <button type="button" className={`filter-chip ${pathwayFilter === 'geriatric' ? 'active' : ''}`} onClick={() => setPathwayFilter('geriatric')}>Geriatric</button>
            </div>
            <div className="filter-chip-group">
              <button type="button" className={`filter-chip ${safetyFilter === 'ALL' ? 'active' : ''}`} onClick={() => setSafetyFilter('ALL')}>All Safety</button>
              <button type="button" className={`filter-chip ${safetyFilter === 'CRITICAL' ? 'active' : ''}`} onClick={() => setSafetyFilter('CRITICAL')}>Critical</button>
              <button type="button" className={`filter-chip ${safetyFilter === 'OVERDUE' ? 'active' : ''}`} onClick={() => setSafetyFilter('OVERDUE')}>Reassess Due</button>
              <button type="button" className={`filter-chip ${safetyFilter === 'LOWCONF' ? 'active' : ''}`} onClick={() => setSafetyFilter('LOWCONF')}>Low Confidence</button>
              <button type="button" className={`filter-chip ${safetyFilter === 'OK' ? 'active' : ''}`} onClick={() => setSafetyFilter('OK')}>Monitoring</button>
            </div>
          </div>

          <button className="btn-white" style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }} onClick={fetchQueueData}>
            <RefreshCw size={14} className={loading ? 'pulse-alert' : ''} /> Refresh
          </button>
        </div>

        <div className="ui-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Pathway / History</th>
                  <th>ESI</th>
                  <th>Chief Complaint</th>
                  <th>Wait Time</th>
                  <th>Last Reassess</th>
                  <th>Safe Interval</th>
                  <th>Due / Overdue</th>
                  <th>Confidence</th>
                  <th>Vitals</th>
                  <th>Safety Status</th>
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan="12" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No active patients match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((p, index) => {
                    const safety = safetyStatusOf(p, confidenceThreshold);
                    const action = nextActionOf(p, confidenceThreshold);
                    const intervalSec = intervalForEsi(thresholds, p.esi_level);
                    const pathway = pathwayOf(p.patient_age);
                    return (
                      <tr
                        key={p.queue_id || p.visit_id || index}
                        style={{ cursor: 'pointer', background: safety.key === 'critical' && p.esi_level === 1 ? '#fef2f2' : undefined }}
                        onClick={() => navigate(`/visit/${p.visit_id}`)}
                      >
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-title)' }}>{p.patient_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            P-{p.patient_id} · Age {p.patient_age ?? '—'}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                            <PathwayBadge age={p.patient_age} />
                            <HistoryBadge hasHistory={p.has_history ?? false} priorVisits={p.prior_visits ?? 0} />
                          </div>
                        </td>
                        <td><EsiSquareBadge level={p.esi_level} /></td>
                        <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.chief_complaint || p.symptom_text || 'Emergency Presentation'}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: p.esi_level === 1 ? '#b91c1c' : 'var(--text-title)' }}>
                            {waitLabelFor(p, nowTime).text}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {p.last_retriage_at ? new Date(p.last_retriage_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {intervalSec !== null && intervalSec !== undefined ? formatInterval(intervalSec) : '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.78rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
                              color: p.retriage_overdue ? '#b91c1c' : p.esi_level === 1 ? '#b91c1c' : 'var(--text-title)',
                            }}
                          >
                            {dueLabelFor(p).text}
                          </span>
                        </td>
                        <td><ConfidencePill confidence={p.confidence} threshold={confidenceThreshold} /></td>
                        <td><CompletenessBar vitals={p.vitals} /></td>
                        <td><SafetyPill status={safety} /></td>
                        <td>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: action.action === 'Re-Vitals' ? '#c2410c' : 'var(--primary-blue)', whiteSpace: 'nowrap' }}>
                            {action.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
              Last updated: {lastUpdated}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-title)', fontWeight: 500 }}>
              <span>Auto-refresh:</span>
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{
                  background: autoRefresh ? '#22c55e' : '#cbd5e1',
                  border: 'none',
                  borderRadius: '9999px',
                  width: '36px', height: '20px',
                  position: 'relative', cursor: 'pointer',
                  transition: 'all 0.2s ease', padding: '2px'
                }}
              >
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%', background: '#ffffff',
                  transform: autoRefresh ? 'translateX(16px)' : 'translateX(0)', transition: 'all 0.2s ease'
                }} />
              </button>
              <span style={{ fontWeight: 600, color: autoRefresh ? '#15803d' : 'var(--text-muted)' }}>
                {autoRefresh ? 'On' : 'Off'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
