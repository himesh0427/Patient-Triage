import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Activity, Users, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/stats');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="page-title">ED Dashboard</h1>
      
      {stats.surge_mode && (
        <div className="alert-banner alert-danger">
          <AlertTriangle size={24} />
          <div>
            <strong>SURGE MODE ACTIVE</strong>
            <p>Wait time thresholds are halved. Auto-escalation enabled.</p>
          </div>
        </div>
      )}

      <div className="grid-3" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <h3 className="form-label">Active Patients</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{stats.total_active}</div>
        </div>
        <div className="card">
          <h3 className="form-label">Retriage Needed</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--danger)' }}>
            {stats.retriage_needed}
          </div>
        </div>
        <div className="card">
          <h3 className="form-label">Low Confidence Predictions</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>
            {stats.low_confidence_active}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link to="/triage" className="btn btn-primary">Start New Triage</Link>
          <Link to="/queue" className="btn btn-secondary">View Live Queue</Link>
        </div>
      </div>
    </div>
  );
}
