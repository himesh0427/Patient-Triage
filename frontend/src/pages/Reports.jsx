import React, { useState, useEffect } from 'react';
import { systemApi } from '../services/api';
import TopNav from '../components/TopNav';
import SurgeBanner from '../components/SurgeBanner';
import {
  BarChart2, TrendingUp, Users, Clock, AlertTriangle,
  ChevronDown, CheckCircle2, ShieldCheck, Activity, RefreshCw, AlertCircle, FlaskConical
} from 'lucide-react';

export default function Reports() {
  const [dateRange, setDateRange] = useState('Last 7 Days');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [surgeMode, setSurgeMode] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, statsRes] = await Promise.all([
        systemApi.getReportsAnalytics(),
        systemApi.getStats(),
      ]);
      setData(res.data);
      setSurgeMode(statsRes.data?.surge_mode || false);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError("Failed to load analytics data from backend service. Please check API connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalPatients = data?.total_patients ?? 0;
  const esiDist = data?.esi_distribution || [
    { level: 1, label: 'ESI 1', count: 0, pct: 0, color: '#ef4444' },
    { level: 2, label: 'ESI 2', count: 0, pct: 0, color: '#f97316' },
    { level: 3, label: 'ESI 3', count: 0, pct: 0, color: '#eab308' },
    { level: 4, label: 'ESI 4', count: 0, pct: 0, color: '#22c55e' },
    { level: 5, label: 'ESI 5', count: 0, pct: 0, color: '#38bdf8' },
  ];

  const totalRecorded = data?.total_recorded_distribution ?? esiDist.reduce((acc, curr) => acc + (curr.count || 0), 0);

  // Dynamic Donut Chart calculation
  let accumulatedPercent = 0;
  const donutSegments = esiDist.map((item) => {
    const pct = totalRecorded > 0 ? (item.count / totalRecorded) * 100 : 0;
    const strokeDasharray = `${pct} ${100 - pct}`;
    const strokeDashoffset = -accumulatedPercent;
    accumulatedPercent += pct;
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      displayPct: item.pct || pct.toFixed(0),
    };
  });

  const topComplaints = data?.top_chief_complaints || [];
  const confidenceTrend = data?.confidence_trend || [];
  const alerts = data?.alerts_summary || {
    high_volume_alerts: 0,
    model_performance_alerts: 0,
    reassessment_alerts: 0,
  };

  // SVG Trend Line calculation for Model Confidence
  const renderTrendChart = () => {
    if (!confidenceTrend || confidenceTrend.length === 0) {
      return (
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No model confidence trend data recorded yet.
        </div>
      );
    }

    const width = 300;
    const height = 100;
    const padding = 20;

    const points = confidenceTrend.map((pt, i) => {
      const x = confidenceTrend.length === 1
        ? width / 2
        : padding + (i / (confidenceTrend.length - 1)) * (width - 2 * padding);
      // confidence_pct ranges from 0 to 100 -> map to SVG Y coordinate (inverted)
      const y = height - padding - ((pt.confidence_pct || 0) / 100) * (height - 2 * padding);
      return { x, y, ...pt };
    });

    const svgPointsString = points.map((p) => `${p.x},${p.y}`).join(' ');

    return (
      <div style={{ height: '180px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '0.5rem 0' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '130px', overflow: 'visible' }}>
          <line x1="0" y1="20" x2={width} y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1="0" y1="50" x2={width} y2="50" stroke="#f1f5f9" strokeDasharray="3 3" />
          <line x1="0" y1="80" x2={width} y2="80" stroke="#f1f5f9" strokeDasharray="3 3" />

          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              points={svgPointsString}
            />
          )}

          {points.map((pt, i) => (
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r="4" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
              <text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize="9" fill="#1e293b" fontWeight="600">
                {pt.confidence_pct}%
              </text>
            </g>
          ))}
        </svg>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-light)', borderTop: '1px solid #f1f5f9', paddingTop: '0.35rem' }}>
          {points.map((pt, i) => (
            <span key={i}>{pt.date}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <TopNav
        title="Reports & Analytics"
        subtitle="Prototype metrics from simulated data · clinical safety source of truth"
        surgeMode={surgeMode}
      />

      <div className="page-container">
        <SurgeBanner active={surgeMode} />

        {/* Error Banner when backend API fails */}
        {error && (
          <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
            <button onClick={fetchAnalytics} className="btn-white" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>
              Retry
            </button>
          </div>
        )}

        {/* Date Range Selector Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Institutional Decision Support &amp; Clinical Safety Source of Truth
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={fetchAnalytics} className="btn-white" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
              <RefreshCw size={13} className={loading ? 'pulse-alert' : ''} /> Refresh Data
            </button>
            <div className="dept-selector">
              <span style={{ fontSize: '0.82rem' }}>Date Range: <strong>{dateRange}</strong></span>
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* Prototype data disclaimer (requirement #12) */}
        <div className="info-callout" style={{ marginBottom: '1.25rem', background: '#f0f9ff', borderColor: '#bae6fd' }}>
          <FlaskConical size={16} style={{ color: '#0369a1', flexShrink: 0 }} />
          <span>
            <strong>Prototype / simulated metrics.</strong> All figures below are computed from
            simulated demonstration data using the prototype LightGBM model. They are <strong>not
            clinically validated</strong> and must not be used to infer real-world model accuracy,
            safety, or performance.
          </span>
        </div>

        {/* 4 KPI Metric Cards with truthful data */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="ui-card">
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>
              Total Registered Patients
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-title)' }}>
              {totalPatients}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, marginTop: '0.2rem' }}>
              Active in queue: {data?.active_queue_count ?? 0}
            </div>
          </div>

          {/* Truthful Metric: ESI 1 Cases (Replaces synthetic accuracy percentage) */}
          <div className="ui-card">
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>
              ESI 1 Critical Cases
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ef4444' }}>
              {data?.esi1_cases ?? 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600, marginTop: '0.2rem' }}>
              Immediate resuscitation level
            </div>
          </div>

          <div className="ui-card">
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>
              Avg Active Wait Time
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-title)' }}>
              {data?.avg_wait_minutes ?? 0} min
            </div>
            <div style={{ fontSize: '0.72rem', color: (data?.avg_wait_minutes || 0) > 30 ? '#ef4444' : '#16a34a', fontWeight: 600, marginTop: '0.2rem' }}>
              {(data?.avg_wait_minutes || 0) > 30 ? 'High wait duration' : 'Within clinical SLA'}
            </div>
          </div>

          <div className="ui-card">
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>
              Total Reassessments &amp; Overrides
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-title)' }}>
              {data?.reassessments_count ?? 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 600, marginTop: '0.2rem' }}>
              Logged clinical audit events
            </div>
          </div>
        </div>

        {/* 2-Column Chart Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Dynamic Donut Chart: Real ESI Distribution */}
          <div className="ui-card">
            <div className="ui-card-header">
              <h3 className="ui-card-title">ESI Acuity Distribution (Real Queue &amp; Visits)</h3>
            </div>

            {totalRecorded === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No patient visits recorded in database yet.
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '1rem 0' }}>
                <div className="donut-container" style={{ padding: 0 }}>
                  <div className="donut-circle" style={{ width: '150px', height: '150px' }}>
                    <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                      {/* Background track */}
                      <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="4.5" />

                      {/* Dynamic Segments */}
                      {donutSegments.map((seg, idx) => (
                        <circle
                          key={idx}
                          cx="18"
                          cy="18"
                          r="15.9155"
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="4.5"
                          strokeDasharray={seg.strokeDasharray}
                          strokeDashoffset={seg.strokeDashoffset}
                        />
                      ))}
                    </svg>
                    <div className="donut-inner-text">
                      <span className="donut-percentage" style={{ fontSize: '1.6rem' }}>
                        {totalRecorded}
                      </span>
                      <span className="donut-label">Total Visits</span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.82rem' }}>
                  {donutSegments.map((seg) => (
                    <div key={seg.level} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: seg.color }} />
                      <span style={{ color: 'var(--text-muted)', width: '45px' }}>{seg.label}</span>
                      <span style={{ fontWeight: 600 }}>{seg.count} ({seg.displayPct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Line Chart: Prototype Model Confidence Trend */}
          <div className="ui-card">
            <div className="ui-card-header">
              <h3 className="ui-card-title">Prototype Model Confidence Trend (Simulated)</h3>
            </div>

            {renderTrendChart()}
          </div>
        </div>

        {/* Bottom 2-Column Row: Real Top Chief Complaints + Real Alerts Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Top Chief Complaints from database */}
          <div className="ui-card">
            <div className="ui-card-header">
              <h3 className="ui-card-title">Top Chief Complaints (Real Influx)</h3>
            </div>

            {topComplaints.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No chief complaints logged in database yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {topComplaints.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', fontSize: '0.85rem' }}>
                    <span style={{ width: '150px', color: 'var(--text-body)', fontWeight: 500 }}>{c.name}</span>
                    <div style={{ flex: 1, height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: c.width, height: '100%', background: '#3b82f6', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: '60px', textAlign: 'right' }}>
                      {c.count} ({c.pct})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real Active Clinical Alerts Summary */}
          <div className="ui-card">
            <div className="ui-card-header">
              <h3 className="ui-card-title">Active Clinical Alerts Summary (Live DB)</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f0fdf4', borderRadius: 'var(--radius-md)', border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#15803d', fontWeight: 600 }}>
                  <CheckCircle2 size={16} />
                  <span>Surge &amp; High Volume Alarms</span>
                </div>
                <span style={{ fontWeight: 800, color: '#15803d' }}>{alerts.high_volume_alerts}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fefce8', borderRadius: 'var(--radius-md)', border: '1px solid #fef08a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#a16207', fontWeight: 600 }}>
                  <AlertTriangle size={16} />
                  <span>Model Performance &amp; Low Confidence Alarms</span>
                </div>
                <span style={{ fontWeight: 800, color: '#a16207' }}>{alerts.model_performance_alerts}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fff7ed', borderRadius: 'var(--radius-md)', border: '1px solid #fed7aa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#c2410c', fontWeight: 600 }}>
                  <Activity size={16} />
                  <span>Overdue Reassessment Alarms</span>
                </div>
                <span style={{ fontWeight: 800, color: '#c2410c' }}>{alerts.reassessment_alerts}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
