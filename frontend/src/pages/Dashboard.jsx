
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Activity, Users, AlertTriangle, UserPlus, Clock } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const statsRes = await api.get('/stats');
      setStats(statsRes.data);
      const queueRes = await api.get('/triage/queue');
      setQueue(queueRes.data.queue.slice(0, 5)); // Just grab top 5 for dashboard
    } catch (err) {
      console.error(err);
    }
  };

  if (!stats) return <div>Loading ED Dashboard...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Triage Dashboard</h1>
          <p style={{color: 'var(--text-muted)'}}>Real-time overview of emergency department</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/triage')}>
          <UserPlus size={20} /> Add New Patient
        </button>
      </div>
      
      {stats.surge_mode && (
        <div className="alert alert-danger">
          <AlertTriangle size={24} />
          <div>
            <strong>SURGE MODE ACTIVE</strong>
            <div style={{fontSize: '0.9rem'}}>High patient volume detected. Wait time thresholds reduced by 50%.</div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid-3" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <div className="form-label" style={{color: 'var(--text-muted)', textTransform: 'uppercase'}}>Total Patients</div>
          <div style={{ fontSize: '3rem', fontWeight: '800' }}>{stats.total_active}</div>
          <div style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Currently in queue</div>
        </div>
        <div className="card">
          <div className="form-label" style={{color: 'var(--text-muted)', textTransform: 'uppercase'}}>Retriage Needed</div>
          <div style={{ fontSize: '3rem', fontWeight: '800', color: stats.retriage_needed > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
            {stats.retriage_needed}
          </div>
          <div style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Patients exceeding wait limits</div>
        </div>
        <div className="card">
          <div className="form-label" style={{color: 'var(--text-muted)', textTransform: 'uppercase'}}>AI Confidence Flags</div>
          <div style={{ fontSize: '3rem', fontWeight: '800', color: stats.low_confidence_active > 0 ? 'var(--warning)' : 'var(--text-main)' }}>
            {stats.low_confidence_active}
          </div>
          <div style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Low confidence requiring review</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid-2" style={{gridTemplateColumns: '2fr 1fr'}}>
        <div className="card" style={{padding: 0, overflow: 'hidden'}}>
          <div style={{padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2 style={{fontSize: '1.25rem', fontWeight: 700}}>Recent Activity</h2>
            <Link to="/queue" style={{color: 'var(--brand-primary)', textDecoration: 'none', fontWeight: 600}}>View All Queue &rarr;</Link>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Age</th>
                  <th>ESI</th>
                  <th>Wait Time</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 && (
                  <tr><td colSpan="4" style={{textAlign:'center', padding:'2rem', color:'var(--text-muted)'}}>No patients in queue</td></tr>
                )}
                {queue.map(p => (
                  <tr key={p.queue_id}>
                    <td style={{fontWeight: 600}}>{p.patient_name}</td>
                    <td>{p.patient_age}</td>
                    <td>
                      <div className={`esi-badge sm esi-${p.esi_level}`}>{p.esi_level}</div>
                    </td>
                    <td style={{display: 'flex', alignItems: 'center', gap: '0.5rem', color: p.retriage_needed ? 'var(--danger)' : 'inherit', fontWeight: p.retriage_needed ? 700 : 500}}>
                      <Clock size={16} /> {Math.floor(p.wait_time_seconds / 60)} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 style={{fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem'}}>Department Status</h2>
          
          <div style={{marginBottom: '1rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
              <span className="form-label">Available Beds</span>
              <span style={{fontWeight: 700}}>4 / 45</span>
            </div>
            <div style={{width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px'}}>
              <div style={{width: '91%', height: '100%', backgroundColor: 'var(--danger)', borderRadius: '4px'}}></div>
            </div>
          </div>
          
          <div style={{marginBottom: '1rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
              <span className="form-label">Staff On Duty</span>
              <span style={{fontWeight: 700}}>12 RNs, 3 MDs</span>
            </div>
          </div>
          
          <div className="alert alert-warning" style={{marginTop: '2rem'}}>
            <AlertTriangle size={20} />
            <div style={{fontSize: '0.9rem'}}>ED is currently experiencing high acuity volume. Prioritize ESI 1 and 2.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
