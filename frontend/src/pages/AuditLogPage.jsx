import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auditApi } from '../services/api';
import TopNav from '../components/TopNav';
import { Search, RefreshCw, Lock } from 'lucide-react';

const ACTION_BADGE = {
  ACCEPT: { cls: 'in-room', label: 'ACCEPT' },
  OVERRIDE: { cls: 'waiting', label: 'OVERRIDE' },
  VITAL_DRIFT_ALERT: { cls: 'discharged', label: 'DRIFT' },
  DISCHARGE: { cls: 'in-room', label: 'DISCHARGE' },
  BYPASS_CRITICAL: { cls: 'waiting', label: 'BYPASS' },
  AUTO_ESCALATE_SURGE: { cls: 'waiting', label: 'SURGE' },
  RETRIAGE: { cls: 'waiting', label: 'RETRIAGE' },
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    try {
      const res = await auditApi.getAllAuditLogs();
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.patient_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <TopNav
        title="Institutional Audit Log"
        subtitle="Immutable compliance trail for all triage predictions, clinician overrides, and drift alerts"
      />

      <div className="page-container">
        <div className="info-callout" style={{ marginBottom: '1.25rem' }}>
          <Lock size={16} style={{ color: 'var(--primary-blue)', flexShrink: 0 }} />
          <span>
            Immutable compliance trail. Every AI prediction, clinician acceptance, override, reassessment,
            vital-drift alert, surge escalation, and discharge is permanently recorded with clinician ID and timestamp.
            Restricted to authorized staff.
          </span>
        </div>

        <div className="ui-card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                type="text"
                className="input-clean"
                placeholder="Search audit trail by clinician, action, patient..."
                style={{ paddingLeft: '2.4rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button onClick={fetchLogs} className="btn-white" style={{ fontSize: '0.82rem' }}>
              <RefreshCw size={13} className={loading ? 'pulse-alert' : ''} /> Refresh Log
            </button>
          </div>
        </div>

        <div className="ui-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Action</th>
                  <th>Patient / Visit</th>
                  <th>Acuity Transition</th>
                  <th>Clinician / Actor</th>
                  <th>Clinical Justification</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No audit events logged yet.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)' }}>
                        #{log.id}
                      </td>
                      <td>
                        <span className={`status-pill ${ACTION_BADGE[log.action]?.cls || 'in-room'}`}>
                          {ACTION_BADGE[log.action]?.label || log.action}
                        </span>
                      </td>
                      <td>
                        <Link to={`/visit/${log.visit_id}`} style={{ fontWeight: 600, color: 'var(--primary-blue)', textDecoration: 'none' }}>
                          {log.patient_name || `Visit #${log.visit_id}`}
                        </Link>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {log.old_value && log.new_value ? `${log.old_value} → ${log.new_value}` : 'Logged'}
                      </td>
                      <td>{log.user_id}</td>
                      <td style={{ maxWidth: '280px', color: 'var(--text-muted)' }}>
                        {log.reason || 'Clinical workflow action'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
