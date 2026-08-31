
import { useState, useEffect } from 'react';
import api from '../services/api';
import { Filter, Clock, AlertCircle } from 'lucide-react';

export default function Queue() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueue = async () => {
    try {
      const res = await api.get('/triage/queue');
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const formatWait = (sec) => {
    const min = Math.floor(sec / 60);
    return `${min} min`;
  };

  if (!data) return <div>Loading Queue...</div>;

  const filteredQueue = filter === 'ALL' 
    ? data.queue 
    : data.queue.filter(p => p.esi_level.toString() === filter);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Live Queue</h1>
          <p style={{color: 'var(--text-muted)'}}>Real-time patient waitlist and status</p>
        </div>
      </div>
      
      <div className="card" style={{padding: 0, overflow: 'hidden'}}>
        <div style={{padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{display: 'flex', gap: '0.5rem'}}>
            <button className={`btn ${filter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('ALL')} style={{minHeight: '32px', padding: '0.4rem 1rem'}}>All</button>
            <button className={`btn ${filter === '1' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('1')} style={{minHeight: '32px', padding: '0.4rem 1rem'}}>ESI 1</button>
            <button className={`btn ${filter === '2' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('2')} style={{minHeight: '32px', padding: '0.4rem 1rem'}}>ESI 2</button>
            <button className={`btn ${filter === '3' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('3')} style={{minHeight: '32px', padding: '0.4rem 1rem'}}>ESI 3</button>
          </div>
          <button className="btn btn-secondary" style={{minHeight: '32px', padding: '0.4rem 1rem'}}><Filter size={16}/> Filters</button>
        </div>
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Age</th>
                <th>ESI</th>
                <th>Wait Time</th>
                <th>Flags</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length === 0 && (
                <tr><td colSpan="6" style={{textAlign:'center', padding:'3rem', color:'var(--text-muted)'}}>No patients found in this category.</td></tr>
              )}
              {filteredQueue.map(p => (
                <tr key={p.queue_id} style={{background: p.retriage_needed ? '#fef2f2' : 'transparent'}}>
                  <td style={{fontWeight: 600, color: 'var(--brand-primary)'}}>{p.patient_name}</td>
                  <td>{p.patient_age}</td>
                  <td>
                    <div className={`esi-badge sm esi-${p.esi_level}`}>{p.esi_level}</div>
                  </td>
                  <td style={{fontWeight: 700, color: p.retriage_needed ? 'var(--danger)' : 'var(--text-main)'}}>
                    {formatWait(p.wait_time_seconds)}
                  </td>
                  <td>
                    <div style={{display:'flex', gap:'0.5rem'}}>
                      {p.alert === 'LOW_CONFIDENCE' && <span style={{background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:'12px', fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', gap:'4px'}}><AlertCircle size={12}/> AI Uncertain</span>}
                      {p.retriage_needed && <span style={{background:'#fee2e2', color:'#991b1b', padding:'2px 8px', borderRadius:'12px', fontSize:'0.75rem', fontWeight:600, display:'flex', alignItems:'center', gap:'4px'}}><Clock size={12}/> Retriage Required</span>}
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{padding:'0.4rem 1rem', fontSize:'0.85rem', minHeight:'32px'}}>View Record</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
