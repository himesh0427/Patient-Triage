import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Queue() {
  const [data, setData] = useState(null);

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

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
        <h1 className="page-title" style={{margin:0}}>Live Queue</h1>
        {data.hospital_type === 'RURAL' && <span className="badge badge-none">RURAL MODE</span>}
      </div>
      
      <div className="card table-container" style={{padding: 0}}>
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Age</th>
              <th>Urgency</th>
              <th>Wait Time</th>
              <th>Flags</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.queue.length === 0 && (
              <tr><td colSpan="6" style={{textAlign:'center', padding:'2rem', color:'var(--text-muted)'}}>Queue is empty</td></tr>
            )}
            {data.queue.map(p => (
              <tr key={p.queue_id}>
                <td style={{fontWeight:500}}>{p.patient_name}</td>
                <td>{p.patient_age}</td>
                <td>
                  {data.hospital_type === 'RURAL' ? (
                    <span className={`badge badge-esi-${p.rural_tier}`}>Tier {p.rural_tier}</span>
                  ) : (
                    <span className={`badge badge-esi-${p.esi_level}`}>ESI {p.esi_level}</span>
                  )}
                </td>
                <td>
                  <span style={{color: p.retriage_needed ? 'var(--danger)' : 'inherit', fontWeight: p.retriage_needed ? 600 : 400}}>
                    {formatWait(p.wait_time_seconds)}
                  </span>
                </td>
                <td>
                  <div style={{display:'flex', gap:'0.5rem'}}>
                    {p.alert === 'LOW_CONFIDENCE' && <span className="badge" style={{background:'var(--warning)', color:'#000'}}>Uncertain</span>}
                    {p.retriage_needed && <span className="badge pulse-alert" style={{background:'var(--danger)', color:'#fff'}}>Retriage</span>}
                    {p.is_overridden && <span className="badge badge-none">Overridden</span>}
                  </div>
                </td>
                <td>
                  <Link to={`/visit/${p.visit_id}`} className="btn btn-secondary" style={{padding:'0.4rem 0.8rem', fontSize:'0.85rem'}}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
